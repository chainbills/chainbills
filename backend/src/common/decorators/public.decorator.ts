// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — @Public() decorator
//
// Metadata-only marker for routes that skip the deny-by-default global JWT
// guard. The decorator has no effect on its own until that guard reads
// `IS_PUBLIC_KEY`.
// ──────────────────────────────────────────────────────────────────────────────

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route handler (or an entire controller) as not requiring auth. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
