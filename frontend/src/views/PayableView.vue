<script setup lang="ts">
import ConnectWalletButton from '@/components/SignInButton.vue';
import IconSpinner from '@/icons/IconSpinner.vue';
import { Payable } from '@/schemas/payable';
import { TokenAndAmount } from '@/schemas/tokens-and-amounts';
import { useChainStore, usePayableStore } from '@/stores';
import { useAppLoadingStore } from '@/stores/app-loading';
import { useTimeStore } from '@/stores/time';
import { denormalizeBytes, useWalletStore } from '@/stores/wallet';
import { useWithdrawalStore } from '@/stores/withdrawal';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const appLoading = useAppLoadingStore();
const chain = useChainStore();
const route = useRoute();
const payable = ref(route.meta.details as Payable);
const time = useTimeStore();
const toast = useToast();
const { origin } = window.location;
const link = `${origin}/pay/${payable.value.id}`;
const payableStore = usePayableStore();
const wallet = useWalletStore();
const { whAddress } = storeToRefs(wallet);
const withdrawal = useWithdrawalStore();

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
  whAddress.value
    ? denormalizeBytes(whAddress.value, chain.current!) == payable.value.host
    : false
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
    const result = await withdrawal.exec(payable.value.id, balance);
    if (result) {
      const newPayable = await payableStore.get(payable.value.id);
      if (newPayable) {
        payable.value = newPayable;
        balsDisplay.value = getBalsDisplay();
        cards.value = getCards();
        isWithdrawing.value = false;
        // reloading the page if updates failed to ensure we don't have
        // stale data in the UI
      } else window.location.reload();
    } else isWithdrawing.value = false;
  }
};

onMounted(() => {
  watch(
    () => whAddress.value,
    (val) => {
      isMine.value = val
        ? denormalizeBytes(val, chain.current!) == payable.value.host
        : false;
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
      <p class="mx-auto w-fit"><ConnectWalletButton /></p>
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
