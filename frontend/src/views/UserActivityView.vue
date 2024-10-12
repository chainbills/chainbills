<script setup lang="ts">
import SignInButton from '@/components/SignInButton.vue';
import TransactionsTable from '@/components/TransactionsTable.vue';
import IconSpinner from '@/icons/IconSpinner.vue';
import { type Receipt } from '@/schemas';
import {
  usePaymentStore,
  useUserStore,
  useWalletStore,
  useWithdrawalStore,
} from '@/stores';
import Button from 'primevue/button';
import TabPanel from 'primevue/tabpanel';
import TabView from 'primevue/tabview';
import { onMounted, ref, watch } from 'vue';

const activeCat = ref(0);
const categories = ['Payments', 'Withdrawals'];
const countFields = ['payerCount', 'hostCount'];
const isLoading = ref(true);
const mines = ref<Receipt[] | null>(null);
const payments = usePaymentStore();
const user = useUserStore();
const wallet = useWalletStore();
const withdrawals = useWithdrawalStore();

const getMines = async () => {
  isLoading.value = true;
  mines.value = await (activeCat.value == 0 ? payments : withdrawals).mines();
  isLoading.value = false;
};

onMounted(async () => {
  if (user.current) await getMines();
  watch(
    () => user.current,
    async (currentUser) => {
      if (currentUser) await getMines();
      else mines.value = null;
    }
  );
  watch(
    () => activeCat.value,
    (_) => {
      if (!user.current) return;
      getMines();
    }
  );
});
</script>

<template>
  <div class="max-w-screen-xl mx-auto pb-20">
    <div class="mb-8 sm:flex justify-between items-center">
      <h2 class="text-3xl font-bold">Your Activity</h2>

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

    <template v-if="!wallet.connected">
      <p class="pt-8 mb-8 text-center text-xl">
        Please connect your wallet to continue
      </p>
      <p class="mx-auto w-fit"><SignInButton /></p>
    </template>

    <template v-else-if="isLoading">
      <p class="text-center my-12">Loading ...</p>
      <IconSpinner height="144" width="144" class="mb-12 mx-auto" />
    </template>

    <template v-else-if="!mines">
      <p class="pt-8 mb-6 text-center text-xl">Something went wrong</p>
      <p class="mx-auto w-fit">
        <Button
          class="bg-primary text-white dark:text-black text-xl px-6 py-2"
          @click="getMines"
          >Retry</Button
        >
      </p>
    </template>

    <template v-else-if="mines.length == 0">
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
          <Button class="bg-primary text-white dark:text-black px-3 py-2"
            >Get Started</Button
          >
        </router-link>
      </p>
    </template>

    <template v-else>
      <TransactionsTable
        :receipts="mines"
        :count-field="countFields[activeCat]"
      />
    </template>
  </div>
</template>
