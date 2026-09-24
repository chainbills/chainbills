<script setup lang="ts">
/**
 * src/views/scan/ScanView.vue
 *
 * The main Chainbills Scan overview page (`/scan`). Shows protocol-wide
 * activity, entity counts, and entity tables across all chains of the
 * selected network, or narrowed to one chain.
 *
 * All state is reflected in URL query parameters so any view can be shared
 * as a link:
 *  - `network` (`'mainnet'` / `'testnet'`) default `DEFAULT_NETWORK`
 *  - `chain` (`'all'` or a `ChainName`) default `'all'`
 *  - `tab` (`'activity'` / `'payables'` / `'payments'` / `'withdrawals'` / `'users'`) default `'activity'`
 *  - `q` (search string) default `''`
 *  - `page` (page number, single-chain only) default `0`
 *
 * Layout:
 *  1. `ScanHeader` title, network switch, chain chips, search box.
 *  2. `ScanStats` stat strip (uses network stats or chain stats).
 *  3. Cross-chain highlight band counts cross-chain payments in the loaded window.
 *  4. Tab bar Activity / Payables / Payments / Withdrawals / Users.
 *  5. Tab panels `ActivityFeed` for Activity, scan entity tables for the rest.
 *
 * Data reads work without a connected wallet (`evm.publicClientFor` + no auth).
 */
import ScanHeader from '@/components/scan/ScanHeader.vue';
import ScanStats from '@/components/scan/ScanStats.vue';
import ScanPayablesTable from '@/components/scan/ScanPayablesTable.vue';
import ScanPaymentsTable from '@/components/scan/ScanPaymentsTable.vue';
import ScanWithdrawalsTable from '@/components/scan/ScanWithdrawalsTable.vue';
import ScanUsersTable from '@/components/scan/ScanUsersTable.vue';
import { ActivityFeed, type ActivitySource } from '@/components/activity';
import { GlassCard, SegmentedTabs } from '@/components/ui';
import {
  chainNamesEvm,
  chainNamesToChains,
  type Chain,
  type ChainName,
  type ChainNetworkType,
} from '@/schemas';
import { useAnalyticsStore, useStatsStore } from '@/stores';
import { DEFAULT_NETWORK, useScanStore, type SearchResult } from '@/stores/scan';
import type { ChainStatsSummary, NetworkStats, TokenVolume } from '@/stores/stats';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { SegmentedTabOption } from '@/components/ui';

const route = useRoute();
const router = useRouter();
const stats = useStatsStore();
const scan = useScanStore();
const analytics = useAnalyticsStore();

// -------------------------------------------------------------------------
// URL-reflected state
// -------------------------------------------------------------------------

/** Currently selected network. Defaults to `DEFAULT_NETWORK`. */
const network = ref<ChainNetworkType>((route.query.network as ChainNetworkType) || DEFAULT_NETWORK);

/** Selected chain: `'all'` or a specific chain name in the current network. */
const selectedChain = ref<string>((route.query.chain as string) || 'all');

/** Active tab. */
const activeTab = ref<string>((route.query.tab as string) || 'activity');

/** Search query string. */
const searchQuery = ref<string>((route.query.q as string) || '');

/** Current page (numbered pagination, single-chain mode). */
const page = ref<number>(Number(route.query.page) || 0);

/** Updates the router query params to match the current state without navigating away. */
const syncRoute = () => {
  router.replace({
    query: {
      ...(network.value !== DEFAULT_NETWORK ? { network: network.value } : {}),
      ...(selectedChain.value !== 'all' ? { chain: selectedChain.value } : {}),
      ...(activeTab.value !== 'activity' ? { tab: activeTab.value } : {}),
      ...(searchQuery.value ? { q: searchQuery.value } : {}),
      ...(page.value !== 0 ? { page: String(page.value) } : {}),
    },
  });
};

watch([network, selectedChain, activeTab, searchQuery, page], syncRoute);

// -------------------------------------------------------------------------
// Derived chain data
// -------------------------------------------------------------------------

