// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Unsubscribe link utilities
//
// Shared between the outbox processor (building the link in templates) and the
// unsubscribe controller (verifying the signature on incoming requests).
//
// Signature: base64url(HMAC-SHA256(UNSUBSCRIBE_SECRET, userId + ':' + type)).
// Verified with crypto.timingSafeEqual to prevent timing attacks.
// ──────────────────────────────────────────────────────────────────────────────

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Computes the unsubscribe HMAC signature for a given userId + type pair.
 * Returns a URL-safe base64 string (no padding, `+` and `/` replaced).
 */
export function computeUnsubscribeSig(secret: string, userId: string, type: string): string {
  const hmac = createHmac('sha256', secret).update(`${userId}:${type}`).digest();
  return hmac.toString('base64url');
}

/**
 * Builds the full one-click unsubscribe URL including the HMAC signature.
 *
 * @param publicApiUrl  Base URL of the API, e.g. `https://api.chainbills.xyz`.
 * @param userId        Recipient user id.
 * @param type          NotificationType string.
 * @param secret        UNSUBSCRIBE_SECRET.
 */
export function buildUnsubscribeUrl(publicApiUrl: string, userId: string, type: string, secret: string): string {
  const sig = computeUnsubscribeSig(secret, userId, type);
  const base = publicApiUrl.replace(/\/$/, '');
  return `${base}/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(type)}&s=${encodeURIComponent(sig)}`;
}

/**
 * Verifies an incoming unsubscribe signature with constant-time comparison.
 * Returns `true` when the signature is valid, `false` otherwise.
 * Never throws on a malformed signature — always returns false.
 */
export function verifyUnsubscribeSig(secret: string, userId: string, type: string, sig: string): boolean {
  try {
    const expected = computeUnsubscribeSig(secret, userId, type);
    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(sig, 'utf8');

    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}
