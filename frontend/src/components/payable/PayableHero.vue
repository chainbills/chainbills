<script setup lang="ts">
/**
 * src/components/payable/PayableHero.vue: the full-width hero band at the
 * top of every payable page.
 *
 * Shows the payable's avatar, short id with copy button (full id on expand),
 * home chain badge and network pill, open/closed status pill (pulsing when
 * open), an "Auto-withdraw" badge when set, the host address chip linking to
 * the scan address page, and the created-at date (absolute, with relative
 * time on hover).
 *
 * Actions row: "Pay this payable" primary CTA (hidden for the host; disabled
 * with a tooltip when closed), "Copy link", "Share" (Web Share API with copy
 * fallback), "Show QR" (QR dialog), and a "Manage" scroll-anchor for the host.
 *
 * Visitor note: when the connected wallet has paid this payable, shows
 * "You've paid this payable N times" below the actions.
 *
 * Props:
 *  - `payable`: the loaded `Payable`.
 *  - `payerPaymentCount`: how many times the connected wallet has paid this
 *    payable (0 when not connected or never paid).
 *
 * Emits:
 *  - `manage`: host clicked the "Manage" button; parent scrolls to host controls.
 *
 * Usage:
 * ```vue
 * <PayableHero :payable="payable" :payer-payment-count="2" @manage="scrollToControls" />
 * ```
 */
import { AddressChip, GlassCard, NetworkPill, PayableAvatar, QrCode, StatusPill } from '@/components/ui';
import IconCopy from '@/icons/IconCopy.vue';
import IconGlobe from '@/icons/IconGlobe.vue';
import { type Payable } from '@/schemas';
import { useAnalyticsStore, useAuthStore } from '@/stores';
import Dialog from 'primevue/dialog';
import { computed, ref } from 'vue';

const props = defineProps<{
  /** The loaded payable. */
  payable: Payable;
  /** How many times the currently connected wallet has paid this payable. 0 when not connected or never paid. */
  payerPaymentCount: number;
}>();

const emit = defineEmits<{
  /** Emitted when the host clicks "Manage" so the parent can scroll to host controls. */
  manage: [];
}>();

const analytics = useAnalyticsStore();
const auth = useAuthStore();

/** True when the connected wallet is this payable's host. */
const isHost = computed(
  () => !!auth.currentUser && auth.currentUser.walletAddress.toLowerCase() === props.payable.host.toLowerCase()
);

/** The payment link for this payable. */
const payUrl = computed(() => `${window.location.origin}/pay/${props.payable.id}`);

/** Short id shown in the hero (first 6 + last 4 chars). */
const shortId = computed(() => {
  const id = props.payable.id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
});

/** Whether the full id is shown in the expand panel. */
const showFullId = ref(false);

/** Whether the QR dialog is open. */
const showQr = ref(false);

/** Feedback for the copy-link button: briefly shows "Copied!" text. */
const copied = ref(false);

/** Formatted created date string, e.g. "Sep 24, 2026". */
const createdDateStr = computed(() => {
  const d = new Date(props.payable.createdAt * 1000);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
});

/** Relative time string, e.g. "3 months ago". Used on hover of the date. */
const relativeTimeStr = computed(() => {
  const ms = Date.now() - props.payable.createdAt * 1000;
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m !== 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
});

/** Copies the payment link to clipboard and flips the button text briefly. */
const copyLink = async () => {
  await navigator.clipboard.writeText(payUrl.value);
  copied.value = true;
  analytics.recordEvent('copied_payment_link', { from: 'payable_hero' });
  setTimeout(() => (copied.value = false), 1800);
};

/** Opens the Web Share sheet if supported; falls back to clipboard copy. */
const share = async () => {
  analytics.recordEvent('shared_payable', { from: 'payable_hero' });
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Pay via Chainbills', url: payUrl.value });
    } catch {
      // Share was dismissed by the user; no action needed.
    }
  } else {
    await copyLink();
  }
};
</script>

