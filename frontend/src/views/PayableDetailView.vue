<script setup lang="ts">
import PayableDetailLoader from '@/components/PayableDetailLoader.vue';
import SignInButton from '@/components/SignInButton.vue';
import TableLoader from '@/components/TableLoader.vue';
import TransactionsTable from '@/components/TransactionsTable.vue';
import IconCopy from '@/icons/IconCopy.vue';
import IconForward from '@/icons/IconForward.vue';
import IconOpenInNew from '@/icons/IconOpenInNew.vue';
import IconSpinner from '@/icons/IconSpinner.vue';
import { Payable, type Receipt, TokenAndAmount } from '@/schemas';
import {
  useAuthStore,
  usePaginatorsStore,
  usePayableStore,
  usePaymentStore,
  useWithdrawalStore,
} from '@/stores';
import NotFoundView from '@/views/NotFoundView.vue';
import Button from 'primevue/button';
import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import Tabs from 'primevue/tabs';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const payable = ref<Payable | null>(null);
const route = useRoute();

const fetchPayable = async (ignoreErrors: boolean) => {
  if (!route.params.id) return;
  isLoading.value = true;
  const fetched = await payableStore.get(
    route.params.id as string,
    ignoreErrors
  );
  if (fetched) payable.value = fetched;
  isLoading.value = false;
};

const lsCatKey = () =>
  (payable.value &&
    `chainbills::payable=>${payable.value.id}::activity_table_category`) ??
  '';
const lsPageKey = () =>
  (payable.value &&
    `chainbills::payable=>${payable.value.id}::activity_table_page`) ??
  '';

const activeCat = ref(+(localStorage.getItem(lsCatKey()) ?? '0'));
const auth = useAuthStore();
const categories = ['Payments', 'Withdrawals'];
const currentTablePage = ref(+(localStorage.getItem(lsPageKey()) ?? '0'));
const isLoading = ref(true);
const isLoadingActivities = ref(true);
const transactions = ref<Receipt[] | null>(null);
const paginators = usePaginatorsStore();
const toast = useToast();
const { origin } = window.location;
const link = computed(
  () => (payable.value && `${origin}/pay/${payable.value.id}`) ?? ''
);
const payments = usePaymentStore();
const payableStore = usePayableStore();
const withdrawals = useWithdrawalStore();

const totalActivitiesCount = computed(() => {
  if (!payable.value) return 0;
  return activeCat.value == 0
    ? payable.value.paymentsCount
    : payable.value.withdrawalsCount;
});

const isMine = computed(
  () => auth.currentUser?.walletAddress == (payable.value?.host ?? '')
);

const copy = () => {
  toast.add({
    severity: 'info',
    summary: 'Copied Link!',
    detail: 'Link successfully copied to clipboard',
    life: 5000,
  });
  navigator.clipboard.writeText(link.value ?? '');
};

const comingSoon = () => {
  toast.add({ severity: 'info', summary: 'Coming Soon!', life: 5000 });
};

const balsDisplay = computed(
  () => (payable.value && payable.value.getBalsDisplay()) ?? []
);
const isWithdrawing = ref(false);

const getTransactions = async () => {
  if (!payable.value) return;
  isLoadingActivities.value = true;
  transactions.value = await (
    activeCat.value == 0 ? payments : withdrawals
  ).getManyForPayable(
    payable.value,
    currentTablePage.value,
    paginators.rowsPerPage
  );
  isLoadingActivities.value = false;
};

