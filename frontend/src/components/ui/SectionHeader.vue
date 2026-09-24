<script setup lang="ts">
/**
 * src/components/ui/SectionHeader.vue — the eyebrow + title + description
 * header used above most page sections (dashboards, activity feeds, the
 * scan explorer, ...).
 *
 * Usage:
 * ```vue
 * <SectionHeader eyebrow="Dashboard" title="Your payables" accent-tail="live">
 *   <template #description>Track balances and withdrawals across every chain.</template>
 *   <template #actions><Button>New payable</Button></template>
 * </SectionHeader>
 * ```
 */
defineProps<{
  /** Small uppercase label shown above the title (e.g. "Dashboard"). */
  eyebrow?: string;
  /** The section's main heading. */
  title: string;
  /** An optional second phrase appended to the title in the accent colour,
   *  matching the "One link. <accent>Every chain.</accent>" pattern from
   *  design-language.md §5. */
  accentTail?: string;
}>();
defineSlots<{
  /** One sentence of supporting copy under the title. Plain text or inline markup. */
  description?: () => unknown;
  /** Right-aligned actions (buttons, filters) shown beside the title on wide screens
   *  and below it on narrow ones. */
  actions?: () => unknown;
}>();
</script>

<template>
  <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
    <div class="min-w-0">
      <p v-if="eyebrow" class="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent mb-2">
        {{ eyebrow }}
      </p>
      <h2 class="font-display text-display-md text-fg">
        {{ title }}<span v-if="accentTail" class="text-accent"> {{ accentTail }}</span>
      </h2>
      <p v-if="$slots.description" class="mt-2 text-sm text-muted max-w-2xl">
        <slot name="description" />
      </p>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
      <slot name="actions" />
    </div>
  </header>
</template>
