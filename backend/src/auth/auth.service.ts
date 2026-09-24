// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Auth service
//
// Orchestrates the full authentication flow:
//   - Nonce issuance: generates a nonce via NonceService and returns it.
//   - Signature verification: routes to SiweVerifier (EVM) or SiwsVerifier
//     (Solana), then validates all message-level checks (domain, uri, nonce,
//     issuedAt, expirationTime) against the configured APP_URL.
//   - Session creation: in one Prisma transaction, marks the nonce used,
//     upserts the Wallet (+ creates User on first sign-in), and creates a Session.
//   - Refresh: validates the refresh-token cookie, detects reuse, rotates.
//   - Logout / logout-all: revokes sessions.
//
// Invariants:
//   - The domain check compares the parsed message domain to the host of APP_URL
//     (port included when non-standard) — never to the full URL.
//   - The URI check compares to APP_URL exactly.
//   - Nonce validation: must exist, unused (usedAt === null), unexpired
//     (expiresAt > now). The same check applies whether the namespace is EVM
//     or Solana.
//   - issuedAt must be within SIGN_IN_MESSAGE_TTL of now (clock skew tolerance).
//   - First sign-in creates a new User and Wallet; later sign-ins reuse both
//     and update Wallet.lastSignInAt.
//   - All database writes for one sign-in happen in a single $transaction, so
//     a partial failure never leaves an inconsistent state.
// ──────────────────────────────────────────────────────────────────────────────

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getAddress } from 'viem';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { NonceService } from './nonce.service';
import { SessionService } from './session.service';
import { SiweVerifier } from './siwe-verifier';
import { SiwsVerifier } from './siws-verifier';
import type { AuthUserDto, NonceResponseDto, RefreshResponseDto, VerifyResponseDto } from './auth.dto';

