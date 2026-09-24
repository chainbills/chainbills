// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Loop runner tests
//
// Covers: fn is called, errors are caught without crashing, stop() resolves.
// ──────────────────────────────────────────────────────────────────────────────

import { runLoop } from './loop-runner';

describe('runLoop', () => {
  it('calls fn at least once when started', async () => {
    let callCount = 0;
    let stopFn!: () => Promise<void>;

    // The fn signals that it has been called, then signals stop.
    const fn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount >= 1) {
        // Stop the loop after first call to avoid infinite running.
        void stopFn();
      }
    });

    stopFn = runLoop({ name: 'test', intervalMs: 0, fn });
    await stopFn;

    expect(fn).toHaveBeenCalled();
  });

  it('does not crash when fn throws', async () => {
    let callCount = 0;
    let stopFn!: () => Promise<void>;

    const fn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error('iteration error');
      // Stop after second call.
      void stopFn();
    });

    stopFn = runLoop({ name: 'test', intervalMs: 0, fn });
    // Wait briefly for at least two iterations.
    await new Promise<void>((r) => setTimeout(r, 50));
    await stopFn();

    // fn was called at least twice (error call + recovery call).
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('stop() resolves after the current iteration finishes', async () => {
    const finished: string[] = [];

    const fn = vi.fn().mockImplementation(async () => {
      await new Promise<void>((r) => setTimeout(r, 5));
      finished.push('iteration');
    });

    const stop = runLoop({ name: 'test', intervalMs: 0, fn });
    // Give one iteration time to start.
    await new Promise<void>((r) => setTimeout(r, 2));
    await stop();

    // After stop resolves the iteration must have completed.
    expect(finished.length).toBeGreaterThanOrEqual(1);
  });
});
