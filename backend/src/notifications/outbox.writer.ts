// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Outbox writer
//
// A plain function (not a NestJS service class) that can be called inside an
// existing Prisma transaction. Inserts one Outbox row per call — used by the
// EVM indexer whenever an activity maps to an email notification (SPEC §11.1).
//
// Invariants:
//   - Called only inside a prisma.$transaction; never commits on its own.
//   - Skips silently when the event timestamp is older than maxEventAgeMs.
//   - Skips when no Wallet row exists for recipientWalletKey whose User has an
//     emailVerifiedAt (i.e. a verified email).
//   - The dedupeKey "<TYPE>:<entityId>:<walletKey>" guards against duplicates
//     when an activity is reprocessed (the insert is a no-op on conflict).
// ──────────────────────────────────────────────────────────────────────────────

import { Prisma, type NotificationType } from '@prisma/client';

/** A Prisma client scoped to an active transaction (the parameter type passed by $transaction). */
export type PrismaTransactionClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Enqueues one `Outbox` row inside an active Prisma transaction.
 *
 * @param tx                  The transaction-scoped Prisma client.
 * @param type                Which notification template this triggers.
 * @param entityId            The primary entity id (payable id, payment id, etc.).
 * @param recipientWalletKey  "evm:0x…" or "solana:…" of the intended recipient.
 * @param eventTimestamp      The on-chain event time; used for the age check.
 * @param payload             Template-specific data (ids, amounts as strings, chain ids).
 * @param maxEventAgeMs       Events older than this are silently skipped.
 */
export async function enqueueOutbox(
  tx: PrismaTransactionClient,
  type: NotificationType,
  entityId: string,
  recipientWalletKey: string,
  eventTimestamp: Date,
  payload: Record<string, unknown>,
  maxEventAgeMs: number
): Promise<void> {
  // Age gate: on-chain events older than maxEventAgeMs never produce emails.
  if (Date.now() - eventTimestamp.getTime() > maxEventAgeMs) {
    return;
  }

  // Recipient gate: the wallet must exist and its user must have a verified email.
  const wallet = await tx.wallet.findUnique({
    where: { key: recipientWalletKey },
    select: { user: { select: { emailVerifiedAt: true } } },
  });
  if (!wallet || !wallet.user.emailVerifiedAt) {
    return;
  }

  const dedupeKey = `${type}:${entityId}:${recipientWalletKey}`;

  // Conflict-ignore: reprocessing an activity never creates a duplicate outbox row.
  await tx.outbox.upsert({
    where: { dedupeKey },
    create: {
      dedupeKey,
      type,
      walletKey: recipientWalletKey,
      payload: payload as Prisma.InputJsonValue,
    },
    // On conflict, leave the existing row untouched.
    update: {},
  });
}
