// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Nonce service
//
// Generates, stores and validates single-use sign-in nonces (AuthNonce rows).
// Nonces expire after NONCE_TTL_MS and are guaranteed single-use: the first
// successful verify call sets usedAt; all later calls for the same nonce fail.
//
// Opportunistic cleanup: each generateNonce() call deletes rows that expired
// more than 1 hour ago, keeping the table small without a dedicated cron job.
// ──────────────────────────────────────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import bs58 from 'bs58';
import { PrismaService } from '../prisma/prisma.service';

/** Nonce expiry: 5 minutes (SPEC.md §9.1). */
const NONCE_TTL_MS = 5 * 60 * 1_000;

/** Rows expired more than this long ago are deleted on each nonce issue. */
const CLEANUP_AGE_MS = 60 * 60 * 1_000;

/** Number of random bytes to generate per nonce (≥16 per SPEC.md §9.1). */
const NONCE_BYTES = 16;

/** Generates and validates single-use sign-in nonces (SPEC.md §9.1). */
@Injectable()
export class NonceService {
  private readonly logger = new Logger(NonceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a fresh single-use nonce, stores it in `AuthNonce` with a
   * 5-minute expiry, and opportunistically deletes stale rows.
   *
   * The nonce is 16 random bytes encoded as base58, which satisfies SIWE's
   * "≥ 8 alphanumeric chars" requirement (base58 output is alphanumeric and
   * 16 bytes produce ~22 characters).
   */
  async generateNonce(): Promise<{ nonce: string; expiresAt: Date }> {
    // Opportunistic cleanup — fire and forget; failures are logged but never
    // propagate to the caller.
    this.cleanupExpired().catch((err: unknown) => {
      this.logger.warn({ err }, 'nonce cleanup failed');
    });

    const nonce = bs58.encode(randomBytes(NONCE_BYTES));
    const expiresAt = new Date(Date.now() + NONCE_TTL_MS);

    await this.prisma.authNonce.create({ data: { nonce, expiresAt } });
    return { nonce, expiresAt };
  }

  /**
   * Retrieves the AuthNonce row for `nonce`. Returns null when not found.
   * Callers must separately check `usedAt` and `expiresAt`.
   */
  async findNonce(nonce: string) {
    return this.prisma.authNonce.findUnique({ where: { nonce } });
  }

  /**
   * Marks `nonce` as used inside an ongoing Prisma transaction. The caller
   * must pass a Prisma transaction client (`tx`) so this write is atomic with
   * the Session + Wallet upserts in AuthService.verify().
   */
  async markUsed(tx: PrismaService, nonce: string): Promise<void> {
    await tx.authNonce.update({
      where: { nonce },
      data: { usedAt: new Date() },
    });
  }

  /**
   * Deletes AuthNonce rows whose `expiresAt` is older than CLEANUP_AGE_MS.
   * Called opportunistically on each nonce issue; failures are non-fatal.
   */
  private async cleanupExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - CLEANUP_AGE_MS);
    const { count } = await this.prisma.authNonce.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    if (count > 0) {
      this.logger.debug({ count }, 'cleaned up expired nonces');
    }
  }
}
