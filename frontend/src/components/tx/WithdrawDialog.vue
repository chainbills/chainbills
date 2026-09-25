<script setup lang="ts">
/**
 * src/components/tx/WithdrawDialog.vue — the glass dialog a host uses to
 * withdraw one of a payable's token balances. Shows the available balance,
 * an amount input with a "Max" shortcut, and a live breakdown (amount, the
 * withdrawal fee in basis points from the chain's config capped by that
 * token's `maxWithdrawalFees`, and the net amount the host receives), then
 * drives the `'withdraw'` tx-flow through `withdrawals.exec`.
 *
 * Used by `PayableDetailView.vue` (opened from a balance's own "Withdraw"
 * button) and, from brief 04 onward, the public payable page's host
 * controls.
 *
 * Usage:
 * ```vue
 * <WithdrawDialog v-model:visible="showWithdraw" :payable="payable" :balance="selectedBalance" @withdrawn="onWithdrawn" />
 * ```
 */
import { AddressChip } from '@/components/ui';
import { contracts, parseTokenAmount, TokenAndAmount, type Payable } from '@/schemas';
import { useAnalyticsStore, useEvmStore, useStatsStore, useWithdrawalStore } from '@/stores';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import { computed, ref, watch } from 'vue';
import { useTxRetry } from './retry';

const props = defineProps<{
  /** Whether the dialog is open. */
  visible: boolean;
  /** The payable being withdrawn from. Its `chain` decides where the withdrawal transaction runs. */
  payable: Payable;
  /** The token and current balance the host chose to withdraw from. */
  balance: TokenAndAmount;
}>();

const emit = defineEmits<{
  /** Two-way binding for `visible`. */
  'update:visible': [boolean];
  /** Fires with the new withdrawal's id once the flow succeeds, so the caller can refresh the payable. */
  withdrawn: [withdrawalId: string];
}>();

const analytics = useAnalyticsStore();
const evm = useEvmStore();
const stats = useStatsStore();
const withdrawals = useWithdrawalStore();
const { setRetry } = useTxRetry();

const amountInput = ref('');
const isSubmitting = ref(false);
/** Withdrawal fee, in basis points (divide by 100 for a percentage), read from the payable's chain config. */
const feeBps = ref(0);
/** This token's fee cap on the payable's chain, in the token's smallest unit. `0n` means no cap is configured. */
const maxFee = ref(0n);

const decimals = computed(() => props.balance.details[props.payable.chain.name]?.decimals ?? 0);
const spender = computed(() => contracts[props.payable.chain.name]);

/** Loads the fee config for the current balance's token/chain, so the breakdown below is accurate before the host ever submits. */
const loadFeeConfig = async () => {
  const tokenAddress = props.balance.details[props.payable.chain.name]?.address;
  const [chainStats, tokenDetails] = await Promise.all([
    stats.getChainStats(props.payable.chain),
    tokenAddress ? evm.getTokenDetailsOnChain(tokenAddress, props.payable.chain.name) : Promise.resolve(null),
  ]);
  feeBps.value = chainStats?.withdrawalFeePercentage ?? 0;
  maxFee.value = tokenDetails ? BigInt(tokenDetails.maxWithdrawalFees) : 0n;
};

watch(
  () => [props.visible, props.balance] as const,
  ([visible]) => {
    if (!visible) return;
    amountInput.value = props.balance.format(props.payable.chain);
    loadFeeConfig();
  },
  { immediate: true }
);

const rawAmount = computed(() => {
  try {
    return parseTokenAmount(amountInput.value || '0', decimals.value);
  } catch {
    return null;
  }
});

const amountError = computed(() => {
  if (rawAmount.value === null) return 'Enter a valid amount.';
  if (rawAmount.value <= 0n) return 'Enter an amount greater than zero.';
  if (rawAmount.value > props.balance.amount) return 'That is more than the available balance.';
  return '';
});

