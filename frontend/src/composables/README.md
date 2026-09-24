# composables/

Vue composables shared across stores and views. Unlike `stores/*`, these
hold no Pinia state of their own — each call to one creates its own
independent, scoped instance.

## `usePoller.ts`

`usePoller(fn, options)` repeatedly calls `fn` on an interval until it
resolves `true`, then stops. It is the one place polling cadence, backoff
and tab-visibility handling live, so every "wait for an on-chain condition"
loop in the app behaves the same way:

- pauses automatically while `document.hidden` (no wasted RPC calls for a
  backgrounded tab), and resumes promptly when the tab becomes visible;
- optionally widens its interval after `backoffAfterMs` has elapsed
  (`intervalMs` → `maxIntervalMs`), matching the cadence in
  `reference/onchain-data.md` §5.1 (every 6s, backing off to 20s after 3
  minutes);
- optionally times out after `timeoutMs`, calling `onTimeout` once;
- cleans itself up automatically when its owning component/effect scope is
  disposed (`onScopeDispose`), so callers do not need their own `onUnmounted`
  cleanup for it.

Returns `{ status, attempts, lastCheckedAt, stop, checkNow, start }`:

```ts
const poller = usePoller(
  async () => {
    const arrived = await payment.trackArrival(userPayment);
    return arrived.arrived;
  },
  { intervalMs: 6_000, backoffAfterMs: 3 * 60_000, maxIntervalMs: 20_000, timeoutMs: 10 * 60_000 }
);
// poller.status.value: 'idle' | 'polling' | 'succeeded' | 'stopped'
// poller.checkNow() — for a manual "Refresh" button
// poller.stop() — for an unmount or a "give up" action
```

Consumers: `stores/payment.ts` (`trackArrival`) and `stores/payable.ts`
(`trackSync`) both build a `usePoller` internally and expose their own
narrower, typed result to callers — views never call `usePoller` directly
for those two cases. A future view that needs its own ad-hoc on-chain wait
can still reach for `usePoller` directly.
