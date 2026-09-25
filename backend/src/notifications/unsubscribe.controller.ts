// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Unsubscribe controller
//
// Handles one-click email unsubscribe (RFC 8058) (SPEC.md §11.5).
//
// GET  /email/unsubscribe?u=<userId>&t=<type>&s=<sig>
//   Validates the HMAC signature; on success returns a minimal HTML page with a
//   single POST button. Invalid signature -> 400 (no leak of userId/type existence).
//
// POST /email/unsubscribe?u=<userId>&t=<type>&s=<sig>
//   Validates the signature; on success sets the NotificationPreference row
//   email=false (upserts if absent); returns 200.
//
// Public route (no JWT required). Throttled at 20 req/min per IP.
// Signature check: verifyUnsubscribeSig() uses timingSafeEqual.
// ──────────────────────────────────────────────────────────────────────────────

import { BadRequestException, Controller, Get, Header, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { NotificationType } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { verifyUnsubscribeSig } from './unsubscribe.utils';
import { escapeHtml } from './templates/layout';

/** Throttle: 20 requests per 60 s per IP (stricter than global). */
const UNSUBSCRIBE_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

const VALID_TYPES = new Set<string>(Object.values(NotificationType));

/** Minimal HTML confirmation page shown on GET (no external deps, inline styles). */
function confirmPage(userId: string, type: string, sig: string): string {
  const safeType = escapeHtml(type);
  const params = new URLSearchParams({ u: userId, t: type, s: sig }).toString();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribe — Chainbills</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#fff;border-radius:8px;padding:40px;max-width:440px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  h1{font-size:22px;color:#1a1a2e;margin:0 0 16px}
  p{color:#555;font-size:15px;margin:0 0 24px;line-height:1.6}
  button{background:#1a1a2e;color:#e8d5b7;border:none;padding:12px 28px;font-size:15px;font-weight:600;border-radius:6px;cursor:pointer}
  button:hover{opacity:.9}
</style>
</head>
<body>
<div class="card">
  <h1>Unsubscribe</h1>
  <p>Click the button to stop receiving <strong>${safeType}</strong> emails from Chainbills.</p>
  <form method="POST" action="/email/unsubscribe?${params}">
    <button type="submit">Unsubscribe</button>
  </form>
</div>
</body>
</html>`;
}

/** Serves the one-click unsubscribe endpoints required by RFC 8058 and mail clients. */
@ApiTags('unsubscribe')
@Controller('email')
@Public()
@Throttle(UNSUBSCRIBE_THROTTLE)
export class UnsubscribeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService
  ) {}

  @Get('unsubscribe')
  @Header('Content-Type', 'text/html')
  @ApiOperation({ summary: 'Show an unsubscribe confirmation page.' })
  @ApiQuery({ name: 'u', description: 'User id', required: true })
  @ApiQuery({ name: 't', description: 'NotificationType', required: true })
  @ApiQuery({ name: 's', description: 'HMAC signature', required: true })
  @ApiResponse({ status: 200, description: 'HTML confirmation page.' })
  @ApiResponse({ status: 400, description: 'Invalid or tampered signature.' })
  getUnsubscribePage(@Query('u') userId: string, @Query('t') type: string, @Query('s') sig: string): string {
    this.validateSignature(userId, type, sig);
    return confirmPage(userId, type, sig);
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process a one-click unsubscribe (RFC 8058).' })
  @ApiQuery({ name: 'u', description: 'User id', required: true })
  @ApiQuery({ name: 't', description: 'NotificationType', required: true })
  @ApiQuery({ name: 's', description: 'HMAC signature', required: true })
  @ApiResponse({ status: 200, description: 'Unsubscribed successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or tampered signature.' })
  async processUnsubscribe(
    @Query('u') userId: string,
    @Query('t') type: string,
    @Query('s') sig: string
  ): Promise<{ ok: boolean }> {
    this.validateSignature(userId, type, sig);

    // Upsert the preference row with email=false.
    await this.prisma.notificationPreference.upsert({
      where: { userId_type: { userId, type: type as NotificationType } },
      create: { userId, type: type as NotificationType, email: false },
      update: { email: false },
    });

    return { ok: true };
  }

  /**
   * Validates the HMAC signature, the userId is non-empty, and the type is a
   * valid NotificationType. Throws 400 on any failure — deliberately vague to
   * avoid leaking whether a userId/type pair exists in the database.
   */
  private validateSignature(userId: string, type: string, sig: string): void {
    if (!userId || !type || !sig) {
      throw new BadRequestException('invalid unsubscribe link');
    }
    if (!VALID_TYPES.has(type)) {
      throw new BadRequestException('invalid unsubscribe link');
    }
    const valid = verifyUnsubscribeSig(this.config.env.unsubscribeSecret, userId, type, sig);
    if (!valid) {
      throw new BadRequestException('invalid unsubscribe link');
    }
  }
}
