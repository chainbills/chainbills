// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — @Public() decorator
//
// Metadata-only marker for routes that skip the (deny-by-default) global
// JWT guard added in phase 2b (SPEC.md §9.2). Phase 1 defines the metadata
// key and decorator now so route handlers can be annotated ahead of the
// guard's arrival without a breaking change later; the decorator has no
// effect on its own until that guard reads `IS_PUBLIC_KEY`.
// ──────────────────────────────────────────────────────────────────────────────

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route handler (or an entire controller) as not requiring auth. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
