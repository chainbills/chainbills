// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Users module
//
// Imported by ApiModule for ROLE=api|all. Provides UsersService and registers
// UsersController. Depends on PrismaModule (data), AppConfigModule (secrets),
// and NotificationsModule (MailProvider for OTP delivery).
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule, AppConfigModule, NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
