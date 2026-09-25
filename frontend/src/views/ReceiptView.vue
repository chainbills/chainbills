<script setup lang="ts">
/**
 * src/views/ReceiptView.vue — `/receipt/:id`, public. Shows one payment or
 * withdrawal receipt: its amount, status, every on-chain field, and the
 * payable it belongs to. Works for all three receipt shapes
 * (`UserPayment`, `PayablePayment`, `Withdrawal`) without knowing which
 * chain the id lives on up front (`payment.get`/`withdrawal.get` probe
 * every EVM chain in parallel).
 *
 * A cross-chain `UserPayment` gets a live delivery tracker: a two-step
 * mini `Stepper` ("Burned on {source}" done, "Delivered to {destination}"
 * waiting) that flips to done once `payment.trackArrival` resolves —
 * standalone from whatever `'pay-cross-chain'` tx-flow may or may not
 * still be tracking the same payment in the background. A cross-chain
 * `PayablePayment` instead links back to its origin `UserPayment` receipt.
 * A `Withdrawal` shows the on-chain amount received.
 */
import CrossChainRoute from '@/components/tx/CrossChainRoute.vue';
import {
  AddressChip,
  ChainBadge,
  GlassCard,
  KeyValueList,
  SectionHeader,
  StatusPill,
  Stepper,
  TokenAmount,
  type KeyValueItem,
  type StepperStep,
} from '@/components/ui';
import ReceiptLoader from '@/components/ReceiptLoader.vue';
import { PayablePayment, UserPayment, Withdrawal, type Receipt } from '@/schemas';
import {
  useAnalyticsStore,
  useAuthStore,
  usePaymentStore,
  useTimeStore,
  useWithdrawalStore,
} from '@/stores';
import NotFoundView from '@/views/NotFoundView.vue';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const analytics = useAnalyticsStore();
const auth = useAuthStore();
const paymentStore = usePaymentStore();
const time = useTimeStore();
const toast = useToast();
const withdrawalStore = useWithdrawalStore();
const route = useRoute();

const isLoading = ref(true);
const receipt = ref<Receipt | null>(null);

const isWithdrawal = computed(() => receipt.value instanceof Withdrawal);
const isUserPayment = computed(() => receipt.value instanceof UserPayment);

const receiptType = computed(() =>
  isWithdrawal.value ? 'Withdrawal' : isUserPayment.value ? 'Payment made' : 'Payment received'
);

/** The chain the "user" of this receipt (payer, or host for a withdrawal) acted from. */
const userChain = computed(() => receipt.value?.userChain() ?? null);
/** The chain the payable itself lives on. */
const payableChain = computed(() => receipt.value?.chain ?? null);
const isCrossChain = computed(
  () => !!userChain.value && !!payableChain.value && userChain.value.name !== payableChain.value.name
);

/** Where "View payable" points: the host's own management page when this is their withdrawal, otherwise the public pay page. */
const payableLinkRoute = computed(() => {
  if (!receipt.value) return '#';
  const mine = auth.currentUser?.walletAddress.toLowerCase() === receipt.value.user().toLowerCase();
  const base = isWithdrawal.value && mine ? 'payable' : 'pay';
  return `/${base}/${receipt.value.payableId}`;
});

// --- Cross-chain delivery tracker (UserPayment only) ---
const deliverySteps = ref<StepperStep[]>([]);
const deliveryStatus = ref<'idle' | 'pending' | 'delivered' | 'timeout'>('idle');
const destinationPayablePaymentId = ref<string | null>(null);

const trackDelivery = async (userPayment: UserPayment) => {
  deliveryStatus.value = 'pending';
  deliverySteps.value = [
    { title: `Burned on ${userPayment.chain.displayName}`, status: 'done' },
    {
      title: `Delivered to ${userPayment.payableChain.displayName}`,
      status: 'waiting',
      hints: ['Circle is attesting the burn…', 'The relayer is submitting your payment…', 'Usually 1–3 minutes…'],
    },
  ];

  const { arrived, payablePayment } = await paymentStore.trackArrival(userPayment);
  const deliverStep = deliverySteps.value[1];
  if (arrived) {
    deliverySteps.value = [deliverySteps.value[0], { ...deliverStep, status: 'done', hints: undefined }];
    deliveryStatus.value = 'delivered';
    destinationPayablePaymentId.value = payablePayment?.id ?? null;
    analytics.recordEvent('cross_chain_delivery_resolved', {
      status: 'delivered',
      payment_id: userPayment.id,
      from_chain: userPayment.chain.name,
      to_chain: userPayment.payableChain.name,
    });
  } else {
    deliverySteps.value = [
      deliverySteps.value[0],
      { ...deliverStep, description: 'Still relaying — this is taking longer than usual. Check back soon.' },
    ];
    deliveryStatus.value = 'timeout';
    analytics.recordEvent('cross_chain_delivery_resolved', {
      status: 'timeout',
      payment_id: userPayment.id,
      from_chain: userPayment.chain.name,
      to_chain: userPayment.payableChain.name,
    });
  }
};

const statusTone = computed<'success' | 'warning'>(() =>
  isUserPayment.value && isCrossChain.value && deliveryStatus.value !== 'delivered' ? 'warning' : 'success'
);
const statusLabel = computed(() => {
  if (isUserPayment.value && isCrossChain.value)
    return deliveryStatus.value === 'delivered' ? 'Delivered' : 'Relaying…';
  return 'Completed';
});

