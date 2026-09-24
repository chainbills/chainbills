<script setup lang="ts">
/**
 * src/components/ui/TokenAmount.vue — a token logo next to a formatted
 * amount and symbol, used anywhere a payment, balance or fee is displayed.
 *
 * Accepts either a raw on-chain `bigint` (paired with a `token` prop so the
 * component knows which decimals/logo to use) or an already-built
 * `TokenAndAmount` (which carries its own token/decimals). The `bigint` path
 * formats with viem's `formatUnits`, per the app-wide rule against
 * `number * 10 ** decimals` amount maths.
 *
 * Usage:
 * ```vue
 * <TokenAmount :token="usdcToken" :amount="1500000n" :chain="sepolia" />
 * <TokenAmount :amount="tokenAndAmount" :chain="sepolia" size="sm" />
 * <TokenAmount :amount="tokenAndAmount" :chain="sepolia" size="lg" />
 * ```
 */
import { getTokenLogo, TokenAndAmount, type Chain, type Token } from '@/schemas';
import { formatUnits } from 'viem';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** The token being displayed. Required when `amount` is a raw `bigint`;
     *  ignored when `amount` is a `TokenAndAmount` (which already knows its
     *  token). */
    token?: Token;
    /** The amount to format: a raw on-chain integer, or a `TokenAndAmount`
     *  built elsewhere in the app. */
    amount: bigint | TokenAndAmount;
    /** The chain the amount lives on, used to look up decimals and the
     *  chain-specific token logo/address. */
    chain: Chain;
    /** Visual size. `md` (default) for cards and detail rows, `sm` for
     *  dense table cells, `lg` for a receipt's or summary's hero amount. */
    size?: 'sm' | 'md' | 'lg';
  }>(),
  { size: 'md' }
);

/** Resolves the token, its logo and the formatted display string,
 *  regardless of which shape `amount` was passed in as. */
const resolved = computed(() => {
  if (props.amount instanceof TokenAndAmount) {
    const token = props.amount.token();
    return {
      name: token.name,
      logo: getTokenLogo(props.chain, token),
      formatted: props.amount.format(props.chain).toString(),
    };
  }

  const token = props.token!;
  const decimals = token.details[props.chain.name]?.decimals ?? 0;
  return {
    name: token.name,
    logo: getTokenLogo(props.chain, token),
    formatted: formatUnits(props.amount, decimals),
  };
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5"
    :class="size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-2xl' : 'text-sm'"
  >
    <img
      :src="resolved.logo"
      :alt="`${resolved.name} logo`"
      :class="size === 'sm' ? 'w-4 h-4 rounded-full' : size === 'lg' ? 'w-7 h-7 rounded-full' : 'w-5 h-5 rounded-full'"
    />
    <span class="font-semibold tabular-nums text-fg">{{ resolved.formatted }}</span>
    <span class="text-muted" :class="size === 'lg' && 'text-base'">{{ resolved.name }}</span>
  </span>
</template>
