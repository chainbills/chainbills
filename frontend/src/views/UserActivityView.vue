<script setup lang="ts">
/**
 * src/views/UserActivityView.vue — the connected wallet's activity page,
 * route `/activity`.
 */
import SignInButton from '@/components/SignInButton.vue';
import { ActivityFeed, type ActivitySource } from '@/components/activity';
import { AddressChip, ChainSwitcher, EmptyState, ScrollToTop, SearchInput, StatTile } from '@/components/ui';
import { chainNamesEvm, chainNamesToChains } from '@/schemas';
import { useAnalyticsStore, useAuthStore, useEvmStore } from '@/stores';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const evm = useEvmStore();
const analytics = useAnalyticsStore();
const router = useRouter();

/** `'chain'` shows the connected chain's feed; `'network'` merges all chains. */
const scope = ref<string>('chain');

/** Maps ChainSwitcher's emitted value to the feed scope. */
const onScopeChange = (value: string) => {
  scope.value = value === 'network' ? 'network' : 'chain';
  analytics.recordEvent('changed_user_activity_scope', { scope: scope.value });
};

/** The value passed to ChainSwitcher: 'network' when showing all chains, otherwise the connected chain name. */
const switcherValue = computed(() =>
  scope.value === 'network' ? 'network' : (auth.currentUser?.chain.name ?? 'chain')
);

/** The feed source for `ActivityFeed`, following the current wallet/scope. `null` while signed out. */
const source = computed<ActivitySource | null>(() => {
  const user = auth.currentUser;
  if (!user) return null;
  if (scope.value === 'chain')
    return { kind: 'user', address: user.walletAddress, networkType: user.chain.networkType, chain: user.chain };
  return { kind: 'user', address: user.walletAddress, networkType: user.chain.networkType };
});

const persistKey = computed(() => {
  const user = auth.currentUser;
  if (!user) return undefined;
  // Include chain name for single-chain scope so a wallet chain switch forces a remount + skeleton.
  // Include network type for all-chains scope so switching networks (testnet <-> mainnet) also remounts.
  const suffix = scope.value === 'network'
    ? `network::${user.chain.networkType}`
    : `chain::${user.chain.name}`;
  return `user-activity::${user.walletAddress}::${suffix}`;
});

// ---------------------------------------------------------------------------
// Stats row
// ---------------------------------------------------------------------------

interface UserStats {
  payments: number;
  payables: number;
  withdrawals: number;
  activities: number;
}

const ZERO_STATS: UserStats = { payments: 0, payables: 0, withdrawals: 0, activities: 0 };
const stats = ref<UserStats | null>(null);
const statsLoading = ref(true);

interface RawUserCounters {
  paymentsCount: unknown;
  payablesCount: unknown;
  withdrawalsCount: unknown;
  activitiesCount: unknown;
}

const addStats = (a: UserStats, raw: RawUserCounters | null): UserStats => ({
  payments: a.payments + (raw ? Number(raw.paymentsCount) : 0),
  payables: a.payables + (raw ? Number(raw.payablesCount) : 0),
  withdrawals: a.withdrawals + (raw ? Number(raw.withdrawalsCount) : 0),
  activities: a.activities + (raw ? Number(raw.activitiesCount) : 0),
});

const loadStats = async () => {
  const user = auth.currentUser;
  if (!user) {
    stats.value = null;
    return;
  }
  statsLoading.value = true;
  try {
    if (scope.value === 'chain') {
      const raw = await evm.fetchUserOnChain(user.walletAddress, user.chain.name);
      stats.value = addStats(ZERO_STATS, raw);
    } else {
      const chains = chainNamesEvm.filter((n) => chainNamesToChains[n].networkType === user.chain.networkType);
      const raws = await Promise.all(chains.map((n) => evm.fetchUserOnChain(user.walletAddress, n)));
      stats.value = raws.reduce(addStats, ZERO_STATS);
    }
  } finally {
    statsLoading.value = false;
  }
};

watch([() => auth.currentUser?.walletAddress, () => auth.currentUser?.chain.name, scope], loadStats, { immediate: true });

// ---------------------------------------------------------------------------
// Signed-out lookup
// ---------------------------------------------------------------------------

const lookupAddress = ref('');

const goToAddress = () => {
  const address = lookupAddress.value.trim();
  if (!address) return;
  analytics.recordEvent('looked_up_address', { from: 'user_activity_page' });
  router.push(`/scan/address/${address}`);
};
</script>

<template>
  <div class="max-w-screen-xl mx-auto pb-20">
    <template v-if="!auth.currentUser">
      <EmptyState
        title="Connect your wallet"
        description="Sign in to see your payments, payables and withdrawals across chains."
      >
        <template #action>
          <div class="flex flex-col items-center gap-4">
            <SignInButton
              id="user-activity"
              @click="analytics.recordEvent('clicked_signin', { from: 'user_activity_page' })"
            />
            <div class="flex items-center gap-2">
              <SearchInput
                v-model="lookupAddress"
                placeholder="Look up any address"
                class="w-64"
                @keyup.enter="goToAddress"
              />
              <button
                type="button"
                class="rounded-full border border-glass-border bg-glass-tint backdrop-blur px-3.5 py-2 text-sm text-fg hover:bg-fg/5"
                @click="goToAddress"
              >
                Go
              </button>
            </div>
          </div>
        </template>
      </EmptyState>
    </template>

    <template v-else>
      <!-- Header: title left, chain switcher + wallet right -->
      <header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
        <h1 class="font-display text-display-md text-fg">Your activity</h1>

        <div class="flex items-center gap-2 shrink-0">
          <ChainSwitcher
            :model-value="switcherValue"
            show-all-chains
            @update:model-value="onScopeChange"
          />
          <AddressChip :value="auth.currentUser.walletAddress" :chain="auth.currentUser.chain" kind="address" />
        </div>
      </header>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatTile label="Payments made" :value="stats?.payments" :loading="statsLoading" />
        <StatTile label="Payables created" :value="stats?.payables" :loading="statsLoading" />
        <StatTile label="Withdrawals" :value="stats?.withdrawals" :loading="statsLoading" />
        <StatTile label="Total activities" :value="stats?.activities" :loading="statsLoading" accent />
      </div>

      <ActivityFeed
        v-if="source"
        :key="persistKey"
        :source="source"
        :tabs="['all', 'payables', 'payments', 'withdrawals']"
        searchable
        filterable
        :persist-key="persistKey"
      />
    </template>
  </div>

  <ScrollToTop />
</template>
