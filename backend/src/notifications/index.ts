// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Notifications public surface
//
// Re-exports the outbox writer so callers import from 'notifications/' without
// knowing the internal file layout.
// ──────────────────────────────────────────────────────────────────────────────

export { enqueueOutbox, type PrismaTransactionClient } from './outbox.writer';