/** The fee this withdrawal would pay: `amount * feeBps / 10000`, capped by `maxFee` when one is configured. */
const fee = computed(() => {
  if (rawAmount.value === null || rawAmount.value <= 0n) return 0n;
  const raw = (rawAmount.value * BigInt(feeBps.value)) / 10_000n;
  return maxFee.value > 0n && raw > maxFee.value ? maxFee.value : raw;
});

const netAmount = computed(() => (rawAmount.value !== null && rawAmount.value > 0n ? rawAmount.value - fee.value : 0n));

const feePercentLabel = computed(() => `${(feeBps.value / 100).toFixed(2).replace(/\.?0+$/, '')}%`);

const asAmount = (raw: bigint) => new TokenAndAmount(props.balance.token(), raw).display(props.payable.chain);

const setMax = () => {
  amountInput.value = props.balance.format(props.payable.chain);
  analytics.recordEvent('clicked_max_withdrawal', {
    token: props.balance.name,
    chain: props.payable.chain.name,
  });
};

const close = () => emit('update:visible', false);

const submit = async () => {
  if (amountError.value || rawAmount.value === null) return;
  analytics.recordEvent('withdraw_submitted', {
    payable_id: props.payable.id,
    token: props.balance.name,
    chain: props.payable.chain.name,
    net_amount: asAmount(rawAmount.value - fee.value),
    fee_pct: feePercentLabel.value,
  });
  setRetry(() => submit());
  isSubmitting.value = true;
  close();
  const withdrawalId = await withdrawals.exec(
    props.payable.id,
    new TokenAndAmount(props.balance.token(), rawAmount.value)
  );
  isSubmitting.value = false;
  if (withdrawalId) emit('withdrawn', withdrawalId);
};
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Withdraw funds"
    class="w-full max-w-sm max-sm:m-4"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <p class="text-sm text-muted mb-4">
      Withdraw from your <strong class="text-fg">{{ balance.name }}</strong> balance on {{ payable.chain.displayName }}.
      A {{ feePercentLabel }} fee applies, sent to
      <AddressChip :value="spender" :chain="payable.chain" kind="address" />.
    </p>

    <label class="block mb-1.5">
      <span class="text-xs uppercase tracking-wider text-muted">Amount</span>
      <div class="mt-1 flex items-center gap-2">
        <input
          v-model="amountInput"
          type="number"
          min="0"
          :step="10 ** -decimals"
          class="w-full rounded-xl border border-glass-border bg-glass-tint px-3 py-2 text-sm text-fg outline-none focus:border-accent"
        />
        <button type="button" class="text-xs font-medium text-accent hover:underline shrink-0" @click="setMax">
          Max
        </button>
      </div>
    </label>
    <p class="text-xs text-muted mb-1">Available: {{ balance.display(payable.chain) }}</p>
    <p v-if="amountError" class="text-xs text-danger mb-3">{{ amountError }}</p>

    <dl class="divide-y divide-fg/5 mt-3">
      <div class="flex items-center justify-between py-2 text-sm">
        <dt class="text-muted">Amount</dt>
        <dd class="tabular-nums text-fg">{{ rawAmount !== null ? asAmount(rawAmount) : '—' }}</dd>
      </div>
      <div class="flex items-center justify-between py-2 text-sm">
        <dt class="text-muted">Fee ({{ feePercentLabel }})</dt>
        <dd class="tabular-nums text-fg">− {{ asAmount(fee) }}</dd>
      </div>
      <div class="flex items-center justify-between py-2 text-sm font-semibold">
        <dt class="text-fg">You receive</dt>
        <dd class="tabular-nums text-fg">{{ asAmount(netAmount) }}</dd>
      </div>
    </dl>

    <template #footer>
      <Button severity="secondary" @click="close">Cancel</Button>
      <Button :disabled="!!amountError || isSubmitting" @click="submit">Withdraw</Button>
    </template>
  </Dialog>
</template>
