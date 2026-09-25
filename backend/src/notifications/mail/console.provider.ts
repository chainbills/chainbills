// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Console mail provider
//
// Development-only MailProvider that logs the full message (including the OTP
// code) to the pino logger. Config validation rejects MAIL_PROVIDER=console
// when NODE_ENV=production so this path is unreachable in a live deployment.
//
// Useful locally: run the service, request a verification email, and read the
// code from the terminal output without needing a ZeptoMail account.
// ──────────────────────────────────────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import type { MailMessage, MailProvider } from './mail.provider';

/**
 * Logs the outgoing email to the pino logger instead of sending it.
 * Safe to use only when NODE_ENV != production (config validation enforces this).
 */
@Injectable()
export class ConsoleMailProvider implements MailProvider {
  private readonly logger = new Logger(ConsoleMailProvider.name);

  /**
   * Logs the message at `debug` level so the OTP code is visible in the
   * terminal during local development without appearing in production logs.
   */
  async send(msg: MailMessage): Promise<{ messageId: string }> {
    const messageId = `console-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.logger.debug(
      {
        messageId,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      },
      '[ConsoleMailProvider] email logged (not sent)'
    );
    return { messageId };
  }
}
