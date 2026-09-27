<script setup lang="ts">
/**
 * src/components/ui/KeyValueList.vue — a definition-list layout for detail
 * panels (payable configuration, transaction receipts, stepper meta), with
 * the label on the left and the value on the right, stacking on narrow
 * screens per design-language.md §7.4.
 *
 * Each row's value is a scoped slot (named after the item's `key`) so
 * callers can render rich content — an `AddressChip`, a `TokenAmount`, a
 * `ChainBadge` — instead of being limited to plain text.
 *
 * Usage:
 * ```vue
 * <KeyValueList :items="[{ key: 'host', label: 'Host' }, { key: 'amount', label: 'Amount' }]">
 *   <template #host="{ item }"><AddressChip :value="payable.host" kind="address" /></template>
 *   <template #amount="{ item }"><TokenAmount :amount="amount" :chain="chain" /></template>
 * </KeyValueList>
 * ```
 */
export interface KeyValueItem {
  /** Unique key, also used as the scoped slot name for this row's value. */
  key: string;
  /** The row's label, shown muted on the left (or above, on mobile). */
  label: string;
  /** A plain-text value. Ignored if a scoped slot named `key` is provided. */
  value?: string;
  /** Renders `value`/the slot content in monospace — use for ids, hashes and addresses. */
  mono?: boolean;
  /** Renders the row's value across the full width with no label column and no right-alignment — for embedded visual strips (e.g. a cross-chain route indicator) that don't fit the two-column layout. */
  fullWidth?: boolean;
}

defineProps<{
  /** The rows to render, top to bottom. */
  items: KeyValueItem[];
}>();
</script>

<template>
  <dl class="divide-y divide-fg/5">
    <template v-for="item in items" :key="item.key">
      <div v-if="item.fullWidth" class="py-3">
        <slot :name="item.key" :item="item">{{ item.value }}</slot>
      </div>
      <div
        v-else
        class="flex flex-col gap-1 py-3 min-[414px]:flex-row min-[414px]:items-center min-[414px]:justify-between min-[414px]:gap-4"
      >
        <dt class="text-sm text-muted shrink-0">{{ item.label }}</dt>
        <dd :class="['text-sm text-fg text-right', item.mono && 'font-mono text-xs']">
          <slot :name="item.key" :item="item">{{ item.value }}</slot>
        </dd>
      </div>
    </template>
  </dl>
</template>
