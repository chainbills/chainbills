<script setup lang="ts">
/**
 * src/components/scan/ChainBreakdownBar.vue
 *
 * A horizontal proportional bar showing how a single stat (payables count,
 * user count, etc.) is distributed across chains. Each segment's width is
 * proportional to that chain's share of `total`, coloured with the chain's
 * `brandColor` at 60% opacity. A tooltip on each segment reveals the chain
 * display name and count.
 *
 * Props:
 *  - `chains`: the set of chains to render segments for (order preserved).
 *  - `values`: the per-chain raw count for the one stat being displayed.
 *  - `total`: the sum used for proportion maths.
 *
 * Usage:
 * ```vue
 * <ChainBreakdownBar :chains="networkChains" :values="perChainPayables" :total="networkStats.payablesCount" />
 * ```
 */
import type { Chain, ChainName } from '@/schemas';

const props = defineProps<{
  /** The chains to render, in the order their segments should appear. */
  chains: Chain[];
  /** Per-chain count for the stat this bar visualises. */
  values: Partial<Record<ChainName, number>>;
  /** Total count (sum of all values) used to compute proportions. */
  total: number;
}>();

/** Percentage width for one chain's segment (floored to avoid sub-pixel rounding gaps). */
const segmentWidth = (chainName: ChainName): string => {
  if (props.total <= 0) return '0%';
  const v = props.values[chainName] ?? 0;
  return `${((v / props.total) * 100).toFixed(2)}%`;
};
</script>

<template>
  <!-- Horizontal bar with one coloured segment per chain. Zero-total renders a grey placeholder. -->
  <div class="flex h-1.5 w-full overflow-hidden rounded-full bg-fg/10" role="presentation" aria-hidden="true">
    <template v-if="total > 0">
      <div
        v-for="chain in chains"
        :key="chain.name"
        class="h-full transition-all duration-300"
        :style="{
          width: segmentWidth(chain.name),
          backgroundColor: chain.brandColor,
          opacity: 0.6,
        }"
        :title="`${chain.displayName}: ${values[chain.name] ?? 0}`"
      />
    </template>
    <div v-else class="h-full w-full rounded-full bg-fg/10" />
  </div>
</template>
