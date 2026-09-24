<script setup lang="ts">
import PayableDetailLoader from '@/components/PayableDetailLoader.vue';
import SignInButton from '@/components/SignInButton.vue';
import TableLoader from '@/components/TableLoader.vue';
import TransactionsTable from '@/components/TransactionsTable.vue';
import WithdrawDialog from '@/components/tx/WithdrawDialog.vue';
import IconCopy from '@/icons/IconCopy.vue';
import IconForward from '@/icons/IconForward.vue';
import IconOpenInNew from '@/icons/IconOpenInNew.vue';
import { Payable, type Receipt, TokenAndAmount } from '@/schemas';
import {
  useAnalyticsStore,
  useAuthStore,
  usePaginatorsStore,
  usePayableStore,
  usePaymentStore,
  useThemeStore,
  useWithdrawalStore,
} from '@/stores';
import NotFoundView from '@/views/NotFoundView.vue';
import Button from 'primevue/button';
import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import Tabs from 'primevue/tabs';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const payable = ref<Payable | null>(null);
const route = useRoute();

let skipWatcherNextUpdate = false;

const fetchPayable = async (ignoreErrors: boolean, showLoading = true) => {
  if (!route.params.id) return;
  isLoading.value = showLoading;

  // Capture old counts before fetching
  const prevPaymentsCount = payable.value?.paymentsCount ?? 0;
  const prevWithdrawalsCount = payable.value?.withdrawalsCount ?? 0;

  const fetched = await payableStore.get(route.params.id as string, ignoreErrors);
  if (fetched) {
    // Compare active-tab count
    const activeTabCountChanged =
      activeCat.value === 0
        ? fetched.paymentsCount !== prevPaymentsCount
        : fetched.withdrawalsCount !== prevWithdrawalsCount;

    if (activeTabCountChanged) {
      // Only trigger watcher if on last page
      const isOnLastPage =
        currentTablePage.value ===
        paginators.getLastPage(activeCat.value === 0 ? prevPaymentsCount : prevWithdrawalsCount);
      if (!isOnLastPage) {
        // Count changed but not on last page, skip loader
        skipWatcherNextUpdate = true;
      } else {
        currentTablePage.value = paginators.getLastPage(
          activeCat.value === 0 ? fetched.paymentsCount : fetched.withdrawalsCount
        );
      }
      // Otherwise: count changed AND on last page, let watcher fire normally (reload activities)
    } else {
      // Count didn't change, skip watcher entirely to prevent activity table reload
      skipWatcherNextUpdate = true;
    }

    payable.value = fetched;
  }
  isLoading.value = false;
};

const lsCatKey = () => (payable.value && `chainbills::payable=>${payable.value.id}::activity_table_category`) ?? '';
const lsPaymentsPageKey = () => (payable.value && `chainbills::payable=>${payable.value.id}::payments_page`) ?? '';
const lsWithdrawalsPageKey = () =>
  (payable.value && `chainbills::payable=>${payable.value.id}::withdrawals_page`) ?? '';
const lsPageKey = () => (activeCat.value === 0 ? lsPaymentsPageKey() : lsWithdrawalsPageKey());

const activeCat = ref(0);
const analytics = useAnalyticsStore();
const auth = useAuthStore();
const categories = ['Payments', 'Withdrawals'];
const currentTablePage = ref(0);
const isLoading = ref(true);
const isLoadingActivities = ref(true);
const transactions = ref<Receipt[] | null>(null);
const paginators = usePaginatorsStore();
const theme = useThemeStore();
const toast = useToast();
const { origin } = window.location;
const link = computed(() => (payable.value && `${origin}/pay/${payable.value.id}`) ?? '');
const payments = usePaymentStore();
const payableStore = usePayableStore();
const router = useRouter();
const withdrawals = useWithdrawalStore();

const totalActivitiesCount = computed(() => {
  if (!payable.value) return 0;
  return activeCat.value == 0 ? payable.value.paymentsCount : payable.value.withdrawalsCount;
});

const isMine = computed(() => auth.currentUser?.walletAddress == (payable.value?.host ?? ''));

const copy = () => {
  toast.add({
    severity: 'info',
    summary: 'Copied Link!',
    detail: 'Link successfully copied to clipboard',
    life: 5000,
  });
  navigator.clipboard.writeText(link.value ?? '');
  analytics.recordEvent(`copied_payment_link`, {
    from: 'payable_detail_page',
  });
};

const comingSoon = () => {
  toast.add({ severity: 'info', summary: 'Coming Soon!', life: 5000 });
  analytics.recordEvent('clicked_coming_soon_feature');
};

