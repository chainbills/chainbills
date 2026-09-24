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
import { useTxFlowStore } from '@/stores';
import type { TxFlow, TxStep } from '@/stores/tx-flow';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { primaryActionsFor, type FlowAction } from './flow-actions';
import { useTxRetry } from './retry';

const txFlow = useTxFlowStore();
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

const close = () => {
  txFlow.dismiss();
  shownFlow.value = null;
};

const visible = computed({
  get: () => !!flow.value,
  set: (value: boolean) => {
    if (!value) close();
  },
});

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

/** Tracks the `sm` breakpoint so the dialog can render as a bottom sheet on mobile and a centered dialog above it. */
const isMobile = ref(typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
const mobileQuery = typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)') : null;
const onMobileQueryChange = (e: MediaQueryListEvent) => (isMobile.value = e.matches);
onMounted(() => mobileQuery?.addEventListener('change', onMobileQueryChange));
onUnmounted(() => mobileQuery?.removeEventListener('change', onMobileQueryChange));

/** Shows "Continue in background" instead of the plain "keep this window open" hint once the active step is a background-eligible wait (e.g. a relay). */
const showBackgroundButton = computed(() => !!flow.value?.canRunInBackground && activeStep.value?.status === 'waiting');

const continueInBackground = () => {
  if (flow.value) txFlow.moveToBackground(flow.value.id);
  shownFlow.value = null;
};

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
  <Dialog
    v-if="flow"
    v-model:visible="visible"
    modal
    :dismissable-mask="dismissable"
    :close-on-escape="dismissable"
    :closable="dismissable"
    :position="isMobile ? 'bottom' : 'center'"
    :class="['w-full sm:max-w-lg', isMobile && '!rounded-b-none']"
  >
    <template #header>
      <div>
        <h2 class="font-display text-lg text-fg">{{ flow.title }}</h2>
        <p v-if="flow.subtitle" class="text-sm text-muted mt-0.5">{{ flow.subtitle }}</p>
      </div>
    </template>

    <!-- Status banner: only shown once the flow has left `running`, since the stepper itself already communicates progress. -->
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

    <!-- Success summary: the ids this flow produced, plus a link to the last transaction it sent. -->
    <div v-if="flow.status === 'succeeded' && resultItems.length" class="mt-5 rounded-xl bg-fg/[0.03] px-3.5 py-2">
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

    <template #footer>
      <div v-if="flow.status === 'running'" class="w-full">
        <Button v-if="showBackgroundButton" severity="secondary" class="w-full sm:w-auto" @click="continueInBackground">
          Continue in background
        </Button>
        <p v-else class="text-xs text-muted text-center sm:text-right">Keep this window open.</p>
      </div>

      <div v-else-if="flow.status === 'succeeded'" class="flex flex-wrap justify-end gap-2">
        <Button v-for="action in primaryActions" :key="action.label" severity="secondary" @click="runAction(action)">
          {{ action.label }}
        </Button>
        <Button @click="close">Close</Button>
      </div>

      <div v-else-if="flow.status === 'failed'" class="flex flex-wrap justify-end gap-2">
        <Button severity="secondary" @click="close">Close</Button>
        <Button @click="tryAgain">Try again</Button>
      </div>

      <div v-else-if="flow.status === 'cancelled'" class="flex flex-wrap justify-end gap-2">
        <Button @click="tryAgain">Try again</Button>
      </div>
    </template>
  </Dialog>
</template>
