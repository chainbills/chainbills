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

/** One trust point: a claim, one sentence backing it, and the real contract
 *  function/identifier that makes it verifiable rather than a promise. */
const points = [
  {
    title: 'Non-custodial contracts',
    description: 'Funds sit in the Chainbills contract on the payable’s own chain until the host withdraws them.',
    code: 'function withdraw(bytes32 payableId, address token, uint256 amount)',
  },
  {
    title: 'Cross-chain ids, not chain-specific ones',
    description: 'Every chain reference is a keccak256 cbChainId (CAIP-2) — never a Wormhole id or a Circle domain.',
    code: 'cbChainId = keccak256("eip155:11155111")',
  },
  {
    title: 'Verifiable on Scan',
    description: 'Every payable, payment and withdrawal this page describes can be looked up on-chain at /scan.',
    code: 'CbGetters.getPayable(payableId)',
  },
  {
    title: 'One transparent fee',
    description: 'A flat 2% is taken on withdrawal — computed on-chain, visible before you confirm.',
    code: '(amount * config.withdrawalFeePercentage) / 10000',
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
        <h3 class="font-display text-lg text-fg mb-1.5">{{ point.title }}</h3>
        <p class="text-sm text-muted mb-3">{{ point.description }}</p>
        <p
          class="font-mono text-[11px] rounded-lg bg-fg/[0.04] border border-glass-border px-3 py-2 text-accent overflow-x-auto whitespace-pre"
        >
          {{ point.code }}
        </p>
      </GlassCard>
    </div>
  </section>
</template>
