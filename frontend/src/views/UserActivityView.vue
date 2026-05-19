<script setup lang="ts">
import SignInButton from '@/components/SignInButton.vue';
import TableLoader from '@/components/TableLoader.vue';
import TransactionsTable from '@/components/TransactionsTable.vue';
import { type Receipt } from '@/schemas';
import {
  useAnalyticsStore,
  useAuthStore,
  usePaginatorsStore,
  usePaymentStore,
  useThemeStore,
  useWithdrawalStore,
} from '@/stores';
import Button from 'primevue/button';
import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import Tabs from 'primevue/tabs';
import { computed, onMounted, ref, watch } from 'vue';

const auth = useAuthStore();
const lsCatKey = () => `chainbills::user=>${auth.currentUser?.walletAddress}` + '::activity_table_category';
const lsPaymentsPageKey = () => `chainbills::user=>${auth.currentUser?.walletAddress}` + '::payments_page';
const lsWithdrawalsPageKey = () => `chainbills::user=>${auth.currentUser?.walletAddress}` + '::withdrawals_page';
const lsPageKey = () => (activeCat.value === 0 ? lsPaymentsPageKey() : lsWithdrawalsPageKey());

const activeCat = ref(0);
const analytics = useAnalyticsStore();
const theme = useThemeStore();
const categories = ['Payments', 'Withdrawals'];
const countFields = ['payerCount', 'hostCount'];
const currentTablePage = ref(0);
const isLoading = ref(true);
const paginators = usePaginatorsStore();
const payments = usePaymentStore();
const transactions = ref<Receipt[] | null>(null);
const withdrawals = useWithdrawalStore();

const totalCount = computed(() => {
  if (!auth.currentUser) return 0;
  return auth.currentUser[activeCat.value == 0 ? 'paymentsCount' : 'withdrawalsCount'];
});

const getTransactions = async () => {
  isLoading.value = true;
  transactions.value = await (activeCat.value == 0 ? payments : withdrawals).getManyForCurrentUser(
    currentTablePage.value,
    paginators.rowsPerPage
  );
  isLoading.value = false;
};

const resetTablePage = () => {
  if (!auth.currentUser) return (currentTablePage.value = 0);
  activeCat.value = +(localStorage.getItem(lsCatKey()) ?? '0');
  const finalPage = paginators.getLastPage(
    auth.currentUser[activeCat.value == 0 ? 'paymentsCount' : 'withdrawalsCount']
  );
  const lastSavedPage = +(localStorage.getItem(lsPageKey()) ?? '0');
  if (lastSavedPage < 0 || lastSavedPage > finalPage || !Number.isInteger(lastSavedPage)) {
    currentTablePage.value = finalPage;
  } else {
    currentTablePage.value = lastSavedPage;
  }
};

const updateTablePage = (page: number) => {
  currentTablePage.value = page;
  localStorage.setItem(lsPageKey(), page.toString());
  getTransactions();
};

const onWindowFocus = async () => {
  if (!auth.currentUser) return;

  const prevPaymentsCount = auth.currentUser.paymentsCount;
  const prevWithdrawalsCount = auth.currentUser.withdrawalsCount;

  // Refresh user silently — no loader shown
  await auth.refreshUser();

  if (!auth.currentUser) return;

  // Compare active-tab count
  const activeTabCountChanged =
    activeCat.value === 0
      ? auth.currentUser.paymentsCount !== prevPaymentsCount
      : auth.currentUser.withdrawalsCount !== prevWithdrawalsCount;

  if (activeTabCountChanged) {
    // Only reload if on last page
    const isOnLastPage =
      currentTablePage.value ===
      paginators.getLastPage(activeCat.value === 0 ? prevPaymentsCount : prevWithdrawalsCount);
    if (isOnLastPage) {
      currentTablePage.value = paginators.getLastPage(
        auth.currentUser[activeCat.value === 0 ? 'paymentsCount' : 'withdrawalsCount']
      );
      await getTransactions();
    }
  }
};

onMounted(async () => {
  if (auth.currentUser) await getTransactions();

  window.addEventListener('focus', onWindowFocus);

  watch(
    () => auth.currentUser?.walletAddress,
    async (newAddress, oldAddress) => {
      if (newAddress && newAddress !== oldAddress) {
        resetTablePage();
        await getTransactions();
      } else if (!newAddress) {
        transactions.value = null;
      }
    }
  );

  watch(
    () => activeCat.value,
    (_) => {
      if (!auth.currentUser) return;
      localStorage.setItem(lsCatKey(), activeCat.value.toString());
      resetTablePage();
      getTransactions();
      analytics.recordEvent('changed_user_activity_category', {
        category: activeCat.value == 0 ? 'payments' : 'withdrawals',
      });
    }
  );
});
</script>

<template>
  <div class="max-w-screen-xl mx-auto pb-20">
    <div class="mb-8 sm:flex justify-between items-center">
      <h2 class="text-3xl font-bold max-sm:mb-6">Activity</h2>

      <div class="max-sm:flex justify-end">
        <Tabs v-model:value="activeCat">
          <TabList>
            <Tab v-for="(category, i) of categories" :value="i" class="bg-app-bg">{{ category }}</Tab>
          </TabList>
        </Tabs>
      </div>
    </div>

    <template v-if="!auth.currentUser">
      <p class="pt-8 mb-8 text-center text-xl">Please connect your wallet to continue</p>
      <p class="mx-auto w-fit">
        <SignInButton
          @click="
            analytics.recordEvent('clicked_signin', {
              from: 'user_activity_page',
            })
          "
        />
      </p>
    </template>

    <template v-else-if="isLoading"><TableLoader /></template>

    <template v-else-if="!transactions">
      <p class="pt-8 mb-6 text-center text-xl">Something went wrong</p>
      <p class="mx-auto w-fit">
        <Button
          class="text-xl px-6 py-2"
          @click="
            getTransactions();
            analytics.recordEvent('clicked_retry_get_transactions', {
              from: 'user_activity_page',
            });
          "
          >Retry</Button
        >
      </p>
    </template>

    <template v-else-if="transactions.length === 0">
      <div class="text-center pt-12">
        <img
          :src="`/assets/chainbills-${theme.isDisplayDark ? 'dark' : 'light'}.png`"
          alt="Chainbills"
          class="w-20 h-20 mx-auto mb-4 opacity-40"
        />
        <p class="text-lg font-semibold mb-2">
          {{ activeCat == 0 ? 'No payments made yet' : 'No withdrawals yet' }}
        </p>
        <p class="text-gray-600 dark:text-gray-400 max-w-sm mx-auto mb-6">
          {{
            activeCat == 0
              ? 'When you make a payment to any payable your history will appear here.'
              : 'Withdraw from your payables on the Dashboard to see them here.'
          }}
        </p>
        <router-link
          v-if="activeCat == 1"
          to="/dashboard"
          @click="
            analytics.recordEvent('clicked_go_to_dashboard_from_empty_state', {
              from: 'user_activity_page',
            })
          "
        >
          <Button class="px-3 py-2 text-sm">Go to Dashboard</Button>
        </router-link>
      </div>
    </template>

    <template v-else>
      <TransactionsTable
        :chainColumn="activeCat === 0 ? 'payable' : undefined"
        :countField="countFields[activeCat]"
        :currentPage="currentTablePage"
        :hideUser="true"
        :receipts="transactions"
        :totalCount="totalCount"
        @updateTablePage="updateTablePage"
      />
    </template>
  </div>
</template>
