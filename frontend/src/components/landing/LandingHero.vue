<script setup lang="ts">
/**
 * src/components/landing/LandingHero.vue — the landing page's first section:
 * the eyebrow pill, the shimmer-gradient headline, the sub-headline, the two
 * calls to action, a trust row of chain badges, and the animated
 * `ChainConstellation` visual (right on wide screens, below the copy on
 * narrow ones).
 *
 * Renders with no network reads and no layout shift: every chain fact it
 * shows (names, brand colours) comes from the static `schemas/chain.ts`
 * constants, so the hero paints on the very first frame without waiting on
 * any RPC call.
 *
 * Usage: `<LandingHero />` inside `HomeView.vue`, as the first section.
 */
import { chainNamesEvm, chainNamesToChains } from '@/schemas';
import { useAnalyticsStore } from '@/stores';
import { ChainBadge } from '@/components/ui';
import Button from 'primevue/button';
import { computed } from 'vue';
import ChainConstellation from './ChainConstellation.vue';

const analytics = useAnalyticsStore();

/** The active EVM chains, for the trust row and the eyebrow's "Live on …" list. */
const liveChains = chainNamesEvm.map((name) => chainNamesToChains[name]);

/** "MegaETH, Sepolia & Arc Testnet" — a natural-language join of the live
 *  chain names for the eyebrow pill. */
const liveChainsLabel = computed(() => {
  const names = liveChains.map((c) => c.displayName);
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
});
</script>

<template>
  <section class="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center py-10 sm:py-16">
    <div>
      <span
        class="inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass-tint px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent mb-6"
      >
        Cross-chain payments · Live on {{ liveChainsLabel }}
      </span>

      <h1 class="font-display text-display-xl text-fg mb-6">
        <span class="shimmer-text block">One link.</span>
        <span class="block">Paid from any chain.</span>
      </h1>

      <p class="text-base sm:text-lg text-muted max-w-xl mb-8">
        Create a payable, share one link, and accept crypto from any supported chain. Payments settle on-chain through
        Circle CCTP and Wormhole, with no custodian in between.
      </p>

      <div class="flex flex-wrap items-center gap-3 mb-8">
        <router-link to="/start" @click="analytics.recordEvent('clicked_home_hero_get_started')" class="group">
          <Button size="large">
            <span class="flex items-center gap-2">
              Create a payable
              <span class="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
            </span>
          </Button>
        </router-link>
        <router-link to="/scan" @click="analytics.recordEvent('clicked_home_explore_scan')" class="group">
          <Button severity="secondary" size="large">
            <span class="flex items-center gap-2">
              Explore Scan
              <span class="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
            </span>
          </Button>
        </router-link>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <ChainBadge v-for="chain in liveChains" :key="chain.name" :chain="chain" size="sm" />
      </div>
    </div>

    <ChainConstellation />
  </section>
</template>

<style scoped>
/* Gradient text sweeping through the brand accent and its secondary glow,
   used exactly once on the page (design-language.md §6, "Shimmer text"). */
.shimmer-text {
  background: linear-gradient(90deg, var(--fg), var(--accent), var(--accent-2), var(--fg));
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: shimmer 3s linear infinite;
}
@keyframes shimmer {
  to {
    background-position: -200% center;
  }
}
@media (prefers-reduced-motion: reduce) {
  .shimmer-text {
    animation: none;
    background-position: 0 center;
  }
}
</style>
