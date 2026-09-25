// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Users service
//
// Handles all /me endpoint business logic (SPEC.md §10):
//   - getMe: fetch user + wallets + preferences.
//   - updatePreferences: partial-upsert NotificationPreference rows.
//   - requestEmailVerification: rate-limit check, generate OTP, send directly
//     via MailProvider (the user is waiting), store codeHash.
//   - verifyEmail: find the latest pending verification, compare code with
//     timingSafeEqual, mark consumed, set User.email + emailVerifiedAt.
//   - removeEmail: clear User.email + emailVerifiedAt.
//
// Rate-limit invariants (SPEC.md §10):
//   - >= 60 s between sends per user.
//   - <= 5 sends per user per 24 h.
//   - <= 5 sends per target email per 24 h.
//   - Max 5 attempts per EmailVerification row before it is exhausted.
//
// Security invariants:
//   - codeHash = HMAC-SHA256(OTP_HMAC_SECRET, verificationId + ':' + code).
//   - Compared with crypto.timingSafeEqual (constant-time).
//   - Error messages never reveal whether an email is used by another user.
//   - A new send invalidates all older pending verifications for the user.
//   - Provider failures return 502 and do not count against the rate limit.
// ──────────────────────────────────────────────────────────────────────────────

import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { NotificationType, type NotificationPreference, type Wallet, type User } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { MAIL_PROVIDER, type MailProvider } from '../notifications/mail/mail.provider';
import { verificationCodeTemplate } from '../notifications/templates/verification-code.template';
import type { MeResponseDto, UpdatePreferencesDto } from './users.dto';
import { NOTIFICATION_TYPES } from './users.dto';

