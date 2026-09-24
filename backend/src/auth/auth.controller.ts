// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Auth controller
//
// HTTP surface for the auth flow (SPEC.md §9.1):
//   POST /auth/nonce     — issue a nonce (@Public, throttled 10/min/IP)
//   POST /auth/verify    — verify SIWE / SIWS, issue tokens (@Public, throttled)
//   POST /auth/refresh   — rotate refresh token (@Public, cookie-based)
//   POST /auth/logout    — revoke current session (authenticated)
//   POST /auth/logout-all — revoke all sessions (authenticated)
//
// Cookie management: the refresh token is set / cleared here via a helper so
// AuthService stays cookie-free and testable.
// ──────────────────────────────────────────────────────────────────────────────

// Renamed: DOM global `Body` (fetch mixin) would otherwise clash with `@nestjs/common`'s `Body`.
import { Body as RequestBody, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
// Aliased: DOM globals Request and Response would otherwise clash with these.
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AppConfigService } from '../config/app-config.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { NonceResponseDto, RefreshResponseDto, VerifyRequestDto, VerifyResponseDto } from './auth.dto';
import type { AuthUser } from './jwt-auth.guard';

/** Cookie name for the refresh token (SPEC.md §9.2). */
const REFRESH_COOKIE = 'cb_refresh';

/** Auth-specific throttle: 10 requests per 60 s per IP. */
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService
  ) {}

  @Public()
  @Post('nonce')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Issue a single-use nonce for SIWE / SIWS sign-in.' })
  @ApiResponse({ status: 200, description: 'Nonce issued.', type: NonceResponseDto })
  async nonce(): Promise<NonceResponseDto> {
    return this.authService.getNonce();
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Verify a signed SIWE (EVM) or SIWS (Solana) message and issue tokens.' })
  @ApiResponse({ status: 200, description: 'Authentication successful.', type: VerifyResponseDto })
  @ApiResponse({ status: 400, description: 'Malformed message or DTO.' })
  @ApiResponse({ status: 401, description: 'Signature invalid, nonce reused/expired, domain mismatch, etc.' })
  async verify(
    @RequestBody() dto: VerifyRequestDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: ExpressResponse
  ): Promise<VerifyResponseDto> {
    const { response, refreshToken } = await this.authService.verify(dto.namespace, dto.message, dto.signature, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    this.setRefreshCookie(res, refreshToken);
    return response;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Rotate the refresh token and return a new access token.' })
  @ApiResponse({ status: 200, description: 'Token rotated.', type: RefreshResponseDto })
  @ApiResponse({ status: 401, description: 'Cookie missing, session expired or revoked.' })
  async refresh(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: ExpressResponse
  ): Promise<RefreshResponseDto> {
    const rawToken = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
    const { response, refreshToken } = await this.authService.refresh(rawToken);
    this.setRefreshCookie(res, refreshToken);
    return response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke the current session.' })
  @ApiResponse({ status: 204, description: 'Session revoked.' })
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: ExpressResponse): Promise<void> {
    await this.authService.logout(user.sessionId);
    this.clearRefreshCookie(res);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke all sessions for the authenticated user.' })
  @ApiResponse({ status: 204, description: 'All sessions revoked.' })
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: ExpressResponse): Promise<void> {
    await this.authService.logoutAll(user.userId);
    this.clearRefreshCookie(res);
  }

  /**
   * Sets the `cb_refresh` httpOnly cookie. Attributes per SPEC.md §9.2:
   * HttpOnly, Secure (unless COOKIE_SECURE=false), SameSite=Lax, Path=/auth,
   * Domain from COOKIE_DOMAIN (if set), maxAge = REFRESH_TOKEN_TTL in seconds.
   */
  private setRefreshCookie(res: ExpressResponse, token: string): void {
    const env = this.config.env;
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'lax',
      path: '/auth',
      domain: env.cookieDomain,
      maxAge: Math.floor(env.refreshTokenTtlMs / 1_000) * 1_000, // convert to ms for express
    });
  }

  /**
   * Clears the `cb_refresh` cookie by setting an immediately-expired value.
   * The same path and domain attributes must match the set call, or the
   * browser will not remove the cookie.
   */
  private clearRefreshCookie(res: ExpressResponse): void {
    const env = this.config.env;
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'lax',
      path: '/auth',
      domain: env.cookieDomain,
    });
  }
}
