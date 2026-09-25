// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Loop runner utility
//
// Wraps a repeating async function in a loop that:
//   - Starts in onApplicationBootstrap (via WorkerModule).
//   - Catches and logs iteration errors without crashing the process.
//   - Stops gracefully when stop() is called (waits for the current iteration).
//
// Invariants:
//   - A failure in one iteration is logged and retried on the next tick.
//   - The loop does not start until start() is called.
//   - stop() resolves once the current iteration finishes.
// ──────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';

/**
 * Hard ceiling on how long `stop()` will wait for an in-flight iteration.
 * Past this, the loop is marked stopped even if the tick is still running, so
 * a stuck RPC call never blocks shutdown past the point tsc-watch / Kubernetes
 * would otherwise SIGKILL us. In-flight work is orphaned intentionally — the
 * lock still gets released and the standby can take over.
 */
const STOP_TIMEOUT_MS = 3_000;

/** Options for a single loop. */
export interface LoopOptions {
  /** Human label used in log messages. */
  name: string;
  /** Time to wait between iterations, in ms. */
  intervalMs: number;
  /** The function to run each iteration. */
  fn: () => Promise<void>;
}

/**
 * Starts a named loop and returns a stop function. The caller is responsible
 * for awaiting stop() on shutdown to wait for the current iteration to finish.
 */
export function runLoop(opts: LoopOptions): () => Promise<void> {
  const logger = new Logger(`Loop:${opts.name}`);
  let running = true;

  // Resolve to signal that the loop has fully stopped.
  let resolveStop: () => void;
  const stopped = new Promise<void>((r) => {
    resolveStop = r;
  });

  async function loop(): Promise<void> {
    while (running) {
      try {
        await opts.fn();
      } catch (err) {
        logger.error({ err }, `iteration error — will retry after ${opts.intervalMs}ms`);
      }

      if (!running) break;

      await new Promise<void>((r) => setTimeout(r, opts.intervalMs));
    }
    resolveStop!();
  }

  // Fire-and-forget; errors are caught inside the loop.
  void loop();

  return async () => {
    running = false;
    const timedOut = await Promise.race([
      stopped.then(() => false),
      new Promise<boolean>((r) => setTimeout(() => r(true), STOP_TIMEOUT_MS)),
    ]);
    if (timedOut) {
      logger.warn(`loop stop timed out after ${STOP_TIMEOUT_MS}ms — abandoning in-flight iteration`);
    } else {
      logger.log('loop stopped');
    }
  };
}
