<script setup lang="ts">
/**
 * src/components/scan/ScanUsersTable.vue
 *
 * Renders a paginated table of on-chain users (wallets that have interacted
 * with Chainbills) for the Scan explorer.
 *
 * Columns: address, chain, payables count, payments count, withdrawals count,
 * activities count, link to the address page.
 *
 * In all-chains mode, rows are grouped by chain (no per-user timestamp exists
 * on-chain), and the table shows a section header with a `ChainBadge` between
 * each chain's rows.
 *
 * Props:
 *  - `chainName`: chain to query, or `null` for all-chains mode.
 *  - `networkType`: active network.
 *  - `page`: current 0-based page.
 *  - `pageSize`: rows per page.
 *  - `textFilter`: optional substring filter.
 *
 * Emits:
 *  - `update:page`: page change.
 *
 * Usage:
 * ```vue
 * <ScanUsersTable :chain-name="null" network-type="testnet" :page="0" :page-size="20" />
 * ```
 */
import ScanEntityTable, { type ColumnDef } from './ScanEntityTable.vue';
import { AddressChip, ChainBadge } from '@/components/ui';
import { chainNamesToChains, type ChainName, type ChainNetworkType } from '@/schemas';
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
  return allRows.value.filter((r) => r.address?.toLowerCase().includes(q));
});

const filterNote = computed(() => {
  if (!props.chainName && allRows.value.length > 0) {
    return `Showing ${allRows.value.length} users · grouped by chain`;
  }
  return null;
});

const columns: ColumnDef[] = [
  { label: 'Address', key: 'address', slotName: 'address' },
  { label: 'Chain', key: 'chainName', slotName: 'chain' },
  { label: 'Payables', key: 'payablesCount' },
  { label: 'Payments', key: 'paymentsCount' },
  { label: 'Withdrawals', key: 'withdrawalsCount' },
  { label: 'Activities', key: 'activitiesCount' },
];

const load = async () => {
  loading.value = true;
  error.value = null;
  allRows.value = [];
  cursor.value = { yielded: {} };
  try {
    if (props.chainName) {
      const result = await scan.getChainUsers(props.chainName, props.page, props.pageSize);
      allRows.value = result.items;
      total.value = result.total;
    } else {
      const result = await scan.getNetworkUsers(props.networkType, { yielded: {} }, props.pageSize);
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
    const result = await scan.getNetworkUsers(props.networkType, cursor.value, props.pageSize);
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
    <!-- Address chip with link to address page -->
    <template #cell-address="{ row }">
      <AddressChip
        v-if="row.address"
        :value="row.address"
        kind="address"
        :chain="row.chainName ? chainNamesToChains[row.chainName as ChainName] : undefined"
        :to="`/scan/address/${row.address}`"
      />
      <span v-else class="text-muted">-</span>
    </template>

    <!-- Chain badge -->
    <template #cell-chain="{ row }">
      <ChainBadge v-if="row.chainName" :chain="chainNamesToChains[row.chainName as ChainName]" />
      <span v-else class="text-muted">-</span>
    </template>

    <!-- Expanded detail -->
    <template #row-detail="{ row }">
      <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt class="text-muted">Address</dt>
        <dd class="font-mono text-[11px] break-all">{{ row.address }}</dd>
        <dt class="text-muted">Chain</dt>
        <dd>{{ row.chainName ? chainNamesToChains[row.chainName as ChainName].displayName : '-' }}</dd>
        <dt class="text-muted">Payables</dt>
        <dd class="tabular-nums">{{ Number(row.payablesCount ?? 0).toLocaleString() }}</dd>
        <dt class="text-muted">Payments</dt>
        <dd class="tabular-nums">{{ Number(row.paymentsCount ?? 0).toLocaleString() }}</dd>
        <dt class="text-muted">Withdrawals</dt>
        <dd class="tabular-nums">{{ Number(row.withdrawalsCount ?? 0).toLocaleString() }}</dd>
        <dt class="text-muted">Activities</dt>
        <dd class="tabular-nums">{{ Number(row.activitiesCount ?? 0).toLocaleString() }}</dd>
      </dl>
      <div class="mt-4">
        <RouterLink
          v-if="row.address"
          :to="`/scan/address/${row.address}`"
          class="rounded-full px-4 py-1.5 text-sm font-medium bg-accent text-accent-fg hover:bg-accent/90 transition-colors"
        >
          View address
        </RouterLink>
      </div>
    </template>
  </ScanEntityTable>
</template>
