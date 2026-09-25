// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Email template snapshot tests
//
// Covers: one snapshot per NotificationType + verification-code template.
// HTML escaping of interpolated values tested explicitly.
// ──────────────────────────────────────────────────────────────────────────────

import { verificationCodeTemplate } from './verification-code.template';
import {
  payableCreatedTemplate,
  paymentReceivedTemplate,
  paymentReceiptTemplate,
  withdrawalCompletedTemplate,
} from './notification.templates';
import { escapeHtml } from './layout';

const BASE = {
  appUrl: 'https://chainbills.xyz',
  unsubscribeUrl: 'https://api.chainbills.xyz/email/unsubscribe?u=user1&t=PAYABLE_CREATED&s=sig',
};

// ── Verification code ─────────────────────────────────────────────────────────

describe('verificationCodeTemplate', () => {
  it('matches snapshot', () => {
    const result = verificationCodeTemplate({
      code: '042891',
      appUrl: 'https://chainbills.xyz',
      fromName: 'Chainbills',
    });
    expect(result.subject).toMatchSnapshot();
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it('contains the OTP code in the HTML', () => {
    const { html } = verificationCodeTemplate({
      code: '123456',
      appUrl: 'https://chainbills.xyz',
      fromName: 'Chainbills',
    });
    expect(html).toContain('123456');
  });

  it('contains the OTP code in the plain-text body', () => {
    const { text } = verificationCodeTemplate({
      code: '000001',
      appUrl: 'https://chainbills.xyz',
      fromName: 'Chainbills',
    });
    expect(text).toContain('000001');
  });

  it('does NOT include an unsubscribe link', () => {
    const { html } = verificationCodeTemplate({
      code: '000001',
      appUrl: 'https://chainbills.xyz',
      fromName: 'Chainbills',
    });
    expect(html).not.toContain('unsubscribe');
  });
});

// ── PAYABLE_CREATED ───────────────────────────────────────────────────────────

describe('payableCreatedTemplate', () => {
  it('matches snapshot', () => {
    const result = payableCreatedTemplate({
      ...BASE,
      payableId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      chainId: '0xchain',
    });
    expect(result.subject).toMatchSnapshot();
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it('HTML-escapes a <script> tag in payableId', () => {
    const evil = '<script>alert(1)</script>';
    const result = payableCreatedTemplate({
      ...BASE,
      payableId: evil,
      chainId: '0x1',
    });
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });
});

// ── PAYMENT_RECEIVED ──────────────────────────────────────────────────────────

describe('paymentReceivedTemplate', () => {
  it('matches snapshot', () => {
    const result = paymentReceivedTemplate({
      ...BASE,
      unsubscribeUrl: BASE.unsubscribeUrl.replace('PAYABLE_CREATED', 'PAYMENT_RECEIVED'),
      paymentId: '0xpmt123',
      payableId: '0xpay456',
      token: '0xtoken',
      amount: '1500000',
      symbol: 'USDC',
      decimals: 6,
      payerChainId: '0xchain',
    });
    expect(result.subject).toMatchSnapshot();
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it('formats the amount correctly', () => {
    const { html } = paymentReceivedTemplate({
      ...BASE,
      unsubscribeUrl: '',
      paymentId: '0x1',
      payableId: '0x2',
      token: '0x3',
      amount: '1000000',
      symbol: 'USDC',
      decimals: 6,
      payerChainId: '0xchain',
    });
    expect(html).toContain('1 USDC');
  });

  it('HTML-escapes symbol', () => {
    const result = paymentReceivedTemplate({
      ...BASE,
      unsubscribeUrl: '',
      paymentId: '0x1',
      payableId: '0x2',
      token: '0x3',
      amount: '1000000',
      symbol: '<evil>',
      decimals: 6,
      payerChainId: '0xchain',
    });
    expect(result.html).not.toContain('<evil>');
    expect(result.html).toContain('&lt;evil&gt;');
  });
});

// ── PAYMENT_RECEIPT ───────────────────────────────────────────────────────────

describe('paymentReceiptTemplate', () => {
  it('matches snapshot', () => {
    const result = paymentReceiptTemplate({
      ...BASE,
      unsubscribeUrl: BASE.unsubscribeUrl.replace('PAYABLE_CREATED', 'PAYMENT_RECEIPT'),
      paymentId: '0xpmt789',
      payableId: '0xpay012',
      payableChainId: '0xchain',
      token: '0xtoken',
      amount: '2000000',
      symbol: 'USDC',
      decimals: 6,
    });
    expect(result.subject).toMatchSnapshot();
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });
});

// ── WITHDRAWAL_COMPLETED ──────────────────────────────────────────────────────

describe('withdrawalCompletedTemplate', () => {
  it('matches snapshot', () => {
    const result = withdrawalCompletedTemplate({
      ...BASE,
      unsubscribeUrl: BASE.unsubscribeUrl.replace('PAYABLE_CREATED', 'WITHDRAWAL_COMPLETED'),
      withdrawalId: '0xwdr345',
      payableId: '0xpay678',
      token: '0xtoken',
      amount: '5000000',
      symbol: 'USDC',
      decimals: 6,
    });
    expect(result.subject).toMatchSnapshot();
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it('HTML-escapes payableId containing quotes', () => {
    const result = withdrawalCompletedTemplate({
      ...BASE,
      unsubscribeUrl: '',
      withdrawalId: '0xw',
      payableId: '"injected"',
      token: '0xt',
      amount: '1000',
      symbol: 'ETH',
      decimals: 18,
    });
    expect(result.html).not.toContain('"injected"');
    expect(result.html).toContain('&quot;injected&quot;');
  });
});

// ── escapeHtml ────────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes all five HTML special chars', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('leaves safe strings unchanged', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });
});
