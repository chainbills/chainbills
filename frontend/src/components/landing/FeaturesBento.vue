<script setup lang="ts">
/**
 * src/components/landing/FeaturesBento.vue — the landing page's features
 * section: a bento grid of glass cards, varied sizes, each with a corner
 * glow and a hover lift, summarising what a payable can do.
 *
 * Usage: `<FeaturesBento />` inside `HomeView.vue`.
 */
import { GlassCard, SectionHeader } from '@/components/ui';
import IconDashboard from '@/icons/IconDashboard.vue';
import IconFinance from '@/icons/IconFinance.vue';
import IconGlobe from '@/icons/IconGlobe.vue';
import IconHorizontalAdjustments from '@/icons/IconHorizontalAdjustments.vue';
import IconLock from '@/icons/IconLock.vue';
import IconPayCheck from '@/icons/IconPayCheck.vue';
import IconSync from '@/icons/IconSync.vue';
import IconWallet from '@/icons/IconWallet.vue';

/** One bento cell. `span` widens a cell to two columns on `lg+`, giving the
 *  grid its varied-size "bento" look instead of a uniform grid. `iconClass`
 *  picks the one colour utility that actually paints each icon: the set in
 *  `src/icons/*` mixes stroke-only, fill-only and `fill="currentColor"`
 *  SVGs, so a single shared class would either leave some icons invisible or
 *  wrongly solid-fill a stroke-only one. */
const features: {
  title: string;
  description: string;
  icon: unknown;
  iconClass: string;
  to?: string;
  span?: boolean;
}[] = [
  {
    title: 'Payable links',
    description: 'Every payable gets one shareable link a payer can open from any device, no wallet address needed.',
    icon: IconPayCheck,
    iconClass: 'stroke-accent',
    span: true,
  },
  {
    title: 'Exact-amount enforcement',
    description: 'Lock a payable to specific tokens and amounts so partial or wrong-token payments are rejected.',
    icon: IconHorizontalAdjustments,
    iconClass: 'stroke-accent',
  },
  {
    title: 'Accept any token or specific options',
    description: 'Or leave it open: accept any amount of any supported token instead.',
    icon: IconWallet,
    iconClass: 'stroke-accent',
  },
  {
    title: 'Auto-withdraw',
    description: 'Turn it on and every payment sweeps straight to your wallet — no manual withdrawal step.',
    icon: IconSync,
    iconClass: 'text-accent',
  },
  {
    title: 'Close and reopen anytime',
    description: 'Stop new payments instantly, and reopen the same payable whenever you want to resume.',
    icon: IconLock,
    iconClass: 'fill-accent',
  },
  {
    title: 'Public receipts',
    description: 'Every payment gets a public, shareable receipt — proof of payment with no login required.',
    icon: IconFinance,
    iconClass: 'stroke-accent',
  },
  {
    title: 'On-chain explorer (Scan)',
    description: 'Browse every payable, payment and withdrawal across every chain, mainnet and testnet, at /scan.',
    icon: IconGlobe,
    iconClass: 'stroke-accent',
    to: '/scan',
    span: true,
  },
  {
    title: 'Transparent 2% withdrawal fee',
    description: 'The only fee is a flat 2% on withdrawals. No hidden spreads, no subscription.',
    icon: IconDashboard,
    iconClass: 'text-accent',
  },
];
</script>

<template>
  <section class="py-10 sm:py-14">
    <SectionHeader eyebrow="Features" title="Everything a payable" accent-tail="needs, nothing it doesn't." />

    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">
      <component
        :is="feature.to ? 'router-link' : 'div'"
        v-for="(feature, i) in features"
        :key="feature.title"
        :to="feature.to"
        :class="feature.span && 'lg:col-span-2'"
        v-reveal="{ delay: (i % 4) * 60 }"
      >
        <GlassCard hoverable class="h-full relative overflow-hidden">
          <div class="absolute -top-14 -right-14 w-40 h-40 rounded-full bg-accent/10 blur-2xl pointer-events-none" />
          <div class="relative">
            <div class="p-2 rounded-xl bg-accent/10 w-fit mb-4">
              <component :is="feature.icon" :class="['w-5 h-5', feature.iconClass]" />
            </div>
            <h3 class="font-display text-lg text-fg mb-1.5">{{ feature.title }}</h3>
            <p class="text-sm text-muted">{{ feature.description }}</p>
          </div>
        </GlassCard>
      </component>
    </div>
  </section>
</template>
