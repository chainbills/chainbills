<script setup lang="ts">
/**
 * src/components/scan/ScanPaymentsTable.vue
 *
 * Renders a paginated table of on-chain payments for the Scan explorer,
 * with a sub-toggle to switch between "Received" (payable-side payments,
 * `chainPayablePaymentIdsPaginated`) and "Made" (user-side payments,
 * `chainUserPaymentIdsPaginated`).
 *
 * Columns: amount, route (source ChainBadge to destination ChainBadge),
 * payable id, payer address, timestamp, receipt link.
 *
 * Filters: Same-chain / Cross-chain chip row (applied to the loaded window
 * using the `payerChainId` field on received payments).
 *
 * Props:
 *  - `chainName`: chain to query, or `null` for all-chains merged mode.
 *  - `networkType`: active network.
 *  - `page`: current page.
 *  - `pageSize`: rows per page.
 *  - `textFilter`: optional substring filter applied on the loaded window.
 *
 * Emits:
 *  - `update:page`: page change.
 *
 * Usage:
 * ```vue
 * <ScanPaymentsTable :chain-name="null" network-type="testnet" :page="0" :page-size="20" />
 * ```
 */
import ScanEntityTable, { type ColumnDef } from './ScanEntityTable.vue';
import { AddressChip, ChainBadge, FilterChips, SegmentedTabs, StatusPill } from '@/components/ui';
import { cbChainIdToChain, chainNamesToChains, type Chain, type ChainName, type ChainNetworkType } from '@/schemas';
import { useScanStore, type ScanMultiChainCursor } from '@/stores/scan';
import { computed, onMounted, ref, watch } from 'vue';
import type { FilterChipOption, SegmentedTabOption } from '@/components/ui';

const props = withDefaults(defineProps<{
  /** Chain to query in single-chain mode, or `null` for all-chains merged mode. */
  chainName: ChainName | null;
  /** Active network type. */
  networkType: ChainNetworkType;
  /** Current page (0-based). */
  page: number;
  /** Rows per page. */
  pageSize: number;
  /** Optional substring filter applied to the loaded window. */
  textFilter?: string;
}>(), { textFilter: '' });

const emit = defineEmits<{
  'update:page': [page: number];
}>();

const scan = useScanStore();

/** 'received' = payable-side payments (chainPayablePaymentIdsPaginated). 'made' = user-side. */
const subTab = ref<'received' | 'made'>('received');

const subTabOptions: SegmentedTabOption[] = [
  { label: 'Received', value: 'received' },
  { label: 'Made', value: 'made' },
];

/** 'all', 'same', or 'cross'. */
const directionFilter = ref('all');
const directionOptions: FilterChipOption[] = [
  { label: 'All', value: 'all' },
  { label: 'Same-chain', value: 'same' },
  { label: 'Cross-chain', value: 'cross' },
];

const allRows = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);
const cursor = ref<ScanMultiChainCursor>({ yielded: {} });
const hasMore = ref(false);

/** Rows after applying direction and text filters. */
const filteredRows = computed(() => {
  let rows = allRows.value;
  if (subTab.value === 'received' && directionFilter.value !== 'all') {
    rows = rows.filter((r) => {
      const isCross =
        r.payerChainId && r.chainName
          ? r.payerChainId !== chainNamesToChains[r.chainName as ChainName]?.cbChainId
          : false;
      return directionFilter.value === 'cross' ? isCross : !isCross;
    });
  }
  if (props.textFilter) {
    const q = props.textFilter.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.id?.toLowerCase().includes(q) ||
        r.payableId?.toLowerCase().includes(q) ||
        r.payer?.toLowerCase().includes(q)
    );
  }
  return rows;
});

const filterNote = computed(() => {
  if (!props.chainName && allRows.value.length > 0) {
    return `Filtering the latest ${allRows.value.length} payments`;
  }
  return null;
});

const receivedColumns: ColumnDef[] = [
  { label: 'Amount', key: 'amount', slotName: 'amount' },
  { label: 'Route', key: 'payerChainId', slotName: 'route' },
  { label: 'Payable', key: 'payableId', slotName: 'payable' },
  { label: 'Payer', key: 'payer', slotName: 'payer' },
  { label: 'Time', key: 'timestamp', slotName: 'time' },
];

const madeColumns: ColumnDef[] = [
  { label: 'Amount', key: 'amount', slotName: 'amount' },
  { label: 'Payable', key: 'payableId', slotName: 'payable' },
  { label: 'Destination', key: 'payableChainId', slotName: 'destchain' },
  { label: 'Time', key: 'timestamp', slotName: 'time' },
];

const columns = computed<ColumnDef[]>(() =>
  subTab.value === 'received' ? receivedColumns : madeColumns
);