/** Chains in the current network (EVM only Solana inactive). */
const networkChains = computed<Chain[]>(() =>
  chainNamesEvm.map((n) => chainNamesToChains[n]).filter((c) => c.networkType === network.value)
);

/** The active `Chain` when a single chain is selected, or `null` for all-chains. */
const activeChain = computed<Chain | null>(() => {
  if (selectedChain.value === 'all') return null;
  return chainNamesToChains[selectedChain.value as ChainName] ?? null;
});

// -------------------------------------------------------------------------
// Stats
// -------------------------------------------------------------------------

const chainStatsData = ref<ChainStatsSummary | null>(null);
const networkStatsData = ref<NetworkStats | null>(null);
const tokenVolumes = ref<TokenVolume[]>([]);
const statsLoading = ref(false);

const loadStats = async () => {
  statsLoading.value = true;
  try {
    if (activeChain.value) {
      chainStatsData.value = await stats.getChainStats(activeChain.value);
      tokenVolumes.value = await stats.getTokenVolumes(activeChain.value);
      networkStatsData.value = null;
    } else {
      networkStatsData.value = await stats.getNetworkStats(network.value);
      tokenVolumes.value = Object.values(networkStatsData.value?.volumesByToken ?? {});
      chainStatsData.value = null;
    }
  } finally {
    statsLoading.value = false;
  }
};

const activeStats = computed<ChainStatsSummary | NetworkStats | null>(() =>
  activeChain.value ? chainStatsData.value : networkStatsData.value
);

/** Withdrawal fee basis points for the withdrawal fee reconstruction. */
const withdrawalFeePercentage = computed(() => chainStatsData.value?.withdrawalFeePercentage ?? 0);

// Reset to page 0 when chain/network/tab changes.
watch([network, selectedChain, activeTab], () => {
  page.value = 0;
  loadStats();
});

onMounted(loadStats);

// -------------------------------------------------------------------------
// Tab configuration
// -------------------------------------------------------------------------

const tabOptions = computed<SegmentedTabOption[]>(() => [
  { label: 'Activity', value: 'activity' },
  { label: 'Payables', value: 'payables' },
  { label: 'Payments', value: 'payments' },
  { label: 'Withdrawals', value: 'withdrawals' },
  { label: 'Users', value: 'users' },
]);

// -------------------------------------------------------------------------
// ActivityFeed source
// -------------------------------------------------------------------------

const activitySource = computed<ActivitySource>(() => {
  if (activeChain.value) {
    return { kind: 'chain', chain: activeChain.value };
  }
  return { kind: 'network', networkType: network.value };
});

// -------------------------------------------------------------------------
// Cross-chain highlight band
// -------------------------------------------------------------------------

/**
 * Counts cross-chain payments in the latest loaded window of payable
 * payments (where `payerChainId` differs from the chain the payment landed
 * on). This is a client-side count over whatever window is currently loaded
 * the UI labels this explicitly.
 */
const crossChainCount = ref(0);

// -------------------------------------------------------------------------
// Search result handling
// -------------------------------------------------------------------------

const handleSearchResult = (result: SearchResult) => {
  analytics.recordEvent('scan_search', { kind: result.kind });
  if (result.kind === 'address') {
    router.push(`/scan/address/${result.address}`);
  } else if (result.kind === 'entity' && result.matches.length === 1) {
    const m = result.matches[0];
    if (m.type === 'userPayment' || m.type === 'payablePayment') {
      router.push(`/receipt/${m.id}`);
    } else if (m.type === 'payable') {
      router.push(`/payable/${m.id}`);
    }
  } else if (result.kind === 'chain-filter') {
    selectedChain.value = result.chainName;
  } else if (result.kind === 'token-filter') {
    // Token filter is not yet persisted in the URL just show in the filter note area.
    // The search box already shows "No exact on-chain match" for non-matching queries.
  } else if (result.kind === 'text-filter') {
    // Pass text filter through to tables via the textFilter prop.
  }
};

