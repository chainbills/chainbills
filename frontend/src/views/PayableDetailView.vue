<script setup lang="ts">
/**
 * src/views/PayableDetailView.vue: `/payable/:id`. The public payable detail
 * page. Everyone can view it, with or without a connected wallet.
 *
 * Layout: full-width hero band at the top, then a two-column grid on desktop
 * (main content ~2/3, sticky side rail ~1/3). Mobile stacks everything
 * vertically.
 *
 * Main column:
 *  - Description card (sanitised text, host's "Edit" button).
 *  - Balances card (HOST ONLY): each balance with a "Withdraw" button.
 *  - ActivityFeed with All / Payments / Withdrawals / Settings tabs.
 *
 * Side rail:
 *  - PayableSettingsCard: payment rules + auto-withdraw + fee.
 *  - PayableAvailabilityCard: per-chain sync status.
 *  - Numbers row: payment count, withdrawal count, activity count.
 *
 * Below the grid (host only): PayableHostControls for Close/Reopen, edit
 * rules, auto-withdraw and description.
 *
 * States:
 *  - Loading: PayableDetailLoader (skeleton mirroring the layout).
 *  - Not found: EmptyState with a search input routing to `/scan?q=`.
 *  - Normal: the page content above.
 */
import PayableDetailLoader from '@/components/PayableDetailLoader.vue';
import { ActivityFeed } from '@/components/activity';
import PayableAvailabilityCard from '@/components/payable/PayableAvailabilityCard.vue';
import PayableBalancesCard from '@/components/payable/PayableBalancesCard.vue';
import PayableHero from '@/components/payable/PayableHero.vue';
import PayableHostControls from '@/components/payable/PayableHostControls.vue';
import PayableSettingsCard from '@/components/payable/PayableSettingsCard.vue';
import { EmptyState, GlassCard, ScrollToTop, SearchInput, StatTile } from '@/components/ui';
import { FEATURES } from '@/config/features';
import IconWallet from '@/icons/IconWallet.vue';
import { Payable } from '@/schemas';
import { useAnalyticsStore, useAuthStore, usePayableStore } from '@/stores';
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const analytics = useAnalyticsStore();
const auth = useAuthStore();
const payableStore = usePayableStore();

/** The loaded payable; null while loading or when not found. */
const payable = ref<Payable | null>(null);

/** True while the first payable load is in flight. */
const isLoading = ref(true);

/** True when the payable was fetched but was not found on any chain. */
const notFound = ref(false);

/** The search term typed into the not-found search box, so the user can route to /scan?q=. */
const notFoundSearch = ref('');

/** A key incremented after each host action to re-mount ActivityFeed and force a fresh fetch. */
const feedKey = ref(0);

/** The scroll anchor for the host controls section. */
const hostControlsEl = ref<HTMLElement | null>(null);

/** True when the connected wallet is this payable's host. */
const isHost = computed(
  () =>
    !!auth.currentUser &&
    !!payable.value &&
    auth.currentUser.walletAddress.toLowerCase() === payable.value.host.toLowerCase()
);

/**
 * Counts how many times the currently connected wallet has paid this payable.
 * On-chain via `usePayableStore`, loaded after the payable is fetched.
 * Zero when not connected or never paid.
 */
const payerPaymentCount = ref(0);

/** Fetches the payable by id from on-chain (with off-chain description overlay). */
const fetchPayable = async (ignoreErrors = false, showLoading = true) => {
  const id = route.params.id as string;
  if (!id) return;

  if (showLoading) isLoading.value = true;

  const result = await payableStore.get(id, ignoreErrors);
  if (showLoading) isLoading.value = false;

  if (result) {
    payable.value = result;
    notFound.value = false;
  } else if (!ignoreErrors) {
    notFound.value = true;
    payable.value = null;
  }
};

/** Silently refreshes the payable while the tab regains focus. Named for removal on unmount. */
const onWindowFocus = () => fetchPayable(true, false);

onMounted(async () => {
  await fetchPayable(false, true);
  window.addEventListener('focus', onWindowFocus);

  // Record visit.
  analytics.recordEvent('viewed_payable', { payable_id: route.params.id });
});

