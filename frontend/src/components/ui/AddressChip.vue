<script setup lang="ts">
/**
 * src/components/ui/AddressChip.vue — a truncated, monospaced wallet address
 * or on-chain id, with a copy button and an explorer link.
 *
 * Truncates any value longer than 14 characters to `first6…last4`, which
 * works for EVM addresses, Solana base58 addresses and Chainbills' own
 * numeric/hex ids alike. The copy and explorer-link icons reveal on hover on
 * desktop (`group-hover`) and stay visible on touch devices (`sm:` gate).
 *
 * Usage:
 * ```vue
 * <AddressChip :value="walletAddress" :chain="sepolia" kind="address" />
 * <AddressChip :value="payable.id" kind="id" :to="`/payable/${payable.id}`" />
 * ```
 */
import { getWalletUrl, type Chain } from '@/schemas';
import { useAnalyticsStore } from '@/stores';
import { computed, ref } from 'vue';
import IconCopy from '@/icons/IconCopy.vue';
import IconOpenInNew from '@/icons/IconOpenInNew.vue';

const props = defineProps<{
  /** The raw address or id to display and copy. */
  value: string;
  /** The chain the value belongs to. Required to build the explorer link
   *  when `kind` is `'address'`; ignored for `'id'`. */
  chain?: Chain;
  /** `'address'` shows a blockchain-explorer link; `'id'` is an internal
   *  Chainbills id (payable, payment, withdrawal) with no explorer of its
   *  own, so only the `to` link (if given) and the copy button apply. */
  kind: 'address' | 'id';
  /** An internal route to link the chip's value to, e.g. a payable's detail
   *  page. Rendered as the value's own `<router-link>` when set. */
  to?: string;
}>();

const analytics = useAnalyticsStore();
const copied = ref(false);

const truncated = computed(() => {
  const v = props.value;
  return v.length <= 14 ? v : `${v.slice(0, 6)}…${v.slice(-4)}`;
});

const explorerUrl = computed(() =>
  props.kind === 'address' && props.chain ? getWalletUrl(props.value, props.chain) : null
);

/** Copies the full (untruncated) value to the clipboard and flips the icon
 *  to a checkmark for 1.5s as feedback before reverting. */
const copy = async () => {
  await navigator.clipboard.writeText(props.value);
  copied.value = true;
  analytics.recordEvent('copied_address_chip', { kind: props.kind, chain: props.chain?.name });
  setTimeout(() => (copied.value = false), 1500);
};
</script>

<template>
  <span
    class="group inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-bg/30 px-2.5 py-1 font-mono text-xs"
  >
    <component :is="to ? 'router-link' : 'span'" :to="to" class="text-fg" :title="value">{{ truncated }}</component>

    <button
      type="button"
      @click="copy"
      :aria-label="copied ? 'Copied' : 'Copy to clipboard'"
      :title="copied ? 'Copied' : 'Copy to clipboard'"
      class="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:text-accent"
    >
      <span v-if="copied" class="text-success">✓</span>
      <IconCopy v-else class="w-3.5 h-3.5" />
    </button>

    <a
      v-if="explorerUrl"
      :href="explorerUrl"
      target="_blank"
      rel="noopener noreferrer"
      title="View in explorer"
      aria-label="View in explorer"
      class="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:text-accent"
    >
      <IconOpenInNew class="w-3.5 h-3.5" />
    </a>
  </span>
</template>