const resetTablePage = () => {
  if (!payable.value) return;
  activeCat.value = +(localStorage.getItem(lsCatKey()) ?? '0');
  const finalPage = paginators.getLastPage(
    payable.value[activeCat.value == 0 ? 'paymentsCount' : 'withdrawalsCount']
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

const shorten = (v: string) =>
  `${v.substring(0, 5)}...${v.substring(v.length - 5)}`;

const updateTablePage = (page: number) => {
  if (!payable.value) return;
  currentTablePage.value = page;
  localStorage.setItem(lsPageKey()!, page.toString());
  getTransactions();
};

const withdraw = async (balance: TokenAndAmount) => {
  if (!payable.value || !auth.currentUser) return;
  if (balance.amount == 0) {
    toast.add({
      severity: 'info',
      summary: 'Zero Balance',
      detail: 'You cannot withdraw an empty balance.',
      life: 12000,
    });
  } else {
    isWithdrawing.value = true;
    const result = await withdrawals.exec(payable.value.id, balance);
    if (result) {
      const newPayable = await payableStore.get(payable.value.id);
      if (newPayable) {
        payable.value = newPayable;
        isWithdrawing.value = false;

        // showing the receipt ID if withdrawal was successful since we are not
        // redirecting to the receipt page for withdrawals.
        console.log('Withdrawal Receipt ID: ', result);

        // reloading the page if updates failed to ensure we don't have
        // stale data in the UI
      } else window.location.reload();
    } else isWithdrawing.value = false;
  }
};

onMounted(async () => {
  await fetchPayable(true);

  resetTablePage();
  await getTransactions();

  watch([() => auth.currentUser, () => activeCat.value], (_) => {
    if (!payable.value) return;
    localStorage.setItem(lsCatKey()!, activeCat.value.toString());
    resetTablePage();
    getTransactions();
  });
  watch(() => payable.value, getTransactions);
});
</script>

<template>
  <PayableDetailLoader v-if="isLoading" />

  <NotFoundView v-else-if="!payable" />

  <section class="max-w-screen-xl mx-auto pb-20" v-else>
    <template v-if="!auth.currentUser">
      <p class="my-12 text-center text-xl">
        Please connect your wallet to continue
      </p>
      <p class="mx-auto w-fit"><SignInButton /></p>
    </template>

    <template class="" v-else-if="!isMine">
      <h2 class="text-3xl text-center mb-8 pt-8 font-bold">Unauthorized</h2>
      <p class="text-lg text-center max-w-sm mx-auto mb-4">
        You don't have permissions to view this page.
      </p>
      <p class="text-lg text-center max-w-md mx-auto mb-8">
        You can navigate to the Home page or Get Started with us today by
        Creating a Payable.
      </p>
      <p class="text-center">
        <router-link to="/">
          <Button class="bg-transparent text-primary px-3 py-2 mr-6"
            >Go Home</Button
          >
        </router-link>
        <router-link to="/start">
          <Button class="-mt-1 px-3 py-2">Get Started</Button>
        </router-link>
      </p>
    </template>

    <template v-else>
      <div class="sm:flex items-start mb-8">
        <h2 class="sm:grow max-sm:mb-8 leading-tight flex gap-x-2 items-center">
          <span class="text-lg sm:text-xl font-bold text-gray-500"
            >Payables</span
          >
          <IconForward
            class="w-3 h-3 mt-px sm:w-4 sm:h-4 sm:mt-[2px] text-gray-500 inline-block"
          />
          <span class="text-xl sm:text-2xl font-bold break-all">{{
            shorten(payable.id)
          }}</span>
        </h2>

        <Button
          class="px-4 py-1 max-sm:ml-auto max-sm:block"
          @click="() => fetchPayable(false)"
        >
          Refresh
        </Button>
      </div>

      <div class="sm:flex sm:justify-between sm:gap-x-4 mb-16">
        <div class="sm:w-1/2">
          <div class="max-w-sm mb-12">
            <h3 class="font-medium mb-2">Share Payment Link</h3>

            <div
              class="relative pl-3 pr-20 py-1.5 rounded-md shadow-inner bg-primary bg-opacity-10 dark:bg-opacity-5 mb-3"
            >
              <p
                class="line-clamp-1 whitespace-pre overflow-ellipsis text-sm opacity-80"
              >
                {{ link }}
              </p>
              <span class="absolute right-16 top-1.5 text-sm">...</span>
              <Button
                class="bg-transparent p-1 border-none !absolute w-8 h-8 top-0 right-8"
                @click="copy"
                title="Copy Payment Link"
              >
                <IconCopy class="text-primary w-5 h-5" />
              </Button>
              <a
                :href="link"
                target="_blank"
                rel="noopener noreferrer"
                title="Open Payment Page"
                class="bg-transparent p-1 border-none !absolute w-8 h-8 top-0.5 right-1 rounded-md"
                v-ripple
              >
                <IconOpenInNew class="text-primary w-5 h-5" />
              </a>
            </div>
          </div>

          <div class="max-w-lg">
            <h3 class="font-medium">
              Current Balance{{ balsDisplay.length == 1 ? '' : 's' }}
            </h3>
            <small class="text-xs text-gray-500 block mb-4"
              >We charge 2% on every withdrawal.</small
            >
            <div v-if="isWithdrawing" class="py-12 max-w-lg">
              <p class="text-center text-lg mb-4">Withdrawing ...</p>
              <IconSpinner height="96" width="96" class="mx-auto mb-8" />
            </div>
            <p v-else-if="balsDisplay.length == 0" class="mb-12">
              You have no balances yet. To withdraw, share your payable's link
              and receive payments.
            </p>
            <div
              v-else-if="balsDisplay.length == 1"
              class="mb-12 flex items-end"
            >
              <p class="text-4xl mr-6">
                {{ balsDisplay[0].display(payable.chain) }}
              </p>
              <Button
                @click="withdraw(balsDisplay[0])"
                class="text-sm px-3 py-1"
                >Withdraw</Button
              >
            </div>
            <div
              v-else
              class="grid grid-cols-2 gap-6 sm:flex pb-12 flex-wrap content-start"
            >
              <div
                v-for="taa of balsDisplay"
                class="p-4 md:w-36 lg:w-44 bg-primary bg-opacity-10 dark:bg-opacity-5 text-center rounded-md shadow-inner"
              >
                <p class="font-bold text-lg mb-3">
                  {{ taa.display(payable.chain) }}
                </p>
                <Button
                  class="bg-transparent text-primary text-sm px-3 py-1"
                  @click="withdraw(taa)"
                  >Withdraw</Button
                >
              </div>
            </div>
          </div>
        </div>

        <div class="max-w-lg sm:w-1/2">
          <h3 class="font-medium mb-2 sm:text-right">Description</h3>
          <textarea
            readonly
            v-model="payable.description"
            description
            class="outline-none w-full px-3 py-2 bg-primary bg-opacity-10 dark:bg-opacity-5 rounded-md shadow-inner mb-1 min-h-20 max-h-40"
          ></textarea>
          <Button
            class="bg-transparent text-primary text-sm px-3 py-1 block ml-auto"
            float-button
            @click="comingSoon"
            >Update
          </Button>
        </div>
      </div>

      <div class="mb-8 sm:flex justify-between items-center">
        <h2 class="text-3xl font-bold max-sm:mb-6">Payable Activity</h2>

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

      <template v-if="isLoadingActivities"><TableLoader /></template>

      <template v-else-if="!transactions">
        <p class="pt-8 mb-6 text-center text-xl">Something went wrong</p>
        <p class="mx-auto w-fit">
          <Button class="text-xl px-6 py-2" @click="getTransactions"
            >Retry</Button
          >
        </p>
      </template>

      <template v-else-if="transactions.length == 0">
        <p class="text-lg text-center max-w-sm mx-auto mb-8 pt-8">
          <!--TODO: Update this empty state -->
          No {{ activeCat == 0 ? 'Payments' : 'Withdrawals' }} Yet!
        </p>
      </template>

      <template v-else>
        <TransactionsTable
          countField="payableCount"
          :currentPage="currentTablePage"
          :hidePayable="true"
          :hideUser="activeCat == 1"
          :receipts="transactions"
          :totalCount="totalActivitiesCount"
          @updateTablePage="updateTablePage"
        />
      </template>
    </template>
  </section>
</template>
