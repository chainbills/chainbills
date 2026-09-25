<script setup lang="ts">
/**
 * src/components/scan/ScanWithdrawalsTable.vue
 *
 * Renders a paginated table of on-chain withdrawals for the Scan explorer.
 *
 * Columns: amount (on-chain), payable, host, timestamp, receipt link.
 *
 * Props:
 *  - `chainName`: chain to query, or `null` for all-chains merged mode.
 *  - `networkType`: active network type.
 *  - `page`: current 0-based page.
 *  - `pageSize`: rows per page.
 *  - `textFilter`: optional substring filter.
 *
 * Emits:
 *  - `update:page`: page change.
 *
 * Usage:
 * ```vue
 * <ScanWithdrawalsTable :chain-name="null" network-type="testnet" :page="0" :page-size="20" />
 * ```
 */
import ScanEntityTable, { type ColumnDef } from './ScanEntityTable.vue';
import { AddressChip, ChainBadge, IconChip } from '@/components/ui';
import IconWallet from '@/icons/IconWallet.vue';
import { chainNamesToChains, formatTokenAmount, type Chain, type ChainName, type ChainNetworkType } from '@/schemas';
import { useScanStore, type ScanMultiChainCursor } from '@/stores/scan';
import { computed, onMounted, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  /** Chain to query, or `null` for all-chains merged mode. */
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

const allRows = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);
const cursor = ref<ScanMultiChainCursor>({ yielded: {} });
const hasMore = ref(false);

const filteredRows = computed(() => {
  if (!props.textFilter) return allRows.value;
  const q = props.textFilter.toLowerCase();
  return allRows.value.filter(
    (r) =>
      r.id?.toLowerCase().includes(q) ||
      r.payableId?.toLowerCase().includes(q) ||
      r.host?.toLowerCase().includes(q)
  );
});

const filterNote = computed(() => {
  if (!props.chainName && allRows.value.length > 0) {
    return `Filtering the latest ${allRows.value.length} withdrawals`;
  }
  return null;
});

const columns: ColumnDef[] = [
  { label: '', key: '_icon', slotName: 'icon' },
  { label: 'Amount', key: 'amount', slotName: 'net' },
  { label: 'Payable', key: 'payableId', slotName: 'payable' },
  { label: 'Owner', key: 'host', slotName: 'host' },
  { label: 'Time', key: 'timestamp', slotName: 'time' },
];

const load = async () => {
  loading.value = true;
  error.value = null;
  allRows.value = [];
  cursor.value = { yielded: {} };
  try {
    if (props.chainName) {
      const result = await scan.getChainWithdrawals(props.chainName, props.page, props.pageSize);
      allRows.value = result.items;
      total.value = result.total;
    } else {
      const result = await scan.getNetworkWithdrawals(props.networkType, { yielded: {} }, props.pageSize);
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
  try {
    const result = await scan.getNetworkWithdrawals(props.networkType, cursor.value, props.pageSize);
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
watch([() => props.chainName, () => props.networkType, () => props.page], load);

const formatDate = (ts: any): string => {
  const n = Number(ts);
  if (!n) return '-';
  return new Date(n * 1000).toLocaleString();
};

/** Formats a raw amount (bigint as returned by the contract) for display using 6 decimals (USDC default). */
const formatAmt = (raw: any): string => {
  try {
    const n = BigInt(raw);
    return formatTokenAmount(n, 6);
  } catch {
    return '-';
  }
};
</script>

<template>
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
    <!-- Withdrawal icon -->
    <template #cell-icon>
      <IconChip tone="success" size="sm">
        <IconWallet class="w-3.5 h-3.5" />
      </IconChip>
    </template>

    <!-- Net amount (stored on-chain) -->
    <template #cell-net="{ row }">
      <span class="tabular-nums font-semibold text-sm">{{ formatAmt(row.amount) }}</span>
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

    <!-- Host address -->
    <template #cell-host="{ row }">
      <AddressChip
        v-if="row.host && row.chainName"
        :value="row.host"
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
        <dt class="text-muted">Owner</dt>
        <dd class="font-mono text-[11px] break-all">{{ row.host }}</dd>
        <dt class="text-muted">Amount</dt>
        <dd class="tabular-nums">{{ formatAmt(row.amount) }}</dd>
        <dt class="text-muted">Time</dt>
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
</template>