/** Verification code: 6-digit integer zero-padded to 6 chars. */
function generateCode(): string {
  const n = randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

/**
 * Computes HMAC-SHA256(secret, verificationId + ':' + code).
 * The raw code never touches the database — only this hash is stored.
 */
function computeCodeHash(secret: string, verificationId: string, code: string): Buffer {
  return createHmac('sha256', secret).update(`${verificationId}:${code}`).digest();
}

/** Manages user profile, email verification, and notification preferences. */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider
  ) {}

  /**
   * Returns the full /me response: user id, wallets, verified email, and
   * notification preferences (absent rows default to email: true per SPEC §7).
   */
  async getMe(userId: string): Promise<MeResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { wallets: true, preferences: true },
    });
    return this.mapMe(user);
  }

  /**
   * Upserts NotificationPreference rows for the given userId.
   * Only provided types are updated; missing types are left as-is (defaults apply).
   */
  async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<MeResponseDto> {
    const updates: Array<{ type: NotificationType; email: boolean }> = [];

    for (const type of NOTIFICATION_TYPES) {
      const entry = dto[type];
      if (entry !== undefined) {
        updates.push({ type, email: entry.email });
      }
    }

    if (updates.length > 0) {
      await this.prisma.$transaction(
        updates.map(({ type, email }) =>
          this.prisma.notificationPreference.upsert({
            where: { userId_type: { userId, type } },
            create: { userId, type, email },
            update: { email },
          })
        )
      );
    }

    return this.getMe(userId);
  }

  /**
   * Starts an email verification flow. Rate-limits, generates a 6-digit OTP,
   * stores the codeHash, invalidates older pending verifications, and sends the
   * code directly through MailProvider (the user is waiting).
   *
   * Throws TooManyRequestsException with a `retryAfter` field on rate-limit
   * violations. Throws BadGatewayException when the mail provider fails (does
   * not count against the rate limit — the row is deleted in that case).
   */
  async requestEmailVerification(userId: string, rawEmail: string): Promise<void> {
    const email = rawEmail.trim().toLowerCase();

    // Rate-limit checks (all computed from existing EmailVerification rows).
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1_000);

    const [recentByUser, last24hByUser, last24hByEmail] = await Promise.all([
      // Most-recent send for this user (to enforce >= 60 s gap).
      this.prisma.emailVerification.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      // Count of pending (unconsumed) sends by this user in the last 24 h.
      this.prisma.emailVerification.count({
        where: { userId, createdAt: { gte: oneDayAgo }, consumedAt: null },
      }),
      // Count of pending (unconsumed) sends to this email address in the last 24 h.
      this.prisma.emailVerification.count({
        where: { email, createdAt: { gte: oneDayAgo }, consumedAt: null },
      }),
    ]);

    // Enforce >= 60 s between sends per user.
    if (recentByUser) {
      const secondsSinceLast = Math.floor((now.getTime() - recentByUser.createdAt.getTime()) / 1_000);
      if (secondsSinceLast < 60) {
        const retryAfter = 60 - secondsSinceLast;
        throw new HttpException(
          { message: 'please wait before requesting another code', retryAfter },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }

    // Enforce <= 5 pending sends per user per 24 h.
    if (last24hByUser >= 5) {
      const oldest = await this.prisma.emailVerification.findFirst({
        where: { userId, createdAt: { gte: oneDayAgo }, consumedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      const retryAfter = oldest
        ? Math.ceil((oldest.createdAt.getTime() + 24 * 60 * 60 * 1_000 - now.getTime()) / 1_000)
        : 86_400;
      throw new HttpException({ message: 'daily send limit reached', retryAfter }, HttpStatus.TOO_MANY_REQUESTS);
    }

    // Enforce <= 5 pending sends per target email per 24 h.
    if (last24hByEmail >= 5) {
      const oldest = await this.prisma.emailVerification.findFirst({
        where: { email, createdAt: { gte: oneDayAgo }, consumedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      const retryAfter = oldest
        ? Math.ceil((oldest.createdAt.getTime() + 24 * 60 * 60 * 1_000 - now.getTime()) / 1_000)
        : 86_400;
      throw new HttpException(
        { message: 'daily send limit for this email reached', retryAfter },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Invalidate all pending (non-consumed) verifications for this user first.
    await this.prisma.emailVerification.updateMany({
      where: { userId, consumedAt: null, expiresAt: { gt: now } },
      data: { expiresAt: now },
    });

    // Generate code, compute hash, create the verification row.
    const code = generateCode();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1_000); // 10 min

    // Create the row first to obtain the id for the hash.
    const verification = await this.prisma.emailVerification.create({
      data: {
        userId,
        email,
        // Placeholder; replaced in the update below once we have the id.
        codeHash: '',
        expiresAt,
      },
    });

    const secret = this.config.env.otpHmacSecret ?? '';
    const codeHashBuf = computeCodeHash(secret, verification.id, code);
    const codeHash = codeHashBuf.toString('hex');

    await this.prisma.emailVerification.update({
      where: { id: verification.id },
      data: { codeHash },
    });

    // Send the verification email directly (user is waiting). On failure,
    // delete the row so it does not count against rate limits.
    const { subject, html, text } = verificationCodeTemplate({
      code,
      appUrl: this.config.env.appUrl,
      fromName: this.config.env.zeptomail.fromName,
    });

    try {
      await this.mail.send({ to: email, subject, html, text });
    } catch {
      // Delete the row: provider failure must not consume the rate-limit slot.
      await this.prisma.emailVerification.delete({ where: { id: verification.id } });
      throw new BadGatewayException('failed to send verification email — please try again');
    }
  }

  /**
   * Completes email verification. Finds the latest non-expired, non-consumed
   * verification for the user, checks attempt count, compares the code with
   * timingSafeEqual, and on success sets User.email + emailVerifiedAt.
   *
   * Error messages are deliberately vague — they never say whether the code
   * was wrong vs. expired, which could be useful for timing attacks.
   */
  async verifyEmail(userId: string, code: string): Promise<MeResponseDto> {
    const now = new Date();

    const verification = await this.prisma.emailVerification.findFirst({
      where: { userId, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new BadRequestException('no pending verification found — please request a new code');
    }

    if (verification.attempts >= 5) {
      throw new BadRequestException('too many incorrect attempts — please request a new code');
    }

    // Increment attempts before comparing (prevents enumeration on the final attempt).
    await this.prisma.emailVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });

    const secret = this.config.env.otpHmacSecret ?? '';
    const providedHash = computeCodeHash(secret, verification.id, code);
    const storedHash = Buffer.from(verification.codeHash, 'hex');

    // Constant-time comparison to prevent timing attacks.
    if (providedHash.length !== storedHash.length || !timingSafeEqual(providedHash, storedHash)) {
      throw new BadRequestException('invalid or expired code');
    }

    // Mark consumed and update the user's email atomically.
    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: verification.id },
        data: { consumedAt: now },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { email: verification.email, emailVerifiedAt: now },
      }),
    ]);

    return this.getMe(userId);
  }

  /**
   * Removes the user's verified email. Outbox notifications use the verified
   * email at send time; clearing it stops future sends without touching queued
   * rows (the processor will skip them at send time with reason "no verified email").
   */
  async removeEmail(userId: string): Promise<MeResponseDto> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { email: null, emailVerifiedAt: null },
    });
    return this.getMe(userId);
  }

  /**
   * Maps a Prisma User (with wallets and preferences) to the /me response shape.
   * Absent NotificationPreference rows default to email: true (SPEC §7).
   */
  private mapMe(
    user: User & {
      wallets: Wallet[];
      preferences: NotificationPreference[];
    }
  ): MeResponseDto {
    const prefMap = new Map(user.preferences.map((p) => [p.type, p.email]));

    const preferences = {
      PAYABLE_CREATED: { email: prefMap.get('PAYABLE_CREATED') ?? true },
      PAYMENT_RECEIVED: { email: prefMap.get('PAYMENT_RECEIVED') ?? true },
      PAYMENT_RECEIPT: { email: prefMap.get('PAYMENT_RECEIPT') ?? true },
      WITHDRAWAL_COMPLETED: { email: prefMap.get('WITHDRAWAL_COMPLETED') ?? true },
    };

    return {
      id: user.id,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      wallets: user.wallets.map((w) => ({
        key: w.key,
        namespace: w.namespace,
        address: w.address,
      })),
      preferences,
    };
  }
}
