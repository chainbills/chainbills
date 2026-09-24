// src/components/tx/retry.ts
//
// A tiny, session-scoped handle for "how to retry the flow currently shown
// in TxFlowDialog". A page registers a zero-argument function right before
// it starts a tx-flow (create, pay, withdraw, a host-control write); when
// that flow ends up `failed` or `cancelled`, TxFlowDialog's "Try again"
// button calls whatever was registered last. Kept outside Pinia — this is a
// transient UI wire-up between "the button that started a flow" and "the
// dialog watching it", not app state that needs to survive a reload or be
// inspected in devtools.
//
// Used by: `TxFlowDialog.vue` (reads it), and every view that starts a
// flow it wants retryable from the dialog (`CreatePayableView.vue`,
// `PayView.vue`, `WithdrawDialog.vue`).
import { ref } from 'vue';

type RetryFn = () => void;

const current = ref<RetryFn | null>(null);

export const useTxRetry = () => {
  /** Registers the function that re-runs the action about to start a flow. Call right before starting it. */
  const setRetry = (fn: RetryFn | null) => {
    current.value = fn;
  };
  /** Re-runs the last registered action, if one is set. */
  const retry = () => current.value?.();
  return { retry, setRetry };
};
