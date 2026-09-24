<script setup lang="ts">
/**
 * src/views/UserActivityView.vue — the connected wallet's activity page,
 * route `/activity`.
 *
 * Two scopes, switched with a `SegmentedTabs`: "This chain" (the connected
 * wallet's own on-chain feed, `stores/activity.ts`'s `getForUser`) and "All
 * {network} chains" (every EVM chain of the connected chain's network,
 * merged — `getForUserAcrossChains`). Both render through the same
 * `ActivityFeed`, which owns tabs, filters, search, pagination and the
 * loading/empty/error states.
 *
 * The stats row (`StatTile`s) reads `getUser(address)` directly — for "This
 * chain" that's one read on the connected chain; for the merged scope it's
 * one read per chain of the network, summed client-side (mainnet and
 * testnet counters are never summed together).
 *
 * When no wallet is connected, shows a connect CTA plus a "look up any
 * address" input that routes to `/scan/address/:address` instead
 * of requiring a signed-in wallet just to look at public activity.
 */
import SignInButton from '@/components/SignInButton.vue';
import { ActivityFeed, type ActivitySource } from '@/components/activity';
import { AddressChip, EmptyState, NetworkPill, SearchInput, SegmentedTabs, StatTile } from '@/components/ui';
import { chainNamesEvm, chainNamesToChains } from '@/schemas';
import { useAnalyticsStore, useAuthStore, useEvmStore } from '@/stores';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const evm = useEvmStore();
const analytics = useAnalyticsStore();
const router = useRouter();

/** `'chain'` — just the connected chain's own feed; `'network'` — merged across every EVM chain of the connected chain's network. Kept as a plain `string` (rather than a narrower union) since `SegmentedTabs` emits `string`. */
const scope = ref<string>('chain');

const scopeOptions = computed(() => [
  { label: 'This chain', value: 'chain' },
  { label: `All ${auth.currentUser?.chain.networkType ?? 'testnet'} chains`, value: 'network' },
]);

/** The feed source for `ActivityFeed`, following the current wallet/scope. `null` while signed out. */
const source = computed<ActivitySource | null>(() => {
  const user = auth.currentUser;
  if (!user) return null;
  if (scope.value === 'chain')
    return { kind: 'user', address: user.walletAddress, networkType: user.chain.networkType, chain: user.chain };
  return { kind: 'user', address: user.walletAddress, networkType: user.chain.networkType };
});

const persistKey = computed(() =>
  auth.currentUser ? `user-activity::${auth.currentUser.walletAddress}::${scope.value}` : undefined
);

// ---------------------------------------------------------------------------
// Stats row: `getUser(address)` on the relevant chain(s), summed for the
// merged scope. Independent of `ActivityFeed`'s own data — a page count
// isn't the same as a feed page, and the feed does its own fetching.
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

/** The subset of `getUser(address)`'s raw fields this page reads — the counters are on-chain integers of unspecified numeric type, `Number()`-converted here rather than trusted as already-numbers. */
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

watch([() => auth.currentUser?.walletAddress, scope], loadStats, { immediate: true });

watch(scope, (v) => analytics.recordEvent('changed_user_activity_scope', { scope: v }));

// ---------------------------------------------------------------------------
// Signed-out state: connect CTA, plus a lookup that works without a wallet.
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
      <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 class="font-display text-display-md text-fg mb-2">Your activity</h1>
          <div class="flex items-center gap-2">
            <AddressChip :value="auth.currentUser.walletAddress" :chain="auth.currentUser.chain" kind="address" />
            <NetworkPill :type="auth.currentUser.chain.networkType" />
          </div>
        </div>
        <SegmentedTabs v-model="scope" :options="scopeOptions" />
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
        :tabs="['all', 'payments', 'withdrawals', 'payables']"
        searchable
        filterable
        :persist-key="persistKey"
      />
    </template>
  </div>
</template>
