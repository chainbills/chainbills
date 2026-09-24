// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — @CurrentUser() parameter decorator
//
// Extracts the authenticated user's identity from the request object, where
// JwtAuthGuard stores it after validating the Bearer token.
//
// Usage:
//   @Get('me')
//   getMe(@CurrentUser() user: AuthUser) { ... }
// ──────────────────────────────────────────────────────────────────────────────

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
// Aliased: DOM globals include Request which would clash.
import type { Request as ExpressRequest } from 'express';
import type { AuthUser } from './jwt-auth.guard';

/**
 * Injects `{ userId, walletKey, sessionId }` into a controller method
 * parameter. Only valid on routes that are NOT marked `@Public()` — on public
 * routes `request.user` is undefined.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<ExpressRequest & { user?: AuthUser }>();
  const user = request.user;
  if (!user) {
    // Guard should have blocked the request before reaching here.
    throw new Error('CurrentUser used on a route without JwtAuthGuard');
  }
  return user;
});
