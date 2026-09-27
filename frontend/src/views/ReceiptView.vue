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
import { FEATURES } from '@/config/features';
import {
  AddressChip,
  ChainBadge,
  GlassCard,
  KeyValueList,
  SectionHeader,
  Skeleton,
  StatusPill,
  TokenAmount,
  type KeyValueItem,
  type StepperStep,
} from '@/components/ui';
import ReceiptLoader from '@/components/ReceiptLoader.vue';
import IconOpenInNew from '@/icons/IconOpenInNew.vue';
import { getTxUrl, PayablePayment, UserPayment, Withdrawal, type Receipt } from '@/schemas';
import {
  useAnalyticsStore,
  useAuthStore,
  usePaymentStore,
  useServerStore,
  useTimeStore,
  useWithdrawalStore,
} from '@/stores';
import NotFoundView from '@/views/NotFoundView.vue';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const analytics = useAnalyticsStore();
const auth = useAuthStore();
const paymentStore = usePaymentStore();
const server = useServerStore();
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

/**
 * The number to headline the receipt with. UserPayment leads with `requestedAmount`
 * (the invoice), because the on-chain `amount` includes the CCTP fee added on top —
 * the payer's mental model is the invoice, not the debit. PayablePayment / Withdrawal
 * both lead with `amount` (what was actually credited or withdrawn).
 */
const headlineAmount = computed<bigint | null>(() => {
  const r = receipt.value;
  if (!r) return null;
  const raw = r instanceof UserPayment ? r.requestedAmount ?? r.amount : (r as { amount?: bigint }).amount;
  return typeof raw === 'bigint' ? raw : null;
});

/** The chain the "user" of this receipt (payer, or host for a withdrawal) acted from. */
const userChain = computed(() => receipt.value?.userChain() ?? null);
/**
 * The chain the payable itself lives on. `receipt.chain` alone is wrong for
 * `UserPayment` because a UserPayment lives on the *payer's* chain — the
 * payable it targets can be elsewhere. Read `payableChain` from the payment
 * for UserPayment; fall back to `receipt.chain` for PayablePayment / Withdrawal
 * (both live on the payable's chain by construction).
 */
const payableChain = computed(() => {
  const r = receipt.value;
  if (!r) return null;
  if (r instanceof UserPayment) return r.payableChain;
  return r.chain;
});
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

/** True when the payer just landed here from PayView's post-payment redirect — surfaces the "Pay again" CTA that jumps back. */
const cameFromPay = computed(() => route.query.from === 'pay' && isUserPayment.value);

/**
 * Backend-tracked block-explorer tx URLs for this receipt. Two roles:
 *   - `payerTxUrl` — the transaction on the payer's chain (source-side).
 *     For a UserPayment receipt this is the receipt's own tx; for a
 *     PayablePayment cross-chain receipt this is the origin userPayment's
 *     tx, fetched via the linked userPayment id.
 *   - `payableTxUrl` — the transaction on the payable's chain (destination
 *     side). For a cross-chain PayablePayment receipt this is the receipt's
 *     own tx (the relayer's submission); for a cross-chain UserPayment it's
 *     the eventually-arrived payablePayment's tx.
 *
 * Same-chain receipts have payer chain == payable chain and only need one
 * URL — the template collapses the two into a single "Explorer tx" row
 * when the chains match.
 *
 * Withdrawals reuse `payableTxUrl` (single-chain, single-tx).
 *
 * Any URL that isn't yet known stays null and its row is hidden — no dead
 * links. As the indexer catches up, subsequent visits render more rows.
 */
const payerTxUrl = ref<string | null>(null);
const payableTxUrl = ref<string | null>(null);

