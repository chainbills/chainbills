<script setup lang="ts">
import SignInButton from '@/components/SignInButton.vue';
import TableLoader from '@/components/TableLoader.vue';
import TransactionsTable from '@/components/TransactionsTable.vue';
import { type Receipt } from '@/schemas';
import {
  useAuthStore,
  usePaginatorsStore,
  usePaymentStore,
  useWithdrawalStore,
} from '@/stores';
import Button from 'primevue/button';
import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import Tabs from 'primevue/tabs';
import { computed, onMounted, ref, watch } from 'vue';

const auth = useAuthStore();
const lsCatKey = () =>
  `chainbills::user=>${auth.currentUser?.walletAddress}` +
  '::activity_table_category';
const lsPageKey = () =>
  `chainbills::user=>${auth.currentUser?.walletAddress}` +
  '::activity_table_page';

const activeCat = ref(+(localStorage.getItem(lsCatKey()) ?? '0'));
const categories = ['Payments', 'Withdrawals'];
const countFields = ['payerCount', 'hostCount'];
const currentTablePage = ref(+(localStorage.getItem(lsPageKey()) ?? '0'));
const isLoading = ref(true);
const paginators = usePaginatorsStore();
const payments = usePaymentStore();
const transactions = ref<Receipt[] | null>(null);
const withdrawals = useWithdrawalStore();

const totalCount = computed(() => {
  if (!auth.currentUser) return 0;
  return auth.currentUser[
    activeCat.value == 0 ? 'paymentsCount' : 'withdrawalsCount'
  ];
});

const getTransactions = async () => {
  isLoading.value = true;
  transactions.value = await (
    activeCat.value == 0 ? payments : withdrawals
  ).getManyForCurrentUser(currentTablePage.value, paginators.rowsPerPage);
  isLoading.value = false;
};

const resetTablePage = () => {
  if (!auth.currentUser) return (currentTablePage.value = 0);
  activeCat.value = +(localStorage.getItem(lsCatKey()) ?? '0');
  const finalPage = paginators.getLastPage(
    auth.currentUser[
      activeCat.value == 0 ? 'paymentsCount' : 'withdrawalsCount'
    ]
  );
  const lastSavedPage = +(localStorage.getItem(lsPageKey()) ?? '0');
  if (
    lastSavedPage < 0 ||
    lastSavedPage > finalPage ||
    !Number.isInteger(lastSavedPage)
  ) {
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

onMounted(async () => {
  if (auth.currentUser) await getTransactions();

  watch(
    () => auth.currentUser,
    async (currentUser) => {
      if (currentUser) {
        resetTablePage();
        await getTransactions();
      } else transactions.value = null;
    }
  );

  watch(
    () => activeCat.value,
    (_) => {
      if (!auth.currentUser) return;
      localStorage.setItem(lsCatKey(), activeCat.value.toString());
      resetTablePage();
      getTransactions();
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
            <Tab
              v-for="(category, i) of categories"
              :value="i"
              class="bg-app-bg"
              >{{ category }}</Tab
            >
          </TabList>
        </Tabs>
      </div>
    </div>

    <template v-if="!auth.currentUser">
      <p class="pt-8 mb-8 text-center text-xl">
        Please connect your wallet to continue
      </p>
      <p class="mx-auto w-fit"><SignInButton /></p>
    </template>

    <template v-else-if="isLoading"><TableLoader /></template>

    <template v-else-if="!transactions">
      <p class="pt-8 mb-6 text-center text-xl">Something went wrong</p>
      <p class="mx-auto w-fit">
        <Button class="text-xl px-6 py-2" @click="getTransactions"
          >Retry</Button
        >
      </p>
    </template>

    <template v-else-if="transactions.length == 0">
      <p class="text-lg text-center max-w-sm mx-auto mb-4 pt-8">
        Welcome to Chainbills
      </p>
      <p class="text-lg text-center max-w-md mx-auto mb-8">
        <!--TODO: Update this empty state -->
        You can make payments here. You can also receive. Get Started with us
        today by Creating a Payable today.
      </p>
      <p class="text-center">
        <router-link to="/start">
          <Button class="px-3 py-2">Get Started</Button>
        </router-link>
      </p>
    </template>

    <template v-else>
      <TransactionsTable
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
