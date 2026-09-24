<script setup lang="ts">
/**
 * src/components/payable/PayableSettingsCard.vue: the "How this payable
 * accepts payments" card in the side rail.
 *
 * Shows the payable's payment rules (any token any amount, or a specific list),
 * the auto-withdraw setting, and the withdrawal fee percentage from the
 * payable's home chain config. The fee is loaded once from `useStatsStore`
 * since it belongs to a chain config, not the payable itself.
 *
 * Props:
 *  - `payable`: the loaded `Payable`.
 *
 * Usage:
 * ```vue
 * <PayableSettingsCard :payable="payable" />
 * ```
 */
import { GlassCard, Skeleton, TokenAmount } from '@/components/ui';
import { tokens, type Payable } from '@/schemas';
import { useStatsStore } from '@/stores';
import { computed, onMounted, ref } from 'vue';

const props = defineProps<{
  /** The loaded payable whose settings this card displays. */
  payable: Payable;
}>();

/** Withdrawal fee in basis points loaded from chain config. Shown as a percentage. */
const feeBps = ref<number | null>(null);

const stats = useStatsStore();

/** Loads the withdrawal fee once the card mounts. */
const loadFee = async () => {
  const chainStats = await stats.getChainStats(props.payable.chain);
  feeBps.value = chainStats?.withdrawalFeePercentage ?? null;
};

onMounted(loadFee);

/** Whether this payable accepts any token in any amount (no restriction). */
const isAnyAmount = computed(() => props.payable.allowedTokensAndAmounts.length === 0);

/** Tokens available on the home chain, for the "any amount" explanation row. */
const homeChainTokens = computed(() => tokens.filter((t) => !!t.details[props.payable.chain.name]));

/** Percentage label from the fee in basis points, e.g. "2%" or "2.5%". */
const feeLabel = computed(() => {
  if (feeBps.value === null) return null;
  return `${(feeBps.value / 100).toFixed(2).replace(/\.?0+$/, '')}%`;
});
</script>

<template>
  <GlassCard>
    <h3 class="text-sm font-semibold text-fg mb-4">How this payable accepts payments</h3>

    <!-- Any token, any amount -->
    <template v-if="isAnyAmount">
      <p class="text-xs text-muted mb-3">
        This payable accepts any supported token in any amount. Payers may use any of the following tokens on
        <span class="text-fg">{{ payable.chain.displayName }}</span
        >:
      </p>
      <ul class="flex flex-wrap gap-2 mb-4">
        <li v-for="token in homeChainTokens" :key="token.name">
          <span
            class="inline-flex items-center gap-1 rounded-full border border-glass-border bg-bg/30 px-2.5 py-1 text-xs text-fg"
          >
            {{ token.name }}
          </span>
        </li>
      </ul>
    </template>

    <!-- Specific token/amount options -->
    <template v-else>
      <p class="text-xs text-muted mb-3">Payers must choose one of these exact options:</p>
      <ul class="flex flex-col gap-2 mb-4">
        <li v-for="(ta, i) in payable.allowedTokensAndAmounts" :key="i" class="flex items-center gap-2 text-sm text-fg">
          <span class="text-muted text-xs">or</span>
          <TokenAmount :amount="ta" :chain="payable.chain" size="sm" />
        </li>
      </ul>
    </template>

    <!-- Auto-withdraw setting -->
    <div class="border-t border-fg/5 pt-3 mb-3">
      <div class="flex items-center justify-between text-xs">
        <span class="text-muted">Auto-withdraw</span>
        <span :class="payable.isAutoWithdraw ? 'text-success font-medium' : 'text-muted'">
          {{ payable.isAutoWithdraw ? 'On' : 'Off' }}
        </span>
      </div>
      <p class="text-[11px] text-muted mt-1">
        <template v-if="payable.isAutoWithdraw">
          Each payment is sent straight to the host's wallet minus the fee.
        </template>
        <template v-else> Payments accumulate in the payable's balance until the host withdraws. </template>
      </p>
    </div>

    <!-- Withdrawal fee -->
    <div class="border-t border-fg/5 pt-3">
      <div class="flex items-center justify-between text-xs">
        <span class="text-muted">Withdrawal fee</span>
        <span class="text-fg font-medium tabular-nums">
          <Skeleton v-if="feeBps === null" w="w-12" h="h-4" />
          <span v-else>{{ feeLabel }}</span>
        </span>
      </div>
      <p class="text-[11px] text-muted mt-1">Deducted by Chainbills at the time of withdrawal.</p>
    </div>
  </GlassCard>
</template>
