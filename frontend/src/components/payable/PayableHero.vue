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
import { AddressChip, ChainBadge, GlassCard, QrCode, StatusPill } from '@/components/ui';
import { FEATURES } from '@/config/features';
import IconCopy from '@/icons/IconCopy.vue';
import IconOpenInNew from '@/icons/IconOpenInNew.vue';
import IconQRCode from '@/icons/IconQRCode.vue';
import IconWallet from '@/icons/IconWallet.vue';
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

const analytics = useAnalyticsStore();
const auth = useAuthStore();

/** True when the connected wallet is this payable's host. */
const isHost = computed(
  () => !!auth.currentUser && auth.currentUser.walletAddress.toLowerCase() === props.payable.host.toLowerCase()
);

/** The payment link for this payable. */
const payUrl = computed(() => `${window.location.origin}/pay/${props.payable.id}`);

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
  <GlassCard variant="refract" class="max-w-5xl">
    <!-- Identity row -->
    <div class="flex flex-wrap items-start gap-4 mb-4">
      <!-- Neutral-tinted wallet-icon tile — replaces the payable-avatar so the
           panel reads as "a payable / wallet slot", not "an entity portrait". -->
      <div
        class="shrink-0 w-12 h-10 rounded-xl bg-fg/5 ring-1 ring-glass-border flex items-center justify-center text-muted"
        aria-hidden="true"
      >
        <IconWallet class="w-7 h-7" />
      </div>

      <div class="flex-1 min-w-0 flex flex-wrap gap-2">
        <div class="min-w-0">
          <!-- Full payable id, always visible, in muted mono. -->
           
          <p class="font-mono text-[10px] text-muted break-all select-all mb-1">{{ payable.id }}</p>

          <div v-if="payable.isClosed" class="flex flex-wrap items-center gap-2 mb-1">
            <StatusPill tone="danger" label="Closed" />
          </div>

          <!-- Owner label + address chip. The chip renders its address in `text-fg` by default;
               the arbitrary-selector override forces it to `text-muted` here per design. -->
          <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span class="shrink-0"> Owner:<span v-if="isHost" class="ml-1 text-fg font-medium">(mine)</span> </span>
            <AddressChip
              :value="payable.host"
              :chain="payable.chain"
              kind="address"
              :to="FEATURES.scan ? `/scan/address/${payable.host}` : undefined"
              class="[&_.text-fg]:!text-muted"
            />
          </div>
        </div>

        <div class="flex flex-col items-end gap-3 ml-auto">
          <ChainBadge :chain="payable.chain" size="sm" />

          <span class="flex flex-wrap items-center gap-3 text-[10px] text-muted mr-1" :title="relativeTimeStr"
            >Created {{ createdDateStr }}</span
          >
        </div>
      </div>
    </div>

    <!-- Actions row -->
    <div class="flex flex-wrap items-center gap-2 pt-4 border-t border-fg/5">
      <a
        :href="`/pay/${payable.id}`"
        target="_blank"
        rel="noopener noreferrer"
        :aria-disabled="payable.isClosed"
        v-if="!payable.isClosed"
        class="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm text-accent-fg hover:bg-accent/70 transition-colors"
        :title="payable.isClosed ? 'This payable is closed' : 'Open the pay page in a new tab'"
        @click="analytics.recordEvent('clicked_pay_now_from_hero_header', { payable_id: payable.id })"
      >
        <IconOpenInNew class="w-4 h-4" />
        Pay now
      </a>

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
        <svg viewBox="0 0 24 24" fill="none" class="w-4 h-4" aria-hidden="true">
          <path
            d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Share
      </button>

      <!-- QR (temporarily disabled) -->

      <button
        type="button"
        @click="showQr = true"
        class="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass-tint px-4 py-2 text-sm text-fg hover:bg-fg/5"
        title="Show QR code"
        aria-label="Show QR code for this payable"
      >
        <IconQRCode class="w-4 h-4" />
        QR Code
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
      <QrCode
        :value="payUrl"
        :size="200"
        :downloadable="true"
        :download-name="`chainbills-payable-qr-${payable.id.slice(2, 10)}`"
      />
      <p class="text-xs text-muted text-center break-all">{{ payUrl }}</p>
    </div>
  </Dialog>
</template>
