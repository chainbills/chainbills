<script setup lang="ts">
/**
 * src/components/PayableInfoCard.vue — one glass card in `DashboardView`'s
 * payables grid: avatar, short id, status, rules summary, auto-withdraw
 * badge, current balances, payments count, created time, and quick actions
 * (copy the payment link, open the payable). Fetches its own `Payable` from
 * `payableId` so the grid can render a fixed number of skeleton cards
 * before any ids are known (see `getLoaderCount` in `DashboardView.vue`).
 *
 * Props:
 *  - `count`: this card's 1-based position in the host's payables list,
 *    shown next to the short id while the real id is still loading.
 *  - `payableId`: the payable to load. `null`/`undefined` renders the
 *    loading skeleton indefinitely — `DashboardView` uses this for
 *    placeholder cards while the real ids are still in flight.
 */
import { AddressChip, GlassCard, PayableAvatar, Skeleton, StatusPill, TokenAmount } from '@/components/ui';
import IconCopy from '@/icons/IconCopy.vue';
import IconForward from '@/icons/IconForward.vue';
import { Payable } from '@/schemas';
import { useAnalyticsStore, usePayableStore, useTimeStore } from '@/stores';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const props = defineProps<{
  count: number;
  payableId?: string | null;
}>();

const analytics = useAnalyticsStore();
const payableStore = usePayableStore();
const time = useTimeStore();
const toast = useToast();

const isLoading = ref(true);
const payable = ref<Payable | null>(null);

const balsDisplay = computed(() => payable.value?.getBalsDisplay() ?? []);
const shortId = computed(() => (props.payableId ? `${props.payableId.slice(0, 5)}…${props.payableId.slice(-5)}` : ''));
const rulesSummary = computed(() => {
  if (!payable.value) return '';
  const n = payable.value.allowedTokensAndAmounts.length;
  return n === 0 ? 'Any amount' : n === 1 ? '1 option' : `${n} options`;
});

const copyLink = () => {
  if (!props.payableId) return;
  const link = `${window.location.origin}/pay/${props.payableId}`;
  navigator.clipboard.writeText(link);
  toast.add({ severity: 'info', summary: 'Copied', detail: `Payment link copied to clipboard.`, life: 3000 });
  analytics.recordEvent('copy_payment_link', { from: 'payable_info_card' });
};

const fetchPayable = async () => {
  if (!props.payableId) return;
  isLoading.value = true;
  payable.value = await payableStore.get(props.payableId, true);
  isLoading.value = false;
};

onMounted(fetchPayable);
</script>

<template>
  <GlassCard class="flex flex-col h-full">
    <template v-if="isLoading || !payable">
      <div class="flex items-center gap-3 mb-4">
        <Skeleton w="w-12" h="h-12" rounded="rounded-2xl" />
        <div class="flex-1">
          <Skeleton w="w-24" h="h-4" class="mb-1.5" />
          <Skeleton w="w-16" h="h-3" />
        </div>
      </div>
      <Skeleton w="w-20" h="h-6" class="mb-4" />
      <Skeleton w="w-full" h="h-10" class="mb-2" />
      <Skeleton w="w-2/3" h="h-3" />
      <p class="sr-only">Loading payable #{{ count }}</p>
    </template>

    <template v-else>
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-3 min-w-0">
          <PayableAvatar :id="payable.id" size="sm" />
          <div class="min-w-0">
            <p class="text-xs text-muted">#{{ count }}</p>
            <AddressChip :value="payable.id" kind="id" :to="`/payable/${payable.id}`" />
          </div>
        </div>
        <StatusPill :tone="payable.isClosed ? 'danger' : 'success'" :label="payable.isClosed ? 'Closed' : 'Open'" />
      </div>

      <div class="flex flex-wrap items-center gap-1.5 mb-3">
        <span class="rounded-full bg-fg/5 text-fg text-xs px-2 py-0.5">{{ rulesSummary }}</span>
        <span v-if="payable.isAutoWithdraw" class="rounded-full bg-accent/15 text-accent text-xs px-2 py-0.5"
          >Auto-withdraw</span
        >
      </div>

      <div class="grow mb-4">
        <p class="text-xs uppercase tracking-wider text-muted mb-1.5">
          Balance{{ balsDisplay.length === 1 ? '' : 's' }}
        </p>
        <p v-if="!balsDisplay.length" class="text-sm text-muted">No balances yet</p>
        <div v-else class="flex flex-wrap gap-2">
          <span
            v-for="(bal, i) in balsDisplay"
            :key="i"
            class="rounded-full border border-glass-border bg-bg/30 px-2.5 py-1"
          >
            <TokenAmount :amount="bal" :chain="payable.chain" size="sm" />
          </span>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs text-muted pt-3 border-t border-fg/5">
        <span
          >{{ payable.paymentsCount }} payment{{ payable.paymentsCount === 1 ? '' : 's' }} ·
          {{ time.display(payable.createdAt) }}</span
        >
        <span class="flex items-center gap-1">
          <button
            type="button"
            class="p-1.5 rounded-full hover:bg-fg/5 hover:text-accent"
            title="Copy payment link"
            aria-label="Copy payment link"
            @click="copyLink"
          >
            <IconCopy class="w-3.5 h-3.5" />
          </button>
          <router-link
            :to="`/payable/${payable.id}`"
            class="p-1.5 rounded-full hover:bg-fg/5 hover:text-accent"
            title="Open payable"
            aria-label="Open payable"
            @click="analytics.recordEvent('opened_payable_from_dashboard', { payable_id: payable.id })"
          >
            <IconForward class="w-3.5 h-3.5" />
          </router-link>
        </span>
      </div>
    </template>
  </GlassCard>
</template>
