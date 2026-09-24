<script setup lang="ts">
/**
 * src/components/ui/NetworkPill.vue — a small "Mainnet" or "Testnet" tag.
 *
 * Used standalone next to a chain name, or embedded inside `ChainBadge` when
 * its `network` prop is set. Mainnet renders in the success (emerald) tone,
 * testnet in the warning (amber) tone, matching design-language.md §7.2.
 *
 * Usage: `<NetworkPill type="mainnet" />`
 */
import type { ChainNetworkType } from '@/schemas';

defineProps<{
  /** Which network tier to label. */
  type: ChainNetworkType;
}>();
</script>

<template>
  <span
    :class="[
      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1',
      type === 'mainnet' ? 'text-success bg-success/15 ring-success/30' : 'text-warning bg-warning/15 ring-warning/30',
    ]"
  >
    {{ type === 'mainnet' ? 'Mainnet' : 'Testnet' }}
  </span>
</template>
