// stores/tx-flow.ts
//
// The transaction-flow engine: a reactive model of a multi-step user action
// (creating a payable, paying, withdrawing, editing a payable's settings)
// that reports every step as it happens so the UI can render step-by-step
// progress instead of a single opaque spinner. Every store action that
// performs a write (`stores/evm.ts`, `stores/payable.ts`,
// `stores/payment.ts`, `stores/withdrawal.ts`) starts a flow with `start()`
// and drives its steps through the returned handle; `evm.writeContract`
// itself understands `TxStepHandle` and reports the simulate/wallet-prompt/
// confirm phases of a single write onto whichever step it is given.
//
// `current` is the one flow the UI shows in its transaction progress
// modal. `background` holds flows whose write already succeeded but which
// are still waiting on something the user does not need to stare at (a
// cross-chain relay, a payable sync) — the app shell can surface those in a
// small persistent indicator instead.
import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import type { Chain } from '@/schemas';

/** Lifecycle of a single step inside a transaction flow. */
export type TxStepStatus = 'upcoming' | 'active' | 'waiting' | 'done' | 'skipped' | 'failed';

/** One step of a flow, e.g. "Approve USDC" or "Relaying to Arc Testnet". */
export interface TxStep {
  /** Stable key used to look the step up again, e.g. `'approve'`, `'sign'`, `'relay'`. */
  key: string;
  /** Short, specific title shown next to the step, e.g. "Approve 25 USDC". */
  title: string;
  /** One-line description of what is happening right now. Updated live as the step progresses. */
  description: string;
  /** Rotating microcopy shown while the step is `active` or `waiting` (for example alternating relay-progress hints). */
  hints?: string[];
  status: TxStepStatus;
  /** The chain this step runs on, when relevant (a sync step has one sub-status per destination chain instead). */
  chain?: Chain;
  txHash?: string;
  explorerUrl?: string;
  startedAt?: number;
  endedAt?: number;
  /** Human-readable failure reason, set only when `status === 'failed'`. */
  error?: string;
}

/** The kinds of multi-step actions the app performs. Each kind has its own fixed list of steps. */
export type TxFlowKind =
  | 'create-payable'
  | 'pay'
  | 'pay-cross-chain'
  | 'withdraw'
  | 'close-payable'
  | 'reopen-payable'
  | 'update-payable-tokens'
  | 'update-payable-auto-withdraw'
  | 'update-payable-description';

/** A user-initiated multi-step action and its steps' live state. */
export interface TxFlow {
  id: string;
  kind: TxFlowKind;
  title: string;
  subtitle?: string;
  steps: TxStep[];
  status: 'running' | 'succeeded' | 'failed' | 'cancelled';
  /** Whatever the flow produced — ids, hashes — for the caller/UI to read once it settles. */
  result?: Record<string, unknown>;
  /** True for flows with a long wait (relay, sync) the user may navigate away from; the header can then show it as "background". */
  canRunInBackground?: boolean;
}

/**
 * Handle for driving one step of a running flow. Returned by
 * `TxFlowHandle.step(key)`. `evm.writeContract` accepts one of these (as
 * `TxStepHandle`, its narrower write-only view) to report the phases of a
 * single on-chain write.
 */
export interface TxStepHandle {
  /** Marks the step in progress, optionally replacing its description (e.g. as a write moves from simulate to confirm). */
  activate(description?: string): void;
  /** Marks the step in progress but blocked on something outside the app's control (a wallet prompt), with a one-line hint. */
  wait(hint?: string): void;
  /** Updates fields on an already-active/waiting step without changing its status — used for the txHash/explorerUrl/description updates once a write's hash is known. */
  progress(meta: Partial<Pick<TxStep, 'description' | 'txHash' | 'explorerUrl' | 'hints'>>): void;
  /** Marks the step complete, merging any final metadata (txHash, explorerUrl, ...). */
  done(meta?: Partial<Pick<TxStep, 'txHash' | 'explorerUrl'>>): void;
  /** Marks the step as intentionally not run (for example "approve" when the allowance was already sufficient). */
  skip(): void;
  /** Marks the step failed with a human-readable message. */
  fail(error: string): void;
}

/** Handle for a whole running flow: per-step handles plus flow-level terminal transitions. */
export interface TxFlowHandle {
  id: string;
  flow: TxFlow;
  /** Gets the step handle for `key`. Throws if the flow was not started with a step of that key. */
  step(key: string): TxStepHandle;
  /** Marks the flow succeeded and records its result payload (ids, hashes) for the caller to read. */
  finish(result?: Record<string, unknown>): void;
  /** Marks the flow cancelled (used for a wallet rejection) — no error toast is shown for this outcome. */
  cancel(): void;
  /** Marks the flow failed. If no step is currently `active`/`waiting`, the failure is recorded on the flow itself. */
  fail(error: string): void;
  /** Moves this flow from `current` into the `background` list — for a long wait the user may navigate away from. */
  moveToBackground(): void;
}

let nextFlowId = 0;

