// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Verification-code email template
//
// Sent directly by UsersService.requestEmailVerification (not via outbox)
// because the user is waiting for the code. Does NOT include an unsubscribe
// link — it is a transactional security message, not a marketing email.
// ──────────────────────────────────────────────────────────────────────────────

import { layout, escapeHtml } from './layout';

export interface VerificationCodeParams {
  /** The 6-digit OTP code. */
  code: string;
  /** APP_URL for the link in the email. */
  appUrl: string;
  /** Sender display name (e.g. "Chainbills"). */
  fromName: string;
}

/** Returns { subject, html, text } for the email-verification OTP message. */
export function verificationCodeTemplate(params: VerificationCodeParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { code, fromName } = params;
  const safeCode = escapeHtml(code);
  const safeFrom = escapeHtml(fromName);

  const subject = `Your ${fromName} email verification code`;

  const contentHtml = `
    <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;">Verify your email address</h2>
    <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">
      Use the code below to verify your email address on ${safeFrom}. The code expires in 10 minutes.
    </p>
    <div style="margin:24px 0;padding:20px;background:#f0f4ff;border-radius:8px;text-align:center;">
      <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a1a2e;">${safeCode}</span>
    </div>
    <p style="margin:0;color:#888;font-size:13px;line-height:1.5;">
      If you did not request this code, you can safely ignore this email. Never share this code with anyone.
    </p>`;

  const html = layout(contentHtml);

  const text = [
    `Verify your email address on ${fromName}`,
    '',
    `Your verification code: ${code}`,
    '',
    'The code expires in 10 minutes.',
    '',
    'If you did not request this code, you can safely ignore this email.',
  ].join('\n');

  return { subject, html, text };
}
