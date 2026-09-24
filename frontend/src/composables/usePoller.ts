// composables/usePoller.ts
//
// A generic, visibility-aware polling loop. Chainbills has no push
// notifications for on-chain state, so every "is it done yet" question
// (has the relayer delivered a cross-chain payment? has a payable's update
// synced to another chain?) is answered by polling a read on an interval.
// This composable is the one place that polling cadence, backoff and
// pause-when-hidden logic lives, so every poller in the app behaves the
// same way.
//
// Used by: `stores/payment.ts` (`trackArrival`), `stores/payable.ts`
// (`trackSync`), and any future view/composable that needs to wait for an
// on-chain condition without a page reload.
import { onScopeDispose, ref } from 'vue';

/** Lifecycle of a poller. */
export type PollerStatus = 'idle' | 'polling' | 'succeeded' | 'stopped';

export interface UsePollerOptions {
  /** How often to call `fn` while the tab is visible and before `backoffAfterMs` has elapsed. */
  intervalMs: number;
  /** After this many milliseconds since the poller started, the interval widens to `maxIntervalMs`. Omit to never back off. */
  backoffAfterMs?: number;
  /** The widened interval used once `backoffAfterMs` has elapsed. Required when `backoffAfterMs` is set. */
  maxIntervalMs?: number;
  /** Optional wall-clock cutoff (milliseconds since start) after which the poller stops on its own, calling `onTimeout`. */
  timeoutMs?: number;
  /** Called once if `timeoutMs` elapses without `fn` returning true. */
  onTimeout?: () => void;
  /** Starts polling immediately when true (the default). Set to false to call `start()` explicitly later. */
  immediate?: boolean;
}

export interface UsePollerHandle {
  status: import('vue').Ref<PollerStatus>;
  /** How many times `fn` has been called so far. */
  attempts: import('vue').Ref<number>;
  /** Timestamp (ms) of the most recent call to `fn`, or null before the first one. */
  lastCheckedAt: import('vue').Ref<number | null>;
  /** Stops polling without changing `status` to `'succeeded'`. Safe to call multiple times. */
  stop: () => void;
  /** Runs `fn` once immediately, outside the regular interval (for a manual "Refresh" button). */
  checkNow: () => Promise<void>;
  /** Starts polling if it is not already running (only needed when `immediate: false` was passed). */
  start: () => void;
}

/**
 * Repeatedly calls `fn` until it resolves `true` (success — polling stops
 * and `status` becomes `'succeeded'`) or the poller is stopped/unmounted.
 * Polling pauses automatically while `document.hidden`, and resumes at the
 * next tick after the tab becomes visible again — this saves RPC calls for
 * a tab in the background and matches the cadence described in
 * `reference/onchain-data.md` §5.1 (poll every 6s, back off to 20s after 3
 * minutes, typical CCTP relay 1–3 minutes).
 *
 * @param fn Called on each tick; returns (or resolves to) `true` once the condition being waited for is met.
 */
export const usePoller = (fn: () => boolean | Promise<boolean>, options: UsePollerOptions): UsePollerHandle => {
  const status = ref<PollerStatus>('idle');
  const attempts = ref(0);
  const lastCheckedAt = ref<number | null>(null);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let startedAt: number | null = null;
  let disposed = false;

  const currentInterval = () => {
    if (!options.backoffAfterMs || !options.maxIntervalMs || !startedAt) return options.intervalMs;
    return Date.now() - startedAt >= options.backoffAfterMs ? options.maxIntervalMs : options.intervalMs;
  };

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const scheduleNext = () => {
    clearTimer();
    if (disposed || status.value !== 'polling') return;
    timer = setTimeout(tick, currentInterval());
  };

  const tick = async () => {
    // Skip this tick (but stay scheduled) while the tab is hidden — no point spending an RPC call nobody sees.
    if (document.hidden) {
      scheduleNext();
      return;
    }
    attempts.value++;
    lastCheckedAt.value = Date.now();
    let succeeded = false;
    try {
      succeeded = await fn();
    } catch {
      // A failed check is treated like "not yet" — the next tick tries again.
      succeeded = false;
    }
    if (disposed) return;
    if (succeeded) {
      status.value = 'succeeded';
      clearTimer();
      if (timeoutTimer) clearTimeout(timeoutTimer);
      return;
    }
    scheduleNext();
  };

  const stop = () => {
    status.value = status.value === 'succeeded' ? status.value : 'stopped';
    clearTimer();
    if (timeoutTimer) clearTimeout(timeoutTimer);
  };

  const start = () => {
    if (status.value === 'polling') return;
    status.value = 'polling';
    startedAt = Date.now();
    if (options.timeoutMs) {
      timeoutTimer = setTimeout(() => {
        if (status.value === 'polling') {
          stop();
          options.onTimeout?.();
        }
      }, options.timeoutMs);
    }
    tick();
  };

  const checkNow = async () => {
    attempts.value++;
    lastCheckedAt.value = Date.now();
    try {
      const succeeded = await fn();
      if (succeeded && !disposed) {
        status.value = 'succeeded';
        clearTimer();
        if (timeoutTimer) clearTimeout(timeoutTimer);
      }
    } catch {
      // A manual check that throws is surfaced as "still not there" — the caller's own UI shows the error, if any.
    }
  };

  const onVisibilityChange = () => {
    // Resuming visibility does not reset the backoff clock — it only means the next scheduled tick can now run promptly.
    if (!document.hidden && status.value === 'polling') tick();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  if (options.immediate !== false) start();

  onScopeDispose(() => {
    disposed = true;
    clearTimer();
    if (timeoutTimer) clearTimeout(timeoutTimer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });

  return { attempts, checkNow, lastCheckedAt, start, status, stop };
};
