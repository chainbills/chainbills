// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Outbox processor
//
// Worker loop that claims pending Outbox rows and delivers them via
// MailProvider (SPEC.md §11.2). Registered only in WorkerModule.
//
// Claim strategy: SELECT ... FOR UPDATE SKIP LOCKED to avoid row contention
// between multiple instances (only one instance holds the advisory lock, but
// defensive design keeps the query safe even if that guarantee were broken).
//
// Delivery lifecycle per row:
//   PENDING -> SENDING   (claimed)
//   SENDING -> SENT      (delivered)
//   SENDING -> SKIPPED   (no user / no verified email / preference off)
//   SENDING -> PENDING   (delivery failed, attempts < 8, with backoff)
//   SENDING -> FAILED    (8th attempt failed)
//
// Backoff: 1 min * 2^attempts, capped at 1 h.
// Stuck-SENDING recovery: rows stuck in SENDING for > 10 min are returned to
// PENDING with lastError = 'recovered from stuck SENDING' (crash-safe).
//
// Re-resolution at send time: the wallet key -> user -> email lookup is always
// done at send time from the live DB, not from the snapshot in the Outbox row.
// This means a user who removes their email after a notification is queued will
// not receive it. This is the correct behaviour per SPEC §11.2.
// ──────────────────────────────────────────────────────────────────────────────

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Outbox, NotificationType } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { MAIL_PROVIDER, type MailProvider } from './mail/mail.provider';
import { buildUnsubscribeUrl } from './unsubscribe.utils';
import {
  payableCreatedTemplate,
  paymentReceivedTemplate,
  paymentReceiptTemplate,
  withdrawalCompletedTemplate,
} from './templates/notification.templates';

const BATCH_SIZE = 10;
const STUCK_THRESHOLD_MS = 10 * 60 * 1_000; // 10 min
const MAX_ATTEMPTS = 8;
const BACKOFF_CAP_MS = 60 * 60 * 1_000; // 1 h

/**
 * Computes the next-attempt delay with exponential backoff.
 * `1 min * 2^attempts`, capped at BACKOFF_CAP_MS.
 */
function backoffMs(attempts: number): number {
  return Math.min(60_000 * Math.pow(2, attempts), BACKOFF_CAP_MS);
}

/**
 * Processes the outbox: claims pending rows, resolves recipients, renders
 * templates, and sends via MailProvider. Registered as a worker-only service
 * and driven by WorkerModule's loop runner.
 */
