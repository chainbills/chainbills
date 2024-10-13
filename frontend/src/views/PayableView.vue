<script setup lang="ts">
import SignInButton from '@/components/SignInButton.vue';
import TransactionsTable from '@/components/TransactionsTable.vue';
import IconSpinner from '@/icons/IconSpinner.vue';
import { Payable, type Receipt, TokenAndAmount } from '@/schemas';
import {
  usePaginatorsStore,
  usePayableStore,
  usePaymentStore,
  useTimeStore,
  useWalletStore,
  useWithdrawalStore,
} from '@/stores';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import TabPanel from 'primevue/tabpanel';
import TabView from 'primevue/tabview';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const activeCat = ref(0);
const categories = ['Payments', 'Withdrawals'];
const currentTablePage = ref(0);
const isLoadingActivities = ref(true);
const transactions = ref<Receipt[] | null>(null);
const paginators = usePaginatorsStore();
const route = useRoute();
const payable = ref(route.meta.details as Payable);
const time = useTimeStore();
const toast = useToast();
const { origin } = window.location;
const link = `${origin}/pay/${payable.value.id}`;
const payments = usePaymentStore();
const payableStore = usePayableStore();
const wallet = useWalletStore();
const { address } = storeToRefs(wallet);
const withdrawals = useWithdrawalStore();

const totalActivitiesCount = computed(() => {
  return activeCat.value == 0
    ? payable.value.paymentsCount
    : payable.value.withdrawalsCount;
});

const nth = (n: number) => {
  if (n > 3 && n < 21) return 'th';
  const rem = n % 10;
  if (rem == 1) return 'st';
  else if (rem == 2) return 'nd';
  else if (rem == 3) return 'rd';
  else return 'th';
};

const getCards = () => {
  const {
    paymentsCount,
    withdrawalsCount,
    createdAt,
    hostCount,
    isClosed,
    allowedTokensAndAmounts,
  } = payable.value;
  return [
    ['Payments Received', paymentsCount == 0 ? 'None' : paymentsCount],
    ['Withdrawals Made', withdrawalsCount == 0 ? 'None' : withdrawalsCount],
    ['Free Payments?', allowedTokensAndAmounts.length == 0 ? 'Yes' : 'No'],
    ['Created At', time.display(createdAt)],
    ['Your Nth Count', hostCount + nth(hostCount)],
    ['Closed?', isClosed ? 'Yes' : 'No'],
  ];
};
const cards = ref(getCards());
const isMine = ref(
  (payable.value.chain == 'Ethereum Sepolia'
    ? address.value?.toLowerCase()
    : address.value) == payable.value.host
);

const copy = () => {
  toast.add({
    severity: 'info',
    summary: 'Copied Link!',
    detail: 'Link successfully copied to clipboard',
    life: 5000,
  });
  navigator.clipboard.writeText(link);
};

const comingSoon = () => {
  toast.add({ severity: 'info', summary: 'Coming Soon!', life: 5000 });
};

const getBalsDisplay = () => {
  const all: TokenAndAmount[] = [];
  const { allowedTokensAndAmounts, balances } = payable.value;
  if (allowedTokensAndAmounts.length == 0) {
    balances.forEach((b) => all.push(b));
  } else {
    const copied = [...balances];
    for (let taa of allowedTokensAndAmounts) {
      const found = balances.find((b) => b.name == taa.name);
      all.push(new TokenAndAmount(taa.token(), found?.amount ?? 0));
      if (found) copied.splice(copied.indexOf(found), 1);
    }
    for (let bal of copied) all.push(bal);
  }
  return all;
};
const balsDisplay = ref(getBalsDisplay());
const isWithdrawing = ref(false);

const getTransactions = async () => {
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
  currentTablePage.value = paginators.getLastPage(
    payable.value[activeCat.value == 0 ? 'paymentsCount' : 'withdrawalsCount']
  );
};

const updateTablePage = (page: number) => {
  if (currentTablePage.value == page) return;
  currentTablePage.value = page;
  getTransactions();
};

