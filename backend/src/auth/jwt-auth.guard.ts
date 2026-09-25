// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Global JWT authentication guard
//
// Registered as APP_GUARD so it applies to every route by default. Routes
// decorated with @Public() are allowed through without a token.
//
// Guard flow:
//   1. Check IS_PUBLIC_KEY metadata — skip if present.
//   2. Extract the Bearer token from the Authorization header.
//   3. Verify the JWT with @nestjs/jwt (signature, expiry).
//   4. Do one indexed DB lookup to confirm the session is not revoked.
//   5. Attach { userId, walletKey, sessionId } to request.user so
//      @CurrentUser() can retrieve it in the controller.
//
// A stolen access token is rejected as soon as the session is revoked in DB
// (step 4), even before the token's own expiry — this is the intent of the
// single indexed session lookup per request (SPEC.md §9.2).
// ──────────────────────────────────────────────────────────────────────────────

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
// Aliased: DOM globals include Request which would clash.
import type { Request as ExpressRequest } from 'express';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import type { JwtPayload } from './auth.service';

/** Shape attached to `request.user` by the guard. */
export interface AuthUser {
  userId: string;
  walletKey: string;
  sessionId: string;
}

/** Global deny-by-default guard; routes decorated with @Public() are exempt. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    /** Lazily injected via forwardRef because AuthModule imports this guard. */
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow routes marked @Public().
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<ExpressRequest & { user?: AuthUser }>();

    const token = this.extractBearerToken(request);
    if (!token) throw new UnauthorizedException('missing access token');

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('invalid or expired access token');
    }

    // One indexed DB lookup — confirms the session is still active.
    const valid = await this.authService.validateSession(payload.sid);
    if (!valid) throw new UnauthorizedException('session revoked or expired');

    request.user = {
      userId: payload.sub,
      walletKey: payload.wlt,
      sessionId: payload.sid,
    };

    return true;
  }

  private extractBearerToken(request: ExpressRequest): string | undefined {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return undefined;
    return auth.slice(7);
  }
}