export const useTxFlowStore = defineStore('tx-flow', () => {
  /** All flows started this session, most recent first is not guaranteed — look up by id. */
  const flows = reactive(new Map<string, TxFlow>());
  /** The id of the flow the UI's modal should show, or null when nothing is running in the foreground. */
  const currentId = ref<string | null>(null);
  /** Ids of flows relegated to the background list (still `running`, but the user does not need to watch them). */
  const backgroundIds = ref<string[]>([]);

  /** The flow the UI shows in its modal. */
  const current = computed<TxFlow | null>(() => (currentId.value ? (flows.get(currentId.value) ?? null) : null));

  /** Flows still waiting (relay, sync) that a persistent header indicator can surface. */
  const background = computed<TxFlow[]>(() =>
    backgroundIds.value.map((id) => flows.get(id)).filter((f): f is TxFlow => !!f)
  );

  const now = () => Date.now();

  const findStep = (flow: TxFlow, key: string): TxStep => {
    const step = flow.steps.find((s) => s.key === key);
    if (!step) throw new Error(`Unknown tx-flow step "${key}" for flow "${flow.kind}"`);
    return step;
  };

  const makeStepHandle = (flow: TxFlow, key: string): TxStepHandle => ({
    activate(description) {
      const step = findStep(flow, key);
      step.status = 'active';
      if (description) step.description = description;
      step.startedAt ??= now();
    },
    wait(hint) {
      const step = findStep(flow, key);
      step.status = 'waiting';
      step.startedAt ??= now();
      if (hint) step.hints = [hint];
    },
    progress(meta) {
      const step = findStep(flow, key);
      Object.assign(step, meta);
    },
    done(meta) {
      const step = findStep(flow, key);
      Object.assign(step, meta);
      step.status = 'done';
      step.endedAt = now();
    },
    skip() {
      const step = findStep(flow, key);
      step.status = 'skipped';
      step.startedAt ??= now();
      step.endedAt = now();
    },
    fail(error) {
      const step = findStep(flow, key);
      step.status = 'failed';
      step.error = error;
      step.endedAt = now();
      flow.status = 'failed';
    },
  });

  /**
   * Starts a new flow, makes it `current`, and returns a handle to drive it.
   * @param kind    Which kind of action this is (drives step wiring conventions documented in README §5).
   * @param title   Flow title shown in the modal header, e.g. "Pay 25 USDC".
   * @param steps   The steps this flow will go through, each starting as `upcoming` unless given another status.
   * @param options Optional `subtitle` and `canRunInBackground` (for flows with a relay/sync tail).
   */
  const start = (
    kind: TxFlowKind,
    title: string,
    steps: Array<Pick<TxStep, 'key' | 'title' | 'description'> & Partial<TxStep>>,
    options?: { subtitle?: string; canRunInBackground?: boolean }
  ): TxFlowHandle => {
    const id = `tx-${++nextFlowId}-${now()}`;
    flows.set(id, {
      id,
      kind,
      title,
      subtitle: options?.subtitle,
      steps: steps.map((s) => ({ status: 'upcoming', ...s })),
      status: 'running',
      canRunInBackground: options?.canRunInBackground,
    });
    // `flows` is a `reactive()` Map: `.get()` returns a reactive-wrapped view of the
    // stored object, whose property writes actually notify Vue. The plain object
    // literal passed to `.set()` above is not itself reactive — every mutation below
    // (and every one a `TxStepHandle`/`TxFlowHandle` makes later) must go through
    // this reactive reference, or the UI never re-renders as steps progress.
    const flow = flows.get(id)!;
    currentId.value = id;

    return {
      id,
      flow,
      step: (key) => makeStepHandle(flow, key),
      finish(result) {
        flow.status = 'succeeded';
        flow.result = result;
        if (currentId.value === id) currentId.value = null;
        backgroundIds.value = backgroundIds.value.filter((bid) => bid !== id);
      },
      cancel() {
        flow.status = 'cancelled';
        if (currentId.value === id) currentId.value = null;
        backgroundIds.value = backgroundIds.value.filter((bid) => bid !== id);
      },
      fail(error) {
        // A step already marked `failed` (via its own handle) carries the message; otherwise record it on the flow.
        const activeStep = flow.steps.find((s) => s.status === 'active' || s.status === 'waiting');
        if (activeStep) {
          activeStep.status = 'failed';
          activeStep.error = error;
          activeStep.endedAt = now();
        }
        flow.status = 'failed';
      },
      moveToBackground() {
        moveToBackground(id);
      },
    };
  };

  /** Re-opens a background flow as the current one (for example the user clicks the header's "relaying…" indicator). */
  const bringToForeground = (id: string) => {
    backgroundIds.value = backgroundIds.value.filter((bid) => bid !== id);
    currentId.value = id;
  };

  /** Moves a still-running flow into the background list by id — the same effect as its own handle's `moveToBackground`, exposed here so `TxFlowDialog`'s "Continue in background" button can call it without holding onto the original handle. */
  const moveToBackground = (id: string) => {
    if (currentId.value === id) currentId.value = null;
    if (!backgroundIds.value.includes(id)) backgroundIds.value = [...backgroundIds.value, id];
  };

  /** Dismisses the modal for the current flow without changing its status (used after `succeeded`/`failed`/`cancelled`). */
  const dismiss = () => {
    currentId.value = null;
  };

  return { background, bringToForeground, current, dismiss, flows, moveToBackground, start };
});
