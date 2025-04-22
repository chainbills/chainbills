<script setup lang="ts">
import PayableInfoCard from '@/components/PayableInfoCard.vue';
import SignInButton from '@/components/SignInButton.vue';
import {
  useAnalyticsStore,
  useAuthStore,
  usePaginatorsStore,
  usePayableStore,
} from '@/stores';
import Button from 'primevue/button';
import Paginator from 'primevue/paginator';
import { onMounted, ref, watch } from 'vue';

const analytics = useAnalyticsStore();
const auth = useAuthStore();
const lsPageKey = () =>
  `chainbills::user=>${auth.currentUser?.walletAddress}` +
  '::payable_info_cards_page';

const currentPage = ref(+(localStorage.getItem(lsPageKey()) ?? '0'));
const isLoading = ref(true);
const payableIds = ref<string[] | null>();
const payableStore = usePayableStore();
const paginators = usePaginatorsStore();

const generateEmpties = (length: number) => Array.from({ length }, (_) => null);

const getPayableIds = async () => {
  isLoading.value = true;
  payableIds.value = await payableStore.getIdsForCurrentUser(
    currentPage.value,
    paginators.rowsPerPage
  );
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
      <p class="pt-8 mb-8 text-center text-xl">
        Please connect your wallet to continue
      </p>
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

    <template v-else-if="payableIds && payableIds.length == 0">
      <p class="text-lg text-center max-w-sm mx-auto mb-4 pt-8">
        You haven't created any payables.
      </p>
      <p class="text-lg text-center max-w-md mx-auto mb-8">
        Get Started with us today by Creating a Payable today.
      </p>
      <p class="text-center">
        <router-link
          to="/start"
          @click="
            analytics.recordEvent('clicked_get_started', {
              from: 'dashboard_page',
            })
          "
        >
          <Button class="px-3 py-2">Get Started</Button>
        </router-link>
      </p>
    </template>

    <template v-else>
      <template v-if="payableIds || isLoading">
        <div
          class="grid gap-6 max-sm:!grid-cols-1 max-[992px]:!grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 mb-12 mx-auto"
        >
          <PayableInfoCard
            v-for="(id, i) in payableIds ??
            generateEmpties(paginators.rowsPerPage)"
            :key="id ?? i"
            :count="
              paginators.rowsPerPage * currentPage +
              ((payableIds?.length ?? paginators.rowsPerPage) - i)
            "
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
          :totalRecords="auth.currentUser.payablesCount"
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
