<script setup lang="ts">
/**
 * src/views/DashboardView.vue — `/dashboard`. The signed-in host's own
 * payables: a header with a "Create payable" CTA and the connected chain
 * badge, a stats row (payables, payments received, withdrawals), and a
 * paginated grid of `PayableInfoCard`s. Payables load newest first, with a
 * localStorage-remembered page per wallet+chain and a placeholder count
 * (also cached) so returning to the page doesn't flash a skeleton grid of
 * the wrong size while the real count loads.
 */
import PayableInfoCard from '@/components/PayableInfoCard.vue';
import SignInButton from '@/components/SignInButton.vue';
import { ChainSwitcher, EmptyState, ScrollToTop, SectionHeader, StatTile } from '@/components/ui';
import { useAnalyticsStore, useAuthStore, useEvmStore, usePaginatorsStore, usePayableStore } from '@/stores';
import Button from 'primevue/button';
import Paginator from 'primevue/paginator';
import { computed, onMounted, ref, watch } from 'vue';

const analytics = useAnalyticsStore();
const auth = useAuthStore();
const evm = useEvmStore();
const payableStore = usePayableStore();
const paginators = usePaginatorsStore();

const lsPageKey = () => `chainbills::user=>${auth.currentUser?.walletAddress}` + '::payable_info_cards_page';
const lsCacheCountKey = () =>
  `chainbills::user=>${auth.currentUser?.walletAddress}::chain=>${auth.currentUser?.chain.name}::payables_count_cache`;

const currentPage = ref(+(localStorage.getItem(lsPageKey()) ?? '0'));
const isLoading = ref(true);
const payableIds = ref<string[] | null>();

// Load cached payables count for placeholder generation
const cachedPayablesCount = computed(() => {
  if (!auth.currentUser) return 0;
  const cached = localStorage.getItem(lsCacheCountKey());
  return cached ? parseInt(cached, 10) : auth.currentUser.payablesCount;
});

// Use real count if loaded, fallback to cached
const displayCount = computed(() => {
  if (!isLoading.value && payableIds.value !== null) return auth.currentUser?.payablesCount ?? 0;
  return cachedPayablesCount.value;
});

const getLoaderCount = (index: number): number =>
  Math.max(1, displayCount.value - paginators.rowsPerPage * currentPage.value - index);

const expectedCardsCount = computed(() => {
  if (displayCount.value === 0) return paginators.rowsPerPage;
  const remaining = displayCount.value - currentPage.value * paginators.rowsPerPage;
  return Math.max(1, Math.min(paginators.rowsPerPage, remaining));
});

const generateEmpties = (length: number) => Array.from({ length }, () => null);

const getPayableIds = async () => {
  isLoading.value = true;
  payableIds.value = await payableStore.getIdsForCurrentUser(currentPage.value, paginators.rowsPerPage);
  if (auth.currentUser && payableIds.value !== null) {
    localStorage.setItem(lsCacheCountKey(), auth.currentUser.payablesCount.toString());
  }
  isLoading.value = false;
};

const resetPage = () => {
  if (!auth.currentUser) return (currentPage.value = 0);
  currentPage.value = paginators.getLastPage(auth.currentUser.payablesCount);
};

const updatePage = (page: number) => {
  currentPage.value = page;
  localStorage.setItem(lsPageKey(), page.toString());
  getPayableIds();
};

// --- Stats row ---
/** Sum of `paymentsCount` across every payable the host has on their connected chain — fetched once per wallet/chain rather than per page, since the grid itself only ever loads one page of full `Payable` structs at a time. */
const totalPaymentsReceived = ref<number | null>(null);

const loadPaymentsTotal = async () => {
  if (!auth.currentUser) {
    totalPaymentsReceived.value = null;
    return;
  }
  if (auth.currentUser.payablesCount === 0) {
    totalPaymentsReceived.value = 0;
    return;
  }
  totalPaymentsReceived.value = null;
  const { walletAddress, chain, payablesCount } = auth.currentUser;
  const ids = await evm.getUserPayableIdsPaginated(walletAddress, 0, payablesCount, chain.name);
  if (!ids) return;
  const raw = await evm.getPayablesBulk(ids, chain.name);
  totalPaymentsReceived.value = raw ? raw.reduce((sum, p) => sum + Number(p.paymentsCount), 0) : null;
};

onMounted(async () => {
  if (auth.currentUser) {
    await getPayableIds();
    loadPaymentsTotal();
  }

  watch(
    () => auth.currentUser,
    async (currentUser) => {
      if (currentUser) {
        resetPage();
        await getPayableIds();
        loadPaymentsTotal();
      } else {
        payableIds.value = null;
        totalPaymentsReceived.value = null;
      }
    }
  );
});
</script>

<template>
  <section class="pt-6 pb-20 max-w-screen-xl mx-auto">
    <SectionHeader eyebrow="Dashboard" title="Your payables">
      <template #actions>
        <ChainSwitcher v-if="auth.currentUser" :model-value="auth.currentUser.chain.name" />
        <router-link to="/start" @click="analytics.recordEvent('clicked_create_payable', { from: 'dashboard_page' })">
          <Button class="px-4">Create payable</Button>
        </router-link>
      </template>
    </SectionHeader>

    <template v-if="!auth.currentUser">
      <EmptyState title="Connect your wallet" description="Sign in to see and manage your payables.">
        <template #action>
          <SignInButton @click="analytics.recordEvent('clicked_signin', { from: 'dashboard_page' })" />
        </template>
      </EmptyState>
    </template>

    <template v-else-if="(payableIds && payableIds.length === 0) || (payableIds === null && displayCount === 0)">
      <EmptyState title="No payables yet" description="Create your first payable to start receiving payments.">
        <template #action>
          <router-link to="/start" @click="analytics.recordEvent('clicked_get_started', { from: 'dashboard_page' })">
            <Button class="px-4">Create payable</Button>
          </router-link>
        </template>
      </EmptyState>
    </template>

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatTile label="Payables" :value="auth.currentUser.payablesCount" />
        <StatTile
          label="Payments received"
          :value="totalPaymentsReceived ?? undefined"
          :loading="totalPaymentsReceived === null"
        />
        <StatTile label="Withdrawals" :value="auth.currentUser.withdrawalsCount" />
      </div>

      <div class="grid gap-4 max-sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
        <PayableInfoCard
          v-for="(id, i) in payableIds ?? generateEmpties(expectedCardsCount)"
          :key="id ?? i"
          :count="payableIds ? displayCount - paginators.rowsPerPage * currentPage - i : getLoaderCount(i)"
          :payableId="id"
        />
      </div>

      <div class="flex justify-end mt-4">
        <div class="glass-surface glass-frost rounded-2xl overflow-hidden">
          <Paginator
            :currentPage="currentPage"
            currentPageReportTemplate="{first} to {last} of {totalRecords}"
            :first="paginators.rowsPerPage * currentPage"
            :rows="paginators.rowsPerPage"
            :rowsPerPageOptions="paginators.rowsPerPageOptions"
            template="FirstPageLink PrevPageLink JumpToPageDropdown CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
            :totalRecords="displayCount"
            @page="
              (e) => {
                paginators.setRowsPerPage(e.rows);
                updatePage(e.page);
                analytics.recordEvent('updated_payables_list_pagination');
              }
            "
          />
        </div>
      </div>
    </template>
  </section>

  <ScrollToTop />
</template>