const detailItems = computed<KeyValueItem[]>(() => {
  if (!receipt.value) return [];
  const items: KeyValueItem[] = [{ key: 'id', label: 'Receipt ID', mono: true }];
  items.push({ key: 'user', label: isWithdrawal.value ? 'Owner' : 'Payer' });
  items.push({ key: 'payableId', label: 'Payable' });
  if (isCrossChain.value) {
    items.push({ key: 'userChain', label: isWithdrawal.value ? "Owner's chain" : "Payer's chain" });
    items.push({ key: 'payableChain', label: "Payable's chain" });
  } else {
    items.push({ key: 'chain', label: 'Chain' });
  }
  if (receipt.value instanceof PayablePayment && receipt.value.isCrossChain) {
    items.push({ key: 'origin', label: 'Origin payment' });
  }
  items.push({ key: 'timestamp', label: isWithdrawal.value ? 'Withdrawn at' : 'Paid at' });
  return items;
});

const copy = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast.add({ severity: 'info', summary: 'Copied', detail: `${label} copied to clipboard.`, life: 3000 });
  analytics.recordEvent('copied_receipt_field', { field: label });
};

/** The page's own URL, read here (rather than from `window` directly in the template) so vue-tsc can type-check the template's `@click` expression against a plain string. */
const receiptUrl = computed(() => window.location.href);

const share = async () => {
  const url = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Chainbills receipt', url });
      analytics.recordEvent('shared_receipt');
      return;
    } catch {
      // The user cancelled the native share sheet — fall through to a plain copy.
    }
  }
  copy(url, 'Receipt link');
};

onMounted(async () => {
  const id = route.params.id as string;
  receipt.value = (await paymentStore.get(id)) as Receipt | null;
  if (!receipt.value) receipt.value = await withdrawalStore.get(id, undefined, true);
  isLoading.value = false;

  if (receipt.value instanceof UserPayment && receipt.value.isCrossChain) trackDelivery(receipt.value);
});
</script>

<template>
  <ReceiptLoader v-if="isLoading" />
  <NotFoundView v-else-if="!receipt" />

  <section v-else class="pt-6 pb-20 max-w-screen-md mx-auto">
    <SectionHeader eyebrow="Receipt" :title="receiptType" />

    <GlassCard class="mb-6">
      <div class="flex items-start justify-between gap-4 mb-4">
        <TokenAmount :amount="receipt.amount" :token="receipt.token" :chain="receipt.chain" size="lg" />
        <StatusPill :tone="statusTone" :label="statusLabel" :pulse="statusLabel === 'Relaying…'" />
      </div>

      <KeyValueList :items="detailItems">
        <template #id><AddressChip :value="receipt.id" kind="id" /></template>
        <template #user
          ><AddressChip :value="receipt.user()" :chain="userChain ?? undefined" kind="address"
        /></template>
        <template #payableId>
          <AddressChip :value="receipt.payableId" kind="id" :to="payableLinkRoute" />
        </template>
        <template #chain><ChainBadge v-if="receipt.chain" :chain="receipt.chain" size="sm" /></template>
        <template #userChain><ChainBadge v-if="userChain" :chain="userChain" size="sm" /></template>
        <template #payableChain><ChainBadge v-if="payableChain" :chain="payableChain" size="sm" /></template>
        <template #origin>
          <AddressChip
            v-if="receipt instanceof PayablePayment"
            :value="receipt.payerPaymentId"
            kind="id"
            :to="`/receipt/${receipt.payerPaymentId}`"
          />
        </template>
        <template #timestamp>{{ time.display(receipt.timestamp) }}</template>
      </KeyValueList>

      <div class="flex items-center gap-2 pt-4 mt-2 border-t border-fg/5">
        <Button severity="secondary" class="text-xs px-3 py-1.5" @click="copy(receiptUrl, 'Receipt link')">
          Copy receipt link
        </Button>
        <Button severity="secondary" class="text-xs px-3 py-1.5" @click="share">Share</Button>
      </div>
    </GlassCard>

    <!-- Cross-chain delivery tracker: only for the payer's own (UserPayment) receipt. -->
    <GlassCard v-if="receipt instanceof UserPayment && receipt.isCrossChain" class="mb-6">
      <p class="text-sm font-medium text-fg mb-4">Delivery status</p>
      <CrossChainRoute :source-chain="receipt.chain" :dest-chain="receipt.payableChain" class="mb-5" tracked />
      <Stepper :steps="deliverySteps" />
      <div
        v-if="deliveryStatus === 'delivered' && destinationPayablePaymentId"
        class="mt-4 pt-4 border-t border-fg/5 text-sm"
      >
        <span class="text-muted mr-2">Destination receipt:</span>
        <AddressChip :value="destinationPayablePaymentId" kind="id" :to="`/receipt/${destinationPayablePaymentId}`" />
      </div>
    </GlassCard>

    <p v-if="!isWithdrawal" class="text-center text-sm text-muted max-w-md mx-auto pt-4">
      Receive money from anyone, on any chain, with <span class="text-accent font-medium">Chainbills</span>.
      <router-link to="/start" class="text-accent hover:underline">Create a payable</router-link> to get started.
    </p>
  </section>
</template>