const load = async () => {
  loading.value = true;
  error.value = null;
  allRows.value = [];
  cursor.value = { yielded: {} };
  try {
    if (props.chainName) {
      if (subTab.value === 'received') {
        const result = await scan.getChainPayablePayments(props.chainName, props.page, props.pageSize);
        allRows.value = result.items;
        total.value = result.total;
      } else {
        const result = await scan.getChainUserPayments(props.chainName, props.page, props.pageSize);
        allRows.value = result.items;
        total.value = result.total;
      }
    } else {
      const result = await scan.getNetworkPayments(props.networkType, { yielded: {} }, props.pageSize);
      allRows.value = result.items;
      cursor.value = result.cursor;
      hasMore.value = result.hasMore;
      total.value = 0;
    }
  } catch (e) {
    error.value = `${e}`;
  } finally {
    loading.value = false;
  }
};

const loadMore = async () => {
  if (loading.value || !hasMore.value) return;
  loading.value = true;
  error.value = null;
  try {
    const result = await scan.getNetworkPayments(props.networkType, cursor.value, props.pageSize);
    allRows.value = [...allRows.value, ...result.items];
    cursor.value = result.cursor;
    hasMore.value = result.hasMore;
  } catch (e) {
    error.value = `${e}`;
  } finally {
    loading.value = false;
  }
};

onMounted(load);
watch([() => props.chainName, () => props.networkType, () => props.page, subTab], load);

const formatDate = (ts: any): string => {
  const n = Number(ts);
  if (!n) return '-';
  return new Date(n * 1000).toLocaleString();
};

/** Looks up a `Chain` by its on-chain `bytes32` cbChainId, or null if not found. */
const chainFromCbId = (cbChainId: string | undefined) =>
  cbChainId ? cbChainIdToChain[cbChainId] ?? null : null;
</script>

<template>
  <div class="space-y-3">
    <!-- Sub-toggle: Received / Made -->
    <SegmentedTabs :options="subTabOptions" v-model="subTab" />

    <!-- Direction filter (only meaningful for received payments) -->
    <FilterChips v-if="subTab === 'received'" :options="directionOptions" v-model="directionFilter" />

    <ScanEntityTable
      :columns="columns"
      :rows="filteredRows"
      :loading="loading"
      :total="total"
      :page="props.page"
      :page-size="props.pageSize"
      :all-chains="!props.chainName"
      :has-more="hasMore"
      :filter-note="filterNote"
      :error="error"
      @update:page="emit('update:page', $event)"
      @load-more="loadMore"
      @retry="load"
    >
      <!-- Amount -->
      <template #cell-amount="{ row }">
        <span class="tabular-nums font-semibold text-sm">{{ row.amount ? `${row.amount}` : '-' }}</span>
      </template>

      <!-- Cross-chain route (received payments: payerChain to this chain) -->
      <template #cell-route="{ row }">
        <div class="flex items-center gap-1.5">
          <ChainBadge v-if="chainFromCbId(row.payerChainId)" :chain="chainFromCbId(row.payerChainId)!" :show-name="false" />
          <span class="text-xs text-muted">to</span>
          <ChainBadge v-if="row.chainName" :chain="chainNamesToChains[row.chainName as ChainName]" :show-name="false" />
        </div>
      </template>

      <!-- Destination chain for "made" sub-tab -->
      <template #cell-destchain="{ row }">
        <ChainBadge v-if="chainFromCbId(row.payableChainId)" :chain="chainFromCbId(row.payableChainId)!" />
        <span v-else class="text-muted">-</span>
      </template>

      <!-- Payable link -->
      <template #cell-payable="{ row }">
        <AddressChip
          v-if="row.payableId"
          :value="row.payableId"
          kind="id"
          :to="`/payable/${row.payableId}`"
        />
        <span v-else class="text-muted">-</span>
      </template>

      <!-- Payer address -->
      <template #cell-payer="{ row }">
        <AddressChip
          v-if="row.payer && row.chainName"
          :value="typeof row.payer === 'string' && row.payer.length > 42 ? `0x${row.payer.slice(-40)}` : row.payer"
          kind="address"
          :chain="chainNamesToChains[row.chainName as ChainName]"
        />
        <span v-else class="text-muted">-</span>
      </template>

      <!-- Timestamp -->
      <template #cell-time="{ row }">
        <span class="text-xs text-muted tabular-nums">{{ formatDate(row.timestamp) }}</span>
      </template>

      <!-- Expanded detail -->
      <template #row-detail="{ row }">
        <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt class="text-muted">Full ID</dt>
          <dd class="font-mono text-[11px] break-all">{{ row.id }}</dd>
          <dt class="text-muted">Payable</dt>
          <dd class="font-mono text-[11px] break-all">{{ row.payableId }}</dd>
          <dt class="text-muted">Chain</dt>
          <dd>{{ row.chainName ? chainNamesToChains[row.chainName as ChainName].displayName : '-' }}</dd>
          <dt class="text-muted">Timestamp</dt>
          <dd class="tabular-nums">{{ formatDate(row.timestamp) }}</dd>
        </dl>
        <div class="mt-4">
          <RouterLink
            :to="`/receipt/${row.id}`"
            class="rounded-full px-4 py-1.5 text-sm font-medium bg-accent text-accent-fg hover:bg-accent/90 transition-colors"
          >
            View receipt
          </RouterLink>
        </div>
      </template>
    </ScanEntityTable>
  </div>
</template>