const textFilter = computed(() => {
  // Only drive text filter when we have a search query but no on-chain match.
  return searchQuery.value;
});

const PAGE_SIZE = 20;
</script>

<template>
  <main class="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
    <!-- 1. Header: title, network switch, chain chips, search -->
    <ScanHeader
      v-model="searchQuery"
      :network="network"
      :chain="selectedChain"
      :network-chains="networkChains"
      @update:network="network = $event"
      @update:chain="selectedChain = $event"
      @update:model-value="(v) => { searchQuery = v; }"
    />

    <!-- 2. Stats strip -->
    <ScanStats
      :stats="activeStats"
      :token-volumes="tokenVolumes"
      :loading="statsLoading"
      :all-chains="selectedChain === 'all'"
      :chains="networkChains"
    />

    <!-- 3. Cross-chain highlight band (only when data is available) -->
    <GlassCard v-if="crossChainCount > 0 || (activeStats && ('foreignPayablesCount' in activeStats))" variant="dense" padding="px-5 py-4">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span class="text-muted text-xs uppercase tracking-[0.12em]">Cross-chain activity</span>
        <span v-if="crossChainCount > 0" class="tabular-nums font-semibold">
          {{ crossChainCount }} cross-chain payment{{ crossChainCount === 1 ? '' : 's' }}
          <span class="text-muted font-normal text-xs ml-1">in the latest {{ PAGE_SIZE }} loaded</span>
        </span>
        <span
          v-if="activeStats && 'foreignPayablesCount' in activeStats && activeStats.foreignPayablesCount > 0"
          class="tabular-nums font-semibold"
        >
          {{ activeStats.foreignPayablesCount }} synced payable{{ activeStats.foreignPayablesCount === 1 ? '' : 's' }}
          <span class="text-muted font-normal text-xs ml-1">from other chains</span>
        </span>
      </div>
    </GlassCard>

    <!-- 4. Tab bar -->
    <SegmentedTabs v-model="activeTab" :options="tabOptions" />

    <!-- 5. Tab panels -->
    <div>
      <!-- Activity tab -->
      <div v-show="activeTab === 'activity'" role="tabpanel" aria-label="Activity feed">
        <ActivityFeed
          :source="activitySource"
          :page-size="PAGE_SIZE"
          searchable
          filterable
          :persist-key="`scan-activity-${network}-${selectedChain}`"
        />
      </div>

      <!-- Payables tab -->
      <div v-show="activeTab === 'payables'" role="tabpanel" aria-label="Payables list">
        <ScanPayablesTable
          :chain-name="activeChain?.name ?? null"
          :network-type="network"
          :page="page"
          :page-size="PAGE_SIZE"
          :text-filter="textFilter"
          @update:page="page = $event"
        />
      </div>

      <!-- Payments tab -->
      <div v-show="activeTab === 'payments'" role="tabpanel" aria-label="Payments list">
        <ScanPaymentsTable
          :chain-name="activeChain?.name ?? null"
          :network-type="network"
          :page="page"
          :page-size="PAGE_SIZE"
          :text-filter="textFilter"
          @update:page="page = $event"
        />
      </div>

      <!-- Withdrawals tab -->
      <div v-show="activeTab === 'withdrawals'" role="tabpanel" aria-label="Withdrawals list">
        <ScanWithdrawalsTable
          :chain-name="activeChain?.name ?? null"
          :network-type="network"
          :page="page"
          :page-size="PAGE_SIZE"
          :withdrawal-fee-percentage="withdrawalFeePercentage"
          :text-filter="textFilter"
          @update:page="page = $event"
        />
      </div>

      <!-- Users tab -->
      <div v-show="activeTab === 'users'" role="tabpanel" aria-label="Users list">
        <ScanUsersTable
          :chain-name="activeChain?.name ?? null"
          :network-type="network"
          :page="page"
          :page-size="PAGE_SIZE"
          :text-filter="textFilter"
          @update:page="page = $event"
        />
      </div>
    </div>
  </main>
</template>