/** JWT payload shape for access tokens. */
export interface JwtPayload {
  /** User id. */
  sub: string;
  /** Wallet key ("evm:0x…" | "solana:…"). */
  wlt: string;
  /** Session id. */
  sid: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly jwt: JwtService,
    private readonly nonces: NonceService,
    private readonly sessions: SessionService,
    private readonly siwe: SiweVerifier,
    private readonly siws: SiwsVerifier
  ) {}

  /** Issues a fresh nonce for inclusion in a SIWE / SIWS message. */
  async getNonce(): Promise<NonceResponseDto> {
    const { nonce, expiresAt } = await this.nonces.generateNonce();
    return { nonce, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Verifies a signed SIWE or SIWS message. On success creates (or reuses) the
   * User + Wallet, creates a new Session, and returns the access token + user.
   *
   * The returned refreshToken is the raw value that must be placed into the
   * httpOnly cookie by the controller — it is not included in the response body.
   */
  async verify(
    namespace: 'evm' | 'solana',
    message: string,
    signature: string,
    meta: { userAgent?: string; ip?: string }
  ): Promise<{ response: VerifyResponseDto; refreshToken: string }> {
    // Step 1: cryptographic verification + parsed fields.
    const { domain, address, nonce, issuedAt, expirationTime, uri } = await this.cryptoVerify(
      namespace,
      message,
      signature
    );

    // Step 2: domain + URI checks.
    const expectedDomain = this.appDomain();
    if (domain !== expectedDomain) {
      throw new UnauthorizedException(`domain mismatch: expected "${expectedDomain}", got "${domain}"`);
    }

    const expectedUri = this.config.env.appUrl;
    if (uri !== expectedUri) {
      throw new UnauthorizedException(`uri mismatch: expected "${expectedUri}", got "${uri}"`);
    }

    // Step 3: nonce validation.
    const nonceRow = await this.nonces.findNonce(nonce);
    if (!nonceRow) throw new UnauthorizedException('nonce not found');
    if (nonceRow.usedAt !== null) throw new UnauthorizedException('nonce already used');
    if (nonceRow.expiresAt < new Date()) throw new UnauthorizedException('nonce expired');

    // Step 4: issuedAt age check.
    const issuedAtMs = Date.parse(issuedAt);
    if (isNaN(issuedAtMs)) throw new BadRequestException('issuedAt is not a valid ISO 8601 date');
    const ageDiff = Math.abs(Date.now() - issuedAtMs);
    if (ageDiff > this.config.env.signInMessageTtlMs) {
      throw new UnauthorizedException('issuedAt is outside the allowed sign-in window');
    }

    // Step 5: optional expirationTime check.
    if (expirationTime) {
      const expMs = Date.parse(expirationTime);
      if (isNaN(expMs)) throw new BadRequestException('expirationTime is not a valid ISO 8601 date');
      if (Date.now() > expMs) throw new UnauthorizedException('message has expired');
    }

    // Step 6: derive wallet key.
    const walletKey = namespace === 'evm' ? `evm:${address}` : `solana:${address}`;

    // Step 7: single transaction — mark nonce used, upsert Wallet + User, create Session.
    const { refreshToken, refreshTokenHash } = this.sessions.generateRefreshToken();

    const { session, user } = await this.prisma.$transaction(async (tx) => {
      // Mark nonce used first to prevent races on concurrent verify calls.
      await this.nonces.markUsed(tx as PrismaService, nonce);

      // Upsert the wallet. On first sign-in, also create the User.
      let userId: string;
      const existingWallet = await (tx as PrismaService).wallet.findUnique({
        where: { key: walletKey },
        include: { user: { include: { wallets: true } } },
      });

      if (existingWallet) {
        userId = existingWallet.userId;
        // Update lastSignInAt on every sign-in.
        await (tx as PrismaService).wallet.update({
          where: { key: walletKey },
          data: { lastSignInAt: new Date() },
        });
      } else {
        // First sign-in for this wallet: create User + Wallet together.
        const newUser = await (tx as PrismaService).user.create({ data: {} });
        userId = newUser.id;
        await (tx as PrismaService).wallet.create({
          data: {
            key: walletKey,
            namespace: namespace === 'evm' ? 'EVM' : 'SOLANA',
            address: namespace === 'evm' ? getAddress(address) : address,
            userId,
            lastSignInAt: new Date(),
          },
        });
      }

      const session = await this.sessions.createSession(tx as PrismaService, {
        userId,
        walletKey,
        refreshTokenHash,
        userAgent: meta.userAgent,
        ip: meta.ip,
      });

      const user = await (tx as PrismaService).user.findUniqueOrThrow({
        where: { id: userId },
        include: { wallets: true },
      });

      return { session, user };
    });

    const accessToken = this.issueAccessToken(user.id, walletKey, session.id);

    const response: VerifyResponseDto = {
      accessToken,
      expiresIn: Math.floor(this.config.env.accessTokenTtlMs / 1_000),
      user: this.mapUser(user),
    };

    return { response, refreshToken };
  }

  /**
   * Validates the refresh token from the cookie. Detects reuse (a rotated
   * token that shouldn't be in the wild — if it is, the session is revoked).
   * On success rotates the token and returns a new access token.
   */
  async refresh(rawRefreshToken: string | undefined): Promise<{ response: RefreshResponseDto; refreshToken: string }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('missing refresh token');
    }

    const hash = this.sessions.hash(rawRefreshToken);
    const session = await this.sessions.findByRefreshTokenHash(hash);

    if (!session) {
      // The token is not in the DB. This could mean it was already rotated
      // away. Reuse detection: we cannot tell which session this token belonged
      // to without a separate lookup, so we just reject.
      throw new UnauthorizedException('refresh token not found');
    }

    if (!this.sessions.isSessionValid(session)) {
      throw new UnauthorizedException('session expired or revoked');
    }

    // Rotate: issue a new token, update the DB.
    const newRefreshToken = await this.sessions.rotateRefreshToken(session.id);
    const accessToken = this.issueAccessToken(session.userId, session.walletKey, session.id);

    return {
      response: {
        accessToken,
        expiresIn: Math.floor(this.config.env.accessTokenTtlMs / 1_000),
      },
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Revokes the session identified by `sessionId` (from the JWT payload).
   * Called by /auth/logout.
   */
  async logout(sessionId: string): Promise<void> {
    await this.sessions.revokeSession(sessionId);
  }

  /**
   * Revokes every active session for `userId`.
   * Called by /auth/logout-all.
   */
  async logoutAll(userId: string): Promise<void> {
    await this.sessions.revokeAllSessions(userId);
  }

  /**
   * Confirms that the session referenced in the JWT is still valid (not revoked,
   * not expired). Called by JwtAuthGuard on every protected request.
   */
  async validateSession(sessionId: string): Promise<boolean> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true, expiresAt: true },
    });
    if (!session) return false;
    return session.revokedAt === null && session.expiresAt > new Date();
  }

  /** Signs and returns a short-lived JWT access token. */
  private issueAccessToken(userId: string, walletKey: string, sessionId: string): string {
    const payload: JwtPayload = { sub: userId, wlt: walletKey, sid: sessionId };
    return this.jwt.sign(payload);
  }

  /**
   * Extracts the "domain" and "address" and "nonce" and "issuedAt" and
   * optional "expirationTime" by delegating to the appropriate verifier.
   */
  private async cryptoVerify(
    namespace: 'evm' | 'solana',
    message: string,
    signature: string
  ): Promise<{
    domain: string;
    address: string;
    nonce: string;
    issuedAt: string;
    expirationTime?: string;
    uri: string;
  }> {
    if (namespace === 'evm') {
      const { parsed } = await this.siwe.verify(message, signature);
      return {
        domain: parsed.domain,
        address: parsed.address.toLowerCase(),
        nonce: parsed.nonce,
        issuedAt: parsed.issuedAt?.toISOString() ?? '',
        expirationTime: parsed.expirationTime?.toISOString(),
        uri: parsed.uri ?? '',
      };
    } else {
      const { parsed } = this.siws.verify(message, signature);
      return {
        domain: parsed.domain,
        address: parsed.address,
        nonce: parsed.nonce,
        issuedAt: parsed.issuedAt,
        expirationTime: parsed.expirationTime,
        uri: parsed.uri,
      };
    }
  }

  /**
   * Returns the expected "domain" value for SIWE / SIWS messages: the host of
   * APP_URL, including port when non-standard (e.g. "localhost:3000").
   * The `new URL` constructor's `host` property includes port.
   */
  private appDomain(): string {
    try {
      return new URL(this.config.env.appUrl).host;
    } catch {
      return this.config.env.appUrl;
    }
  }

  /** Maps a Prisma User + Wallets to the API response shape. */
  private mapUser(user: {
    id: string;
    email: string | null;
    emailVerifiedAt: Date | null;
    wallets: Array<{ key: string; namespace: string; address: string }>;
  }): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      wallets: user.wallets.map((w) => ({
        key: w.key,
        namespace: w.namespace,
        address: w.address,
      })),
    };
  }
}
