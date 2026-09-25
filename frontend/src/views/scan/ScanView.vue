<script setup lang="ts">
/**
 * src/views/scan/ScanView.vue
 *
 * The main Chainbills Scan overview page (`/scan`). Shows protocol-wide
 * activity, entity counts and token volumes across all chains of the selected
 * network. Chain filtering is handled inside the `ActivityFeed` component
 * itself. Network is set via `?network=` query param (defaults to testnet).
 */
import ScanHeader from '@/components/scan/ScanHeader.vue';
import ScanStats from '@/components/scan/ScanStats.vue';
import { ActivityFeed, type ActivitySource } from '@/components/activity';
import { GlassCard, ScrollToTop } from '@/components/ui';
import { chainNamesEvm, chainNamesToChains, type Chain, type ChainName, type ChainNetworkType } from '@/schemas';
import { useStatsStore } from '@/stores';
import { DEFAULT_NETWORK } from '@/stores/scan';
import type { ChainStatsSummary, NetworkStats, TokenVolume } from '@/stores/stats';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const stats = useStatsStore();

// -------------------------------------------------------------------------
// URL-reflected state
// -------------------------------------------------------------------------

const network = ref<ChainNetworkType>((route.query.network as ChainNetworkType) || DEFAULT_NETWORK);

const syncRoute = () => {
  router.replace({
    query: {
      ...(network.value !== DEFAULT_NETWORK ? { network: network.value } : {}),
    },
  });
};

watch([network], syncRoute);

// -------------------------------------------------------------------------
// Derived chain data
// -------------------------------------------------------------------------

const networkChains = computed<Chain[]>(() =>
  chainNamesEvm.map((n) => chainNamesToChains[n]).filter((c) => c.networkType === network.value)
);

// -------------------------------------------------------------------------
// Chain filter (driven by ActivityFeed's internal chain dropdown)
// -------------------------------------------------------------------------

const chainFilter = ref<string>('all');

const activeChain = computed<Chain | null>(() => {
  if (chainFilter.value === 'all') return null;
  return chainNamesToChains[chainFilter.value as ChainName] ?? null;
});

// -------------------------------------------------------------------------
// Stats — network-wide or per-chain depending on chainFilter
// -------------------------------------------------------------------------

const networkStatsData = ref<NetworkStats | null>(null);
const chainStatsData = ref<ChainStatsSummary | null>(null);
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

watch([network, chainFilter], () => {
  loadStats();
});

onMounted(loadStats);

// -------------------------------------------------------------------------
// ActivityFeed source (always network-wide)
// -------------------------------------------------------------------------

const activitySource = computed<ActivitySource>(() => ({
  kind: 'network',
  networkType: network.value,
}));

// -------------------------------------------------------------------------
// Cross-chain highlight band
// -------------------------------------------------------------------------

const crossChainCount = ref(0);

const PAGE_SIZE = 20;
</script>

<template>
  <main class="max-w-screen-xl mx-auto py-10 space-y-8">
    <!-- 1. Header: title only -->
    <ScanHeader />

    <!-- 2. Stats strip — syncs with ActivityFeed's chain filter -->
    <ScanStats
      :stats="activeStats"
      :token-volumes="tokenVolumes"
      :loading="statsLoading"
      :all-chains="chainFilter === 'all'"
      :chains="networkChains"
    />

    <!-- 3. Cross-chain highlight band -->
    <GlassCard v-if="crossChainCount > 0" variant="dense" padding="px-5 py-4">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span class="text-muted text-xs uppercase tracking-[0.12em]">Cross-chain activity</span>
        <span class="tabular-nums font-semibold">
          {{ crossChainCount }} cross-chain payment{{ crossChainCount === 1 ? '' : 's' }}
          <span class="text-muted font-normal text-xs ml-1">in the latest {{ PAGE_SIZE }} loaded</span>
        </span>
      </div>
    </GlassCard>

    <!-- 4. Live activity feed -->
    <ActivityFeed
      :source="activitySource"
      :page-size="PAGE_SIZE"
      searchable
      filterable
      :persist-key="`scan-activity-${network}`"
      @update:chain-filter="chainFilter = $event"
    />
  </main>

  <ScrollToTop />
</template>