const loadExplorerLinks = async () => {
  payerTxUrl.value = null;
  payableTxUrl.value = null;
  if (!receipt.value) return;
  const r = receipt.value;

  if (r instanceof UserPayment) {
    // The backend's UserPayment DTO carries both the payer-side hash and, once
    // the relay lands, the paired payablePayment's hash.
    const details = await server.getPaymentRelayStatus(r.id);
    if (details?.userPaymentTxHash) {
      payerTxUrl.value = getTxUrl(details.userPaymentTxHash, r.chain);
    }
    if (details?.payablePaymentTxHash && r.isCrossChain) {
      payableTxUrl.value = getTxUrl(details.payablePaymentTxHash, r.payableChain);
    }
  } else if (r instanceof PayablePayment) {
    // Backend carries both the payable-side hash (this receipt's own tx) and
    // the paired userPayment's source-side hash (for cross-chain). On-chain
    // reads don't include either — always go through the backend here.
    const details = await server.getPayablePaymentTxHashes(r.id);
    if (details?.payablePaymentTxHash) {
      payableTxUrl.value = getTxUrl(details.payablePaymentTxHash, r.chain);
    }
    if (details?.userPaymentTxHash && r.isCrossChain) {
      payerTxUrl.value = getTxUrl(details.userPaymentTxHash, r.payerChain);
    }
  } else if (r instanceof Withdrawal) {
    const txHash = (r as unknown as { txHash?: string }).txHash ?? null;
    if (txHash) payableTxUrl.value = getTxUrl(txHash, r.chain);
  }
};

/** For same-chain UserPayment / PayablePayment the payer chain equals the
 * payable chain; a single "Explorer tx" row is enough. This picks whichever
 * URL the backend already knows about. */
const singleChainTxUrl = computed(() => payerTxUrl.value ?? payableTxUrl.value);

// --- Cross-chain delivery tracker (UserPayment only) ---
const deliveryStatus = ref<'idle' | 'pending' | 'delivered' | 'timeout'>('idle');
const destinationPayablePaymentId = ref<string | null>(null);
/** Unix-seconds timestamp when the destination PayablePayment was recorded. Null until delivery resolves. */
const deliveredAt = ref<number | null>(null);

/**
 * Formats a duration in seconds as a short human string:
 * "45s", "2m 15s", "1h 3m", "2d 4h". Small on-purpose so the delivery
 * summary line stays a one-liner even for slow-relay outliers.
 */
const formatDuration = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
};

/**
 * Fills in the post-arrival details that may not be available at the exact
 * moment the trackDelivery poller flips to `arrived`:
 *  - The destination `PayablePayment.timestamp` (on-chain), needed to
 *    compute the real delivery duration from the two receipt timestamps.
 *  - The destination `tx_hash` from the backend, needed to render the
 *    "Destination tx" row's explorer link.
 *
 * The backend indexer polls the destination chain every ~12 s, so a
 * just-delivered payment may need a couple of ticks before both are
 * queryable. Poll until we have them or timeout — bounded so it never
 * hangs on a permanently-failed relay.
 */
const HYDRATE_INTERVAL_MS = 3000;
const HYDRATE_MAX_ATTEMPTS = 20; // ~60 s of retries.
const hydrateArrival = async (userPayment: UserPayment, payablePaymentId: string) => {
  for (let i = 0; i < HYDRATE_MAX_ATTEMPTS; i++) {
    if (!deliveredAt.value) {
      const pp = await paymentStore.getForPayable(payablePaymentId, userPayment.payableChain);
      if (pp?.timestamp) deliveredAt.value = pp.timestamp;
    }
    // Explorer links are refreshed even after we have deliveredAt — the backend
    // may still be catching up on either tx_hash column while the on-chain
    // record is already queryable. Poll until BOTH the payer-side and the
    // payable-side URLs are known so neither row stays hidden.
    await loadExplorerLinks();
    if (deliveredAt.value && payerTxUrl.value && payableTxUrl.value) return;
    await new Promise((r) => setTimeout(r, HYDRATE_INTERVAL_MS));
  }
};

