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
    await stopped;
    logger.log('loop stopped');
  };
}
