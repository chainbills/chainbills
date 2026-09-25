// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Email layout
//
// Minimal inline-CSS wrapper used by every notification template. Keeps all
// styling self-contained (no external CSS) so email clients render it correctly.
//
// All interpolated values must be HTML-escaped before being passed here.
// The layout itself does not escape — escaping is the caller's responsibility.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Escapes HTML special characters in a string to prevent injection.
 * Must be applied to every user-controlled or data-driven value before
 * embedding it in an HTML template.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Wraps `contentHtml` in a shared email layout: Chainbills header, content
 * area with inline styling, and a footer containing the unsubscribe link.
 *
 * Parameters:
 *   contentHtml     — The per-template inner HTML. Values must already be escaped.
 *   unsubscribeHtml — Optional footer HTML for the unsubscribe link block.
 *                     Omit for the OTP template (no unsubscribe link).
 */
export function layout(contentHtml: string, unsubscribeHtml = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chainbills</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:32px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">
        <!-- Header -->
        <tr>
          <td style="background:#1a1a2e;padding:24px 32px;">
            <span style="color:#e8d5b7;font-size:22px;font-weight:700;letter-spacing:0.5px;">Chainbills</span>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:32px;">
            ${contentHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:20px 32px;border-top:1px solid #e8e8e8;">
            <p style="margin:0 0 8px;color:#888;font-size:12px;">
              You are receiving this email because of activity on your Chainbills account.
            </p>
            ${unsubscribeHtml ? `<p style="margin:0;color:#888;font-size:12px;">${unsubscribeHtml}</p>` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * Returns a primary call-to-action button HTML for linking to the app.
 * `href` and `label` must already be HTML-escaped if they contain user data.
 */
export function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#1a1a2e;color:#e8d5b7;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">${label}</a>`;
}

/**
 * Renders the amount + token symbol as a prominent hero card, tinted to
 * match the Chainbills header palette. A small caption above the amount
 * (e.g. "You received", "You paid") tells the reader what the number means.
 *
 * Uses a nested table for Outlook compatibility. `amount`, `symbol`, and
 * `caption` must already be HTML-escaped.
 */
export function amountCard(amount: string, symbol: string, caption: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 24px;border-collapse:separate;">
    <tr>
      <td align="center" style="background:#faf7f0;border:1px solid #efe6d3;border-radius:12px;padding:24px 20px;">
        <div style="color:#7a6c4a;font-size:11px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;">${caption}</div>
        <div style="color:#1a1a2e;font-size:34px;font-weight:700;line-height:1;letter-spacing:-0.5px;font-family:Arial,Helvetica,sans-serif;">
          ${amount}<span style="color:#5b6474;font-size:18px;font-weight:600;margin-left:6px;">${symbol}</span>
        </div>
      </td>
    </tr>
  </table>`;
}

/**
 * Returns the unsubscribe link paragraph HTML for the footer.
 * `href` must be a valid URL with no user-controlled content injected.
 */
export function unsubscribeFooter(href: string): string {
  return `To stop receiving this type of notification, <a href="${href}" style="color:#888;">unsubscribe here</a>.`;
}
