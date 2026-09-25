<script setup lang="ts">
/**
 * src/components/ui/SegmentedTabs.vue — a pill-shaped segmented control,
 * used for view switches (e.g. "Payments / Withdrawals", "Mainnet /
 * Testnet") that don't need PrimeVue Tabs' panel machinery.
 *
 * Fully keyboard accessible: arrow left/right move focus and selection
 * between segments, `Home`/`End` jump to the first/last, following the
 * WAI-ARIA "tabs" pattern (`role="tablist"` on the root, `role="tab"` on
 * each segment).
 *
 * Usage:
 * ```vue
 * <SegmentedTabs v-model="view" :options="[{ label: 'Payments', value: 'payments', count: 4 }, ...]" />
 * ```
 */
import { ref } from 'vue';

export interface SegmentedTabOption {
  /** Visible label. */
  label: string;
  /** Value emitted when this segment is selected. */
  value: string;
  /** Optional count shown in a small mono bubble after the label. */
  count?: number;
}

const props = defineProps<{
  /** Available segments. */
  options: SegmentedTabOption[];
  /** The currently selected segment's value. */
  modelValue: string;
}>();

const emit = defineEmits<{
  /** Fires with the newly selected value. */
  'update:modelValue': [value: string];
}>();

const tabRefs = ref<(HTMLButtonElement | null)[]>([]);

const select = (value: string) => emit('update:modelValue', value);

/** Moves focus (and selection) by `delta` positions, wrapping around both
 *  ends, then focuses the newly active tab so keyboard users can keep
 *  navigating without reaching for the mouse. */
const move = (delta: number) => {
  const currentIndex = props.options.findIndex((o) => o.value === props.modelValue);
  const nextIndex = (currentIndex + delta + props.options.length) % props.options.length;
  const next = props.options[nextIndex];
  select(next.value);
  tabRefs.value[nextIndex]?.focus();
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowRight') move(1);
  else if (event.key === 'ArrowLeft') move(-1);
  else if (event.key === 'Home') {
    select(props.options[0].value);
    tabRefs.value[0]?.focus();
  } else if (event.key === 'End') {
    const last = props.options.length - 1;
    select(props.options[last].value);
    tabRefs.value[last]?.focus();
  } else return;
  event.preventDefault();
};
</script>

<template>
  <div
    role="tablist"
    class="inline-flex rounded-full border border-glass-border bg-bg/30 p-1 gap-0.5"
    @keydown="onKeydown"
  >
    <button
      v-for="(option, index) in options"
      :key="option.value"
      :ref="(el) => (tabRefs[index] = el as HTMLButtonElement)"
      role="tab"
      type="button"
      :aria-selected="modelValue === option.value"
      :tabindex="modelValue === option.value ? 0 : -1"
      @click="select(option.value)"
      :class="[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium transition-colors',
        modelValue === option.value ? 'bg-fg text-bg' : 'text-muted hover:text-fg',
      ]"
    >
      {{ option.label }}
      <span
        v-if="option.count !== undefined"
        :class="[
          'font-mono text-[10px] rounded-full px-1.5 py-0.5',
          modelValue === option.value ? 'bg-bg/20' : 'bg-fg/5',
        ]"
      >
        {{ option.count }}
      </span>
    </button>
  </div>
</template>
