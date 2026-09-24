<script setup lang="ts">
/**
 * src/components/landing/ActivityTicker.vue — the landing page's sixth
 * section: a slow vertical marquee of sample activity rows, illustrating the
 * kind of live feed a payable or chain actually gets on `/scan` and the
 * activity pages.
 *
 * Rows come from `landingActivitySamples` (`./placeholders.ts`) only — they
 * are not linked to any real entity, per the brief. The marquee pauses on
 * hover and never scrolls at all under `prefers-reduced-motion: reduce`
 * (rendered once, unduplicated, in that case).
 *
 * Usage: `<ActivityTicker />` inside `HomeView.vue`.
 */
import { activityTypeMeta, chainNamesToChains } from '@/schemas';
import { ChainBadge, IconChip, SectionHeader } from '@/components/ui';
import { landingActivitySamples } from './placeholders';

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
                <ChainBadge :chain="chainNamesToChains[sample.chainName]" size="sm" />
                <template v-if="sample.counterpartChainName">
                  <span class="text-muted text-xs" aria-hidden="true">from</span>
                  <ChainBadge :chain="chainNamesToChains[sample.counterpartChainName]" size="sm" />
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

    <p class="text-center text-sm text-muted mt-6">
      <router-link to="/scan" class="text-accent hover:underline">Open Scan →</router-link>
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
