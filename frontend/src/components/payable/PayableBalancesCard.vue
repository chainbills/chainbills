<script setup lang="ts">
/**
 * src/components/payable/PayableBalancesCard.vue: the host-only balances
 * card in the main column.
 *
 * Shows each balance from `payable.getBalsDisplay()` as a large `TokenAmount`
 * with a "Withdraw" button that opens `WithdrawDialog`. When no balances exist
 * (nothing received yet), shows an empty state with a "Copy payment link" action.
 *
 * Non-hosts never see this card. The parent (`PayableDetailView`) conditionally
 * mounts it only for the payable's host.
 *
 * Props:
 *  - `payable`: the loaded `Payable`.
 *
 * Emits:
 *  - `withdrawn`: fires with the new withdrawal id after a successful withdrawal,
 *    so the parent can refresh the payable.
 *
 * Usage:
 * ```vue
 * <PayableBalancesCard :payable="payable" @withdrawn="onWithdrawn" />
 * ```
 */
import WithdrawDialog from '@/components/tx/WithdrawDialog.vue';
import { EmptyState, GlassCard, TokenAmount } from '@/components/ui';
import IconCopy from '@/icons/IconCopy.vue';
import { type Payable, type TokenAndAmount } from '@/schemas';
import { useAnalyticsStore } from '@/stores';
import Button from 'primevue/button';
import { computed, ref } from 'vue';

const props = defineProps<{
  /** The loaded payable whose balances this card displays. */
  payable: Payable;
}>();

const emit = defineEmits<{
  /** Fires with the withdrawal id once `WithdrawDialog` reports success. */
  withdrawn: [withdrawalId: string];
}>();

const analytics = useAnalyticsStore();

/** Balances ordered/merged per the `getBalsDisplay` logic in the `Payable` class. */
const balsDisplay = computed(() => props.payable.getBalsDisplay());

/** Balances with a positive amount (non-zero). */
const nonZeroBalances = computed(() => balsDisplay.value.filter((b) => b.amount > 0n));

/** The balance currently selected for withdrawal; drives `WithdrawDialog`. */
const selectedBalance = ref<TokenAndAmount | null>(null);
const showWithdraw = ref(false);

/** Opens the withdraw dialog for a specific balance. */
const openWithdraw = (balance: TokenAndAmount) => {
  selectedBalance.value = balance;
  showWithdraw.value = true;
  analytics.recordEvent('opened_withdraw_dialog', { payable_id: props.payable.id });
};

/** Payment link for this payable; used in the empty-state copy action. */
const payUrl = computed(() => `${window.location.origin}/pay/${props.payable.id}`);

/** Copies the payment link and briefly logs the event. */
const copyLink = async () => {
  await navigator.clipboard.writeText(payUrl.value);
  analytics.recordEvent('copied_payment_link', { from: 'payable_balances_card' });
};

/** Forwards the withdrawal id upward so the parent can refresh the payable. */
const onWithdrawn = (withdrawalId: string) => emit('withdrawn', withdrawalId);
</script>

<template>
  <GlassCard>
    <h3 class="text-sm font-semibold text-fg mb-1">Balances</h3>
    <p class="text-xs text-muted mb-4">Accumulated payments ready to withdraw.</p>

    <!-- Empty state: no non-zero balances -->
    <EmptyState
      v-if="nonZeroBalances.length === 0"
      title="No balance yet"
      description="Share your payment link to receive payments. They will appear here once received."
    >
      <template #action>
        <button
          type="button"
          @click="copyLink"
          class="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass-tint px-4 py-2 text-sm text-fg hover:bg-fg/5"
          aria-label="Copy payment link"
        >
          <IconCopy class="w-4 h-4" />
          Copy payment link
        </button>
      </template>
    </EmptyState>

    <!-- Balance list -->
    <ul v-else class="flex flex-col gap-3">
      <li
        v-for="balance in nonZeroBalances"
        :key="balance.name"
        class="flex items-center justify-between gap-4 p-3 rounded-xl border border-glass-border bg-fg/[0.02]"
      >
        <TokenAmount :amount="balance" :chain="payable.chain" size="lg" />
        <Button class="shrink-0 text-sm px-4 py-1.5" @click="openWithdraw(balance)">Withdraw</Button>
      </li>
    </ul>
  </GlassCard>

  <!-- Withdraw dialog -->
  <WithdrawDialog
    v-if="selectedBalance"
    v-model:visible="showWithdraw"
    :payable="payable"
    :balance="selectedBalance"
    @withdrawn="onWithdrawn"
  />
</template>
