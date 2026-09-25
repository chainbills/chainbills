// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Auth module
//
// Imported by ApiModule only when ROLE=api|all (SPEC.md §2.1).
// Registers JwtAuthGuard as APP_GUARD so it is globally active for all routes
// in the HTTP layer — routes opt out with @Public().
//
// JwtModule is configured with the same JWT_ACCESS_SECRET and
// ACCESS_TOKEN_TTL that AuthService uses to sign tokens, so the guard's
// verify() call uses the same parameters.
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ChainsModule } from '../chains/chains.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { NonceService } from './nonce.service';
import { SessionService } from './session.service';
import { SiweVerifier } from './siwe-verifier';
import { SiwsVerifier } from './siws-verifier';
import { JwtAuthGuard } from './jwt-auth.guard';

/** Registers auth services, SIWE/SIWS verifiers, and the global JwtAuthGuard for the API layer. */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ChainsModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        // JWT_ACCESS_SECRET is required for api/all roles; the `??` fallback
        // satisfies the compiler for the (never-reached) worker-only path.
        secret: config.env.jwtAccessSecret ?? '',
        signOptions: {
          expiresIn: Math.floor(config.env.accessTokenTtlMs / 1_000),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    NonceService,
    SessionService,
    SiweVerifier,
    SiwsVerifier,
    JwtAuthGuard,
    // Register the guard globally so every route in the API layer is protected
    // by default, with @Public() as the opt-out.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, JwtModule, SessionService],
})
export class AuthModule {}