const trackDelivery = async (userPayment: UserPayment) => {
  deliveryStatus.value = 'pending';

  let arrived = false;
  let payablePaymentId: string | null = null;
  let failureReason: string | null = null;
  /** Destination PayablePayment fetched to know exactly when it landed. Null until we have it. */
  let payablePayment: PayablePayment | null = null;

  if (FEATURES.relayStatus) {
    // Race on-chain polling against backend polling. On-chain hits the destination chain
    // directly, so it usually detects arrival before the backend's own indexer+poller chain
    // does (that path adds up to ~12s of indexer lag on top of its own poller cadence — the
    // gap the tx-flow dialog exposes). Backend polling keeps running to surface FAILED
    // reasons the on-chain path can't see; whichever fires "arrived" first wins.
    const onChainJob = paymentStore.trackArrival(userPayment);
    const backendJob = paymentStore.trackArrivalViaBackend(userPayment.id);

    await new Promise<void>((resolve) => {
      let done = false;
      let onChainRes: Awaited<typeof onChainJob> | null = null;
      let backendRes: Awaited<typeof backendJob> | null = null;

      const settle = () => {
        if (done) return;
        if (onChainRes?.arrived) {
          arrived = true;
          payablePayment = onChainRes.payablePayment ?? null;
          payablePaymentId = payablePayment?.id ?? null;
        } else if (backendRes?.arrived) {
          arrived = true;
          payablePaymentId = backendRes.payablePaymentId;
        } else if (backendRes?.failureReason) {
          failureReason = backendRes.failureReason;
        } else if (onChainRes && backendRes) {
          // Both finalized without success — timeout on both paths.
        } else {
          return;
        }
        done = true;
        resolve();
      };

      onChainJob.then((r) => {
        onChainRes = r;
        settle();
      });
      backendJob.then((r) => {
        backendRes = r;
        settle();
      });
    });

    // Backend "arrived" only carries the id — fetch the full record so we know its timestamp.
    if (arrived && !payablePayment && payablePaymentId) {
      payablePayment = await paymentStore.getForPayable(payablePaymentId, userPayment.payableChain);
    }
  } else {
    const result = await paymentStore.trackArrival(userPayment);
    arrived = result.arrived;
    payablePayment = result.payablePayment ?? null;
    payablePaymentId = payablePayment?.id ?? null;
  }

  if (arrived) {
    deliveryStatus.value = 'delivered';
    destinationPayablePaymentId.value = payablePaymentId;
    // Delivered-at MUST be the on-chain PayablePayment.timestamp — never a
    // wall-clock fallback, otherwise the "delivery duration" row shows the
    // wrong number and doesn't reconcile with the two receipt timestamps.
    // The hydrator runs on every delivery so the destination tx URL row lights
    // up as soon as the backend has hashed it, even when the on-chain timestamp
    // is already known — the two land at different times.
    if (payablePayment?.timestamp) deliveredAt.value = payablePayment.timestamp;
    if (payablePaymentId) hydrateArrival(userPayment, payablePaymentId).catch(() => {});
    analytics.recordEvent('cross_chain_delivery_resolved', {
      status: 'delivered',
      payment_id: userPayment.id,
      from_chain: userPayment.chain.name,
      to_chain: userPayment.payableChain.name,
      duration_s: payablePayment?.timestamp ? Math.max(0, payablePayment.timestamp - userPayment.timestamp) : null,
    });
  } else {
    deliveryStatus.value = 'timeout';
    void failureReason; // reason is surfaced via the status pill / retry path; kept for the analytics event.
    analytics.recordEvent('cross_chain_delivery_resolved', {
      status: failureReason ? 'failed' : 'timeout',
      payment_id: userPayment.id,
      from_chain: userPayment.chain.name,
      to_chain: userPayment.payableChain.name,
    });
  }
};

/** Total relay duration in seconds (source burn timestamp -> destination PayablePayment timestamp). Null until delivery resolves. */
const deliveryDurationSeconds = computed(() => {
  if (!deliveredAt.value || !(receipt.value instanceof UserPayment)) return null;
  return Math.max(0, deliveredAt.value - receipt.value.timestamp);
});

/** Live ticker (Unix seconds), advanced every 1 s while the delivery is
 *  still pending on a cross-chain UserPayment receipt so `pendingDurationSeconds`
 *  can render a continuously-updating "waiting X" value. Frozen the moment
 *  arrival resolves or the component unmounts. */
const nowSeconds = ref(Math.floor(Date.now() / 1000));
let tickInterval: ReturnType<typeof setInterval> | null = null;
const startTicker = () => {
  stopTicker();
  nowSeconds.value = Math.floor(Date.now() / 1000);
  tickInterval = setInterval(() => {
    nowSeconds.value = Math.floor(Date.now() / 1000);
  }, 1000);
};
const stopTicker = () => {
  if (tickInterval !== null) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
};
watch(deliveryStatus, (s) => {
  if (s === 'pending') startTicker();
  else stopTicker();
});
onUnmounted(stopTicker);

/** Seconds elapsed since the payer's burn, up to "now". Live while relaying;
 *  null once we know a real `deliveredAt` (then `deliveryDurationSeconds`
 *  takes over) or when the receipt isn't a cross-chain UserPayment. */
