// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — ZeptoMail provider tests
//
// Covers: correct request body shape, auth header, List-Unsubscribe header,
// successful response parsing, non-2xx error mapping, network error.
// All tests mock fetch — no network access needed.
// ──────────────────────────────────────────────────────────────────────────────

import { ZeptoMailProvider } from './zeptomail.provider';
import { MailProviderError } from './mail.provider';
import type { MailMessage } from './mail.provider';

const API_URL = 'https://api.zeptomail.com';
const API_KEY = 'test-api-key';
const FROM_ADDRESS = 'notify@notify.chainbills.xyz';
const FROM_NAME = 'Chainbills';

function makeProvider() {
  return new ZeptoMailProvider(API_URL, API_KEY, FROM_ADDRESS, FROM_NAME);
}

function makeMockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  });
}

const BASE_MSG: MailMessage = {
  to: 'user@example.com',
  subject: 'Test subject',
  html: '<p>Hello</p>',
  text: 'Hello',
};

describe('ZeptoMailProvider.send', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sends a POST to /v1.1/email with the correct URL', async () => {
    const mockFetch = makeMockFetch(200, { data: [{ message_id: 'zm-123' }] });
    global.fetch = mockFetch as unknown as typeof fetch;
    const provider = makeProvider();
    await provider.send(BASE_MSG);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/v1.1/email`);
  });

  it('sends the Zoho-enczapikey auth header', async () => {
    const mockFetch = makeMockFetch(200, { data: [{ message_id: 'zm-123' }] });
    global.fetch = mockFetch as unknown as typeof fetch;
    await makeProvider().send(BASE_MSG);
    const [, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: `Zoho-enczapikey ${API_KEY}`,
    });
  });

  it('sends the correct JSON body shape', async () => {
    const mockFetch = makeMockFetch(200, { data: [{ message_id: 'zm-abc' }] });
    global.fetch = mockFetch as unknown as typeof fetch;
    await makeProvider().send(BASE_MSG);
    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.from).toEqual({ address: FROM_ADDRESS, name: FROM_NAME });
    expect(body.to).toEqual([{ email_address: { address: 'user@example.com', name: '' } }]);
    expect(body.subject).toBe('Test subject');
    expect(body.htmlbody).toBe('<p>Hello</p>');
    expect(body.textbody).toBe('Hello');
  });

  it('includes mime_headers when msg.headers is provided', async () => {
    const mockFetch = makeMockFetch(200, { data: [{ message_id: 'zm-456' }] });
    global.fetch = mockFetch as unknown as typeof fetch;
    const msg: MailMessage = {
      ...BASE_MSG,
      headers: {
        'List-Unsubscribe': '<https://example.com/unsub>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    };
    await makeProvider().send(msg);
    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.mime_headers?.['List-Unsubscribe']).toBeTruthy();
    expect(body.mime_headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('omits mime_headers when no headers are provided', async () => {
    const mockFetch = makeMockFetch(200, { data: [{ message_id: 'zm-789' }] });
    global.fetch = mockFetch as unknown as typeof fetch;
    await makeProvider().send(BASE_MSG);
    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.mime_headers).toBeUndefined();
  });

  it('returns the messageId from the response', async () => {
    const mockFetch = makeMockFetch(200, { data: [{ message_id: 'zm-return-me' }] });
    global.fetch = mockFetch as unknown as typeof fetch;
    const result = await makeProvider().send(BASE_MSG);
    expect(result.messageId).toBe('zm-return-me');
  });

  it('throws MailProviderError on non-2xx response', async () => {
    const mockFetch = makeMockFetch(400, {
      error: { code: 'TEM_INVALID', message: 'template not found' },
    });
    global.fetch = mockFetch as unknown as typeof fetch;
    await expect(makeProvider().send(BASE_MSG)).rejects.toBeInstanceOf(MailProviderError);
  });

  it('includes the provider error code in MailProviderError', async () => {
    const mockFetch = makeMockFetch(401, { code: 'AUTH_FAILED', message: 'bad key' });
    global.fetch = mockFetch as unknown as typeof fetch;
    const err = await makeProvider()
      .send(BASE_MSG)
      .catch((e) => e);
    expect(err).toBeInstanceOf(MailProviderError);
    expect((err as MailProviderError).providerCode).toBe('AUTH_FAILED');
  });

  it('throws MailProviderError with NETWORK_ERROR on fetch rejection', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network unreachable')) as unknown as typeof fetch;
    const err = await makeProvider()
      .send(BASE_MSG)
      .catch((e) => e);
    expect(err).toBeInstanceOf(MailProviderError);
    expect((err as MailProviderError).providerCode).toBe('NETWORK_ERROR');
  });
});
