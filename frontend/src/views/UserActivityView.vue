<script setup lang="ts">
import SignInButton from '@/components/SignInButton.vue';
import IconCopy from '@/icons/IconCopy.vue';
import IconOpenInNew from '@/icons/IconOpenInNew.vue';
import IconSpinner from '@/icons/IconSpinner.vue';
import { type Payment } from '@/schemas';
import {
  usePaymentStore,
  useTimeStore,
  useUserStore,
  useWalletStore,
} from '@/stores';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref, watch } from 'vue';

const isLoading = ref(true);
const payments = usePaymentStore();
const mines = ref<Payment[] | null>(null);
const toast = useToast();
const time = useTimeStore();
const user = useUserStore();
const wallet = useWalletStore();

const copy = (text: string, context: string) => {
  navigator.clipboard.writeText(text);
  toast.add({
    severity: 'info',
    summary: 'Copied',
    detail: `${context} copied to clipboard`,
    life: 3000,
  });
};

const getMines = async () => {
  isLoading.value = true;
  mines.value = await payments.mines();
  isLoading.value = false;
};

const shorten = (v: string) =>
  `${v.substring(0, 5)}...${v.substring(v.length - 5)}`;

onMounted(async () => {
  if (user.current) await getMines();
  watch(
    () => user.current,
    async (currentUser) => {
      if (currentUser) await getMines();
      else mines.value = null;
    }
  );
});
</script>

<template>
  <div class="max-w-screen-xl mx-auto pb-20">
    <h2 class="text-3xl font-bold mb-8">Your Payments</h2>

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
      <DataTable
        :value="mines"
        :paginator="true"
        :rows="10"
        :rowsPerPageOptions="[10, 25, 50, 100]"
        showGridlines
        stripedRows
        sortMode="multiple"
        removableSort
        :multiSortMeta="[{ field: 'payerCount', order: -1 }]"
      >
        <Column field="payerCount" sortable>
          <template #header>
            <span>N<sup>th</sup></span>
          </template>
        </Column>
        <Column field="timestamp" header="Timestamp" sortable>
          <template #body="{ data }">
            {{ time.display(data.timestamp) }}
          </template>
        </Column>
        <Column field="details" header="Details">
          <template #body="{ data }">
            <p class="flex gap-x-2 items-center">
              <img
                :src="`/assets/tokens/${data.details.name}.png`"
                class="w-6 h-6"
                aria-hidden="true"
              />
              <span class="font-medium text-lg">
                {{ data.displayDetails() }}
              </span>
            </p>
          </template>
        </Column>
        <Column field="id" header="Receipt ID">
          <template #body="{ data }">
            <p class="flex gap-x-2 items-center">
              <span class="text-sm text-gray-500 w-[100px]">
                {{ shorten(data.id) }}
              </span>
              <Button
                @click="copy(data.id, `Receipt ID: ${data.id}`)"
                title="Copy Receipt ID"
              >
                <IconCopy class="text-primary" />
              </Button>
              <a
                :href="`/receipt/${data.id}`"
                target="_blank"
                rel="noopener noreferrer"
                title="View Receipt"
              >
                <IconOpenInNew class="text-primary" />
              </a>
            </p>
          </template>
        </Column>
        <Column field="payableId" header="Payable" sortable>
          <template #body="{ data }">
            <p class="flex gap-x-2 items-center">
              <span class="text-sm text-gray-500 w-[100px]">
                {{ shorten(data.payableId) }}
              </span>
              <Button
                @click="copy(data.payableId, `Payable ID: ${data.payableId}`)"
                title="Copy Payable ID"
              >
                <IconCopy class="text-primary" />
              </Button>
              <a
                :href="`/pay/${data.payableId}`"
                target="_blank"
                rel="noopener noreferrer"
                title="Payment Page"
              >
                <IconOpenInNew class="text-primary" />
              </a>
            </p>
          </template>
        </Column>
      </DataTable>
    </template>
  </div>
</template>
