<script setup lang="ts">
/**
 * src/components/activity/ActivityDetailPanel.vue — the full field-by-field
 * breakdown of one activity, rendered as a `KeyValueList`. This is the
 * content of `ActivityTable`'s expanded row and `ActivityList`'s bottom
 * sheet — both mount this component only while the row is open, which is
 * also what makes the row's "is this cross-chain payment still pending?"
 * check lazy: it runs once in `onMounted`, exactly when a row is expanded,
 * never up front for the whole page.
 *
 * Shows every on-chain field of the activity and its resolved entity:
 * activity id / entity id, chain/user/payable counts, the absolute block
 * timestamp, and, per type:
 *  - `UserPaid`/`PayableReceived`: the payer-side and payable-side payment
 *    ids (linked to `/receipt/:id`) plus source/destination chains; a
 *    still-in-flight cross-chain `UserPaid` shows a "checking delivery"
 *    state while `payment.trackArrival` runs, then "Delivered"/"Pending".
 *  - `Withdrew`: gross amount, the 2% (or chain-configured) withdrawal fee,
 *    and the net amount the host received — the fee is derived from
 *    `stats.getChainStats(chain).withdrawalFeePercentage` since
 *    `Withdrawal.amount` itself already has the fee deducted.
 *
 * Usage: `<ActivityDetailPanel :activity="activity" @resolved="onResolved" />`
 */
import { AddressChip, ChainBadge, KeyValueList, StatusPill, TokenAmount, type KeyValueItem } from '@/components/ui';
import {
  ActivityType,
  Payable,
  PayablePayment,
  TokenAndAmount,
  User,
  UserPayment,
  Withdrawal,
  type Activity,
} from '@/schemas';
import { usePaymentStore, useStatsStore } from '@/stores';
import { computed, onMounted, ref } from 'vue';

const props = defineProps<{
  /** The activity to break down. `entity` must already be resolved. */
  activity: Activity;
}>();

const emit = defineEmits<{
  /** Fires once, after the lazy cross-chain-arrival check finishes, so the parent row can show a pending rail from then on. */
  resolved: [arrived: boolean];
}>();

const payment = usePaymentStore();
const stats = useStatsStore();

/** `'idle'` when there's nothing to check (not a pending cross-chain `UserPaid`), `'checking'` while `trackArrival` polls, then `'arrived'`/`'pending'`. */
const arrivalStatus = ref<'idle' | 'checking' | 'arrived' | 'pending'>('idle');
const destinationPaymentId = ref<string | null>(null);

/** Gross/fee/net breakdown for a `Withdrew` activity, filled in once the withdrawal's chain config loads. */
const withdrawalFee = ref<{ gross: bigint; fee: bigint } | null>(null);

const entity = computed(() => props.activity.entity);

onMounted(async () => {
  const e = entity.value;

  if (props.activity.type === ActivityType.UserPaid && e instanceof UserPayment && e.isCrossChain) {
    arrivalStatus.value = 'checking';
    const { arrived, payablePayment } = await payment.trackArrival(e);
    if (arrived && payablePayment) destinationPaymentId.value = payablePayment.id;
    arrivalStatus.value = arrived ? 'arrived' : 'pending';
    emit('resolved', arrived);
  }

  if (props.activity.type === ActivityType.Withdrew && e instanceof Withdrawal) {
    const chainStats = await stats.getChainStats(e.chain);
    if (chainStats) {
      const feeBps = BigInt(chainStats.withdrawalFeePercentage);
      // `e.amount` is already net of the fee — reconstruct the pre-fee gross by inverting the
      // contract's `fee = gross * feeBps / 10000` (rounding differences against the exact
      // on-chain fee are possible but stay within a fraction of a token unit).
      const gross = feeBps >= 10_000n ? e.amount : (e.amount * 10_000n) / (10_000n - feeBps);
      withdrawalFee.value = { gross, fee: gross - e.amount };
    }
  }
});

