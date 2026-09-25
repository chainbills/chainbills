<script setup lang="ts">
/**
 * src/components/landing/ActivityTicker.vue — the landing page's sixth
 * section: a slow vertical marquee of sample activity rows, illustrating the
 * kind of live feed a payable or chain actually gets on `/scan` and the
 * activity pages.
 *
 * Rows come from `landingActivitySamples` (`./placeholders.ts`) only — they
 * are illustrative and not linked to any real entity. The marquee pauses on
 * hover and never scrolls at all under `prefers-reduced-motion: reduce`
 * (rendered once, unduplicated, in that case).
 *
 * Usage: `<ActivityTicker />` inside `HomeView.vue`.
 */
import { activityTypeMeta, chainNamesToChains } from '@/schemas';
import { IconChip, SectionHeader } from '@/components/ui';
import { FEATURES } from '@/config/features';
import { landingActivitySamples, type LandingChainName } from './placeholders';

const scanOn = FEATURES.scan;

/** Display info for each chain used in the ticker. */
const chainMeta: Record<LandingChainName, { name: string; logo: string; color: string }> = {
  arctestnet: { name: 'Arc', logo: '/assets/tokens/ARC.png', color: '#00d2ff' },
  base: { name: 'Base', logo: '/assets/tokens/BASE.png', color: '#0052FF' },
  megaeth: { name: 'MegaETH', logo: '/assets/tokens/MegaETH.png', color: '#c6f135' },
  sepolia: { name: 'Sepolia', logo: '/assets/tokens/ETH.png', color: '#627eea' },
  solanadevnet: { name: 'Solana', logo: '/assets/tokens/SOL.png', color: '#9945ff' },
};

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Maps an `ActivityTypeMeta` icon key to a short glyph — the landing page
 *  has no dependency on a full icon-font, so the ticker uses simple
 *  direction/status glyphs instead of importing one icon component per type. */
const glyphs: Record<string, string> = {
  'user-plus': '＋',
  'file-plus': '＋',
  'arrow-up-right': '↗',
  'arrow-down-left': '↙',
  wallet: '⬇',
  lock: '⏸',
  'lock-open': '▶',
  sliders: '⚙',
  'toggle-left': '⇄',
};
</script>

<template>
  <section class="py-10 sm:py-14">
    <SectionHeader eyebrow="Activity" title="Payments are always" accent-tail="moving." />

    <div
      class="glass-surface glass-dense rounded-2xl overflow-hidden h-[22rem] group"
      role="list"
      aria-label="Sample activity feed"
    >
      <div
        :class="['flex flex-col', !prefersReducedMotion && 'ticker-track group-hover:[animation-play-state:paused]']"
      >
        <template v-for="pass in prefersReducedMotion ? [0] : [0, 1]" :key="pass">
          <div
            v-for="sample in landingActivitySamples"
            :key="`${pass}-${sample.id}`"
            role="listitem"
            class="flex items-center gap-3 px-4 py-3 border-b border-glass-border last:border-b-0"
          >
            <IconChip :tone="activityTypeMeta[sample.type].tone">
              <span aria-hidden="true">{{ glyphs[activityTypeMeta[sample.type].icon] ?? '•' }}</span>
            </IconChip>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm font-medium text-fg">{{ activityTypeMeta[sample.type].label }}</p>
                <span
                  class="inline-flex items-center gap-1 rounded-full border pl-1 pr-2 py-0.5 text-xs font-medium text-fg"
                  :style="{ backgroundColor: `${chainMeta[sample.chainName].color}1f`, borderColor: `${chainMeta[sample.chainName].color}4d` }"
                >
                  <img :src="chainMeta[sample.chainName].logo" :alt="chainMeta[sample.chainName].name" class="w-3.5 h-3.5 rounded-full" />
                  {{ chainMeta[sample.chainName].name }}
                </span>
                <template v-if="sample.counterpartChainName">
                  <span class="text-muted text-xs" aria-hidden="true">from</span>
                  <span
                    class="inline-flex items-center gap-1 rounded-full border pl-1 pr-2 py-0.5 text-xs font-medium text-fg"
                    :style="{ backgroundColor: `${chainMeta[sample.counterpartChainName].color}1f`, borderColor: `${chainMeta[sample.counterpartChainName].color}4d` }"
                  >
                    <img :src="chainMeta[sample.counterpartChainName].logo" :alt="chainMeta[sample.counterpartChainName].name" class="w-3.5 h-3.5 rounded-full" />
                    {{ chainMeta[sample.counterpartChainName].name }}
                  </span>
                </template>
              </div>
              <p class="font-mono text-[11px] text-muted truncate">{{ sample.detail }}</p>
            </div>

            <div class="text-right shrink-0">
              <p v-if="sample.amount" class="tabular-nums font-semibold text-sm text-fg">{{ sample.amount }}</p>
              <p class="text-[10px] uppercase tracking-wider text-muted">{{ sample.timeAgo }}</p>
            </div>
          </div>
        </template>
      </div>
    </div>

    <p v-if="scanOn" class="text-center text-sm text-muted mt-6">
      <router-link to="/scan" class="text-accent hover:underline">Open Scan -&gt;</router-link>
    </p>
  </section>
</template>

<style scoped>
/* Scrolls the (duplicated) row list up by exactly half its height, then
   loops seamlessly back to the start — the standard vertical-marquee trick.
   Paused on hover via the `group-hover:` utility in the template, and never
   applied at all under reduced motion (see `prefersReducedMotion` above). */
.ticker-track {
  animation: ticker-scroll 28s linear infinite;
}
@keyframes ticker-scroll {
  to {
    transform: translateY(-50%);
  }
}
</style>
