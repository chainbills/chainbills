<script setup lang="ts">
/**
 * src/components/ui/ErrorState.vue — the "something went wrong" panel shown
 * by every async region's error state (design-language.md §7.4), paired with
 * `EmptyState` (empty) and `Skeleton` (loading) to cover all three states a
 * data-driven region needs.
 *
 * Usage:
 * ```vue
 * <ErrorState message="Couldn't load this payable from the chain." @retry="load" />
 * ```
 */
defineProps<{
  /** Plain-language explanation of what went wrong, following the voice
   *  guidance in design-language.md §9: say what happened and what to do. */
  message: string;
}>();

const emit = defineEmits<{
  /** Fires when the user clicks "Retry". The caller re-runs whatever fetch
   *  or on-chain read failed. */
  retry: [];
}>();
</script>

<template>
  <div class="flex flex-col items-center text-center gap-3 py-12 px-6">
    <div class="flex items-center justify-center w-14 h-14 rounded-full bg-danger/10 text-danger">
      <svg viewBox="0 0 24 24" fill="none" class="w-6 h-6" aria-hidden="true">
        <path
          d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
    <p class="text-sm text-fg max-w-sm">{{ message }}</p>
    <button
      type="button"
      @click="emit('retry')"
      class="rounded-full border border-glass-border bg-glass-tint backdrop-blur px-4 py-1.5 text-sm font-medium text-fg hover:bg-fg/5"
    >
      Retry
    </button>
  </div>
</template>
