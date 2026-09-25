<script setup lang="ts">
/**
 * src/components/scan/ScanPayablesTable.vue
 *
 * Renders a paginated table of on-chain payables for the Scan explorer.
 * Uses `useScanStore` to fetch payables per chain or merged across the
 * network, and wraps the result in `ScanEntityTable`.
 *
 * Columns: avatar + id, chain, host address, status (open/closed), payment
 * rules summary (accepted tokens or "Any"), payment count, created time.
 *
 * Filters: Open / Closed status chip row (applied to the loaded window).
 *
 * Props:
 *  - `chainName`: the specific chain to query, or `null` for all-chains mode.
 *  - `networkType`: the active network (`'mainnet'` / `'testnet'`).
 *  - `page`: current page (single-chain numbered pagination).
 *  - `pageSize`: rows per page.
 *
 * Emits:
 *  - `update:page`: page change from numbered pagination.
 *
 * Usage:
 * ```vue
 * <ScanPayablesTable :chain-name="null" network-type="testnet" :page="0" :page-size="20" />
 * <ScanPayablesTable chain-name="sepolia" network-type="testnet" :page="page" :page-size="20" @update:page="page = $event" />
 * ```
 */
import ScanEntityTable, { type ColumnDef } from './ScanEntityTable.vue';
import { AddressChip, ChainBadge, FilterChips, PayableAvatar, StatusPill } from '@/components/ui';
import { chainNamesToChains, type ChainName, type ChainNetworkType } from '@/schemas';
import { useScanStore, type ScanMultiChainCursor } from '@/stores/scan';
import { computed, onMounted, ref, watch } from 'vue';
import type { FilterChipOption } from '@/components/ui';

