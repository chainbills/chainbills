// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — API module
//
// Imported by AppModule only when ROLE is "api" or "all" (SPEC.md §2.1).
// Registers AuthModule (phase 2b), UsersModule (phase 3b), and
// NotificationsModule (phase 3b — provides MailProvider and unsubscribe routes).
// Public read controllers land in phase 4.
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, UsersModule, NotificationsModule],
})
export class ApiModule {}
