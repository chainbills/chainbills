<script setup lang="ts">
import ConnectWalletButton from '@/components/ConnectWalletButton.vue';
import { Payable } from '@/schemas/payable';
import { useTimeStore } from '@/stores/time';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { useAnchorWallet } from 'solana-wallets-vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const details = route.meta.details as Payable;
const time = useTimeStore();
const toast = useToast();
const { origin } = window.location;
const link = `${origin}/pay/${details.address}`;
const wallet = useAnchorWallet();

const {
  paymentsCount,
  withdrawalsCount,
  allowsFreePayments,
  createdAt,
  hostCount,
  isClosed,
  tokensAndAmounts,
  balances,
} = details;

const nth = (n: number) => {
  if (n > 3 && n < 21) return 'th';
  const rem = n % 10;
  if (rem == 1) return 'st';
  else if (rem == 2) return 'nd';
  else if (rem == 3) return 'rd';
  else return 'th';
};

const cards = [
  ['Payments Received', paymentsCount == 0 ? 'None' : paymentsCount],
  ['Withdrawals Made', withdrawalsCount == 0 ? 'None' : withdrawalsCount],
  ['Free Payments?', allowsFreePayments ? 'Yes' : 'No'],
  ['Created At', time.display(createdAt)],
  ['Your Nth Count', hostCount + nth(hostCount)],
  ['Closed?', isClosed ? 'Yes' : 'No'],
];

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
  const all = [];
  if (allowsFreePayments) {
    for (let bal of balances) all.push(`${bal.amount} ${bal.name}`);
  } else {
    for (let taa of tokensAndAmounts) {
      const found = balances.find((b) => b.address == taa.address);
      all.push(`${found ? found.amount : '0'} ${taa.name}`);
    }
  }
  return all;
};
const balsDisplay = getBalsDisplay();
</script>

<template>
  <section class="max-w-screen-lg mx-auto pb-20">
    <template v-if="!wallet">
      <p class="my-12 text-center text-xl">
        Please connect your wallet to continue
      </p>
      <p class="mx-auto w-fit"><ConnectWalletButton /></p>
    </template>

    <template
      class=""
      v-else-if="wallet.publicKey.toBase58() != details.hostWallet"
    >
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
        <span class="text-xs break-all text-gray-500">{{
          details.address
        }}</span>
      </h2>

      <div class="max-w-lg mb-12">
        <h3 class="font-medium mb-2">Share your Link</h3>
        <div class="sm:flex items-end">
          <p
            class="p-4 rounded bg-blue-50 dark:bg-slate-900 underline break-all mb-3 sm:mb-0"
          >
            <router-link :to="`/pay/${details.address}`">
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
      <p v-if="balsDisplay.length == 0" class="mb-12">
        You have no balances yet. To withdraw, share your payable's link and
        receive payments.
      </p>
      <div v-else-if="balsDisplay.length == 1" class="mb-12 flex items-end">
        <p class="text-4xl mr-6">
          {{ balsDisplay[0] }}
        </p>
        <Button class="bg-blue-500 text-white dark:text-white text-sm px-3 py-1"
          >Withdraw</Button
        >
      </div>
      <div
        v-else
        class="grid grid-cols-2 gap-6 sm:flex pb-12 flex-wrap content-start"
      >
        <div
          v-for="bal of balsDisplay"
          class="p-4 bg-blue-50 sm:w-44 dark:bg-slate-900 text-center rounded-md shadow-inner"
        >
          <p class="font-bold text-lg mb-3">{{ bal }}</p>
          <Button class="border border-blue-500 text-blue-500 text-sm px-3 py-1"
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
            v-model="details.description"
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
