<script setup lang="ts">
/**
 * src/views/scan/ScanAddressView.vue
 *
 * The Scan address detail page (`/scan/address/:address`). Shows a wallet's
 * activity across every chain in the selected network: per-chain presence
 * cards, then a merged activity feed and per-entity tabs.
 *
 * Network is kept in the URL query param `network` (defaults to
 * `DEFAULT_NETWORK`). Switching network reloads all data.
 *
 * Sections:
 *  1. Header: large `AddressChip`, "This is you" badge when the address
 *     matches the connected wallet, network switch, per-chain explorer links.
 *  2. Per-chain presence cards: `getUser(address)` counts for each chain, or
 *     "No activity on {chain}" when the call reverts.
 *  3. `SegmentedTabs`: Activity / Payables / Payments / Withdrawals.
 *  4. Empty state when the address has never interacted on any chain of the
 *     selected network, with a link to the other network.
 *
 * Reads go through `evm.publicClientFor` (wallet-less). The `auth` store is
 * consulted only to detect "This is you".
 */
import ScanPayablesTable from '@/components/scan/ScanPayablesTable.vue';
import ScanPaymentsTable from '@/components/scan/ScanPaymentsTable.vue';
import ScanWithdrawalsTable from '@/components/scan/ScanWithdrawalsTable.vue';
import { ActivityFeed, type ActivitySource } from '@/components/activity';
import {
  AddressChip,
  ChainBadge,
  EmptyState,
  GlassCard,
  NetworkPill,
  SegmentedTabs,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import {
  chainNamesEvm,
  chainNamesToChains,
  getWalletUrl,
  type Chain,
  type ChainName,
  type ChainNetworkType,
} from '@/schemas';
import { useAuthStore, useEvmStore } from '@/stores';
import { DEFAULT_NETWORK } from '@/stores/scan';
import { useScanStore } from '@/stores/scan';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { SegmentedTabOption } from '@/components/ui';

const route = useRoute();
const router = useRouter();
const evm = useEvmStore();
const auth = useAuthStore();
const scan = useScanStore();

/** The EVM address from the route parameter. */
const address = route.params.address as string;

/** Currently selected network. */
const network = ref<ChainNetworkType>((route.query.network as ChainNetworkType) || DEFAULT_NETWORK);

/** Active tab. */
const activeTab = ref<string>((route.query.tab as string) || 'activity');

/** Current page (single-chain numbered pagination). */
const page = ref<number>(Number(route.query.page) || 0);

const syncRoute = () => {
  router.replace({
    query: {
      ...(network.value !== DEFAULT_NETWORK ? { network: network.value } : {}),
      ...(activeTab.value !== 'activity' ? { tab: activeTab.value } : {}),
      ...(page.value !== 0 ? { page: String(page.value) } : {}),
    },
  });
};

watch([network, activeTab, page], syncRoute);

// -------------------------------------------------------------------------
// "This is you" detection
// -------------------------------------------------------------------------

const isCurrentUser = computed(
  () =>
    !!auth.currentUser &&
    auth.currentUser.walletAddress?.toLowerCase() === address.toLowerCase()
);

// -------------------------------------------------------------------------
// Per-chain presence data
// -------------------------------------------------------------------------

/** One entry per EVM chain in the selected network. */
interface ChainPresence {
  chain: Chain;
  /** Null while loading; false when the call reverted (no activity). */
  data: {
    payablesCount: number;
    paymentsCount: number;
    withdrawalsCount: number;
    activitiesCount: number;
  } | null | false;
}

const chainPresences = ref<ChainPresence[]>([]);
const presenceLoading = ref(false);

/** The chains in the selected network where this address has activity. */
const activeChains = computed<Chain[]>(() =>
  chainPresences.value.filter((p) => !!p.data).map((p) => p.chain)
);

/** True when the address has no activity on any chain of the current network. */
const noActivityOnNetwork = computed(() =>
  !presenceLoading.value &&
  chainPresences.value.length > 0 &&
  chainPresences.value.every((p) => p.data === false)
);

const otherNetwork = computed<ChainNetworkType>(() =>
  network.value === 'mainnet' ? 'testnet' : 'mainnet'
);

const loadPresences = async () => {
  presenceLoading.value = true;
  const chains = chainNamesEvm
    .map((n) => chainNamesToChains[n])
    .filter((c) => c.networkType === network.value);

  chainPresences.value = chains.map((chain) => ({ chain, data: null }));

  await Promise.all(
    chains.map(async (chain, i) => {
      const raw = await evm.fetchUserOnChain(address, chain.name);
      chainPresences.value[i].data = raw
        ? {
            payablesCount: Number(raw.payablesCount),
            paymentsCount: Number(raw.paymentsCount),
            withdrawalsCount: Number(raw.withdrawalsCount),
            activitiesCount: Number(raw.activitiesCount),
          }
        : false;
    })
  );

  presenceLoading.value = false;
};

onMounted(loadPresences);
watch(network, () => {
  page.value = 0;
  loadPresences();
});

// -------------------------------------------------------------------------
// Activity feed source
// -------------------------------------------------------------------------

const activitySource = computed<ActivitySource>(() => ({
  kind: 'user',
  address,
  networkType: network.value,
}));

// -------------------------------------------------------------------------
// Tab configuration
// -------------------------------------------------------------------------

const tabOptions: SegmentedTabOption[] = [
  { label: 'Activity', value: 'activity' },
  { label: 'Payables', value: 'payables' },
  { label: 'Payments', value: 'payments' },
  { label: 'Withdrawals', value: 'withdrawals' },
];

const PAGE_SIZE = 20;

/** The first chain with activity, for single-chain paginated tables on the address page. */
const firstActiveChain = computed<ChainName | null>(() =>
  activeChains.value[0]?.name ?? null
);
</script>

<template>
  <main class="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
    <!-- 1. Header -->
    <header class="space-y-4">
      <div class="flex flex-wrap items-start gap-4">
        <!-- Title area -->
        <div class="flex-1 min-w-0 space-y-2">
          <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Address</p>
          <div class="flex flex-wrap items-center gap-3">
            <AddressChip :value="address" kind="address" class="text-lg" />
            <StatusPill v-if="isCurrentUser" label="This is you" tone="accent" />
          </div>
        </div>

        <!-- Network switch -->
        <div class="flex items-center gap-3">
          <NetworkPill :type="network" />
          <SegmentedTabs
            :modelValue="network"
            :options="[{ label: 'Mainnet', value: 'mainnet' }, { label: 'Testnet', value: 'testnet' }]"
            @update:modelValue="network = $event as ChainNetworkType"
          />
        </div>
      </div>

      <!-- Per-chain explorer links (only chains with activity) -->
      <div v-if="activeChains.length > 0" class="flex flex-wrap gap-2">
        <a
          v-for="chain in activeChains"
          :key="chain.name"
          :href="getWalletUrl(address, chain)"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border border-glass-border text-muted hover:text-fg transition-colors"
          :aria-label="`View on ${chain.displayName} explorer`"
        >
          <ChainBadge :chain="chain" :show-name="false" class="w-4 h-4" />
          {{ chain.displayName }}
        </a>
      </div>
    </header>

    <!-- 2. Per-chain presence cards -->
    <section aria-label="Chain presence">
      <h2 class="text-sm uppercase tracking-wider text-muted mb-3">Activity by chain</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <template v-for="presence in chainPresences" :key="presence.chain.name">
          <!-- Loading skeleton -->
          <GlassCard v-if="presence.data === null" variant="frost">
            <div class="space-y-2">
              <Skeleton h="h-5" w="w-32" />
              <Skeleton h="h-4" w="w-full" />
              <Skeleton h="h-4" w="w-3/4" />
            </div>
          </GlassCard>

          <!-- No activity on this chain -->
          <GlassCard v-else-if="presence.data === false" variant="dense" padding="px-5 py-4">
            <div class="flex items-center gap-3">
              <ChainBadge :chain="presence.chain" />
              <span class="text-sm text-muted">No activity</span>
            </div>
          </GlassCard>

          <!-- Has activity -->
          <GlassCard v-else variant="frost">
            <div class="flex items-center gap-3 mb-3">
              <ChainBadge :chain="presence.chain" />
            </div>
            <dl class="grid grid-cols-2 gap-y-1.5 text-sm">
              <dt class="text-muted">Payables</dt>
              <dd class="tabular-nums font-semibold">{{ presence.data.payablesCount.toLocaleString() }}</dd>
              <dt class="text-muted">Payments</dt>
              <dd class="tabular-nums font-semibold">{{ presence.data.paymentsCount.toLocaleString() }}</dd>
              <dt class="text-muted">Withdrawals</dt>
              <dd class="tabular-nums font-semibold">{{ presence.data.withdrawalsCount.toLocaleString() }}</dd>
              <dt class="text-muted">Activities</dt>
              <dd class="tabular-nums font-semibold">{{ presence.data.activitiesCount.toLocaleString() }}</dd>
            </dl>
          </GlassCard>
        </template>
      </div>
    </section>

    <!-- Empty state: no activity on any chain of the current network -->
    <div v-if="noActivityOnNetwork" class="py-16">
      <EmptyState
        title="No activity on this network"
        :description="`This address has no activity on ${network} yet.`"
      >
        <template #action>
          <button
            type="button"
            class="rounded-full px-5 py-2 text-sm font-medium bg-accent text-accent-fg hover:bg-accent/90 transition-colors"
            @click="network = otherNetwork"
          >
            Check {{ otherNetwork }}
          </button>
        </template>
      </EmptyState>
    </div>

    <!-- 3. Tabs (only shown when there is activity) -->
    <template v-if="!noActivityOnNetwork && activeChains.length > 0">
      <SegmentedTabs v-model="activeTab" :options="tabOptions" />

      <!-- Tab panels -->
      <div>
        <!-- Activity -->
        <div v-show="activeTab === 'activity'" role="tabpanel" aria-label="Address activity feed">
          <ActivityFeed
            :source="activitySource"
            :page-size="PAGE_SIZE"
            searchable
            filterable
            :persist-key="`scan-address-${address}-${network}`"
          />
        </div>

        <!-- Payables -->
        <div v-show="activeTab === 'payables'" role="tabpanel" aria-label="Address payables">
          <ScanPayablesTable
            :chain-name="firstActiveChain"
            :network-type="network"
            :page="page"
            :page-size="PAGE_SIZE"
            @update:page="page = $event"
          />
        </div>

        <!-- Payments -->
        <div v-show="activeTab === 'payments'" role="tabpanel" aria-label="Address payments">
          <ScanPaymentsTable
            :chain-name="firstActiveChain"
            :network-type="network"
            :page="page"
            :page-size="PAGE_SIZE"
            @update:page="page = $event"
          />
        </div>

        <!-- Withdrawals -->
        <div v-show="activeTab === 'withdrawals'" role="tabpanel" aria-label="Address withdrawals">
          <ScanWithdrawalsTable
            :chain-name="firstActiveChain"
            :network-type="network"
            :page="page"
            :page-size="PAGE_SIZE"
            @update:page="page = $event"
          />
        </div>
      </div>
    </template>
  </main>
</template>
