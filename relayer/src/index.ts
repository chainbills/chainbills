// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Entry Point
//
// Starts all chain watchers in parallel and runs the job processor on a
// fixed interval. Each watcher runs in its own async loop; a crash in one
// chain watcher is logged but does not affect the others.
//
// Process management (production):
//   Run under PM2 or as a Cloud Run container with min-instances=1.
//   The getLogs cursor in Firestore ensures zero events are missed on restart.
// ──────────────────────────────────────────────────────────────────────────────

// Load config first — validates env vars and injects RPC URLs into chain configs.
import './config.js';

import { formatEther } from 'viem';
import { ALL_CHAINS } from './config.js';
import { processJobs } from './jobs/processor.js';
import { makePublicClient, relayerAccount } from './utils/clients.js';
import { logger } from './utils/logger.js';
import { startChainWatcher } from './watchers.js';

const PROCESSOR_INTERVAL_MS = 30_000; // Run job processor every 30s

async function main() {
  logger.info('Chainbills Relayer starting…');
  logger.info({ chains: ALL_CHAINS.map((c) => c.name) }, `Watching ${ALL_CHAINS.length} chains`);

  // Start one watcher per chain — all run concurrently in parallel async loops.
  const watcherPromises = ALL_CHAINS.map((chain) =>
    startChainWatcher(chain).catch((err) => {
      logger.error({ chain: chain.name, err }, 'Chain watcher crashed — restarting');
      // Crash the process so PM2 / Cloud Run restarts it cleanly.
      process.exit(1);
    })
  );

  // Run the job processor on a fixed interval.
  const processorLoop = async () => {
    while (true) {
      try {
        await processJobs();
      } catch (err) {
        logger.error({ err }, 'Job processor error');
      }
      await new Promise((r) => setTimeout(r, PROCESSOR_INTERVAL_MS));
    }
  };

  // Periodically check gas balances
  const balanceCheckLoop = async () => {
    const account = relayerAccount();
    while (true) {
      try {
        for (const chain of ALL_CHAINS) {
          const publicClient = makePublicClient(chain);
          const balance = await publicClient.getBalance({ address: account.address });
          if (balance < chain.minGasBalance) {
            logger.warn(
              { chain: chain.name, balance: formatEther(balance) },
              `CRITICAL: Low native token balance on ${chain.name} (${formatEther(balance)} ETH) — Please fund relayer!`
            );
          } else {
            logger.debug({ chain: chain.name, balance: formatEther(balance) }, 'Gas balance OK');
          }
        }
      } catch (err) {
        logger.error({ err }, 'Gas balance check error');
      }
      await new Promise((r) => setTimeout(r, 5 * 60 * 1000)); // Check every 5 minutes
    }
  };

  // Run watchers + processor + balance checker together.
  await Promise.all([...watcherPromises, processorLoop(), balanceCheckLoop()]);
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error — relayer crashed');
  process.exit(1);
});