const props = withDefaults(defineProps<{
  /** Chain to query in single-chain mode, or `null` for all-chains merged mode. */
  chainName: ChainName | null;
  /** Active network type. */
  networkType: ChainNetworkType;
  /** Current page (0-based, single-chain mode). */
  page: number;
  /** Rows per page. */
  pageSize: number;
  /** Optional text filter to highlight rows by id/host substring. */
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

/** Status filter: 'all', 'open', or 'closed'. */
const statusFilter = ref('all');
const statusOptions: FilterChipOption[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
];

/** Rows after applying the status filter and optional text filter. */
const filteredRows = computed(() => {
  let rows = allRows.value;
  if (statusFilter.value === 'open') rows = rows.filter((r) => !r.isClosed);
  if (statusFilter.value === 'closed') rows = rows.filter((r) => r.isClosed);
  if (props.textFilter) {
    const q = props.textFilter.toLowerCase();
    rows = rows.filter(
      (r) => r.id?.toLowerCase().includes(q) || r.host?.toLowerCase().includes(q)
    );
  }
  return rows;
});

const filterNote = computed(() => {
  if (!props.chainName && allRows.value.length > 0) {
    return `Filtering the latest ${allRows.value.length} payables`;
  }
  return null;
});

const columns: ColumnDef[] = [
  { label: 'Payable', key: 'id', slotName: 'id' },
  { label: 'Chain', key: 'chainName', slotName: 'chain' },
  { label: 'Owner', key: 'host', slotName: 'host' },
  { label: 'Status', key: 'isClosed', slotName: 'status' },
  { label: 'Rules', key: 'allowedTokensAndAmountsCount', slotName: 'rules' },
  { label: 'Payments', key: 'paymentsCount' },
  { label: 'Created', key: 'createdAt', slotName: 'created' },
];

const load = async () => {
  loading.value = true;
  error.value = null;
  try {
    if (props.chainName) {
      const result = await scan.getChainPayables(props.chainName, props.page, props.pageSize);
      allRows.value = result.items;
      total.value = result.total;
    } else {
      const result = await scan.getNetworkPayables(props.networkType, { yielded: {} }, props.pageSize);
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
    const result = await scan.getNetworkPayables(props.networkType, cursor.value, props.pageSize);
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
watch([() => props.chainName, () => props.networkType, () => props.page], () => {
  allRows.value = [];
  cursor.value = { yielded: {} };
  load();
});

/** Formats a Unix timestamp (seconds) as a relative or absolute date. */
const formatDate = (ts: any): string => {
  const n = Number(ts);
  if (!n) return '-';
  return new Date(n * 1000).toLocaleDateString();
};
</script>

<template>
  <div class="space-y-3">
    <!-- Status filter chips -->
    <FilterChips :options="statusOptions" v-model="statusFilter" />

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
      <!-- Payable id with avatar -->
      <template #cell-id="{ row }">
        <div class="flex items-center gap-2 min-w-0">
          <PayableAvatar :id="row.id" class="w-7 h-7 shrink-0 rounded-lg" />
          <AddressChip :value="row.id" kind="id" :to="`/payable/${row.id}`" />
        </div>
      </template>

      <!-- Chain badge -->
      <template #cell-chain="{ row }">
        <ChainBadge v-if="row.chainName" :chain="chainNamesToChains[row.chainName as ChainName]" />
        <span v-else class="text-muted">-</span>
      </template>

      <!-- Host address -->
      <template #cell-host="{ row }">
        <AddressChip
          v-if="row.host"
          :value="row.host"
          kind="address"
          :chain="row.chainName ? chainNamesToChains[row.chainName as ChainName] : undefined"
        />
        <span v-else class="text-muted">-</span>
      </template>

      <!-- Open/Closed status pill -->
      <template #cell-status="{ row }">
        <StatusPill
          :label="row.isClosed ? 'Closed' : 'Open'"
          :tone="row.isClosed ? 'danger' : 'success'"
        />
      </template>

      <!-- Payment rules: token count or "Any" -->
      <template #cell-rules="{ row }">
        <span class="text-sm text-muted">
          {{ Number(row.allowedTokensAndAmountsCount) === 0 ? 'Any' : `${row.allowedTokensAndAmountsCount} rule(s)` }}
        </span>
      </template>

      <!-- Created date -->
      <template #cell-created="{ row }">
        <span class="text-sm text-muted tabular-nums">{{ formatDate(row.createdAt) }}</span>
      </template>

      <!-- Expanded detail panel -->
      <template #row-detail="{ row }">
        <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt class="text-muted">Full ID</dt>
          <dd class="font-mono text-[11px] break-all">{{ row.id }}</dd>
          <dt class="text-muted">Owner</dt>
          <dd class="font-mono text-[11px] break-all">{{ row.host }}</dd>
          <dt class="text-muted">Chain</dt>
          <dd>{{ row.chainName ? chainNamesToChains[row.chainName as ChainName].displayName : '-' }}</dd>
          <dt class="text-muted">Status</dt>
          <dd>{{ row.isClosed ? 'Closed' : 'Open' }}</dd>
          <dt class="text-muted">Payments</dt>
          <dd class="tabular-nums">{{ Number(row.paymentsCount).toLocaleString() }}</dd>
          <dt class="text-muted">Withdrawals</dt>
          <dd class="tabular-nums">{{ Number(row.withdrawalsCount).toLocaleString() }}</dd>
          <dt class="text-muted">Created</dt>
          <dd class="tabular-nums">{{ formatDate(row.createdAt) }}</dd>
          <dt class="text-muted">Auto-withdraw</dt>
          <dd>{{ row.isAutoWithdraw ? 'Yes' : 'No' }}</dd>
        </dl>
        <div class="mt-4 flex gap-3">
          <RouterLink
            :to="`/payable/${row.id}`"
            class="rounded-full px-4 py-1.5 text-sm font-medium bg-accent text-accent-fg hover:bg-accent/90 transition-colors"
          >
            View payable
          </RouterLink>
        </div>
      </template>
    </ScanEntityTable>
  </div>
</template>
