<script setup lang="ts">
/**
 * src/components/tx/TxFlowDialog.vue — the single modal that renders
 * `useTxFlowStore().current`: every multi-step write in the app (create,
 * pay, withdraw, close/reopen/update a payable) shows its progress here.
 * Mounted once, in `App.vue`.
 *
 * Layout: a glass dialog (a bottom sheet on mobile, via PrimeVue's own
 * `position="bottom"`), with the flow's title/subtitle as the header, a
 * vertical `Stepper` bound to `flow.steps` as the body (each step's tx hash
 * and chain surface through the `meta` slot), and a footer that changes
 * with the flow's status:
 *  - `running`: "Keep this window open", or a "Continue in background"
 *    button once the active step is `waiting` on a background-eligible flow;
 *  - `succeeded`: a summary of the flow's result ids plus kind-specific
 *    actions ("View receipt", "Open payable", …);
 *  - `failed`: the failed step's error message plus "Try again";
 *  - `cancelled`: "You cancelled in your wallet." plus "Try again".
 *
 * The dialog refuses to close on a backdrop click or Escape while a step is
 * `waiting` on a wallet prompt, so an in-flight signature request is never
 * silently dropped. "Try again" re-runs whatever function the page that
 * started the flow last registered with `useTxRetry` (`./retry.ts`).
 */
import { AddressChip, ChainBadge, Stepper, type StepperStep } from '@/components/ui';
import IconOpenInNew from '@/icons/IconOpenInNew.vue';
import { useAnalyticsStore, useTxFlowStore } from '@/stores';
import type { TxFlow, TxStep } from '@/stores/tx-flow';
import Button from 'primevue/button';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { primaryActionsFor, type FlowAction } from './flow-actions';
import { useTxRetry } from './retry';

const txFlow = useTxFlowStore();
const analytics = useAnalyticsStore();
const { retry } = useTxRetry();
const router = useRouter();

/**
 * The flow this dialog renders. `txFlow.current` itself goes back to `null`
 * the instant a flow finishes or is cancelled (see `tx-flow.ts`'s `finish`/
 * `cancel`) — otherwise a succeeded/cancelled flow's dialog would vanish
 * before its footer ever got to render. This ref instead keeps showing
 * whichever flow was last made current until this dialog's own `close()`
 * explicitly clears it (Close/an action button, or dismissing while
 * allowed), so the `succeeded`/`failed`/`cancelled` footers stay on screen
 * for the user to act on. `moveToBackground`'s handler clears it directly
 * too, since that path means "hide this, not because it's done".
 */
const shownFlow = ref<TxFlow | null>(null);
watch(
  () => txFlow.current,
  (current) => {
    if (current) shownFlow.value = current;
  },
  { immediate: true }
);
const flow = computed(() => shownFlow.value);

watch(
  () => flow.value?.steps.find((s) => s.status === 'waiting'),
  (waitingStep) => {
    if (waitingStep && flow.value) {
      analytics.recordEvent('tx_flow_wallet_prompt', {
        flow_kind: flow.value.kind,
        step: (waitingStep as any).key ?? waitingStep.title,
      });
    }
  }
);

/** Whether the panel is currently fading out before auto-close. */
const fadingOut = ref(false);
let collapseTimer: ReturnType<typeof setTimeout> | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;

const clearAutoTimers = () => {
  if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null; }
  if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
};

const close = () => {
  clearAutoTimers();
  fadingOut.value = false;
  txFlow.dismiss();
  shownFlow.value = null;
};

/** The one step currently in progress (blocked on a wallet prompt, or just running), if any. */
const activeStep = computed(() => flow.value?.steps.find((s) => s.status === 'active' || s.status === 'waiting'));
/** The step that failed, when the flow's status is `failed` — carries the plain-language error to show. */
const failedStep = computed(() => flow.value?.steps.find((s) => s.status === 'failed'));
/** The most recent step to have produced a transaction hash, for the success summary's explorer link. */
const lastTxStep = computed(() => [...(flow.value?.steps ?? [])].reverse().find((s) => s.txHash));

/** Blocks backdrop/Escape dismissal while a step is waiting on a wallet prompt, so a pending signature is never dropped silently. */
const dismissable = computed(() => activeStep.value?.status !== 'waiting');

