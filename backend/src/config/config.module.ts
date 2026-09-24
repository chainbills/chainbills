// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Config module
//
// Wraps @nestjs/config so `ConfigModule.forRoot({ validate: validateEnv })`
// runs once at boot, before any other module initialises (SPEC.md §5.1
// item 2). Global, so `AppConfigService` is injectable anywhere without
// re-importing this module.
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import { validateEnv } from './env.schema';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      // `npm run start:dev` reads `.env` directly (via the bundled dotenv
      // loader) for local development. Docker / Cloud Run / docker-compose
      // instead inject real process env vars before Node starts, which
      // dotenv never overwrites, so both paths converge on the same
      // `validateEnv(process.env)` call below.
      validate: validateEnv,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
