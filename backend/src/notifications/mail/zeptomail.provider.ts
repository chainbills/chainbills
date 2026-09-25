// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — ZeptoMail provider
//
// Sends transactional email via the ZeptoMail REST API (v1.1/email).
// Authentication: `Authorization: Zoho-enczapikey <token>`. The Zoho console
// copies the token already prefixed with `Zoho-enczapikey `, so this provider
// accepts either form (raw token or pre-prefixed string) and normalises to a
// single, correct Authorization header.
// Region: ZEPTOMAIL_API_URL matches the Zoho account's region
//   (cpaas.zoho.com for global, cpaas.zoho.eu for EU, cpaas.zoho.in for India).
// Custom headers (List-Unsubscribe) are sent as the `mime_headers` object.
// 10-second fetch timeout. Non-2xx responses throw MailProviderError.
//
// ZeptoMail request shape (v1.1):
//   POST /v1.1/email
//   {
//     "from": { "address": "...", "name": "..." },
//     "to": [{ "email_address": { "address": "...", "name": "" } }],
//     "subject": "...",
//     "htmlbody": "...",
//     "textbody": "...",
//     "mime_headers": { "List-Unsubscribe": "...", ... }   // optional
//   }
// ──────────────────────────────────────────────────────────────────────────────

import type { MailMessage, MailProvider } from './mail.provider';
import { MailProviderError } from './mail.provider';

/**
 * ZeptoMail API response shape.
 * The `data` array contains one object per recipient with a `message_id`.
 */
interface ZeptoMailResponse {
  data?: Array<{ message_id?: string }>;
  message?: string;
  code?: string;
  error?: { code?: string; message?: string };
}

/**
 * Delivers email through ZeptoMail's REST API.
 *
 * Constructed with the three config values from AppConfigService.env.zeptomail.
 * The `apiUrl` should be the region host (no trailing slash); this provider
 * appends `/v1.1/email` when making the request.
 */
const AUTH_PREFIX = 'Zoho-enczapikey ';

export class ZeptoMailProvider implements MailProvider {
  private readonly authHeader: string;

  constructor(
    private readonly apiUrl: string,
    apiKey: string,
    private readonly fromAddress: string,
    private readonly fromName: string
  ) {
    // Accept both the raw token and the `Zoho-enczapikey <token>` form the
    // Zoho console's copy-to-clipboard produces. Prepending the prefix
    // unconditionally would double it up when the user pastes the copied
    // value verbatim and ZeptoMail would reject the request with 401.
    const trimmed = apiKey.trim();
    this.authHeader = trimmed.startsWith(AUTH_PREFIX) ? trimmed : `${AUTH_PREFIX}${trimmed}`;
  }

  async send(msg: MailMessage): Promise<{ messageId: string }> {
    const url = `${this.apiUrl}/v1.1/email`;

    // Build request body per ZeptoMail v1.1 schema.
    const body: Record<string, unknown> = {
      from: { address: this.fromAddress, name: this.fromName },
      to: [{ email_address: { address: msg.to, name: '' } }],
      subject: msg.subject,
      htmlbody: msg.html,
      textbody: msg.text,
    };

    // Attach List-Unsubscribe and other custom headers via mime_headers.
    if (msg.headers && Object.keys(msg.headers).length > 0) {
      body['mime_headers'] = msg.headers;
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new MailProviderError(`ZeptoMail fetch failed: ${message}`, 'NETWORK_ERROR');
    }

    const rawText = await response.text();
    let parsed: ZeptoMailResponse = {};
    try {
      parsed = JSON.parse(rawText) as ZeptoMailResponse;
    } catch {
      // Leave parsed as empty object; error handling below will use the HTTP status.
    }

    if (!response.ok) {
      const code = parsed.error?.code ?? parsed.code ?? String(response.status);
      const detail = parsed.error?.message ?? parsed.message ?? rawText.slice(0, 200);
      throw new MailProviderError(`ZeptoMail error ${code}: ${detail}`, code);
    }

    // Extract message_id from the first recipient entry.
    const messageId = parsed.data?.[0]?.message_id ?? `zeptomail-${Date.now()}`;
    return { messageId };
  }
}
