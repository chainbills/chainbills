<script setup lang="ts">
import ConnectWalletButton from '@/components/SignInButton.vue';
import IconSpinner from '@/icons/IconSpinner.vue';
import { Payable } from '@/schemas/payable';
import { usePayableStore } from '@/stores/payable';
import { useTimeStore } from '@/stores/time';
import { useWalletStore } from '@/stores/wallet';
import Button from 'primevue/button';
import { onMounted, ref, watch } from 'vue';

const isLoading = ref(false);
const mines = ref<Payable[] | null>();
const payable = usePayableStore();
const time = useTimeStore();
const wallet = useWalletStore();
const getMines = async () => {
  isLoading.value = true;
  mines.value = await payable.mines();
  isLoading.value = false;
};
onMounted(() => {
  console.log('before')
  if (wallet.connected) getMines().then(() => {});
  console.log('after')
  watch(
    () => wallet.connected,
    async (connected) => {
      if (connected) await getMines();
      else mines.value = null;
    }
  );
});
</script>

<template>
  <section class="max-w-screen-lg mx-auto pb-20">
    <div class="mb-8 flex justify-between items-center">
      <h2 class="text-3xl font-bold">Your Payables</h2>
      <router-link to="/start">
        <Button class="bg-blue-500 text-white dark:text-black px-4 py-1"
          >Create</Button
        >
      </router-link>
    </div>

    <template v-if="!wallet.connected">
      <p class="pt-8 mb-8 text-center text-xl">
        Please connect your wallet to continue
      </p>
      <p class="mx-auto w-fit"><ConnectWalletButton /></p>
    </template>

    <template v-else-if="isLoading">
      <p class="text-center my-12">Loading ...</p>
      <IconSpinner height="144" width="144" class="mb-12 mx-auto" />
    </template>

    <template v-else-if="!mines">
      <p class="pt-8 mb-6 text-center text-xl">Something went wrong</p>
      <p class="mx-auto w-fit">
        <Button
          class="bg-blue-500 text-white dark:text-black text-xl px-6 py-2"
          @click="getMines"
          >Retry</Button
        >
      </p>
    </template>

    <template v-else-if="mines.length == 0">
      <p class="text-lg text-center max-w-sm mx-auto mb-4 pt-8">
        You haven't created any payables.
      </p>
      <p class="text-lg text-center max-w-md mx-auto mb-8">
        Get Started with us today by Creating a Payable today.
      </p>
      <p class="text-center">
        <router-link to="/start">
          <Button class="bg-blue-500 text-white dark:text-black px-3 py-2"
            >Get Started</Button
          >
        </router-link>
      </p>
    </template>

    <template v-else>
      <div class="sm:grid sm:grid-cols-2 md:grid-cols-3 gap-6">
        <router-link
          v-for="{
            id,
            hostCount,
            paymentsCount,
            chain,
            balances,
            createdAt,
            isClosed,
          } of mines"
          :to="`/payable/${id}`"
          class="block w-full max-w-sm mx-auto mb-8 sm:mx-0 sm:mb-0"
        >
          <Button
            class="p-6 mx-auto block w-full bg-blue-100 dark:bg-slate-900 rounded-md shadow-inner shadow"
          >
            <p class="text-xs text-left text-gray-500 mb-1">#{{ hostCount }}</p>
            <p class="text-left mb-1">
              <span class="font-bold">Created: </span>
              <span>{{ time.display(createdAt) }}</span>
            </p>
            <p class="text-left mb-1">
              <span class="font-bold">Closed? </span>
              <span>{{ isClosed ? 'Yes' : 'No' }}</span>
            </p>
            <p class="text-left mb-1">
              <span class="font-bold">{{
                paymentsCount == 0 ? 'No' : paymentsCount
              }}</span>
              <span> Payment{{ paymentsCount == 1 ? '' : 's' }}</span>
            </p>
            <p class="text-left font-bold mb-1" v-if="balances.length > 0">
              Balance{{ balances.length == 1 ? '' : 's' }}
            </p>
            <div class="flex gap-2 flex-wrap mb-4">
              <p
                v-for="bal of balances"
                class="px-2 py-1 shadow rounded"
                style="background-color: var(--app-bg)"
              >
                {{ bal.display(chain) }}
              </p>
            </div>
            <span
              class="bg-blue-500 text-white dark:text-black text-sm px-3 py-1 rounded"
            >
              Withdraw
            </span>
          </Button>
        </router-link>
        <div></div>
      </div>
    </template>
  </section>
</template>
