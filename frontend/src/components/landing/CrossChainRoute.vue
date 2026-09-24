<script setup lang="ts">
/**
 * src/components/landing/CrossChainRoute.vue — a horizontal diagram of one
 * cross-chain payment's route: source chain → burn → Circle attestation →
 * Chainbills relayer → destination chain, with a light travelling the full
 * route on a loop.
 *
 * This is a local stand-in for the shared `CrossChainRoute` component that
 * brief 03 (`src/components/tx/`) owns; that folder does not exist yet in
 * this codebase, so `CrossChainDeepDive.vue` uses this copy until the
 * transaction-flow work merges and the shared component can be swapped in.
 * Purely illustrative — it takes no live transaction data, only the two
 * chains to label.
 *
 * Usage: `<CrossChainRoute :source="arctestnet" :destination="sepolia" />`
 */
import { ChainBadge, IconChip } from '@/components/ui';
import type { Chain } from '@/schemas';

withDefaults(
  defineProps<{
    /** The chain the payer sends from (where the CCTP burn happens). */
    source: Chain;
    /** The chain the payable lives on (where the funds are credited). */
    destination: Chain;
  }>(),
  {}
);

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The three hops between the source and destination chain badges. */
const hops = [
  { label: 'Burn', icon: '🔥' },
  { label: 'Circle attests', icon: '🛰️' },
  { label: 'Relayer delivers', icon: '🔁' },
];
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
      <ChainBadge :chain="source" size="sm" />

      <template v-for="(hop, i) in hops" :key="hop.label">
        <span class="relative h-px w-6 sm:w-8 bg-glass-border shrink-0" aria-hidden="true">
          <span v-if="!prefersReducedMotion" class="route-sweep" :style="{ animationDelay: `${i * 0.5}s` }"></span>
        </span>
        <IconChip tone="accent" size="sm" :title="hop.label">
          <span class="text-xs" aria-hidden="true">{{ hop.icon }}</span>
        </IconChip>
      </template>

      <span class="relative h-px w-6 sm:w-8 bg-glass-border shrink-0" aria-hidden="true">
        <span
          v-if="!prefersReducedMotion"
          class="route-sweep"
          :style="{ animationDelay: `${hops.length * 0.5}s` }"
        ></span>
      </span>
      <ChainBadge :chain="destination" size="sm" />
    </div>
    <p class="text-xs text-muted">{{ hops.map((h) => h.label).join(' → ') }} — usually 1–3 minutes end to end.</p>
  </div>
</template>

<style scoped>
/* A short bright dash chasing along each hairline hop, left to right, looped
   with a per-hop delay so the light appears to travel the whole route. */
.route-sweep {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  transform: translateX(-100%);
  animation: route-sweep 2s linear infinite;
}
@keyframes route-sweep {
  to {
    transform: translateX(100%);
  }
}
</style>