/** Which `KeyValueList` rows to render, in order — varies by activity type. */
const items = computed<KeyValueItem[]>(() => {
  const a = props.activity;
  const base: KeyValueItem[] = [
    { key: 'id', label: 'Activity id' },
    { key: 'entityId', label: 'Entity id' },
    { key: 'chain', label: 'Chain' },
    { key: 'counts', label: 'Position' },
    { key: 'timestamp', label: 'Recorded at' },
  ];

  if (a.type === ActivityType.UserPaid || a.type === ActivityType.PayableReceived) {
    return [...base, { key: 'route', label: 'Route' }, { key: 'payment', label: 'Payment' }];
  }
  if (a.type === ActivityType.Withdrew) {
    return [
      ...base,
      { key: 'gross', label: 'Gross amount' },
      { key: 'fee', label: 'Withdrawal fee' },
      { key: 'net', label: 'Net received' },
    ];
  }
  if (a.type === ActivityType.InitializedUser) {
    return [...base, { key: 'wallet', label: 'Wallet' }];
  }
  return [...base, { key: 'host', label: 'Host' }];
});

const absoluteTimestamp = computed(() => new Date(props.activity.timestamp * 1000).toLocaleString());
</script>

<template>
  <KeyValueList :items="items">
    <template #id>
      <AddressChip :value="activity.id" kind="id" />
    </template>
    <template #entityId>
      <span class="font-mono text-xs break-all">{{ activity.entityId }}</span>
    </template>
    <template #chain>
      <ChainBadge :chain="activity.chain" size="sm" network />
    </template>
    <template #counts>
      <span class="font-mono text-xs"
        >chain #{{ activity.chainCount }}<template v-if="activity.userCount"> · user #{{ activity.userCount }}</template
        ><template v-if="activity.payableCount"> · payable #{{ activity.payableCount }}</template></span
      >
    </template>
    <template #timestamp>{{ absoluteTimestamp }}</template>

    <!-- Payment routing: payer-side and payable-side ids, both linking to their receipts. -->
    <template #route v-if="entity instanceof UserPayment || entity instanceof PayablePayment">
      <span class="inline-flex items-center gap-2">
        <ChainBadge :chain="entity instanceof UserPayment ? activity.chain : entity.payerChain" size="sm" />
        <span class="text-muted">→</span>
        <ChainBadge :chain="entity instanceof UserPayment ? entity.payableChain : activity.chain" size="sm" />
      </span>
    </template>
    <template #payment v-if="entity instanceof UserPayment || entity instanceof PayablePayment">
      <div class="flex flex-col items-end gap-1">
        <router-link :to="`/receipt/${activity.id}`" class="text-accent hover:underline text-xs font-mono">
          {{ activity.id.slice(0, 10) }}…
        </router-link>
        <template v-if="entity instanceof PayablePayment">
          <router-link :to="`/receipt/${entity.payerPaymentId}`" class="text-accent hover:underline text-xs font-mono">
            from {{ entity.payerPaymentId.slice(0, 10) }}…
          </router-link>
        </template>
        <template v-else-if="entity.isCrossChain">
          <StatusPill v-if="arrivalStatus === 'checking'" tone="info" label="Checking delivery…" pulse />
          <StatusPill v-else-if="arrivalStatus === 'pending'" tone="warning" label="Delivery pending" pulse />
          <router-link
            v-else-if="arrivalStatus === 'arrived' && destinationPaymentId"
            :to="`/receipt/${destinationPaymentId}`"
            class="text-accent hover:underline text-xs font-mono"
          >
            Delivered → {{ destinationPaymentId.slice(0, 10) }}…
          </router-link>
        </template>
      </div>
    </template>

    <!-- Withdrawal fee breakdown. -->
    <template #gross v-if="entity instanceof Withdrawal">
      <TokenAmount
        v-if="withdrawalFee"
        :amount="new TokenAndAmount(entity.token, withdrawalFee.gross)"
        :chain="entity.chain"
        size="sm"
      />
      <span v-else class="text-muted text-xs">Loading…</span>
    </template>
    <template #fee v-if="entity instanceof Withdrawal">
      <TokenAmount
        v-if="withdrawalFee"
        :amount="new TokenAndAmount(entity.token, withdrawalFee.fee)"
        :chain="entity.chain"
        size="sm"
      />
      <span v-else class="text-muted text-xs">Loading…</span>
    </template>
    <template #net v-if="entity instanceof Withdrawal">
      <TokenAmount :amount="new TokenAndAmount(entity.token, entity.amount)" :chain="entity.chain" size="sm" />
    </template>

    <!-- New-wallet activity: just the wallet. -->
    <template #wallet v-if="entity instanceof User">
      <AddressChip :value="entity.walletAddress" :chain="entity.chain" kind="address" />
    </template>

    <!-- Payable-settings activities: the host. -->
    <template #host v-if="entity instanceof Payable">
      <AddressChip :value="entity.host" :chain="activity.chain" kind="address" />
    </template>
  </KeyValueList>
</template>