/** Claims pending outbox rows and delivers them via MailProvider with exponential backoff and stuck-row recovery. */
@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider
  ) {}

  /**
   * One processing tick:
   *   1. Recover stuck SENDING rows (> 10 min).
   *   2. Claim up to BATCH_SIZE PENDING rows.
   *   3. Process each row.
   */
  async tick(): Promise<void> {
    await this.recoverStuck();
    const rows = await this.claimPending();
    for (const row of rows) {
      await this.processRow(row);
    }
  }

  /**
   * Returns rows stuck in SENDING for more than STUCK_THRESHOLD_MS to PENDING
   * so a process crash never leaves notifications permanently locked.
   */
  private async recoverStuck(): Promise<void> {
    const stuckBefore = new Date(Date.now() - STUCK_THRESHOLD_MS);
    const result = await this.prisma.outbox.updateMany({
      where: {
        status: 'SENDING',
        nextAttemptAt: { lte: stuckBefore },
      },
      data: {
        status: 'PENDING',
        lastError: 'recovered from stuck SENDING',
      },
    });
    if (result.count > 0) {
      this.logger.warn({ count: result.count }, 'recovered stuck SENDING rows');
    }
  }

  /**
   * Claims up to BATCH_SIZE rows atomically with FOR UPDATE SKIP LOCKED,
   * sets their status to SENDING, and returns them.
   */
  private async claimPending(): Promise<Outbox[]> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Outbox[]>`
        SELECT * FROM "outbox"
        WHERE status = 'PENDING'::"outbox_status"
          AND next_attempt_at <= ${now}
        ORDER BY next_attempt_at ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED`;

      if (rows.length === 0) return [];

      const ids = rows.map((r) => r.id);
      await tx.outbox.updateMany({
        where: { id: { in: ids } },
        data: { status: 'SENDING' },
      });

      return rows;
    });
  }

  /**
   * Processes a single outbox row: resolves the recipient, renders the
   * template, sends via MailProvider, and updates the row status.
   */
  private async processRow(row: Outbox): Promise<void> {
    // Re-resolve the recipient at send time.
    const wallet = await this.prisma.wallet.findUnique({
      where: { key: row.walletKey },
      select: {
        userId: true,
        user: {
          select: {
            email: true,
            emailVerifiedAt: true,
          },
        },
      },
    });

    if (!wallet) {
      await this.markSkipped(row.id, 'no Wallet row for recipientWalletKey');
      return;
    }

    if (!wallet.user.email || !wallet.user.emailVerifiedAt) {
      await this.markSkipped(row.id, 'user has no verified email');
      return;
    }

    // Check NotificationPreference (absent row = enabled per SPEC §7).
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId_type: { userId: wallet.userId, type: row.type } },
      select: { email: true },
    });
    if (preference !== null && !preference.email) {
      await this.markSkipped(row.id, 'notification type disabled by user preference');
      return;
    }

    // Render the template.
    const recipientEmail = wallet.user.email;
    const userId = wallet.userId;
    const unsubscribeUrl = buildUnsubscribeUrl(
      this.config.env.publicApiUrl,
      userId,
      row.type,
      this.config.env.unsubscribeSecret
    );

    let subject: string;
    let html: string;
    let text: string;

    try {
      ({ subject, html, text } = this.renderTemplate(row, unsubscribeUrl));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ outboxId: row.id, type: row.type, err }, 'template render failed');
      await this.markFailed(row, `template render error: ${message}`);
      return;
    }

    // Build List-Unsubscribe headers for RFC 8058 one-click support.
    const headers: Record<string, string> = {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };

    // Send via MailProvider.
    try {
      const { messageId } = await this.mail.send({
        to: recipientEmail,
        subject,
        html,
        text,
        headers,
      });

      await this.prisma.outbox.update({
        where: { id: row.id },
        data: {
          status: 'SENT',
          providerMessageId: messageId,
          sentAt: new Date(),
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn({ outboxId: row.id, type: row.type }, `mail send failed: ${message}`);
      await this.markFailed(row, message);
    }
  }

  /** Sets SKIPPED with the reason in lastError. */
  private async markSkipped(id: string, reason: string): Promise<void> {
    await this.prisma.outbox.update({
      where: { id },
      data: { status: 'SKIPPED', lastError: reason },
    });
  }

  /**
   * Increments attempts and either retries (with backoff) or marks FAILED
   * after MAX_ATTEMPTS.
   */
  private async markFailed(row: Outbox, error: string): Promise<void> {
    const newAttempts = row.attempts + 1;

    if (newAttempts >= MAX_ATTEMPTS) {
      await this.prisma.outbox.update({
        where: { id: row.id },
        data: { status: 'FAILED', attempts: newAttempts, lastError: error },
      });
      this.logger.error({ outboxId: row.id, type: row.type }, `outbox row failed after ${newAttempts} attempts`);
      return;
    }

    const nextAttemptAt = new Date(Date.now() + backoffMs(newAttempts));
    await this.prisma.outbox.update({
      where: { id: row.id },
      data: {
        status: 'PENDING',
        attempts: newAttempts,
        nextAttemptAt,
        lastError: error,
      },
    });
  }

  /**
   * Renders the notification template for the given outbox row.
   * Throws on unknown type or missing required payload fields.
   */
  private renderTemplate(row: Outbox, unsubscribeUrl: string): { subject: string; html: string; text: string } {
    const payload = row.payload as Record<string, unknown>;
    const appUrl = this.config.env.appUrl;
    const base = { unsubscribeUrl, appUrl };

    switch (row.type as NotificationType) {
      case 'PAYABLE_CREATED':
        return payableCreatedTemplate({
          ...base,
          payableId: payload.payableId as string,
          chainId: payload.chainId as string,
        });

      case 'PAYMENT_RECEIVED':
        return paymentReceivedTemplate({
          ...base,
          paymentId: payload.paymentId as string,
          payableId: payload.payableId as string,
          token: payload.token as string,
          amount: payload.amount as string,
          symbol: (payload.symbol as string) ?? 'TOKEN',
          decimals: (payload.decimals as number) ?? 0,
          payerChainId: payload.payerChainId as string,
        });

      case 'PAYMENT_RECEIPT':
        return paymentReceiptTemplate({
          ...base,
          paymentId: payload.paymentId as string,
          payableId: payload.payableId as string,
          payableChainId: payload.payableChainId as string,
          token: payload.token as string,
          amount: payload.amount as string,
          symbol: (payload.symbol as string) ?? 'TOKEN',
          decimals: (payload.decimals as number) ?? 0,
        });

      case 'WITHDRAWAL_COMPLETED':
        return withdrawalCompletedTemplate({
          ...base,
          withdrawalId: payload.withdrawalId as string,
          payableId: payload.payableId as string,
          token: payload.token as string,
          amount: payload.amount as string,
          symbol: (payload.symbol as string) ?? 'TOKEN',
          decimals: (payload.decimals as number) ?? 0,
        });

      default:
        throw new Error(`unknown notification type: ${row.type}`);
    }
  }
}
