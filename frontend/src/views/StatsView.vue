<script setup lang="ts">
import IconSpinner from '@/icons/IconSpinner.vue';
import { ChainStats } from '@/schemas/chain-stats';
import { useCosmwasmStore, useServerStore } from '@/stores';
import Button from 'primevue/button';
import { onMounted, ref } from 'vue';

const cosmwasm = useCosmwasmStore();
const isLoading = ref(true);
const server = useServerStore();
const stats = ref<ChainStats | null>(null);
const volumes = ref<any>(null);

const fetchStats = async () => {
  isLoading.value = true;
  stats.value = await cosmwasm.chainStats();
  volumes.value = await server.volumes();
  isLoading.value = false;
};

const getCards = (stats: ChainStats, volumes: any) => {
  const { usersCount, payablesCount, paymentsCount, withdrawalsCount } = stats;
  return [
    ['Users', usersCount],
    ['Payables', payablesCount],
    ['Payments', paymentsCount],
    ['Withdrawals', withdrawalsCount],
    ...('Burnt Xion' in volumes
      ? Object.entries(volumes['Burnt Xion']).map(([token, amount]) => [
          token,
          Math.trunc((amount as number) * 100) / 100,
        ])
      : []),
  ];
};

onMounted(() => {
  fetchStats();
});
</script>

<template>
  <section class="max-w-screen-xl mx-auto">
    <div class="mb-8 flex justify-between items-center">
      <h2 class="text-3xl font-bold">Burnt Xion Stats</h2>
      <Button class="px-4 py-1" @click="fetchStats">Refresh</Button>
    </div>

    <template v-if="isLoading">
      <p class="text-center my-12">Loading ...</p>
      <IconSpinner height="144" width="144" class="mb-12 mx-auto" />
    </template>

    <template v-else-if="!stats || !volumes">
      <p class="pt-8 mb-8 text-center text-xl">Something went wrong</p>
      <p class="mx-auto w-fit mb-40">
        <Button class="text-xl px-6 py-2" @click="fetchStats">Retry</Button>
      </p>
    </template>

    <template v-else>
      <div
        class="grid grid-cols-2 gap-6 sm:flex pb-8 mb-60 flex-wrap content-start"
      >
        <div
          v-for="card of getCards(stats, volumes)"
          class="px-4 py-3 bg-blue-50 sm:w-44 dark:bg-slate-900 text-center rounded-md shadow-inner"
        >
          <p class="text-sm text-gray-500">{{ card[0] }}</p>
          <p class="font-bold text-lg">{{ card[1] }}</p>
        </div>
      </div>
    </template>
  </section>
</template>