/** `Stepper` (`ui/Stepper.vue`) types its `steps` prop as its own `StepperStep`, a structurally looser shape than `TxStep` — this is the one, explicit boundary between the two. */
const stepperSteps = computed<StepperStep[]>(() => (flow.value?.steps ?? []) as unknown as StepperStep[]);
/** Recovers the richer `TxStep` fields (`chain`, `txHash`, `explorerUrl`) inside the `meta` slot, which only sees the step as a `StepperStep`. */
const asTxStep = (step: StepperStep) => step as unknown as TxStep;

/** When true, the panel shows only the header bar (title + status). */
const collapsed = ref(false);

/** Shows "Continue in background" instead of the plain "keep this window open" hint once the active step is a background-eligible wait (e.g. a relay). */
const showBackgroundButton = computed(() => !!flow.value?.canRunInBackground && activeStep.value?.status === 'waiting');

const continueInBackground = () => {
  clearAutoTimers();
  if (flow.value) txFlow.moveToBackground(flow.value.id);
  shownFlow.value = null;
};

/** Auto-collapse then fade when all steps are done (success) or the only remaining step is a background relay. */
watch(
  [() => flow.value?.status, showBackgroundButton],
  ([status, canBackground]) => {
    clearAutoTimers();
    if (status === 'succeeded' || canBackground) {
      collapsed.value = true;
      collapseTimer = setTimeout(() => {
        fadingOut.value = true;
        fadeTimer = setTimeout(() => {
          if (canBackground) {
            continueInBackground();
          } else {
            close();
          }
          fadingOut.value = false;
        }, 350);
      }, 1000);
    }
  },
  { immediate: false }
);

onBeforeUnmount(clearAutoTimers);

const tryAgain = () => {
  close();
  retry();
};

/** Labels for the id-shaped fields a flow's `result` commonly carries, used to build the success summary without the dialog needing to know each flow kind's exact result shape. */
const idLabels: Record<string, string> = {
  payableId: 'Payable ID',
  paymentId: 'Payment ID',
  userPaymentId: 'Payment ID',
  payablePaymentId: 'Destination payment ID',
  withdrawalId: 'Withdrawal ID',
};

const resultItems = computed(() => {
  const result = flow.value?.result;
  if (!result) return [];
  return Object.entries(result)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[0] in idLabels)
    .map(([key, value]) => ({ key, label: idLabels[key], value, mono: true }));
});

/** The actions offered once the flow succeeds, chosen from its `kind` and `result` (shared with `TxBackgroundTray`'s completion toast). */
const primaryActions = computed<FlowAction[]>(() => (flow.value ? primaryActionsFor(flow.value) : []));

