// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Notifications module
//
// Provides MailProvider (via a factory that selects the implementation from
// MAIL_PROVIDER env var) and exports it for UsersModule (OTP delivery) and
// OutboxProcessor (notification delivery).
//
// Also registers UnsubscribeController (public, no auth) for ROLE=api|all.
// OutboxProcessor is registered separately in WorkerModule so it only runs in
// the worker role.
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfigService } from '../config/app-config.service';
import { MAIL_PROVIDER } from './mail/mail.provider';
import { ConsoleMailProvider } from './mail/console.provider';
import { ZeptoMailProvider } from './mail/zeptomail.provider';
import { UnsubscribeController } from './unsubscribe.controller';

@Module({
  imports: [AppConfigModule, PrismaModule],
  controllers: [UnsubscribeController],
  providers: [
    {
      provide: MAIL_PROVIDER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const { mailProvider, zeptomail } = config.env;
        if (mailProvider === 'zeptomail') {
          return new ZeptoMailProvider(
            zeptomail.apiUrl,
            zeptomail.apiKey ?? '',
            zeptomail.fromAddress ?? '',
            zeptomail.fromName
          );
        }
        return new ConsoleMailProvider();
      },
    },
  ],
  exports: [MAIL_PROVIDER],
})
export class NotificationsModule {}
