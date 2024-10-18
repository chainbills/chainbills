<script setup lang="ts">
import IconSpinner from '@/icons/IconSpinner.vue';
import { ChainStats } from '@/schemas/chain-stats';
import { useCosmwasmStore } from '@/stores';
import Button from 'primevue/button';
import { onMounted, ref } from 'vue';

const cosmwasm = useCosmwasmStore();
const isLoading = ref(true);
const stats = ref<ChainStats | null>(null);

const fetchStats = async () => {
  isLoading.value = true;
  stats.value = await cosmwasm.chainStats();
  isLoading.value = false;
};

const getCards = (stats: ChainStats) => {
  const { usersCount, payablesCount, paymentsCount, withdrawalsCount } = stats;
  return [
    ['Users', usersCount],
    ['Payables', payablesCount],
    ['Payments', paymentsCount],
    ['Withdrawals', withdrawalsCount],
  ];
};

onMounted(() => {
  fetchStats();
});
</script>

<template>
  <div class="mb-8 flex justify-between items-center">
    <h2 class="text-3xl font-bold">Burnt Xion Stats</h2>
    <Button
      class="bg-primary text-white dark:text-black px-4 py-1"
      @click="fetchStats"
      >Refresh</Button
    >
  </div>

  <template v-if="isLoading">
    <p class="text-center my-12">Loading ...</p>
    <IconSpinner height="144" width="144" class="mb-12 mx-auto" />
  </template>

  <template v-else-if="!stats">
    <p class="pt-8 mb-8 text-center text-xl">Something went wrong</p>
    <p class="mx-auto w-fit mb-40">
      <Button
        class="bg-primary text-white dark:text-black text-xl px-6 py-2"
        @click="fetchStats"
        >Retry</Button
      >
    </p>
  </template>

  <template v-else>
    <div
      class="grid grid-cols-2 gap-6 sm:flex pb-8 mb-60 flex-wrap content-start"
    >
      <div
        v-for="card of getCards(stats)"
        class="px-4 py-3 bg-blue-50 sm:w-44 dark:bg-slate-900 text-center rounded-md shadow-inner"
      >
        <p class="text-sm text-gray-500">{{ card[0] }}</p>
        <p class="font-bold text-lg">{{ card[1] }}</p>
      </div>
    </div>
  </template>
</template>
