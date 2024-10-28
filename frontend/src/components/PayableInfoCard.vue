<script setup lang="ts">
const { count, payableId } = defineProps(['count', 'payableId']);
import Shimmer from '@/components/Shimmer.vue';
import IconCopy from '@/icons/IconCopy.vue';
import IconForward from '@/icons/IconForward.vue';
import IconWallet from '@/icons/IconWallet.vue';
import { Payable } from '@/schemas';
import { usePayableStore, useTimeStore } from '@/stores';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const balsDisplay = computed(() => {
  if (!payable.value) return [];
  return payable.value.getBalsDisplay();
});
const isLoading = ref(true);
const payable = ref<Payable | null>(null);
const payableStore = usePayableStore();
const time = useTimeStore();
const toast = useToast();

const copy = () => {
  if (payableId) {
    const link = `${window.location.origin}/pay/${payableId}`;
    navigator.clipboard.writeText(link);
    toast.add({
      severity: 'info',
      summary: 'Copied',
      detail: `Payment Link: ${link} copied to clipboard.`,
      life: 3000,
    });
  }
};

const fetchPayable = async () => {
  if (!payableId) return;
  isLoading.value = true;
  payable.value = await payableStore.get(payableId);
  isLoading.value = false;
};

const shorten = (v: string) =>
  `${v.substring(0, 5)}...${v.substring(v.length - 5)}`;

onMounted(() => {
  fetchPayable();
});
</script>

<template>
  <section class="border border-shadow rounded-lg p-4 flex flex-col">
    <div class="flex justify-between mb-1">
      <p v-if="!payableId" class="flex items-center">
        <span class="text-sm text-gray-700 dark:text-gray-400">
          #{{ count }} <span class="font-bold">·</span>
        </span>
        <Shimmer class="!ml-1 !mb-pt w-28 h-4 rounded" :isLoading="isLoading" />
      </p>
      <h2 class="flex gap-x-1 items-center" v-else>
        <span class="text-sm text-gray-700 dark:text-gray-400">
          #{{ count }} <span class="font-bold">·</span>
          {{ shorten(payableId) }}
        </span>
        <Button
          class="bg-transparent p-1 border-none"
          @click="copy"
          title="Copy Payment LInk"
        >
          <IconCopy class="text-primary w-4 h-4" />
        </Button>
      </h2>
      <p
        class="text-gray-500 flex items-center cursor-help"
        :title="`No of Payments: ${payable?.paymentsCount ?? ''}`"
      >
        <IconWallet class="w-4 h-4 stroke-current inline-block -mt-0.5 mr-1" />
        <Shimmer
          class="w-6 h-4 rounded"
          :isLoading="isLoading"
          v-if="!payable"
        />
        <span v-else>{{ payable.paymentsCount }}</span>
      </p>
    </div>
    <Shimmer
      class="w-24 h-3.5 rounded !mb-8"
      :isLoading="isLoading"
      v-if="!payable"
    />
    <p class="text-xs text-gray-500 mb-8" v-else>
      {{ time.display(payable.createdAt) }}
    </p>

    <template v-if="!payable">
      <Shimmer class="w-24 h-4 rounded !mb-1" :isLoading="isLoading" />
      <Shimmer class="w-20 h-6 rounded !mb-4" :isLoading="isLoading" />
      <div class="mt-auto flex items-end">
        <div class="w-full mr-8">
          <Shimmer class="w-24 h-4 rounded !mb-1" :isLoading="isLoading" />
          <Shimmer class="h-8 rounded" :isLoading="isLoading" />
        </div>
        <Shimmer
          class="w-20 h-6 rounded"
          :isLoading="isLoading"
          v-if="!payableId"
        />
        <div v-else>
          <router-link
            :to="`/payable/${payableId}`"
            class="text-primary px-3 py-1.5 -mb-1.5 -mr-3 flex items-center h-fit rounded-md"
            v-ripple
          >
            <IconForward class="w-4 h-4" />
            <IconForward class="w-4 h-4" />
            <IconForward class="w-4 h-4" />
          </router-link>
        </div>
      </div>
    </template>
    <template v-else>
      <p v-if="!balsDisplay.length" class="text-xl text-center py-3 mb-4">
        No Balances Yet
      </p>
      <template v-else>
        <h3 class="text-sm text-gray-700 dark:text-gray-400 mb-1">
          Current Balance{{ balsDisplay.length > 1 ? 's' : '' }}
        </h3>
        <div class="flex gap-4 flex-wrap mb-6">
          <p
            v-for="bal of balsDisplay"
            class="flex gap-x-1 items-center bg-primary bg-opacity-10 px-1 rounded"
          >
            <img
              :src="`/assets/tokens/${bal.name}.png`"
              class="w-5 h-5"
              aria-hidden="true"
            />
            <span class="text-lg">{{ bal.display(payable.chain) }}</span>
          </p>
        </div>
      </template>

      <div class="mt-auto flex items-end">
        <div class="mr-8">
          <h3 class="text-sm text-gray-700 dark:text-gray-400">Description</h3>
          <p class="text-xs line-clamp-3">{{ payable.description }}</p>
        </div>
        <div class="ml-auto">
          <router-link
            :to="`/payable/${payableId}`"
            class="text-primary px-3 py-1.5 -mb-1.5 -mr-3 flex items-center h-fit rounded-md"
            v-ripple
          >
            <IconForward class="w-4 h-4" />
            <IconForward class="w-4 h-4" />
            <IconForward class="w-4 h-4" />
          </router-link>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
section {
  box-shadow:
    0 0 1.5px 0 var(--shadow),
    0 0 1px -1px var(--shadow);
}
</style>
