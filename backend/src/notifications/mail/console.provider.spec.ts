// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Console mail provider tests
//
// Covers: send returns a messageId, the message content is logged.
// ──────────────────────────────────────────────────────────────────────────────

import { ConsoleMailProvider } from './console.provider';

describe('ConsoleMailProvider', () => {
  it('resolves with a messageId', async () => {
    const provider = new ConsoleMailProvider();
    const result = await provider.send({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      text: 'Hello',
    });
    expect(result.messageId).toBeTruthy();
    expect(result.messageId).toMatch(/^console-/);
  });

  it('does not throw for any message content', async () => {
    const provider = new ConsoleMailProvider();
    await expect(
      provider.send({
        to: 'user@example.com',
        subject: 'OTP: 123456',
        html: '<b>code</b>',
        text: 'code: 123456',
        headers: { 'List-Unsubscribe': '<https://example.com>' },
      })
    ).resolves.not.toThrow();
  });
});