const balsDisplay = computed(() => (payable.value && payable.value.getBalsDisplay()) ?? []);
const showWithdrawModal = ref(false);
const selectedBalance = ref<TokenAndAmount | null>(null);

const openWithdrawModal = (balance: TokenAndAmount) => {
  selectedBalance.value = balance;
  showWithdrawModal.value = true;
};

const getTransactions = async () => {
  if (!payable.value) return;
  isLoadingActivities.value = true;
  transactions.value = await (activeCat.value == 0 ? payments : withdrawals).getManyForPayable(
    payable.value,
    currentTablePage.value,
    paginators.rowsPerPage
  );
  isLoadingActivities.value = false;
};

const resetTablePage = () => {
  if (!payable.value) return;
  activeCat.value = +(localStorage.getItem(lsCatKey()) ?? '0');
  const finalPage = paginators.getLastPage(payable.value[activeCat.value == 0 ? 'paymentsCount' : 'withdrawalsCount']);
  const lastSavedPage = +(localStorage.getItem(lsPageKey()) ?? '0');
  if (lastSavedPage < 0 || lastSavedPage > finalPage || !Number.isInteger(lastSavedPage)) {
    currentTablePage.value = finalPage;
  } else {
    currentTablePage.value = lastSavedPage;
  }
};

const shorten = (v: string) => `${v.substring(0, 5)}...${v.substring(v.length - 5)}`;

const updateTablePage = (page: number) => {
  if (!payable.value) return;
  currentTablePage.value = page;
  localStorage.setItem(lsPageKey()!, page.toString());
  getTransactions();
};

/** Refreshes the payable's balances once `WithdrawDialog` reports a successful withdrawal. */
const onWithdrawn = async () => {
  if (!payable.value) return;
  const newPayable = await payableStore.get(payable.value.id);
  if (newPayable) payable.value = newPayable;
  else window.location.reload();
};

/** Silently refreshes the payable whenever the tab regains focus — named so it can be removed on unmount. */
const onWindowFocus = async () => await fetchPayable(true, false);

onUnmounted(() => window.removeEventListener('focus', onWindowFocus));

onMounted(async () => {
  await fetchPayable(true);

  resetTablePage();
  await getTransactions();

  window.addEventListener('focus', onWindowFocus);

  watch([() => auth.currentUser?.walletAddress, () => activeCat.value], (newVals, oldVals) => {
    if (!payable.value) return;
    if (newVals[1] !== oldVals[1] || newVals[0] !== oldVals[0]) {
      if (newVals[1] !== oldVals[1]) {
        localStorage.setItem(lsCatKey()!, activeCat.value.toString());
      }
      resetTablePage();
      getTransactions();
    }
  });
  watch(
    () => activeCat.value,
    (_) => {
      analytics.recordEvent('changed_payable_activity_category', {
        payable_id: payable.value?.id,
        category: activeCat.value == 0 ? 'payments' : 'withdrawals',
      });
    }
  );
  watch(
    () => auth.currentUser?.chain.name,
    (newName, oldName) => {
      if (oldName && newName && oldName !== newName) {
        router.push('/dashboard');
      }
    }
  );

  watch(
    () => payable.value,
    async () => {
      if (skipWatcherNextUpdate) {
        skipWatcherNextUpdate = false;
        return;
      }
      await getTransactions();
    }
  );
});
</script>

