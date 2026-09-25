// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — API module
//
// Imported by AppModule only when ROLE is "api" or "all" (SPEC.md §2.1).
// Registers AuthModule (phase 2b), UsersModule (phase 3b), and
// NotificationsModule (phase 3b — provides MailProvider and unsubscribe routes).
// Public read controllers and their shared PublicApiService added in phase 4.
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ChainsModule } from '../chains/chains.module';
import { PublicApiService } from './public-api.service';
import { ChainsController } from './chains.controller';
import { PayablesController } from './payables.controller';
import { PaymentsController } from './payments.controller';
import { UsersApiController } from './users-api.controller';
import { WithdrawalsController } from './withdrawals.controller';
import { StatsController } from './stats.controller';

/** Aggregates all HTTP controllers and services active when ROLE is "api" or "all". */
@Module({
  imports: [AuthModule, UsersModule, NotificationsModule, PrismaModule, ChainsModule],
  providers: [PublicApiService],
  controllers: [
    ChainsController,
    PayablesController,
    PaymentsController,
    UsersApiController,
    WithdrawalsController,
    StatsController,
  ],
})
export class ApiModule {}