const runAction = (action: FlowAction) => {
  action.onClick?.();
  if (action.to) router.push(action.to);
  close();
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="flow"
      class="fixed z-50 bottom-4 right-4 left-4 sm:left-auto w-auto sm:w-full sm:max-w-sm shadow-glass transition-[opacity,transform] duration-[350ms] ease-out"
      :class="fadingOut ? 'opacity-0 translate-y-2 pointer-events-none' : 'opacity-100 translate-y-0'"
    >
      <div class="glass-popover rounded-2xl overflow-hidden">
        <!-- Panel header -->
        <div class="flex items-start justify-between gap-3 px-4 py-3 border-b border-glass-border">
          <div class="min-w-0">
            <h2 class="font-display text-sm font-semibold text-fg leading-snug">{{ flow.title }}</h2>
            <p v-if="flow.subtitle && !collapsed" class="text-xs text-muted mt-0.5">{{ flow.subtitle }}</p>
            <p v-if="collapsed && activeStep" class="text-xs text-muted mt-0.5 truncate">{{ activeStep.description }}</p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <!-- Status dot (running = pulsing accent, succeeded = solid green) -->
            <span v-if="flow.status === 'running'" class="relative flex w-2 h-2 mr-1" aria-hidden="true">
              <span class="absolute inline-flex h-full w-full rounded-full bg-accent animate-ping opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            <span v-else-if="flow.status === 'succeeded'" class="relative flex w-2 h-2 mr-1" aria-hidden="true">
              <span class="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            <!-- Collapse toggle -->
            <button
              type="button"
              :aria-label="collapsed ? 'Expand' : 'Collapse'"
              :title="collapsed ? 'Expand' : 'Collapse'"
              class="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-fg/5 transition-colors"
              @click="collapsed = !collapsed"
            >
              <svg viewBox="0 0 24 24" fill="none" class="w-4 h-4 transition-transform" :class="collapsed && 'rotate-180'" aria-hidden="true">
                <path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <!-- Close (only when dismissable) -->
            <button
              v-if="dismissable"
              type="button"
              aria-label="Close"
              title="Close"
              class="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-fg/5 transition-colors"
              @click="close"
            >
              <svg viewBox="0 0 24 24" fill="none" class="w-4 h-4" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Expandable body -->
        <div v-show="!collapsed" class="px-4 pt-4">
          <!-- Status banner: only shown once the flow leaves `running`. -->
          <div
            v-if="flow.status === 'failed'"
            class="mb-4 rounded-xl bg-danger/10 ring-1 ring-danger/30 px-3.5 py-3 text-sm text-danger"
          >
            {{ failedStep?.error ?? 'Something went wrong. Please try again.' }}
          </div>
          <div
            v-else-if="flow.status === 'cancelled'"
            class="mb-4 rounded-xl bg-fg/5 ring-1 ring-fg/10 px-3.5 py-3 text-sm text-muted"
          >
            You cancelled in your wallet.
          </div>
          <div
            v-else-if="flow.status === 'succeeded'"
            class="mb-4 rounded-xl bg-success/10 ring-1 ring-success/30 px-3.5 py-3 text-sm text-success font-medium"
          >
            Done — every step completed.
          </div>

          <Stepper :steps="stepperSteps">
            <template #meta="{ step }">
              <div class="flex items-center gap-2 flex-wrap">
                <ChainBadge v-if="asTxStep(step).chain" :chain="asTxStep(step).chain!" size="sm" />
                <AddressChip v-if="asTxStep(step).txHash" :value="asTxStep(step).txHash!" kind="id" />
                <a
                  v-if="asTxStep(step).explorerUrl"
                  :href="asTxStep(step).explorerUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  <IconOpenInNew class="w-3 h-3" /> View transaction
                </a>
              </div>
            </template>
          </Stepper>

          <!-- Success summary -->
          <div v-if="flow.status === 'succeeded' && resultItems.length" class="mt-4 rounded-xl bg-fg/[0.03] px-3.5 py-2">
            <dl class="divide-y divide-fg/5">
              <div v-for="item in resultItems" :key="item.key" class="flex items-center justify-between gap-4 py-2">
                <dt class="text-xs text-muted">{{ item.label }}</dt>
                <dd><AddressChip :value="item.value" kind="id" /></dd>
              </div>
            </dl>
            <a
              v-if="lastTxStep?.explorerUrl"
              :href="lastTxStep.explorerUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <IconOpenInNew class="w-3 h-3" /> View transaction on explorer
            </a>
          </div>
        </div>

        <!-- Panel footer -->
        <div v-show="!collapsed" class="px-4 py-3">
          <div v-if="flow.status === 'running'">
            <Button v-if="showBackgroundButton" severity="secondary" size="small" class="w-full" @click="continueInBackground">
              Continue in background
            </Button>
            <p v-else class="text-xs text-muted text-center">Keep this panel open.</p>
          </div>

          <div v-else-if="flow.status === 'succeeded'" class="flex flex-wrap gap-2">
            <Button v-for="action in primaryActions" :key="action.label" severity="secondary" size="small" @click="runAction(action)">
              {{ action.label }}
            </Button>
            <Button size="small" @click="close">Close</Button>
          </div>

          <div v-else-if="flow.status === 'failed'" class="flex flex-wrap gap-2">
            <Button severity="secondary" size="small" @click="close">Close</Button>
            <Button size="small" @click="tryAgain">Try again</Button>
          </div>

          <div v-else-if="flow.status === 'cancelled'" class="flex flex-wrap gap-2">
            <Button size="small" @click="tryAgain">Try again</Button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
