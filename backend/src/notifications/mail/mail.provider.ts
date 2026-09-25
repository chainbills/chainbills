// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — MailProvider interface
//
// Defines the contract for sending transactional email. All email delivery
// goes through this interface so the rest of the code (OTP flow, outbox
// processor) is decoupled from the concrete provider (ZeptoMail or console).
//
// Implementations: ZeptoMailProvider (production), ConsoleMailProvider (dev).
// Provider selection: MAIL_PROVIDER env var, wired in NotificationsModule.
// ──────────────────────────────────────────────────────────────────────────────

/** A single outgoing email message. */
export interface MailMessage {
  /** Recipient email address. */
  to: string;
  /** Subject line. */
  subject: string;
  /** HTML body. */
  html: string;
  /** Plain-text body (fallback for clients that do not render HTML). */
  text: string;
  /** Optional extra headers (e.g. List-Unsubscribe). */
  headers?: Record<string, string>;
}

/**
 * Typed error thrown by a MailProvider when the send fails.
 * Carries the provider-specific error code so callers can log it without
 * needing to inspect raw exception shapes.
 */
export class MailProviderError extends Error {
  constructor(
    message: string,
    /** Provider-supplied error code or HTTP status, as a string. */
    public readonly providerCode: string
  ) {
    super(message);
    this.name = 'MailProviderError';
  }
}

/** Injectable token for the MailProvider. */
export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');

/**
 * Transactional email delivery interface.
 *
 * `send` resolves with a `messageId` that can be stored for deduplication /
 * tracking. Throws `MailProviderError` on non-2xx responses or network errors.
 */
export interface MailProvider {
  send(msg: MailMessage): Promise<{ messageId: string }>;
}
