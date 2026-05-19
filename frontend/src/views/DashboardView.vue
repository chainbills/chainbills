<script setup lang="ts">
import PayableInfoCard from '@/components/PayableInfoCard.vue';
import SignInButton from '@/components/SignInButton.vue';
import { useAnalyticsStore, useAuthStore, usePaginatorsStore, usePayableStore, useThemeStore } from '@/stores';
import Button from 'primevue/button';
import Paginator from 'primevue/paginator';
import { computed, onMounted, ref, watch } from 'vue';

const analytics = useAnalyticsStore();
const auth = useAuthStore();
const theme = useThemeStore();
const lsPageKey = () => `chainbills::user=>${auth.currentUser?.walletAddress}` + '::payable_info_cards_page';
const lsCacheCountKey = () =>
  `chainbills::user=>${auth.currentUser?.walletAddress}::chain=>${auth.currentUser?.chain.name}::payables_count_cache`;

const currentPage = ref(+(localStorage.getItem(lsPageKey()) ?? '0'));
const isLoading = ref(true);
const payableIds = ref<string[] | null>();
const payableStore = usePayableStore();
const paginators = usePaginatorsStore();

// Load cached payables count for placeholder generation
const cachedPayablesCount = computed(() => {
  if (!auth.currentUser) return 0;
  const cached = localStorage.getItem(lsCacheCountKey());
  return cached ? parseInt(cached, 10) : auth.currentUser.payablesCount;
});

// Use real count if loaded, fallback to cached
const displayCount = computed(() => {
  if (!isLoading.value && payableIds.value !== null) {
    // Real data loaded
    return auth.currentUser?.payablesCount ?? 0;
  }
  // Still loading, use cached
  return cachedPayablesCount.value;
});

// Separate loader count: always count down from displayCount, regardless of pagination
const getLoaderCount = (index: number): number => {
  return Math.max(1, displayCount.value - paginators.rowsPerPage * currentPage.value - index);
};

const expectedCardsCount = computed(() => {
  if (displayCount.value === 0) return paginators.rowsPerPage;
  const remaining = displayCount.value - currentPage.value * paginators.rowsPerPage;
  return Math.max(1, Math.min(paginators.rowsPerPage, remaining));
});

const generateEmpties = (length: number) => Array.from({ length }, (_) => null);

const getPayableIds = async () => {
  isLoading.value = true;
  payableIds.value = await payableStore.getIdsForCurrentUser(currentPage.value, paginators.rowsPerPage);

  // Cache the latest count when data arrives
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

onMounted(async () => {
  if (auth.currentUser) await getPayableIds();

  watch(
    () => auth.currentUser,
    async (currentUser) => {
      if (currentUser) {
        resetPage();
        await getPayableIds();
      } else payableIds.value = null;
    }
  );
});
</script>

<template>
  <section class="max-w-screen-xl max-[992px]:max-w-screen-md mx-auto pb-20">
    <div class="mb-8 flex justify-between items-center">
      <h2 class="text-3xl font-bold">Payables</h2>
      <router-link to="/start">
        <Button class="px-4 py-1">Create</Button>
      </router-link>
    </div>

    <template v-if="!auth.currentUser">
      <p class="pt-8 mb-8 text-center text-xl">Please connect your wallet to continue</p>
      <p class="mx-auto w-fit">
        <SignInButton
          @click="
            analytics.recordEvent('clicked_signin', {
              from: 'dashboard_page',
            })
          "
        />
      </p>
    </template>

    <template v-else-if="(payableIds && payableIds.length == 0) || (payableIds === null && displayCount === 0)">
      <div class="text-center pt-12">
        <img
          :src="`/assets/chainbills-${theme.isDisplayDark ? 'dark' : 'light'}.png`"
          alt="Chainbills"
          class="w-20 h-20 mx-auto mb-4 opacity-40"
        />
        <p class="text-lg font-semibold mb-2">You haven't created any payables.</p>
        <p class="text-gray-600 dark:text-gray-400 max-w-sm mx-auto mb-6">
          Get Started with us today by Creating a Payable today.
        </p>
        <router-link
          to="/start"
          @click="
            analytics.recordEvent('clicked_get_started', {
              from: 'dashboard_page',
            })
          "
        >
          <Button class="px-3 py-2 text-sm">Get Started</Button>
        </router-link>
      </div>
    </template>

    <template v-else>
      <template v-if="payableIds || isLoading">
        <div
          class="grid gap-6 max-sm:!grid-cols-1 max-[992px]:!grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 mb-12 mx-auto"
        >
          <PayableInfoCard
            v-for="(id, i) in payableIds ?? generateEmpties(expectedCardsCount)"
            :key="id ?? i"
            :count="payableIds ? displayCount - paginators.rowsPerPage * currentPage - i : getLoaderCount(i)"
            :payableId="id"
            class="max-lg:max-w-sm w-full max-sm:mx-auto"
          />
        </div>

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
      </template>

      <template v-else>
        <p class="pt-8 mb-6 text-center text-xl">Something went wrong</p>
        <p class="mx-auto w-fit">
          <Button
            class="text-xl px-6 py-2"
            @click="
              getPayableIds();
              analytics.recordEvent('clicked_retry_get_payable_ids', {
                from: 'dashboard_page',
              });
            "
            >Retry</Button
          >
        </p>
      </template>
    </template>
  </section>
</template>
