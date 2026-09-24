<script setup lang="ts">
/**
 * src/components/ui/Stepper.vue — the visual step list used by transaction
 * flows (create payable, pay, withdraw, cross-chain relay tracking).
 *
 * Purely presentational: it renders whatever `steps` it's given and does not
 * know about contracts, transactions or polling — brief 03's transaction-flow
 * engine is what decides each step's `status` and updates it over time.
 *
 * Two layouts:
 *  - `vertical` (default): a top-to-bottom list with a connecting rail,
 *    used inside dialogs and side panels;
 *  - `horizontal`: a left-to-right row for wide headers, which collapses on
 *    narrow screens to a "Step N of M" line plus a segmented progress bar
 *    (design-language.md §7.5) rather than trying to squeeze every step in.
 *
 * Usage:
 * ```vue
 * <Stepper
 *   :steps="[
 *     { title: 'Approve USDC', status: 'done' },
 *     { title: 'Send payment', status: 'active', hints: ['Waiting for your wallet…', 'Confirming on-chain…'] },
 *     { title: 'Relay to destination', status: 'upcoming' },
 *   ]"
 * >
 *   <template #meta="{ step }"><ChainBadge v-if="step.chain" :chain="step.chain" size="sm" /></template>
 * </Stepper>
 * ```
 */
import { onBeforeUnmount, onMounted, reactive, watch } from 'vue';
import InFlightIndicator from './InFlightIndicator.vue';

/** One step's state. Everything except `title` is optional so a caller can
 *  build a minimal step list and fill in the rest as progress is known. */
export interface StepperStep {
  /** The step's name, e.g. "Approve USDC". */
  title: string;
  /** One sentence of detail shown under the title. */
  description?: string;
  /** Where this step is in its lifecycle. */
  status: 'upcoming' | 'active' | 'waiting' | 'done' | 'skipped' | 'failed';
  /** Plain-language messages rotated every 2.4s while this step is `active`
   *  or `waiting` (e.g. "Waiting for your wallet…", "This usually takes
   *  1-3 minutes…"). Ignored for any other status, and frozen on the first
   *  hint under `prefers-reduced-motion: reduce`. */
  hints?: string[];
  /** Arbitrary data a caller can stash on the step (e.g. a chain or tx hash)
   *  to read back out inside the `meta` slot. */
  [key: string]: unknown;
}

const props = withDefaults(
  defineProps<{
    /** The ordered list of steps to render. */
    steps: StepperStep[];
    /** Layout direction. */
    orientation?: 'vertical' | 'horizontal';
  }>(),
  { orientation: 'vertical' }
);

defineSlots<{
  /** Per-step trailing content (a tx link, a chain badge, …), scoped with
   *  the step object and its index. */
  meta?: (props: { step: StepperStep; index: number }) => unknown;
}>();

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Which hint (by index) is currently shown for each step index. */
const hintIndex = reactive<Record<number, number>>({});
const timers: Record<number, ReturnType<typeof setInterval>> = {};

const rotates = (step: StepperStep) =>
  (step.status === 'active' || step.status === 'waiting') && (step.hints?.length ?? 0) > 1;

/** Starts or stops each step's hint-rotation timer to match its current
 *  status, called on mount and whenever a step's status/hints change. Steps
 *  that stop rotating (moved past active/waiting) have their timer cleared
 *  so they don't keep ticking in the background. */
const syncTimers = () => {
  props.steps.forEach((step, index) => {
    const shouldRotate = rotates(step) && !prefersReducedMotion();
    if (shouldRotate && !timers[index]) {
      hintIndex[index] = hintIndex[index] ?? 0;
      timers[index] = setInterval(() => {
        hintIndex[index] = (hintIndex[index] + 1) % step.hints!.length;
      }, 2400);
    } else if (!shouldRotate && timers[index]) {
      clearInterval(timers[index]);
      delete timers[index];
    }
  });
};

onMounted(syncTimers);
watch(() => props.steps.map((s) => `${s.status}:${s.hints?.join('|') ?? ''}`).join(','), syncTimers);
onBeforeUnmount(() => Object.values(timers).forEach(clearInterval));

const currentHint = (step: StepperStep, index: number) => step.hints?.[hintIndex[index] ?? 0];