<template>
  <PayableDetailLoader v-if="isLoading" />

  <NotFoundView v-else-if="!payable" />

  <section class="max-w-screen-xl mx-auto pb-20" v-else>
    <template v-if="!auth.currentUser">
      <p class="my-12 text-center text-xl">Please connect your wallet to continue</p>
      <p class="mx-auto w-fit">
        <SignInButton
          @click="
            analytics.recordEvent('clicked_signin', {
              from: 'payable_detail_page',
            })
          "
        />
      </p>
    </template>

    <template class="" v-else-if="!isMine">
      <h2 class="text-3xl text-center mb-8 pt-8 font-bold">Unauthorized</h2>
      <p class="text-lg text-center max-w-sm mx-auto mb-4">You don't have permissions to view this page.</p>
      <p class="text-lg text-center max-w-md mx-auto mb-8">
        You can navigate to the Home page or Get Started with us today by Creating a Payable.
      </p>
      <p class="text-center">
        <router-link
          to="/"
          @click="
            analytics.recordEvent('clicked_go_home', {
              from: 'payable_detail_page',
              unauthorized: true,
            })
          "
        >
          <Button class="bg-transparent text-primary px-3 py-2 mr-6">Go Home</Button>
        </router-link>
        <router-link
          to="/start"
          @click="
            analytics.recordEvent('clicked_get_started', {
              from: 'payable_detail_page',
              unauthorized: true,
            })
          "
        >
          <Button class="-mt-1 px-3 py-2">Get Started</Button>
        </router-link>
      </p>
    </template>

    <template v-else>
      <div class="sm:flex items-start mb-8">
        <h2 class="sm:grow max-sm:mb-8 leading-tight flex gap-x-2 items-center">
          <router-link
            to="/dashboard"
            class="text-lg sm:text-xl font-bold text-gray-500 hover:underline flex gap-x-2 items-center"
            @click="analytics.recordEvent('clicked_payables', { from: 'payable_detail_page' })"
          >
            <span>Payables</span>
            <IconForward class="w-3 h-3 mt-px sm:w-4 sm:h-4 sm:mt-[2px] text-gray-500 inline-block" />
          </router-link>
          <span class="text-xl sm:text-2xl font-bold break-all">{{ shorten(payable.id) }}</span>
        </h2>

        <Button
          class="px-4 py-1 max-sm:ml-auto max-sm:block"
          @click="
            fetchPayable(false);
            analytics.recordEvent('clicked_refresh_payable');
          "
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
              <p class="line-clamp-1 whitespace-pre overflow-ellipsis text-sm opacity-80">
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
            <h3 class="font-medium">Current Balance{{ balsDisplay.length == 1 ? '' : 's' }}</h3>
            <small class="text-xs text-gray-500 block mb-4">We charge 2% on every withdrawal.</small>
            <p v-if="balsDisplay.length == 0" class="mb-12">
              You have no balances yet. To withdraw, share your payable's link and receive payments.
            </p>
            <div v-else-if="balsDisplay.length == 1" class="mb-12 flex items-end">
              <p class="text-4xl mr-6">
                {{ balsDisplay[0].display(payable.chain) }}
              </p>
              <Button @click="openWithdrawModal(balsDisplay[0])" class="text-sm px-3 py-1">Withdraw</Button>
            </div>
            <div v-else class="grid grid-cols-2 gap-6 sm:flex pb-12 flex-wrap content-start">
              <div
                v-for="taa of balsDisplay"
                class="p-4 md:w-36 lg:w-44 bg-primary bg-opacity-10 dark:bg-opacity-5 text-center rounded-md shadow-inner"
              >
                <p class="font-bold text-lg mb-3">
                  {{ taa.display(payable.chain) }}
                </p>
                <Button class="bg-transparent text-primary text-sm px-3 py-1" @click="openWithdrawModal(taa)"
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
          <Button class="bg-transparent text-primary text-sm px-3 py-1 block ml-auto" float-button @click="comingSoon"
            >Update
          </Button>
        </div>
      </div>

      <div class="mb-8 sm:flex justify-between items-center">
        <h2 class="text-3xl font-bold max-sm:mb-6">Payable Activity</h2>

        <div class="max-sm:flex justify-end">
          <Tabs v-model:value="activeCat">
            <TabList>
              <Tab v-for="(category, i) of categories" :value="i">{{ category }}</Tab>
            </TabList>
          </Tabs>
        </div>
      </div>

      <template v-if="isLoadingActivities"><TableLoader /></template>

      <template v-else-if="!transactions">
        <p class="pt-8 mb-6 text-center text-xl">Something went wrong</p>
        <p class="mx-auto w-fit">
          <Button
            class="text-xl px-6 py-2"
            @click="
              getTransactions();
              analytics.recordEvent('clicked_retry_get_transactions', {
                from: 'payable_detail_page',
              });
            "
            >Retry</Button
          >
        </p>
      </template>

      <template v-else-if="transactions.length == 0">
        <div class="text-center pt-12">
          <img
            :src="`/assets/chainbills-${theme.isDisplayDark ? 'dark' : 'light'}.png`"
            alt="Chainbills"
            class="w-20 h-20 mx-auto mb-4 opacity-40"
          />
          <p class="text-lg font-semibold mb-2">
            {{ activeCat == 0 ? 'No payments received yet' : 'No withdrawals yet' }}
          </p>
          <p class="text-gray-600 dark:text-gray-400 max-w-sm mx-auto mb-6">
            {{
              activeCat == 0
                ? 'Share your payment link above to start receiving payments.'
                : 'When you withdraw from your balance, the records will appear here.'
            }}
          </p>
        </div>
      </template>

      <template v-else>
        <TransactionsTable
          :chainColumn="activeCat === 0 ? 'user' : undefined"
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

  <WithdrawDialog
    v-if="selectedBalance && payable"
    v-model:visible="showWithdrawModal"
    :payable="payable"
    :balance="selectedBalance"
    @withdrawn="onWithdrawn"
  />
</template>
