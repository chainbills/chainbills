<script setup lang="ts">
/**
 * src/components/ui/FilterChips.vue — a horizontally scrolling row of filter
 * chips, used above activity tables and the scan explorer's lists.
 *
 * Supports single-select (`modelValue` is a string) or multi-select
 * (`modelValue` is a string array) depending on the `multi` prop. Each
 * option may carry a `count`, shown as a small mono bubble.
 *
 * Usage:
 * ```vue
 * <FilterChips v-model="selected" :options="[{ label: 'All', value: 'all', count: 12 }, ...]" />
 * <FilterChips v-model="selectedMany" multi :options="tokenOptions" />
 * ```
 */
export interface FilterChipOption {
  /** Visible chip text. */
  label: string;
  /** The value emitted when this chip is (de)selected. */
  value: string;
  /** Optional count shown in a small mono bubble after the label. */
  count?: number;
}

const props = withDefaults(
  defineProps<{
    /** Available chips. */
    options: FilterChipOption[];
    /** Currently selected value(s). A single string in single-select mode,
     *  an array of strings in multi-select mode. */
    modelValue: string | string[];
    /** When true, multiple chips can be active at once and clicking toggles
     *  membership; when false (default), clicking a chip replaces the
     *  selection entirely. */
    multi?: boolean;
  }>(),
  { multi: false }
);

const emit = defineEmits<{
  /** Fires with the new selection whenever a chip is clicked. */
  'update:modelValue': [value: string | string[]];
}>();

const isActive = (value: string) =>
  props.multi ? (props.modelValue as string[]).includes(value) : props.modelValue === value;

const toggle = (value: string) => {
  if (!props.multi) {
    emit('update:modelValue', value);
    return;
  }
  const current = props.modelValue as string[];
  emit('update:modelValue', current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
};
</script>

<template>
  <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none" role="group">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      @click="toggle(option.value)"
      :aria-pressed="isActive(option.value)"
      :class="[
        'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-wider font-semibold border transition-colors',
        isActive(option.value) ? 'bg-fg text-bg border-fg' : 'border-glass-border text-muted hover:text-fg',
      ]"
    >
      {{ option.label }}
      <span
        v-if="option.count !== undefined"
        :class="['font-mono text-[10px] rounded-full px-1.5 py-0.5', isActive(option.value) ? 'bg-bg/20' : 'bg-fg/5']"
      >
        {{ option.count }}
      </span>
    </button>
  </div>
</template>

<style scoped>
/* Hides the scrollbar on the horizontal chip row while keeping it scrollable
   by touch/trackpad — the row is a filter control, not a document to scroll
   through, so a visible scrollbar would only add clutter. */
.scrollbar-none {
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
</style>
