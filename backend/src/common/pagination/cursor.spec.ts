// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Cursor pagination helper tests
//
// Covers encode/decode round-tripping and both malformed-input failure
// paths in decodeCursor (invalid base64url, and valid base64url that is not
// JSON), each of which must raise a BadRequestException rather than throw.
// ──────────────────────────────────────────────────────────────────────────────

import { BadRequestException } from '@nestjs/common';
import { decodeCursor, encodeCursor } from './cursor';

describe('encodeCursor / decodeCursor', () => {
  it('round-trips an object value', () => {
    const value = { createdAt: '2026-09-24T00:00:00.000Z', id: 'abc123' };
    expect(decodeCursor(encodeCursor(value))).toEqual(value);
  });

  it('round-trips a primitive value', () => {
    expect(decodeCursor<number>(encodeCursor(42))).toBe(42);
  });

  it('produces a URL-safe base64url string with no padding characters', () => {
    const cursor = encodeCursor({ a: 1 });
    expect(cursor).not.toMatch(/[+/=]/);
  });

  it('throws BadRequestException for a cursor that is not valid JSON once decoded', () => {
    // "not json" base64url-decodes cleanly but is not valid JSON.
    const cursor = Buffer.from('not json', 'utf8').toString('base64url');
    expect(() => decodeCursor(cursor)).toThrow(BadRequestException);
    expect(() => decodeCursor(cursor)).toThrow(/invalid cursor/);
  });

  it('throws BadRequestException for input that fails to base64url-decode', () => {
    const spy = vi.spyOn(Buffer, 'from').mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => decodeCursor('anything')).toThrow(BadRequestException);
    spy.mockRestore();
  });
});
