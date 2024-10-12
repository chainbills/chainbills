<script setup lang="ts">
import IconCopy from '@/icons/IconCopy.vue';
import IconOpenInNew from '@/icons/IconOpenInNew.vue';
import { type Receipt } from '@/schemas';
import { useTimeStore } from '@/stores';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';

const { countField, hidePayable, receipts } = defineProps<{
  countField: string;
  hidePayable?: boolean;
  receipts: Receipt[];
}>();

const toast = useToast();
const time = useTimeStore();

const copy = (text: string, context: string) => {
  navigator.clipboard.writeText(text);
  toast.add({
    severity: 'info',
    summary: 'Copied',
    detail: `${context} copied to clipboard`,
    life: 3000,
  });
};

const shorten = (v: string) =>
  `${v.substring(0, 5)}...${v.substring(v.length - 5)}`;
</script>

<template>
  <DataTable
    :value="receipts"
    :paginator="true"
    :rows="10"
    :rowsPerPageOptions="[10, 25, 50, 100]"
    showGridlines
    stripedRows
    sortMode="multiple"
    removableSort
    :multiSortMeta="[{ field: countField, order: -1 }]"
  >
    <Column :field="countField" sortable>
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
          <span class="text-sm text-gray-500 w-[6rem]">
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
    <Column field="payableId" header="Payable" sortable v-if="!hidePayable">
      <template #body="{ data }">
        <p class="flex gap-x-2 items-center">
          <span class="text-sm text-gray-500 w-[6rem]">
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
