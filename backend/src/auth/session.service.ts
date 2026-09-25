// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Session service
//
// Creates, rotates and revokes refresh-token sessions. Each session stores
// sha256(refreshToken) — never the raw token — so a DB compromise does not
// expose tokens that can still be used.
//
// Refresh-token rotation: every /auth/refresh call issues a new token and
// updates the stored hash. If an already-rotated token is presented, the
// entire session is revoked immediately (theft detection: if a rotated token
// is still in the wild, someone stole the old one — SPEC.md §9.1 step 4).
//
// Invariants:
//   - refresh tokens are 32 random bytes encoded as base64url.
//   - sha256 is computed with Node's built-in `crypto` module (no third-party).
//   - constant-time comparison is NOT needed when comparing token hashes stored
//     in the DB because the lookup is keyed by the hash itself; an attacker
//     cannot enumerate hashes in polynomial time.
// ──────────────────────────────────────────────────────────────────────────────

import { createHash, randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';

/** A freshly issued refresh token alongside its hash for storage. */
export interface RefreshTokenPair {
  /** Raw token to set in the cookie — never stored in the DB. */
  refreshToken: string;
  /** sha256(refreshToken) — stored in Session.refreshTokenHash. */
  refreshTokenHash: string;
}

/** Creates, rotates, and revokes refresh-token sessions with theft detection (SPEC.md §9.1). */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService
  ) {}

  /**
   * Generates a secure refresh token and returns both the raw value (for the
   * cookie) and its sha256 hash (for storage in Session.refreshTokenHash).
   */
  generateRefreshToken(): RefreshTokenPair {
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshTokenHash = this.hash(refreshToken);
    return { refreshToken, refreshTokenHash };
  }

  /**
   * Creates a new Session row inside the supplied Prisma transaction.
   * Called from AuthService.verify() where the transaction also marks the
   * nonce used and upserts the Wallet.
   */
  async createSession(
    tx: PrismaService,
    opts: {
      userId: string;
      walletKey: string;
      refreshTokenHash: string;
      userAgent?: string;
      ip?: string;
    }
  ) {
    const expiresAt = new Date(Date.now() + this.config.env.refreshTokenTtlMs);
    return tx.session.create({
      data: {
        userId: opts.userId,
        walletKey: opts.walletKey,
        refreshTokenHash: opts.refreshTokenHash,
        expiresAt,
        userAgent: opts.userAgent,
        ip: opts.ip,
      },
    });
  }

  /**
   * Finds a session by the hash of the raw refresh token.
   * Returns null when no session matches (token unknown or already rotated away).
   */
  async findByRefreshTokenHash(hash: string) {
    return this.prisma.session.findUnique({ where: { refreshTokenHash: hash } });
  }

  /**
   * Rotates the refresh token for a valid session: issues a new token, updates
   * the stored hash, and bumps `lastUsedAt` + `expiresAt`.
   *
   * Returns the new raw refresh token so the caller can set the updated cookie.
   */
  async rotateRefreshToken(sessionId: string): Promise<string> {
    const { refreshToken, refreshTokenHash } = this.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.config.env.refreshTokenTtlMs);
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { refreshTokenHash, expiresAt, lastUsedAt: new Date() },
    });
    return refreshToken;
  }

  /**
   * Revokes a single session by setting `revokedAt = now()`.
   * Used by /auth/logout.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revokes ALL sessions for `userId` by setting `revokedAt = now()`.
   * Used by /auth/logout-all and reuse-detection in /auth/refresh.
   */
  async revokeAllSessions(userId: string): Promise<void> {
    const { count } = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.log({ userId, count }, 'revoked all sessions for user');
  }

  /**
   * Checks if a session is currently valid: not revoked and not expired.
   */
  isSessionValid(session: { revokedAt: Date | null; expiresAt: Date }): boolean {
    const now = new Date();
    return session.revokedAt === null && session.expiresAt > now;
  }

  /** sha256 of a string, returned as a hex string. */
  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
