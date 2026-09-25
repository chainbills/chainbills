<script setup lang="ts">
/**
 * src/components/landing/BuildersTrust.vue — the landing page's eighth
 * section: the case for trusting Chainbills with funds — non-custodial
 * contracts, an open-source codebase, the `cbChainId` cross-chain id scheme,
 * the verifiable `/scan` explorer, and the flat withdrawal fee — each backed
 * by a small code-style snippet naming a real contract function.
 *
 * Usage: `<BuildersTrust />` inside `HomeView.vue`.
 */
import { GlassCard, SectionHeader } from '@/components/ui';
import IconGithub from '@/icons/IconGithub.vue';

/** One trust point: a claim and one sentence backing it. */
const points = [
  {
    title: 'Non-custodial contracts',
    description: 'Funds sit in the Chainbills contract on the payable\'s own chain until the owner withdraws them.',
  },
  {
    title: 'Cross-chain ids, not chain-specific ones',
    description: 'Every chain reference is a keccak256 cbChainId (CAIP-2) — never a Wormhole id or a Circle domain.',
  },
  {
    title: 'Verifiable on Scan',
    description: 'Every payable, payment and withdrawal this page describes can be looked up on-chain at /scan.',
  },
  {
    title: 'One transparent fee',
    description: 'A flat 2% is taken on withdrawal — computed on-chain, visible before you confirm.',
  },
];
</script>

<template>
  <section class="py-10 sm:py-14">
    <SectionHeader eyebrow="For builders" title="Built to be" accent-tail="checked, not trusted.">
      <template #actions>
        <a
          href="https://github.com/chainbills/chainbills"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass-tint px-4 py-2 text-sm font-medium text-fg hover:text-accent transition-colors"
        >
          <IconGithub class="w-4 h-4" />
          View source
        </a>
      </template>
    </SectionHeader>

    <div class="grid sm:grid-cols-2 gap-4">
      <GlassCard v-for="(point, i) in points" :key="point.title" v-reveal="{ delay: i * 70 }">
        <h3 class="font-display text-lg text-fg mb-2">{{ point.title }}</h3>
        <p class="text-sm text-muted leading-relaxed">{{ point.description }}</p>
      </GlassCard>
    </div>
  </section>
</template>
