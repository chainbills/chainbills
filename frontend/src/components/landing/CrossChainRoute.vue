<script setup lang="ts">
/**
 * src/components/landing/CrossChainRoute.vue — a horizontal diagram of one
 * cross-chain payment's route: source chain -> burn -> Circle attestation ->
 * Chainbills relayer -> destination chain, with a light travelling the full
 * route on a loop.
 *
 * It is a landing-only illustration used by `CrossChainDeepDive.vue`.
 * Purely illustrative — it takes no live transaction data, only the two
 * chains to label.
 *
 * Usage: `<CrossChainRoute :source="baseNode" :destination="arcNode" />`
 */
import { IconChip } from '@/components/ui';

export interface RouteNode {
  displayName: string;
  logoSrc: string;
  brandColor: string;
}

withDefaults(
  defineProps<{
    /** The chain the payer sends from (where the CCTP burn happens). */
    source: RouteNode;
    /** The chain the payable lives on (where the funds are credited). */
    destination: RouteNode;
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
      <!-- Source chain badge -->
      <span
        class="inline-flex items-center gap-1.5 rounded-full border pl-1 pr-2.5 py-1 text-xs font-medium text-fg shrink-0"
        :style="{ backgroundColor: `${source.brandColor}1f`, borderColor: `${source.brandColor}4d` }"
      >
        <img :src="source.logoSrc" :alt="`${source.displayName} logo`" class="w-4 h-4 rounded-full" />
        {{ source.displayName }}
      </span>

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

      <!-- Destination chain badge -->
      <span
        class="inline-flex items-center gap-1.5 rounded-full border pl-1 pr-2.5 py-1 text-xs font-medium text-fg shrink-0"
        :style="{ backgroundColor: `${destination.brandColor}1f`, borderColor: `${destination.brandColor}4d` }"
      >
        <img :src="destination.logoSrc" :alt="`${destination.displayName} logo`" class="w-4 h-4 rounded-full" />
        {{ destination.displayName }}
      </span>
    </div>
    <p class="text-xs text-muted">{{ hops.map((h) => h.label).join(' -> ') }} — usually 1-3 minutes end to end.</p>
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
