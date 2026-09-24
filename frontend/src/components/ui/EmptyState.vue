<script setup lang="ts">
/**
 * src/components/ui/EmptyState.vue — the "nothing here yet" panel shown by
 * every async region's empty state (design-language.md §7.4).
 *
 * Renders a muted icon in a glass circle, a title, one sentence of
 * description, and an optional action (a button or link) via the `action`
 * slot. When no `icon` slot is given, a generic dot is shown instead so the
 * layout never collapses awkwardly.
 *
 * Usage:
 * ```vue
 * <EmptyState title="No payables yet" description="Create your first payable to start receiving payments.">
 *   <template #icon><IconWallet class="w-6 h-6" /></template>
 *   <template #action><Button @click="create">Create a payable</Button></template>
 * </EmptyState>
 * ```
 */
defineProps<{
  /** The empty state's headline, e.g. "No payables yet". */
  title: string;
  /** One sentence explaining the empty state or suggesting a next step. */
  description?: string;
}>();
defineSlots<{
  /** A small icon (≈24px) shown inside the glass circle. */
  icon?: () => unknown;
  /** A single call-to-action (button or link) shown under the description. */
  action?: () => unknown;
}>();
</script>

<template>
  <div class="flex flex-col items-center text-center gap-3 py-12 px-6">
    <div class="flex items-center justify-center w-14 h-14 rounded-full bg-fg/5 text-muted">
      <slot name="icon">
        <span class="w-2.5 h-2.5 rounded-full bg-muted/60"></span>
      </slot>
    </div>
    <h3 class="font-display text-lg text-fg">{{ title }}</h3>
    <p v-if="description" class="text-sm text-muted max-w-sm">{{ description }}</p>
    <div v-if="$slots.action" class="mt-1">
      <slot name="action" />
    </div>
  </div>
</template>