<template>
  <GlassCard variant="refract">
    <!-- Identity row -->
    <div class="flex flex-wrap items-start gap-4 mb-5">
      <PayableAvatar :id="payable.id" class="shrink-0" />

      <div class="flex-1 min-w-0">
        <!-- Short id + copy + expand -->
        <div class="flex items-center gap-2 flex-wrap mb-1.5">
          <span class="font-mono text-sm text-fg font-medium">{{ shortId }}</span>
          <button
            type="button"
            class="text-xs text-accent hover:underline"
            @click="showFullId = !showFullId"
            :aria-expanded="showFullId"
            aria-label="Toggle full payable id"
          >
            {{ showFullId ? 'Hide' : 'Show full id' }}
          </button>
        </div>

        <!-- Full id, shown when expanded -->
        <div v-if="showFullId" class="mb-2">
          <span class="font-mono text-xs text-muted break-all select-all">{{ payable.id }}</span>
        </div>

        <!-- Network + status + auto-withdraw badges -->
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <NetworkPill :type="payable.chain.networkType" />
          <StatusPill
            :tone="payable.isClosed ? 'danger' : 'success'"
            :label="payable.isClosed ? 'Closed' : 'Open'"
            :pulse="!payable.isClosed"
          />
          <span
            v-if="payable.isAutoWithdraw"
            class="inline-flex items-center rounded-full bg-accent/15 text-accent text-[11px] font-medium px-2.5 py-1 ring-1 ring-accent/30"
          >
            Auto-withdraw
          </span>
        </div>

        <!-- Host address + created date -->
        <div class="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span class="shrink-0">Host:</span>
          <AddressChip
            :value="payable.host"
            :chain="payable.chain"
            kind="address"
            :to="`/scan/address/${payable.host}`"
          />
          <span class="shrink-0 tabular-nums" :title="relativeTimeStr">Created {{ createdDateStr }}</span>
        </div>
      </div>
    </div>

    <!-- Actions row -->
    <div class="flex flex-wrap items-center gap-2 pt-4 border-t border-fg/5">
      <!-- Pay CTA: hidden for host, disabled when closed -->
      <router-link
        v-if="!isHost"
        :to="payable.isClosed ? '' : `/pay/${payable.id}`"
        :class="['inline-flex', payable.isClosed && 'pointer-events-none']"
        :aria-disabled="payable.isClosed"
        @click="analytics.recordEvent('clicked_pay_from_hero', { payable_id: payable.id })"
      >
        <button
          type="button"
          :disabled="payable.isClosed"
          :title="payable.isClosed ? 'This payable is closed' : 'Pay this payable'"
          class="rounded-full bg-accent text-accent-fg px-5 py-2.5 text-sm font-medium shadow-lg shadow-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Pay this payable
        </button>
      </router-link>

      <!-- Copy link -->
      <button
        type="button"
        @click="copyLink"
        class="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass-tint px-4 py-2 text-sm text-fg hover:bg-fg/5"
        :title="copied ? 'Copied!' : 'Copy payment link'"
        :aria-label="copied ? 'Copied!' : 'Copy payment link'"
      >
        <IconCopy class="w-4 h-4" />
        {{ copied ? 'Copied!' : 'Copy link' }}
      </button>

      <!-- Share -->
      <button
        type="button"
        @click="share"
        class="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass-tint px-4 py-2 text-sm text-fg hover:bg-fg/5"
        title="Share"
        aria-label="Share payable link"
      >
        <IconGlobe class="w-4 h-4" />
        Share
      </button>

      <!-- Show QR -->
      <button
        type="button"
        @click="showQr = true"
        class="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass-tint px-4 py-2 text-sm text-fg hover:bg-fg/5"
        title="Show QR code"
        aria-label="Show QR code for this payable"
      >
        QR
      </button>

      <!-- Host: Manage scroll anchor -->
      <button
        v-if="isHost"
        type="button"
        @click="emit('manage')"
        class="rounded-full border border-accent/50 bg-accent/10 text-accent px-4 py-2 text-sm font-medium hover:bg-accent/20"
        aria-label="Scroll to host management controls"
      >
        Manage
      </button>
    </div>

    <!-- Visitor note: how many times this wallet has paid -->
    <p v-if="!isHost && payerPaymentCount > 0" class="mt-3 text-xs text-muted">
      You've paid this payable
      <span class="text-fg font-medium">{{ payerPaymentCount }} time{{ payerPaymentCount !== 1 ? 's' : '' }}</span
      >.
    </p>
  </GlassCard>

  <!-- QR code dialog -->
  <Dialog v-model:visible="showQr" modal header="Payment QR code" class="w-full max-w-xs max-sm:m-4">
    <div class="flex flex-col items-center gap-4 py-2">
      <QrCode :value="payUrl" :size="200" />
      <p class="text-xs text-muted text-center break-all">{{ payUrl }}</p>
    </div>
  </Dialog>
</template>