const pendingDurationSeconds = computed(() => {
  if (deliveryStatus.value !== 'pending') return null;
  if (!(receipt.value instanceof UserPayment)) return null;
  return Math.max(0, nowSeconds.value - receipt.value.timestamp);
});

/** True when paid-at and delivered-at are less than a minute apart — the
 *  default `time.display` collapses those into the same minute-precision
 *  string so both endpoints look identical, hiding the real gap. When true,
 *  both timestamps render with seconds precision so the difference is
 *  visible in the receipt. */
const useSecondsPrecision = computed(
  () => deliveryDurationSeconds.value !== null && deliveryDurationSeconds.value < 60
);

/** Formats a unix-seconds timestamp with seconds precision (h:mm:ss AM/PM),
 *  used when `useSecondsPrecision` is true. */
const formatTimestampWithSeconds = (when: number) => {
  const date = new Date(when * 1000);
  const timeStr = new Intl.DateTimeFormat('en-us', {
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
  return timeStr;
};

const statusTone = computed<'success' | 'warning'>(() =>
  isUserPayment.value && isCrossChain.value && deliveryStatus.value !== 'delivered' ? 'warning' : 'success'
);
const statusLabel = computed(() => {
  if (isUserPayment.value && isCrossChain.value)
    return deliveryStatus.value === 'delivered' ? 'Delivered' : 'Relaying…';
  return 'Completed';
});

/**
 * Context-aware receipt rows. Rules:
 *  - Always: Receipt ID + timestamp.
 *  - Same-chain: single "Chain" and single "Explorer tx" row.
 *  - Cross-chain UserPayment (payer's view): payer-side block first
 *    (payer, payer chain, payer tx URL), then payable-side block (payable
 *    id, payable chain, destination tx URL).
 *  - Cross-chain PayablePayment (host's view): payable-side block first
 *    (payable id, payable chain, destination tx URL), then payer-side
 *    block (payer, payer chain, payer tx URL), then origin link.
 *  - Withdrawal: id, chain, explorer tx, owner, payable id, withdrawn at.
 *
 * Rows for tx URLs (`explorerTx`, `payerTx`, `destinationTx`) only appear
 * when the backend has recorded the corresponding hash — no dead links.
 */
const detailItems = computed<KeyValueItem[]>(() => {
  if (!receipt.value) return [];
  const items: KeyValueItem[] = [{ key: 'id', label: 'Receipt ID', mono: true }];

  if (receipt.value instanceof Withdrawal) {
    items.push({ key: 'chain', label: 'Chain' });
    if (singleChainTxUrl.value) items.push({ key: 'explorerTx', label: 'Explorer TX' });
    items.push({ key: 'user', label: 'Owner' });
    items.push({ key: 'payableId', label: 'Payable' });
    items.push({ key: 'timestamp', label: 'Withdrawn at' });
    return items;
  }

  if (!isCrossChain.value) {
    // Same-chain: one chain, one tx. Order matches receipt-type ownership
    // (payer-focused for UserPayment, payable-focused for PayablePayment).
    items.push({ key: 'chain', label: 'Chain' });
    if (singleChainTxUrl.value) items.push({ key: 'explorerTx', label: 'Explorer TX' });
    if (receipt.value instanceof PayablePayment) {
      items.push({ key: 'payableId', label: 'Payable' });
      items.push({ key: 'user', label: 'Payer' });
    } else {
      items.push({ key: 'user', label: 'Payer' });
      items.push({ key: 'payableId', label: 'Payable' });
    }
    items.push({ key: 'timestamp', label: 'Paid at' });
    return items;
  }

  // Cross-chain — surface the two sides separately.
  if (receipt.value instanceof PayablePayment) {
    // Host's view: payable block first, then payer block.
    items.push({ key: 'payableId', label: 'Payable' });
    items.push({ key: 'payableChain', label: "Payable's chain" });
    if (payableTxUrl.value) items.push({ key: 'destinationTx', label: 'Destination TX' });
    items.push({ key: 'user', label: 'Payer' });
    items.push({ key: 'payerChain', label: "Payer's chain" });
    if (payerTxUrl.value) items.push({ key: 'payerTx', label: 'Payer TX' });
  } else {
    // Payer's view (UserPayment): payer block first, then payable block.
    items.push({ key: 'user', label: 'Payer' });
    items.push({ key: 'payerChain', label: "Payer's chain" });
    if (payerTxUrl.value) items.push({ key: 'payerTx', label: 'Payer TX' });
    items.push({ key: 'payableId', label: 'Payable' });
    items.push({ key: 'payableChain', label: "Payable's chain" });
    if (payableTxUrl.value) items.push({ key: 'destinationTx', label: 'Destination TX' });
  }
  items.push({ key: 'timestamp', label: 'Paid at' });

  // Cross-chain UserPayment delivery block — inlined inside the KV list so
  // the payer sees the arrival timeline without a separate card. Order:
  //   - route strip (only while relaying)
  //   - delivered-at timestamp
  //   - delivered-in duration
  if (receipt.value instanceof UserPayment) {
    if (receipt.value.hasBridgeFee) {
      items.push({ key: 'bridgeFee', label: 'Bridge fee' });
      items.push({ key: 'debited', label: 'Total debited' });
    }
    if (deliveryStatus.value === 'pending') {
      items.push({ key: 'deliveryRoute', label: '', fullWidth: true });
    }
    items.push({ key: 'deliveredAt', label: 'Delivered at' });
    items.push({ key: 'deliveryDuration', label: 'Delivery duration' });
    if (destinationPayablePaymentId.value) {
      items.push({ key: 'destinationReceipt', label: 'Destination receipt' });
    }
  }
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

/** Minimum time the shimmer is shown, even when the receipt resolves instantly
 *  from IndexedDB. Prevents a jarring flash on every navigation into a
 *  previously-cached receipt — 500 ms is long enough that the shimmer reads as
 *  intentional loading rather than a glitch. */
const MIN_LOADER_MS = 500;

onMounted(async () => {
  const startedAt = Date.now();
  const id = route.params.id as string;
  receipt.value = (await paymentStore.get(id)) as Receipt | null;
  if (!receipt.value) receipt.value = await withdrawalStore.get(id, undefined, true);

  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_LOADER_MS) await new Promise((r) => setTimeout(r, MIN_LOADER_MS - elapsed));
  isLoading.value = false;

  if (receipt.value instanceof UserPayment && receipt.value.isCrossChain) trackDelivery(receipt.value);
  // Fire-and-forget: fetch backend-tracked tx hashes and render as explorer chips.
  loadExplorerLinks().catch(() => {});
});
</script>

<template>
  <ReceiptLoader v-if="isLoading" />
  <NotFoundView v-else-if="!receipt" />

  <section v-else class="pt-6 pb-20 max-w-screen-md mx-auto">
    <SectionHeader eyebrow="Receipt" :title="receiptType" />

    <GlassCard class="mb-6">
      <div class="flex items-start justify-between gap-4 mb-4">
        <TokenAmount
          v-if="headlineAmount !== null"
          :amount="headlineAmount"
          :token="receipt.token"
          :chain="receipt.chain"
          size="lg"
        />
        <StatusPill :tone="statusTone" :label="statusLabel" :pulse="statusLabel === 'Relaying…'" />
      </div>

      <KeyValueList :items="detailItems">
        <template #id><AddressChip :value="receipt.id" kind="id" /></template>
        <template #user>
          <AddressChip :value="receipt.user()" :chain="userChain ?? undefined" kind="address" />
        </template>
        <template #payableId>
          <AddressChip :value="receipt.payableId" kind="id" :to="payableLinkRoute" />
        </template>
        <template #chain><ChainBadge v-if="receipt.chain" :chain="receipt.chain" size="sm" /></template>
        <template #payerChain><ChainBadge v-if="userChain" :chain="userChain" size="sm" /></template>
        <template #payableChain><ChainBadge v-if="payableChain" :chain="payableChain" size="sm" /></template>
        <template #explorerTx>
          <a
            v-if="singleChainTxUrl && receipt.chain"
            :href="singleChainTxUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-accent hover:underline"
            :title="`Open on ${receipt.chain.displayName} block explorer`"
          >
            View transaction <IconOpenInNew class="w-3.5 h-3.5" />
          </a>
        </template>
        <template #payerTx>
          <a
            v-if="payerTxUrl && userChain"
            :href="payerTxUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-accent hover:underline"
            :title="`Open on ${userChain.displayName} block explorer`"
          >
            View on {{ userChain.displayName }} <IconOpenInNew class="w-3.5 h-3.5" />
          </a>
        </template>
        <template #destinationTx>
          <a
            v-if="payableTxUrl && payableChain"
            :href="payableTxUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-accent hover:underline"
            :title="`Open on ${payableChain.displayName} block explorer`"
          >
            View on {{ payableChain.displayName }} <IconOpenInNew class="w-3.5 h-3.5" />
          </a>
        </template>
        <template #bridgeFee>
          <TokenAmount
            v-if="receipt instanceof UserPayment"
            :amount="receipt.bridgeFee"
            :token="receipt.token"
            :chain="receipt.chain"
            size="sm"
          />
        </template>
        <template #debited>
          <TokenAmount
            v-if="receipt instanceof UserPayment"
            :amount="receipt.amount"
            :token="receipt.token"
            :chain="receipt.chain"
            size="sm"
          />
        </template>
        <template #timestamp>
          <span v-if="useSecondsPrecision" :title="time.full(receipt.timestamp)">
            {{ formatTimestampWithSeconds(receipt.timestamp) }}
          </span>
          <span v-else :title="time.full(receipt.timestamp)">
            {{ time.display(receipt.timestamp) }}
          </span>
        </template>

        <!-- Cross-chain delivery block: rendered inline as the last rows of a
             cross-chain UserPayment receipt (see `detailItems` for the order).
             While relaying, the animated route strip sits above the timestamp
             and duration rows and both values are shown as shimmering
             placeholders. Once arrival resolves, the strip disappears and the
             two rows fill with the real values. -->
        <template #deliveryRoute>
          <CrossChainRoute
            v-if="receipt instanceof UserPayment"
            :source-chain="receipt.chain"
            :dest-chain="receipt.payableChain"
            tracked
            animated
          />
        </template>
        <template #deliveredAt>
          <Skeleton v-if="deliveryStatus === 'pending'" w="w-32" h="h-3" />
          <span
            v-else-if="deliveryStatus === 'delivered' && deliveredAt !== null"
            :title="time.full(deliveredAt)"
          >
            <template v-if="useSecondsPrecision">{{ formatTimestampWithSeconds(deliveredAt) }}</template>
            <template v-else>{{ time.display(deliveredAt) }}</template>
          </span>
          <span v-else class="text-muted">-</span>
        </template>
        <template #deliveryDuration>
          <span
            v-if="deliveryStatus === 'pending' && pendingDurationSeconds !== null"
            class="tabular-nums text-muted italic"
            :title="'Time since payment — updates every second while the relay is in flight'"
          >
            {{ formatDuration(pendingDurationSeconds) }} and counting
          </span>
          <span v-else-if="deliveryStatus === 'delivered' && deliveryDurationSeconds !== null" class="tabular-nums">
            {{ formatDuration(deliveryDurationSeconds) }}
          </span>
          <span v-else class="text-muted">-</span>
        </template>
        <template #destinationReceipt>
          <AddressChip
            v-if="destinationPayablePaymentId"
            :value="destinationPayablePaymentId"
            kind="id"
            :to="`/receipt/${destinationPayablePaymentId}`"
          />
        </template>
      </KeyValueList>

      <div class="flex flex-wrap items-center gap-2 pt-4 mt-2 border-t border-fg/5">
        <Button severity="secondary" class="text-xs px-3 py-1.5" @click="copy(receiptUrl, 'Receipt link')">
          Copy receipt link
        </Button>
        <Button severity="secondary" class="text-xs px-3 py-1.5" @click="share">Share</Button>
        <router-link
          v-if="cameFromPay && receipt"
          :to="`/pay/${receipt.payableId}`"
          class="text-xs px-3 py-1.5 rounded-2xl bg-accent text-accent-fg font-medium hover:opacity-90 ml-auto"
        >
          Pay again
        </router-link>
      </div>
    </GlassCard>

    <p v-if="!isWithdrawal" class="text-center text-sm text-muted max-w-md mx-auto pt-4">
      Receive money from anyone, on any chain, with <span class="text-accent font-medium">Chainbills</span>.
      <router-link to="/start" class="text-accent hover:underline">Create a payable</router-link> to get started.
    </p>
  </section>
</template>