onUnmounted(() => window.removeEventListener('focus', onWindowFocus));

/** Called after any host action that returns a refreshed payable. */
const onPayableUpdated = (refreshed: Payable) => {
  payable.value = refreshed;
  feedKey.value++;
};

/** Called after a successful withdrawal; refreshes the payable so balances update. */
const onWithdrawn = async () => {
  await fetchPayable(true, false);
  feedKey.value++;
};

/** Scrolls the page to the host controls section. */
const scrollToControls = async () => {
  await nextTick();
  hostControlsEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/** Routes the not-found search to /scan?q=. */
const handleNotFoundSearch = (q: string) => {
  if (!q.trim()) return;
  router.push({ path: '/scan', query: { q: q.trim() } });
};
</script>

<template>
  <!-- Loading skeleton -->
  <PayableDetailLoader v-if="isLoading" />

  <!-- Not found -->
  <section v-else-if="notFound" class="pt-12 pb-20 max-w-screen-xl mx-auto">
    <EmptyState
      title="Payable not found"
      description="No payable with this id exists on any supported chain."
    >
      <template #icon>
        <IconWallet class="w-6 h-6" />
      </template>
      <template v-if="FEATURES.scan" #action>
        <div class="flex flex-col items-center gap-3 w-full max-w-sm">
          <p class="text-xs text-muted">Try searching for a different id:</p>
          <SearchInput
            v-model="notFoundSearch"
            placeholder="Payable id..."
            class="w-full"
            @update:model-value="handleNotFoundSearch"
          />
        </div>
      </template>
    </EmptyState>
  </section>

  <!-- Main page content -->
  <section v-else-if="payable" class="pt-10 pb-28 max-w-screen-xl mx-auto">
    <!-- Full-width hero -->
    <div class="mb-10">
      <PayableHero
        :payable="payable"
        :payer-payment-count="payerPaymentCount"
        @manage="scrollToControls"
      />
    </div>

    <!-- Two-column grid. min-w-0 on each item prevents the ActivityTable's
         min-content from forcing the grid wider than the viewport. -->
    <div class="grid md:grid-cols-[1fr,minmax(0,280px)] lg:grid-cols-[1fr,minmax(0,360px)] gap-8 items-start">
      <!-- Main column -->
      <div class="flex flex-col gap-6 min-w-0">
        <!-- Description card -->
        <GlassCard>
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-fg">Description</h3>
          </div>

          <div v-if="payable.description" class="text-sm text-fg whitespace-pre-line break-words">
            <!-- Rendered with text node binding: line breaks preserved, no innerHTML risk -->
            {{ payable.description }}
          </div>
          <p v-else class="text-sm text-muted italic">No description provided.</p>
        </GlassCard>

        <!-- Balances card (host only) -->
        <PayableBalancesCard
          v-if="isHost"
          :payable="payable"
          @withdrawn="onWithdrawn"
        />

        <!-- Activity feed -->
        <ActivityFeed
          :key="feedKey"
          :source="{ kind: 'payable', payable }"
          :tabs="['all', 'payments', 'withdrawals', 'settings']"
          filterable
          searchable
          :persist-key="`payable-activity-${payable.id}`"
        />
      </div>

      <!-- Side rail: sticky on md+ -->
      <div class="flex flex-col gap-6 md:sticky md:top-28 min-w-0">
        <!-- Settings card -->
        <PayableSettingsCard :payable="payable" />

        <!-- Availability card -->
        <PayableAvailabilityCard :payable="payable" />

        <!-- Numbers card -->
        <div class="grid grid-cols-3 gap-3">
          <StatTile label="Payments" :value="payable.paymentsCount" />
          <StatTile label="Withdrawals" :value="payable.withdrawalsCount" />
          <StatTile label="Activities" :value="payable.activitiesCount" />
        </div>
      </div>
    </div>

    <!-- Host controls (host only) -->
    <div
      v-if="isHost"
      ref="hostControlsEl"
      class="mt-12 scroll-mt-24"
      aria-labelledby="host-controls-heading"
    >
      <PayableHostControls :payable="payable" @updated="onPayableUpdated" />
    </div>
  </section>

  <ScrollToTop />
</template>
