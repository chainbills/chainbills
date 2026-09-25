<script setup lang="ts">
/**
 * src/components/tx/CrossChainRoute.vue — a visual strip showing a
 * cross-chain payment's route: the source chain, an animated rail with a
 * travelling packet, the destination chain, and underneath it the bridge
 * name, an estimated arrival time and the fees involved.
 *
 * Purely presentational — it takes the two chains and the already-computed
 * fees as props and renders them; it does not read any store or fetch
 * anything itself. Reused by the pay page's route panel, the receipt page's
 * live delivery tracker, and the landing page's cross-chain story.
 *
 * Usage:
 * ```vue
 * <CrossChainRoute
 *   :source-chain="sepolia"
 *   :dest-chain="arctestnet"
 *   :cctp-fee="cctpFeeTokenAndAmount"
 *   :wormhole-fee="wormholeFeeTokenAndAmount"
 * />
 * ```
 */
import { ChainBadge, TokenAmount } from '@/components/ui';
import { TokenAndAmount, type Chain } from '@/schemas';
import { useAnalyticsStore } from '@/stores';
import { onMounted } from 'vue';

const analytics = useAnalyticsStore();

const props = withDefaults(
  defineProps<{
    /** The chain the payer pays from. */
    sourceChain: Chain;
    /** The chain the payable lives on. */
    destChain: Chain;
    /** Circle CCTP's fast-transfer max fee, in USDC, charged on the source chain. */
    cctpFee?: TokenAndAmount;
    /** The Wormhole message fee, in the source chain's native token. */
    wormholeFee?: TokenAndAmount;
    /** Plain-language arrival estimate shown next to the bridge name. */
    estimatedTime?: string;
    /** When true, fires a cross_chain_route_shown analytics event on mount. Set on the pay and receipt pages; omit on the landing page demo. */
    tracked?: boolean;
  }>(),
  { estimatedTime: 'usually 1-3 min', tracked: false }
);

onMounted(() => {
  if (props.tracked) {
    analytics.recordEvent('cross_chain_route_shown', {
      from_chain: props.sourceChain.name,
      to_chain: props.destChain.name,
    });
  }
});
</script>

<template>
  <div>
    <div class="flex items-center gap-3">
      <ChainBadge :chain="sourceChain" size="sm" />

      <!-- The rail: a hairline track with a small glowing packet that
           travels from source to destination on a 4s loop, matching the
           "rail sweep" motion recipe (design-language.md §6). Pinned to the
           midpoint and frozen under `prefers-reduced-motion: reduce`. -->
      <div class="relative flex-1 h-px bg-gradient-to-r from-transparent via-fg/20 to-transparent" aria-hidden="true">
        <span
          class="route-packet absolute top-1/2 -mt-1 w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_2px_rgb(var(--accent-rgb)/0.5)] motion-reduce:left-1/2 motion-reduce:animate-none"
        ></span>
      </div>

      <ChainBadge :chain="destChain" size="sm" />
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
      <span>Bridge: <span class="text-fg font-medium">Circle CCTP</span></span>
      <span class="opacity-50" aria-hidden="true">·</span>
      <span
        >Estimated time: <span class="text-fg font-medium">{{ estimatedTime }}</span></span
      >
    </div>

    <div v-if="cctpFee || wormholeFee" class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
      <span v-if="cctpFee" class="inline-flex items-center gap-1.5">
        CCTP fee (max): <TokenAmount :amount="cctpFee" :chain="sourceChain" size="sm" />
      </span>
      <span v-if="wormholeFee" class="inline-flex items-center gap-1.5">
        Wormhole fee: <TokenAmount :amount="wormholeFee" :chain="sourceChain" size="sm" />
      </span>
    </div>
  </div>
</template>

<style scoped>
@keyframes route-packet-travel {
  0% {
    left: 0%;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    left: 100%;
    opacity: 0;
  }
}
.route-packet {
  animation: route-packet-travel 4s var(--ease-out-expo) infinite;
}
</style>
