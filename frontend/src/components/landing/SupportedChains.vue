<script setup lang="ts">
/**
 * src/components/landing/SupportedChains.vue — the landing page's seventh
 * section: one card per chain Chainbills is deployed to, showing its
 * `ChainBadge`, network tier and which cross-chain messaging paths it
 * supports, plus a "coming soon" card for Solana.
 *
 * Capability tags are static facts from `frontend/CLAUDE.md`'s chain table
 * and `evm/DEPLOYED.md`, not a live read — matching the landing page's
 * no-network-reads rule.
 *
 * Usage: `<SupportedChains />` inside `HomeView.vue`.
 */
import { GlassCard, NetworkPill, SectionHeader } from '@/components/ui';
import { chainNamesToChains, getChainLogo, solanadevnet } from '@/schemas';

/** Which cross-chain messaging paths each deployed chain supports. MegaETH
 *  has no CCTP deployment; Arc Testnet has no Wormhole deployment; Sepolia
 *  has both (`frontend/CLAUDE.md`'s chain table). */
const chainCapabilities = [
  { chain: chainNamesToChains.megaeth, tags: ['Wormhole messaging'] },
  { chain: chainNamesToChains.sepolia, tags: ['Wormhole messaging', 'Circle CCTP'] },
  { chain: chainNamesToChains.arctestnet, tags: ['Circle CCTP'] },
];
</script>

<template>
  <section class="py-10 sm:py-14">
    <SectionHeader eyebrow="Chains" title="Deployed across" accent-tail="every chain that matters." />

    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <GlassCard v-for="(entry, i) in chainCapabilities" :key="entry.chain.name" v-reveal="{ delay: i * 70 }">
        <div class="flex items-center gap-2 mb-4">
          <img :src="getChainLogo(entry.chain)" :alt="`${entry.chain.displayName} logo`" class="w-8 h-8 rounded-full" />
          <div>
            <p class="font-display text-fg">{{ entry.chain.displayName }}</p>
            <NetworkPill :type="entry.chain.networkType" />
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="tag in entry.tags" :key="tag" class="rounded-full bg-fg/5 text-muted text-xs px-2.5 py-1">
            {{ tag }}
          </span>
        </div>
      </GlassCard>

      <!-- Solana is inactive this round (frontend/CLAUDE.md's "Important
           Notes"), but is still shown here so visitors know it's on the
           roadmap rather than absent by oversight. -->
      <GlassCard v-reveal="{ delay: chainCapabilities.length * 70 }" class="opacity-70">
        <div class="flex items-center gap-2 mb-4">
          <img :src="getChainLogo(solanadevnet)" alt="Solana logo" class="w-8 h-8 rounded-full grayscale" />
          <div>
            <p class="font-display text-fg">Solana</p>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 text-muted bg-fg/5 ring-fg/10"
            >
              Coming soon
            </span>
          </div>
        </div>
        <p class="text-xs text-muted">Anchor program groundwork is in place; payments open here in a future round.</p>
      </GlassCard>
    </div>
  </section>
</template>
