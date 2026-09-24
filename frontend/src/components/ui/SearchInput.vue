<script setup lang="ts">
/**
 * src/components/ui/SearchInput.vue — a glass search field with a leading
 * icon, a clear button once there's text, and the `/` keyboard shortcut
 * (common in explorers/dashboards) to jump focus into it from anywhere on
 * the page.
 *
 * The field displays what the user types immediately, but only emits
 * `update:modelValue` after `debounceMs` of no further typing, so callers
 * doing on-chain lookups or filtering large lists don't re-run on every
 * keystroke.
 *
 * Usage: `<SearchInput v-model="query" placeholder="Search payables or addresses" />`
 */
import IconClose from '@/icons/IconClose.vue';
import { onMounted, onUnmounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /** The current (debounced) search value. */
    modelValue: string;
    /** Placeholder text shown when empty. */
    placeholder?: string;
    /** Milliseconds of typing inactivity before `update:modelValue` fires. */
    debounceMs?: number;
  }>(),
  { placeholder: 'Search', debounceMs: 250 }
);

const emit = defineEmits<{
  /** Fires `debounceMs` after the user stops typing, and immediately on clear. */
  'update:modelValue': [value: string];
}>();

const inputEl = ref<HTMLInputElement>();
/** What's currently shown in the field — updates every keystroke, ahead of
 *  the debounced emit, so the input never feels laggy. */
const displayValue = ref(props.modelValue);
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => props.modelValue,
  (value) => {
    if (value !== displayValue.value) displayValue.value = value;
  }
);

const onInput = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => emit('update:modelValue', displayValue.value), props.debounceMs);
};

const clear = () => {
  clearTimeout(debounceTimer);
  displayValue.value = '';
  emit('update:modelValue', '');
  inputEl.value?.focus();
};

/** Focuses the field when `/` is pressed anywhere on the page, unless the
 *  user is already typing into another form field (so it doesn't hijack
 *  a literal "/" character in an active input/textarea). */
const onGlobalKeydown = (event: KeyboardEvent) => {
  if (event.key !== '/') return;
  const target = event.target as HTMLElement;
  const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
  if (isTyping) return;
  event.preventDefault();
  inputEl.value?.focus();
};

onMounted(() => window.addEventListener('keydown', onGlobalKeydown));
onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown);
  clearTimeout(debounceTimer);
});
</script>

<template>
  <label
    class="relative flex items-center rounded-full border border-glass-border bg-glass-tint backdrop-blur px-3.5 py-2 gap-2"
  >
    <svg viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-muted shrink-0" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <input
      ref="inputEl"
      v-model="displayValue"
      @input="onInput"
      type="text"
      :placeholder="placeholder"
      :aria-label="placeholder"
      class="bg-transparent outline-none text-sm text-fg placeholder:text-muted flex-1 min-w-0"
    />
    <button
      v-if="displayValue"
      type="button"
      @click="clear"
      aria-label="Clear search"
      title="Clear search"
      class="text-muted hover:text-fg shrink-0"
    >
      <IconClose class="w-3.5 h-3.5" />
    </button>
    <kbd
      v-else
      class="hidden sm:inline-block text-[10px] font-mono text-muted border border-glass-border rounded px-1.5 py-0.5 shrink-0"
    >
      /
    </kbd>
  </label>
</template>
