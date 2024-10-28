<script setup lang="ts">
import IconCopy from '@/icons/IconCopy.vue';
import IconOpenInNew from '@/icons/IconOpenInNew.vue';
import { type Receipt, Withdrawal } from '@/schemas';
import { useAuthStore, usePaginatorsStore, useTimeStore } from '@/stores';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';
import { computed, ref } from 'vue';

const {
  countField,
  currentPage,
  hidePayable,
  hideUser,
  receipts,
  totalCount,
  userChainField,
} = defineProps<{
  countField: string;
  currentPage: number;
  hidePayable?: boolean;
  hideUser?: boolean;
  receipts: Receipt[];
  totalCount: number;
  userChainField?: string;
}>();

const auth = useAuthStore();
const paginators = usePaginatorsStore();
const sortOrder = ref(-1);
const toast = useToast();
const time = useTimeStore();
const userField = computed(() => {
  if (receipts.length === 0) return '';
  if ((receipts[0] as any)['payer']) return 'payer';
  return 'host';
});

const copy = (text: string, context: string) => {
  navigator.clipboard.writeText(text);
  toast.add({
    severity: 'info',
    summary: 'Copied',
    detail: `${context} copied to clipboard.`,
    life: 3000,
  });
};

const payableRoute = (receipt: Receipt) => {
  const isMine = auth.currentUser?.walletAddress == receipt.user();
  return (
    `/${receipt instanceof Withdrawal && isMine ? 'payable' : 'pay'}/` +
    receipt.payableId
  );
};

const shorten = (v: string) =>
  `${v.substring(0, 5)}...${v.substring(v.length - 5)}`;

const sortedReceipts = computed(() =>
  receipts.sort((a, b) => (a.timestamp - b.timestamp) * sortOrder.value)
);
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
    showGridlines
    sortField="timestamp"
    stripedRows
    :totalRecords="totalCount"
    :value="sortedReceipts"
    v-model:sortOrder="sortOrder"
    @page="
      (e) => {
        paginators.setRowsPerPage(e.rows);
        $emit('updateTablePage', e.page);
      }
    "
  >
    <Column :field="countField" header="No" />
    <Column field="timestamp" header="Timestamp" sortable>
      <template #body="{ data }">
        <span class="text-nowrap">{{ time.display(data.timestamp) }}</span>
      </template>
    </Column>
    <Column field="details" header="Details">
      <template #body="{ data }">
        <p class="flex gap-x-2 items-center w-32">
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
        <p class="flex items-center">
          <span class="text-sm text-gray-500 w-[6rem] mr-1">
            {{ shorten(data.id) }}
          </span>
          <Button
            class="bg-transparent p-1 border-none"
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
            class="p-1 rounded-md"
            v-ripple
          >
            <IconOpenInNew class="text-primary" />
          </a>
        </p>
      </template>
    </Column>
    <Column field="payableId" header="Payable" v-if="!hidePayable">
      <template #body="{ data }">
        <p class="flex items-center">
          <span class="text-sm text-gray-500 w-[6rem] mr-1">
            {{ shorten(data.payableId) }}
          </span>
          <Button
            class="bg-transparent p-1 border-none"
            @click="copy(data.payableId, `Payable ID: ${data.payableId}`)"
            title="Copy Payable ID"
          >
            <IconCopy class="text-primary" />
          </Button>
          <a
            :href="payableRoute(data)"
            target="_blank"
            rel="noopener noreferrer"
            :title="
              payableRoute(data).includes('payable')
                ? 'Payable Page'
                : 'Payment Page'
            "
            class="p-1 rounded-md"
            v-ripple
          >
            <IconOpenInNew class="text-primary" />
          </a>
        </p>
      </template>
    </Column>
    <Column
      v-if="!hideUser && userField"
      :field="userField"
      :header="`${userField[0].toUpperCase() + userField.substring(1)}'s Wallet Address`"
    >
      <template #body="{ data }">
        <p class="flex items-center">
          <span class="text-sm text-gray-500 w-[6rem] mr-1">
            {{ shorten(data.user()) }}
          </span>
          <Button
            class="bg-transparent p-1 border-none"
            @click="copy(data.user(), `Wallet Address: ${data.user()}`)"
            title="Copy Wallet Address"
          >
            <IconCopy class="text-primary" />
          </Button>
          <a
            :href="
              auth.getExplorerUrl(data.user(), data[userChainField ?? 'chain'])
            "
            target="_blank"
            rel="noopener noreferrer"
            title="View on Explorer"
            class="p-1 rounded-md"
            v-ripple
          >
            <IconOpenInNew class="text-primary" />
          </a>
        </p>
      </template>
    </Column>
  </DataTable>
</template>
