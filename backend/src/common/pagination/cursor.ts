// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Cursor pagination helpers
//
// SPEC.md §12.1: list endpoints take `?limit=` and `?cursor=` and respond
// `{ items, nextCursor }`. The cursor is opaque to clients — base64url JSON
// of whatever sort key the query used (e.g. `{ createdAt, id }`) — so a
// caller can never guess or forge a page boundary, and each endpoint is free
// to choose its own sort key shape without changing this encoding.
// ──────────────────────────────────────────────────────────────────────────────

import { BadRequestException } from '@nestjs/common';

/** A single page of a cursor-paginated list response. */
export interface CursorPage<T> {
  items: T[];
  /** Opaque cursor for the next page, or `null` when this was the last page. */
  nextCursor: string | null;
}

/**
 * Encodes a sort-key value into an opaque cursor string. `value` should be
 * exactly what the next query's `WHERE` clause needs to resume after the
 * last row of the current page (e.g. `{ createdAt: string, id: string }`).
 */
export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

/**
 * Decodes a cursor produced by {@link encodeCursor}. Throws a 400 on any
 * malformed input — a cursor is client-supplied, so a bad or tampered value
 * must fail as a normal request error, never as an unhandled exception.
 */
export function decodeCursor<T>(cursor: string): T {
  let json: string;
  try {
    json = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw new BadRequestException('invalid cursor');
  }
  try {
    return JSON.parse(json) as T;
  } catch {
    throw new BadRequestException('invalid cursor');
  }
}
