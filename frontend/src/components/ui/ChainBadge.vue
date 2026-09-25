<script setup lang="ts">
/**
 * src/components/ui/ChainBadge.vue — a chain's logo and name, tinted by the
 * chain's own brand colour.
 *
 * Chain colours are identity-only (design-language.md §2, §8): they appear
 * here, on cross-chain rails and on chain-scoped stat accents, but never as a
 * button or text accent elsewhere in the app — the app's own `--accent`
 * covers that everywhere else.
 *
 * Usage:
 * ```vue
 * <ChainBadge :chain="sepolia" />
 * <ChainBadge :chain="megaeth" size="sm" network />
 * <ChainBadge :chain="arctestnet" runtime />
 * ```
 */
import { getChainLogo, type Chain } from '@/schemas';
import { computed } from 'vue';
import NetworkPill from './NetworkPill.vue';

const props = withDefaults(
  defineProps<{
    /** The chain to render. Supplies the logo, display name, brand colour and network tier. */
    chain: Chain;
    /** Badge size. `md` (default) fits inline text; `sm` fits dense rows/tables. */
    size?: 'sm' | 'md';
    /** When true, appends a `NetworkPill` (Mainnet/Testnet) after the name. */
    network?: boolean;
    /** When true, appends a small "EVM"/"SVM" runtime tag after the name. */
    runtime?: boolean;
  }>(),
  { size: 'md', network: false, runtime: false }
);

/** The badge's tint background/border, computed from the chain's own
 *  `brandColor` so every chain gets a distinct, low-opacity wash rather than
 *  sharing the app accent colour. */
const tintStyle = computed(() => ({
  backgroundColor: `${props.chain.brandColor}1f`, // ~12% alpha (0x1f / 0xff)
  borderColor: `${props.chain.brandColor}4d`, // ~30% alpha (0x4d / 0xff)
}));
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 rounded-full border pl-1 pr-3 py-1 whitespace-nowrap"
    :style="tintStyle"
    :class="size === 'sm' ? 'text-xs' : 'text-sm'"
  >
    <img
      :src="getChainLogo(chain)"
      :alt="`${chain.displayName} logo`"
      :class="size === 'sm' ? 'w-4 h-4 rounded-full' : 'w-5 h-5 rounded-full'"
    />
    <span class="font-medium text-fg">{{ chain.displayName }}</span>
    <span v-if="runtime" class="text-[10px] uppercase tracking-wider text-muted">{{
      chain.isEvm ? 'EVM' : 'SVM'
    }}</span>
    <NetworkPill v-if="network" :type="chain.networkType" />
  </span>
</template>
