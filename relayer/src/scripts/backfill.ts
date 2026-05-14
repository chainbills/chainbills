// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Historical Backfill Script
//
// One-off script to index all historical events on all chains from block 0
// (or chain.deploymentBlock) up to the current head.
//
// Usage:
//   npm run backfill
//   # or for a specific chain:
//   BACKFILL_CHAIN=arctestnet npm run backfill
//
// This is safe to re-run: all writes use { merge: true } so existing records
// are not overwritten. The block cursor is updated after each batch so the
// script can be interrupted and resumed.
// ──────────────────────────────────────────────────────────────────────────────

import '../config.js';
import { ALL_CHAINS } from '../config.js';
import { logger } from '../utils/logger.js';
import { startChainWatcher } from '../watchers.js';

async function backfill() {
  const targetChainName = process.env.BACKFILL_CHAIN;
  const chains = targetChainName ? ALL_CHAINS.filter((c) => c.name === targetChainName) : ALL_CHAINS;

  if (chains.length === 0) {
    logger.error({ targetChainName }, 'No matching chains found');
    process.exit(1);
  }

  logger.info({ chains: chains.map((c) => c.name) }, 'Starting backfill');

  // Run one watcher per selected chain. The watcher will process all blocks
  // from the stored cursor (or deploymentBlock) to the current head, then
  // continue running as a live watcher.
  // For a one-shot backfill, kill the process with Ctrl+C once caught-up.
  await Promise.all(chains.map((c) => startChainWatcher(c)));
}

backfill().catch((err) => {
  logger.fatal({ err }, 'Backfill failed');
  process.exit(1);
});
