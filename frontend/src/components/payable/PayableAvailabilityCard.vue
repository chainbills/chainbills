<script setup lang="ts">
/**
 * src/components/payable/PayableAvailabilityCard.vue: cross-chain
 * availability card in the side rail.
 *
 * Lists every EVM chain in the payable's network (never mixing mainnet and
 * testnet) and shows its status:
 *  - "Home chain" for the payable's own chain.
 *  - "Synced - accepts USDC via CCTP" for synced chains with a USDC route.
 *  - "Sync pending" with an `InFlightIndicator` for chains that are known
 *    about but haven't synced yet. The component polls `payable.trackSync`
 *    via a reactive interval so the status updates without a page reload.
 *  - "Not available: reason" for chains that can't pay this payable.
 *
 * The availability and sync status are loaded together with `payable.availability`
 * and `payable.trackSync`, both from `usePayableStore`.
 *
 * Props:
 *  - `payable`: the loaded `Payable`.
 *
 * Usage:
 * ```vue
 * <PayableAvailabilityCard :payable="payable" />
 * ```
 */
import { ChainBadge, GlassCard, InFlightIndicator, Skeleton } from '@/components/ui';
import { type Payable } from '@/schemas';
import { usePayableStore } from '@/stores';
import type { PayableAvailability } from '@/stores/payable';
import { onMounted, onUnmounted, ref } from 'vue';

const props = defineProps<{
  /** The loaded payable whose cross-chain availability this card displays. */
  payable: Payable;
}>();

/** Loaded availability for each chain in the payable's network. */
const availability = ref<PayableAvailability[] | null>(null);

const payableStore = usePayableStore();

/** Whether any chain is still pending sync. Controls the polling interval. */
let pollInterval: ReturnType<typeof setInterval> | null = null;

/** Loads availability and starts polling if any chain is pending. */
const loadAvailability = async () => {
  const results = await payableStore.availability(props.payable);
  availability.value = results;

  // Stop polling if everything is resolved.
  const hasPending = results.some((r) => !r.isHome && !r.canPay && r.reason === 'Not synced yet');
  if (!hasPending && pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
};

onMounted(async () => {
  await loadAvailability();
  // Poll every 12 seconds while any chain is still pending, backing off is handled by re-checking after each interval.
  pollInterval = setInterval(loadAvailability, 12_000);
});

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
});
</script>

<template>
  <GlassCard>
    <h3 class="text-sm font-semibold text-fg mb-4">Cross-chain availability</h3>

    <!-- Loading skeleton -->
    <div v-if="!availability" class="flex flex-col gap-3">
      <Skeleton v-for="n in 2" :key="n" w="w-full" h="h-8" />
    </div>

    <!-- Chain list -->
    <ul v-else class="flex flex-col divide-y divide-fg/5">
      <li v-for="entry in availability" :key="entry.chain.name" class="flex items-center justify-between py-2.5 gap-2">
        <ChainBadge :chain="entry.chain" size="sm" />

        <!-- Home chain -->
        <span v-if="entry.isHome" class="text-xs text-muted">Home chain</span>

        <!-- Synced and can pay -->
        <span v-else-if="entry.canPay" class="text-xs text-success font-medium">Synced, accepts USDC via CCTP</span>

        <!-- Sync pending -->
        <span
          v-else-if="!entry.canPay && entry.reason === 'Not synced yet'"
          class="flex items-center gap-1.5 text-xs text-warning"
        >
          <InFlightIndicator />
          Sync pending
        </span>

        <!-- Other reason (e.g. USDC not supported) -->
        <span v-else class="text-xs text-muted"> Not available: {{ entry.reason }} </span>
      </li>
    </ul>

    <p v-if="availability && availability.length === 1" class="mt-3 text-xs text-muted">
      This payable lives on a single chain with no others to sync to.
    </p>
  </GlassCard>
</template>