const withdraw = async (balance: TokenAndAmount) => {
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
        balsDisplay.value = getBalsDisplay();
        cards.value = getCards();
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

onMounted(() => {
  watch(
    () => wallet.address,
    (val) =>
      (isMine.value =
        (payable.value.chain == 'Ethereum Sepolia'
          ? val?.toLowerCase()
          : val) == payable.value.host)
  );
  resetTablePage();
  getTransactions();
  watch(
    () => activeCat.value,
    (_) => {
      resetTablePage();
      getTransactions();
    }
  );
  watch(
    () => payable.value,
    (_) => {
      // only refresh transactions if a withdrawal was just completed
      if (activeCat.value == 1) getTransactions();
    }
  );
});
</script>

<template>
  <section class="max-w-screen-lg mx-auto pb-20">
    <template v-if="!wallet.connected">
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
          <Button class="border border-blue-500 text-blue-500 px-3 py-2 mr-6"
            >Go Home</Button
          >
        </router-link>
        <router-link to="/start">
          <Button class="-mt-1 bg-blue-500 text-white dark:text-black px-3 py-2"
            >Get Started</Button
          >
        </router-link>
      </p>
    </template>

    <template v-else>
      <h2 class="mb-8 leading-tight">
        <span>Payable ID:</span><br />
        <span class="text-xs break-all text-gray-500">{{ payable.id }}</span>
      </h2>

      <div class="max-w-lg mb-12">
        <h3 class="font-medium mb-2">Share your Link</h3>
        <div class="sm:flex items-end">
          <p
            class="p-4 rounded bg-blue-50 dark:bg-slate-900 underline break-all mb-3 sm:mb-0"
          >
            <router-link :to="`/pay/${payable.id}`">
              {{ link }}
            </router-link>
          </p>
          <Button
            @click="copy"
            class="sm:ml-4 px-3 py-1 border border-blue-500 text-blue-500 text-center"
            float-button
            >Copy</Button
          >
        </div>
      </div>

      <h2 class="text-3xl mb-4 font-bold">
        Your Balance{{ balsDisplay.length == 1 ? '' : 's' }}
      </h2>
      <small class="text-xs text-gray-500 block mb-4"
        >We charge 2% on every withdrawal.</small
      >
      <div v-if="isWithdrawing" class="py-12 max-w-lg">
        <p class="text-center text-lg mb-4">Withdrawing ...</p>
        <IconSpinner height="96" width="96" class="mx-auto mb-8" />
      </div>
      <p v-else-if="balsDisplay.length == 0" class="mb-12">
        You have no balances yet. To withdraw, share your payable's link and
        receive payments.
      </p>
      <div v-else-if="balsDisplay.length == 1" class="mb-12 flex items-end">
        <p class="text-4xl mr-6">
          {{ balsDisplay[0].display(payable.chain) }}
        </p>
        <Button
          @click="withdraw(balsDisplay[0])"
          class="bg-blue-500 text-white dark:text-white text-sm px-3 py-1"
          >Withdraw</Button
        >
      </div>
      <div
        v-else
        class="grid grid-cols-2 gap-6 sm:flex pb-12 flex-wrap content-start"
      >
        <div
          v-for="taa of balsDisplay"
          class="p-4 bg-blue-50 sm:w-44 dark:bg-slate-900 text-center rounded-md shadow-inner"
        >
          <p class="font-bold text-lg mb-3">
            {{ taa.display(payable.chain) }}
          </p>
          <Button
            class="border border-blue-500 text-blue-500 text-sm px-3 py-1"
            @click="withdraw(taa)"
            >Withdraw</Button
          >
        </div>
      </div>

      <h2 class="text-3xl mb-4 font-bold">Payable's Details</h2>

      <div class="max-w-lg">
        <h3 class="font-medium mb-2">Description</h3>
        <div class="mb-8 sm:flex items-end">
          <textarea
            readonly
            v-model="payable.description"
            class="outline-none w-full px-3 py-2 bg-blue-50 dark:bg-slate-900 rounded-md shadow-inner mb-2 sm:mb-0 sm:mr-4"
          ></textarea>
          <Button
            class="border border-blue-500 text-blue-500 text-sm px-3 py-1"
            float-button
            @click="comingSoon"
            >Update</Button
          >
        </div>
      </div>

      <h3 class="font-medium mb-3">Infos</h3>
      <div class="grid grid-cols-2 gap-6 sm:flex pb-8 flex-wrap content-start">
        <div
          v-for="card of cards"
          class="px-4 py-3 bg-blue-50 sm:w-44 dark:bg-slate-900 text-center rounded-md shadow-inner"
        >
          <p class="text-sm text-gray-500">{{ card[0] }}</p>
          <p class="font-bold text-lg">{{ card[1] }}</p>
        </div>
      </div>

      <h3 class="font-medium mb-2">Sensitive</h3>
      <p class="mb-2 text-xs">Stop receiving payments?</p>
      <Button
        @click="comingSoon"
        class="px-3 py-1 border border-red-500 text-sm text-red-500 text-center"
        >Close Payable</Button
      >

      <div class="mt-12 mb-8 sm:flex justify-between items-center">
        <h2 class="text-3xl font-bold">Payable Activity</h2>

        <div class="max-sm:flex justify-end">
          <TabView :scrollable="true" v-model:activeIndex="activeCat">
            <TabPanel v-for="(category, index) of categories">
              <template #header>
                <Button @click="activeCat = index">{{ category }}</Button>
              </template>
            </TabPanel>
          </TabView>
        </div>
      </div>

      <template v-if="isLoadingActivities">
        <p class="text-center my-12">Loading ...</p>
        <IconSpinner height="144" width="144" class="mb-12 mx-auto" />
      </template>

      <template v-else-if="!transactions">
        <p class="pt-8 mb-6 text-center text-xl">Something went wrong</p>
        <p class="mx-auto w-fit">
          <Button
            class="bg-primary text-white dark:text-black text-xl px-6 py-2"
            @click="getTransactions"
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
          :hidePayable="true"
          :currentPage="currentTablePage"
          :receipts="transactions"
          :totalCount="totalActivitiesCount"
          @updateTablePage="updateTablePage"
        />
      </template>
    </template>
  </section>
</template>

<style scoped>
@media (min-width: 640px) {
  [float-button] {
    width: 5.5rem;
  }
}
</style>
