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
 *  - `Withdrew`: the on-chain net amount received.
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
import { usePaymentStore } from '@/stores';
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

/** `'idle'` when there's nothing to check (not a pending cross-chain `UserPaid`), `'checking'` while `trackArrival` polls, then `'arrived'`/`'pending'`. */
const arrivalStatus = ref<'idle' | 'checking' | 'arrived' | 'pending'>('idle');
const destinationPaymentId = ref<string | null>(null);

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
    return [...base, { key: 'amount', label: 'Amount' }];
  }
  if (a.type === ActivityType.InitializedUser) {
    return [...base, { key: 'wallet', label: 'Wallet' }];
  }
  return [...base, { key: 'host', label: 'Owner' }];
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
      <ChainBadge :chain="activity.chain" size="sm" />
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
        <span class="text-muted text-xs">-&gt;</span>
        <ChainBadge :chain="entity instanceof UserPayment ? entity.payableChain : activity.chain" size="sm" />
      </span>
    </template>
    <template #payment v-if="entity instanceof UserPayment || entity instanceof PayablePayment">
      <div class="flex flex-col items-end gap-2">
        <AddressChip :value="activity.id" kind="id" :to="`/receipt/${activity.id}`" />
        <template v-if="entity instanceof PayablePayment">
          <AddressChip :value="entity.payerPaymentId" kind="id" :to="`/receipt/${entity.payerPaymentId}`" />
        </template>
        <template v-else-if="entity.isCrossChain">
          <StatusPill v-if="arrivalStatus === 'checking'" tone="info" label="Checking delivery" pulse />
          <StatusPill v-else-if="arrivalStatus === 'pending'" tone="warning" label="Delivery pending" pulse />
          <AddressChip
            v-else-if="arrivalStatus === 'arrived' && destinationPaymentId"
            :value="destinationPaymentId"
            kind="id"
            :to="`/receipt/${destinationPaymentId}`"
          />
        </template>
      </div>
    </template>

    <!-- Withdrawal amount (on-chain net received). -->
    <template #amount v-if="entity instanceof Withdrawal">
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
