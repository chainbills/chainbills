// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Users controller
//
// HTTP surface for user self-service (SPEC.md §10):
//   GET    /me                 — profile, wallets, email, preferences
//   PATCH  /me/preferences     — partial update of notification preferences
//   POST   /me/email           — start email verification (sends OTP)
//   POST   /me/email/verify    — complete verification with the OTP code
//   DELETE /me/email           — remove the verified email
//
// All routes require authentication (@CurrentUser() enforced by the global
// JwtAuthGuard). Throttled globally; /me/email gets a stricter limit.
// ──────────────────────────────────────────────────────────────────────────────

// Renamed: DOM global `Body` (fetch mixin) would otherwise clash with `@nestjs/common`'s `Body`.
import { Body as RequestBody, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { MeResponseDto, SetEmailDto, UpdatePreferencesDto, VerifyEmailDto } from './users.dto';

/** Stricter throttle for email verification endpoints: 5 requests per 60 s per IP. */
const EMAIL_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('users')
@Controller()
@ApiBearerAuth('access-token')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile, wallets and notification preferences.' })
  @ApiResponse({ status: 200, description: 'User profile.', type: MeResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async getMe(@CurrentUser() user: AuthUser): Promise<MeResponseDto> {
    return this.users.getMe(user.userId);
  }

  @Patch('me/preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update notification preferences. Only provided types are changed; omitted types remain unchanged.',
  })
  @ApiResponse({ status: 200, description: 'Updated profile with new preferences.', type: MeResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async updatePreferences(
    @CurrentUser() user: AuthUser,
    @RequestBody() dto: UpdatePreferencesDto
  ): Promise<MeResponseDto> {
    return this.users.updatePreferences(user.userId, dto);
  }

  @Post('me/email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(EMAIL_THROTTLE)
  @ApiOperation({ summary: 'Start email verification. Sends a 6-digit code to the provided address.' })
  @ApiResponse({ status: 204, description: 'Verification email sent.' })
  @ApiResponse({ status: 400, description: 'Invalid email address.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded. Response includes retryAfter (seconds).' })
  @ApiResponse({ status: 502, description: 'Mail provider unavailable.' })
  async setEmail(@CurrentUser() user: AuthUser, @RequestBody() dto: SetEmailDto): Promise<void> {
    await this.users.requestEmailVerification(user.userId, dto.email);
  }

  @Post('me/email/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle(EMAIL_THROTTLE)
  @ApiOperation({ summary: 'Complete email verification with the 6-digit OTP.' })
  @ApiResponse({ status: 200, description: 'Email verified. Returns updated profile.', type: MeResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid or expired code, or no pending verification.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async verifyEmail(@CurrentUser() user: AuthUser, @RequestBody() dto: VerifyEmailDto): Promise<MeResponseDto> {
    return this.users.verifyEmail(user.userId, dto.code);
  }

  @Delete('me/email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove the verified email address. Future notifications are suppressed.' })
  @ApiResponse({ status: 200, description: 'Email removed. Returns updated profile.', type: MeResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async removeEmail(@CurrentUser() user: AuthUser): Promise<MeResponseDto> {
    return this.users.removeEmail(user.userId);
  }
}
