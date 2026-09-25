<script setup lang="ts">
/**
 * src/components/ui/EmptyState.vue — the "nothing here yet" panel shown by
 * every async region's empty state (design-language.md §7.4).
 *
 * Renders the Chainbills logo at low opacity as the visual anchor, a title,
 * one sentence of description, and an optional action via the `action` slot.
 *
 * Usage:
 * ```vue
 * <EmptyState title="No payables yet" description="Create your first payable to start receiving payments.">
 *   <template #action><Button @click="create">Create a payable</Button></template>
 * </EmptyState>
 * ```
 */
import { useThemeStore } from '@/stores';

defineProps<{
  /** The empty state's headline, e.g. "No payables yet". */
  title: string;
  /** One sentence explaining the empty state or suggesting a next step. */
  description?: string;
}>();
defineSlots<{
  /** A single call-to-action (button or link) shown under the description. */
  action?: () => unknown;
}>();

const theme = useThemeStore();
</script>

<template>
  <div class="flex flex-col items-center text-center gap-3 py-12 px-6">
    <img
      :src="`/assets/chainbills-${theme.isDisplayDark ? 'dark' : 'light'}.png`"
      alt=""
      aria-hidden="true"
      class="w-16 h-16 opacity-15 pointer-events-none select-none"
    />
    <h3 class="font-display text-lg text-fg">{{ title }}</h3>
    <p v-if="description" class="text-sm text-muted max-w-sm">{{ description }}</p>
    <div v-if="$slots.action" class="mt-1">
      <slot name="action" />
    </div>
  </div>
</template>
