// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Notification email templates
//
// One function per NotificationType (SPEC.md §11.4). Each function returns
// { subject, html, text } ready to pass to MailProvider.send().
//
// Shared invariants:
//   - All interpolated values are HTML-escaped via escapeHtml().
//   - Amounts are formatted with formatAmount() from common/amount/.
//   - Each template includes a primary CTA button and a footer with the
//     unsubscribe link built from PUBLIC_API_URL, userId, type and signature.
//   - Raw bytes32 ids are truncated to 12 chars in subject lines.
// ──────────────────────────────────────────────────────────────────────────────

import { formatAmount } from '../../common/amount/format-amount';
import { layout, ctaButton, unsubscribeFooter, escapeHtml } from './layout';

/** Parameters shared by all notification templates. */
interface BaseTemplateParams {
  /** The HMAC-signed unsubscribe URL. */
  unsubscribeUrl: string;
  /** APP_URL for action buttons. */
  appUrl: string;
}

/** Short display id: first 6 + last 6 chars of a hex id (with 0x prefix). */
function shortId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

// ── PAYABLE_CREATED ───────────────────────────────────────────────────────────

export interface PayableCreatedParams extends BaseTemplateParams {
  payableId: string;
  chainId: string;
}

/** Email sent to the payable host when a new payable is indexed. */
export function payableCreatedTemplate(params: PayableCreatedParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { payableId, appUrl, unsubscribeUrl } = params;
  const safe = escapeHtml;
  const displayId = shortId(payableId);
  const payableUrl = `${appUrl}/payable/${payableId}`;

  const subject = `Your payable ${displayId} is live`;

  const contentHtml = `
    <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;">Your payable is live</h2>
    <p style="margin:0 0 8px;color:#333;font-size:15px;line-height:1.6;">
      Your Chainbills payable has been created and is ready to accept payments.
    </p>
    <p style="margin:0;color:#555;font-size:14px;">Payable ID: <code style="background:#f4f4f4;padding:2px 6px;border-radius:4px;">${safe(displayId)}</code></p>
    ${ctaButton(safe(payableUrl), 'View Payable')}`;

  const html = layout(contentHtml, unsubscribeFooter(safe(unsubscribeUrl)));

  const text = [
    'Your Chainbills payable is live.',
    '',
    `Payable ID: ${payableId}`,
    `View your payable: ${payableUrl}`,
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  return { subject, html, text };
}

// ── PAYMENT_RECEIVED ──────────────────────────────────────────────────────────

export interface PaymentReceivedParams extends BaseTemplateParams {
  paymentId: string;
  payableId: string;
  token: string;
  /** Raw integer amount string. */
  amount: string;
  symbol: string;
  decimals: number;
  payerChainId: string;
}

/** Email sent to the host when a payment lands on their payable. */
export function paymentReceivedTemplate(params: PaymentReceivedParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { paymentId, payableId, amount, symbol, decimals, appUrl, unsubscribeUrl } = params;
  const safe = escapeHtml;
  const formatted = formatAmount(amount, decimals);
  const receiptUrl = `${appUrl}/receipt/${paymentId}`;

  const subject = `You received ${formatted} ${symbol}`;

  const contentHtml = `
    <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;">Payment received</h2>
    <p style="margin:0 0 8px;color:#333;font-size:15px;line-height:1.6;">
      Your payable received a payment of <strong>${safe(formatted)} ${safe(symbol)}</strong>.
    </p>
    <p style="margin:0 0 4px;color:#555;font-size:14px;">Payable: <code style="background:#f4f4f4;padding:2px 6px;border-radius:4px;">${safe(shortId(payableId))}</code></p>
    <p style="margin:0;color:#555;font-size:14px;">Payment: <code style="background:#f4f4f4;padding:2px 6px;border-radius:4px;">${safe(shortId(paymentId))}</code></p>
    ${ctaButton(safe(receiptUrl), 'View Receipt')}`;

  const html = layout(contentHtml, unsubscribeFooter(safe(unsubscribeUrl)));

  const text = [
    `Payment received: ${formatted} ${symbol}`,
    '',
    `Payable: ${payableId}`,
    `Payment: ${paymentId}`,
    `View receipt: ${receiptUrl}`,
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  return { subject, html, text };
}

// ── PAYMENT_RECEIPT ───────────────────────────────────────────────────────────

export interface PaymentReceiptParams extends BaseTemplateParams {
  paymentId: string;
  payableId: string;
  payableChainId: string;
  token: string;
  /** Raw integer amount string. */
  amount: string;
  symbol: string;
  decimals: number;
}

/** Email sent to the payer as their payment receipt. */
export function paymentReceiptTemplate(params: PaymentReceiptParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { paymentId, payableId, amount, symbol, decimals, appUrl, unsubscribeUrl } = params;
  const safe = escapeHtml;
  const formatted = formatAmount(amount, decimals);
  const receiptUrl = `${appUrl}/receipt/${paymentId}`;

  const subject = `Payment receipt: ${formatted} ${symbol}`;

  const contentHtml = `
    <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;">Payment receipt</h2>
    <p style="margin:0 0 8px;color:#333;font-size:15px;line-height:1.6;">
      Your payment of <strong>${safe(formatted)} ${safe(symbol)}</strong> was successful.
    </p>
    <p style="margin:0 0 4px;color:#555;font-size:14px;">Payable: <code style="background:#f4f4f4;padding:2px 6px;border-radius:4px;">${safe(shortId(payableId))}</code></p>
    <p style="margin:0;color:#555;font-size:14px;">Payment ID: <code style="background:#f4f4f4;padding:2px 6px;border-radius:4px;">${safe(shortId(paymentId))}</code></p>
    ${ctaButton(safe(receiptUrl), 'View Receipt')}`;

  const html = layout(contentHtml, unsubscribeFooter(safe(unsubscribeUrl)));

  const text = [
    `Payment receipt: ${formatted} ${symbol}`,
    '',
    `Payable: ${payableId}`,
    `Payment: ${paymentId}`,
    `View receipt: ${receiptUrl}`,
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  return { subject, html, text };
}

// ── WITHDRAWAL_COMPLETED ──────────────────────────────────────────────────────

export interface WithdrawalCompletedParams extends BaseTemplateParams {
  withdrawalId: string;
  payableId: string;
  token: string;
  /** Raw integer amount string (net received after fee). */
  amount: string;
  symbol: string;
  decimals: number;
}

/** Email sent to the host when a withdrawal is indexed. */
export function withdrawalCompletedTemplate(params: WithdrawalCompletedParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { withdrawalId, payableId, amount, symbol, decimals, appUrl, unsubscribeUrl } = params;
  const safe = escapeHtml;
  const formatted = formatAmount(amount, decimals);
  const payableUrl = `${appUrl}/payable/${payableId}`;

  const subject = `Withdrawal of ${formatted} ${symbol} completed`;

  const contentHtml = `
    <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;">Withdrawal completed</h2>
    <p style="margin:0 0 8px;color:#333;font-size:15px;line-height:1.6;">
      Your withdrawal of <strong>${safe(formatted)} ${safe(symbol)}</strong> has been completed.
    </p>
    <p style="margin:0 0 4px;color:#555;font-size:14px;">Payable: <code style="background:#f4f4f4;padding:2px 6px;border-radius:4px;">${safe(shortId(payableId))}</code></p>
    <p style="margin:0;color:#555;font-size:14px;">Withdrawal: <code style="background:#f4f4f4;padding:2px 6px;border-radius:4px;">${safe(shortId(withdrawalId))}</code></p>
    ${ctaButton(safe(payableUrl), 'View Payable')}`;

  const html = layout(contentHtml, unsubscribeFooter(safe(unsubscribeUrl)));

  const text = [
    `Withdrawal completed: ${formatted} ${symbol}`,
    '',
    `Payable: ${payableId}`,
    `Withdrawal: ${withdrawalId}`,
    `View payable: ${payableUrl}`,
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  return { subject, html, text };
}
