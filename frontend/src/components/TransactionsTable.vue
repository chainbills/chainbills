<script setup lang="ts">
import IconCopy from '@/icons/IconCopy.vue';
import IconOpenInNew from '@/icons/IconOpenInNew.vue';
import { type Receipt } from '@/schemas';
import { usePaginatorsStore, useTimeStore } from '@/stores';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable, { type DataTableSortMeta } from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';
import { computed, ref } from 'vue';

const { countField, currentPage, hidePayable, receipts, totalCount } =
  defineProps<{
    countField: string;
    currentPage: number;
    hidePayable?: boolean;
    receipts: Receipt[];
    totalCount: number;
  }>();

const multiSortMeta = ref<DataTableSortMeta[]>([
  { field: countField, order: -1 },
]);
const paginators = usePaginatorsStore();
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

function multiFieldSort(a: any, b: any) {
  if (multiSortMeta.value.length == 0) return 0;

  for (const sorter of multiSortMeta.value) {
    const aValue = a[sorter.field as keyof typeof a];
    const bValue = b[sorter.field as keyof typeof b];

    let comparison = 0;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } 


    if (comparison !== 0) {
      return sorter.order === 1 ? comparison : -comparison;
    }
  }

  return 0;
}

const shorten = (v: string) =>
  `${v.substring(0, 5)}...${v.substring(v.length - 5)}`;

const sortedReceipts = computed(() => receipts.sort(multiFieldSort));
</script>

<template>
  <DataTable
    :currentPage="currentPage"
    currentPageReportTemplate="{first} to {last} of {totalRecords}"
    :first="paginators.rowsPerPage * currentPage"
    :lazy="true"
    :paginator="true"
    paginatorTemplate="FirstPageLink PrevPageLink JumpToPageDropdown CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
    :rows="paginators.rowsPerPage"
    :rowsPerPageOptions="paginators.rowsPerPageOptions"
    :resizableColumns="true"
    removableSort
    sortMode="multiple"
    showGridlines
    stripedRows
    :totalRecords="totalCount"
    :value="sortedReceipts"
    v-model:multiSortMeta="multiSortMeta"
    @page="
      (e) => {
        paginators.setRowsPerPage(e.rows);
        $emit('updateTablePage', e.page);
      }
    "
  >
    <Column :field="countField" sortable>
      <template #header>
        <span>N<sup>th</sup></span>
      </template>
    </Column>
    <Column field="timestamp" header="Timestamp" sortable>
      <template #body="{ data }">
        <span class="text-nowrap">{{ time.display(data.timestamp) }}</span>
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
          <span class="font-medium text-lg text-nowrap">
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
