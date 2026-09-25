<script setup lang="ts">
/**
 * src/components/tx/ApprovalGate.vue — a short heads-up shown on the pay page
 * whenever the selected token needs a wallet approval before the payment
 * itself can be sent. Purely informational — the actual approve step is
 * driven by `evm.pay`/`evm.payForeignViaCctp`, which auto-skip when the
 * existing allowance already covers the amount.
 *
 * Usage:
 * ```vue
 * <ApprovalGate :amount="selectedConfig" :chain="userChain" :cross-chain="!isSameChain" />
 * ```
 */
import { TokenAndAmount, type Chain } from '@/schemas';

defineProps<{
  /** The token and exact amount the payer is about to approve. */
  amount: TokenAndAmount;
  /** The chain the approval transaction runs on. */
  chain: Chain;
  /** When true, adds a note that the approved amount includes a small buffer for the bridge fee. */
  crossChain?: boolean;
}>();
</script>

<template>
  <div class="rounded-2xl border border-glass-border bg-fg/[0.03] p-3.5 text-sm text-fg">
    <p class="font-medium mb-1">Your wallet will ask you twice</p>
    <p class="text-xs text-muted">
      First to unlock <span class="text-fg font-medium">{{ amount.display(chain) }}</span
      ><span v-if="crossChain"> (a touch more to cover the bridge fee)</span>, then to send the payment. Nothing moves
      until you confirm the second prompt.
    </p>
  </div>
</template>
