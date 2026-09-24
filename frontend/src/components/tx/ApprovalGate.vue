<script setup lang="ts">
/**
 * src/components/tx/ApprovalGate.vue — an explainer row shown on the pay
 * page whenever the selected token needs an ERC-20 `approve` before the
 * payment itself can be sent (every token except a chain's native token,
 * which pays straight from `msg.value`).
 *
 * States the exact token and amount being approved (including the CCTP fee
 * buffer, when paying cross-chain), the spender (the Chainbills contract,
 * as an `AddressChip`), why the approval exists, and that approval and
 * payment are two separate wallet prompts — so neither prompt surprises the
 * payer. Purely informational: it does not itself skip the flow's `approve`
 * step, which `evm.pay`/`evm.payForeignViaCctp` already skip on their own
 * once the existing allowance covers the amount.
 *
 * Usage:
 * ```vue
 * <ApprovalGate :amount="selectedConfig" :chain="userChain" :spender="contracts[userChain.name]" :cross-chain="!isSameChain" />
 * ```
 */
import { AddressChip } from '@/components/ui';
import { TokenAndAmount, type Chain } from '@/schemas';

defineProps<{
  /** The token and exact amount the payer is about to approve. */
  amount: TokenAndAmount;
  /** The chain the approval transaction runs on. */
  chain: Chain;
  /** The Chainbills contract address that will spend the approved tokens. */
  spender: string;
  /** When true, adds a note that the approved amount includes a small buffer for the CCTP bridge fee. */
  crossChain?: boolean;
}>();
</script>

<template>
  <div class="rounded-2xl border border-glass-border bg-fg/[0.03] p-3.5 text-xs text-muted">
    <p class="text-fg font-medium mb-1">
      This payment needs a one-time approval for
      <span class="font-semibold">{{ amount.display(chain) }}</span
      ><span v-if="crossChain">, including a small buffer for the CCTP bridge fee</span>.
    </p>
    <p class="mb-1.5">Spender: <AddressChip :value="spender" :chain="chain" kind="address" /></p>
    <p>
      {{ amount.name }} is an ERC-20 token, so your wallet must approve the Chainbills contract to move it before the
      payment can go through. Approval and payment are two separate wallet prompts.
    </p>
  </div>
</template>