const activeIndex = () => {
  const found = props.steps.findIndex((s) => s.status === 'active' || s.status === 'waiting');
  return found === -1 ? props.steps.filter((s) => s.status === 'done').length : found;
};
</script>

<template>
  <!-- Horizontal layout collapses to a compact progress summary below `sm`. -->
  <div v-if="orientation === 'horizontal'" class="sm:hidden">
    <p class="text-xs text-muted mb-2">Step {{ activeIndex() + 1 }} of {{ steps.length }}</p>
    <div class="flex gap-1">
      <span
        v-for="(step, i) in steps"
        :key="i"
        :class="[
          'h-1 flex-1 rounded-full',
          step.status === 'done' || step.status === 'active' || step.status === 'waiting' ? 'bg-accent' : 'bg-fg/10',
        ]"
      ></span>
    </div>
    <p class="mt-2 text-sm font-medium text-fg">{{ steps[activeIndex()]?.title }}</p>
  </div>

  <ol :class="[orientation === 'horizontal' ? 'hidden sm:flex sm:items-start' : 'flex flex-col']">
    <li
      v-for="(step, index) in steps"
      :key="index"
      :class="
        orientation === 'horizontal'
          ? 'flex-1 flex flex-col items-center text-center px-2'
          : 'flex gap-3 pb-6 last:pb-0'
      "
    >
      <div :class="orientation === 'horizontal' ? 'flex items-center w-full' : 'flex flex-col items-center'">
        <!-- Connector line before the node (horizontal only, skipped for the first step). -->
        <span
          v-if="orientation === 'horizontal' && index > 0"
          :class="['h-0.5 flex-1', index <= activeIndex() ? 'bg-accent' : 'bg-fg/10']"
        ></span>

        <!-- The step node itself, styled per status. -->
        <span
          class="relative shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
          :class="{
            'bg-accent text-accent-fg': step.status === 'done',
            'ring-2 ring-accent text-accent bg-bg shadow-[0_0_0_5px_rgb(var(--accent-rgb)/0.15)]':
              step.status === 'active',
            'ring-2 ring-warning text-warning bg-bg': step.status === 'waiting',
            'ring-1 ring-glass-border text-muted bg-bg': step.status === 'upcoming',
            'border border-dashed border-glass-border text-muted bg-bg': step.status === 'skipped',
            'bg-danger/15 ring-1 ring-danger text-danger': step.status === 'failed',
          }"
        >
          <span
            v-if="step.status === 'waiting'"
            class="absolute inset-0 rounded-full ring-2 ring-warning animate-ping"
          ></span>
          <svg v-if="step.status === 'done'" viewBox="0 0 20 20" fill="none" class="w-4 h-4" aria-hidden="true">
            <path
              d="m5 10 3.5 3.5L15 7"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg v-else-if="step.status === 'failed'" viewBox="0 0 20 20" fill="none" class="w-4 h-4" aria-hidden="true">
            <path d="m6 6 8 8m0-8-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <span v-else>{{ index + 1 }}</span>
        </span>

        <!-- Connector line after the node. -->
        <span
          v-if="orientation === 'horizontal' && index < steps.length - 1"
          :class="['h-0.5 flex-1', index < activeIndex() ? 'bg-accent' : 'bg-fg/10']"
        ></span>
        <span
          v-else-if="orientation === 'vertical' && index < steps.length - 1"
          :class="['w-0.5 flex-1 mt-1 min-h-[1.5rem]', index < activeIndex() ? 'bg-accent' : 'bg-fg/10']"
        ></span>
      </div>

      <div :class="orientation === 'horizontal' ? 'mt-2' : 'pt-0.5'">
        <div class="flex items-center gap-2" :class="orientation === 'horizontal' && 'justify-center'">
          <p class="text-sm font-medium text-fg" :class="step.status === 'skipped' && 'italic text-muted'">
            {{ step.title }}
          </p>
          <InFlightIndicator v-if="step.status === 'active'" />
        </div>
        <p v-if="step.description" class="text-xs text-muted mt-0.5">{{ step.description }}</p>
        <Transition name="fade" mode="out-in">
          <p v-if="currentHint(step, index)" :key="hintIndex[index]" class="text-xs text-accent mt-1">
            {{ currentHint(step, index) }}
          </p>
        </Transition>
        <div v-if="$slots.meta" class="mt-1.5">
          <slot name="meta" :step="step" :index="index" />
        </div>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 300ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
