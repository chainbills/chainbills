<script setup lang="ts">
/**
 * src/components/scan/ScanStats.vue
 *
 * The stats strip shown below the Scan header. Renders one `StatTile` per
 * entity counter (payables, payments, withdrawals, users, activities) and
 * per-token volume tiles. When `allChains` is true, a `ChainBreakdownBar`
 * sits underneath each count tile to show the per-chain split.
 *
 * The `stats` prop accepts either a `ChainStatsSummary` (single-chain view)
 * or a `NetworkStats` (all-chains view) both carry the same set of count
 * fields, so the template reads them uniformly.
 *
 * Props:
 *  - `stats`: the resolved stats object, or `null` while loading.
 *  - `tokenVolumes`: per-token volume data, or `null` while loading.
 *  - `loading`: true while any stats fetch is in flight.
 *  - `allChains`: true when the "All chains" filter is active.
 *  - `chains`: the network's chains, used by `ChainBreakdownBar`.
 *
 * Usage:
 * ```vue
 * <ScanStats :stats="networkStats" :token-volumes="volumes" :loading="loading" all-chains :chains="testnetChains" />
 * <ScanStats :stats="chainStats" :token-volumes="chainVolumes" :loading="loading" :chains="[]" />
 * ```
 */
import ChainBreakdownBar from './ChainBreakdownBar.vue';
import { StatTile } from '@/components/ui';
import { formatTokenAmount, type Chain, type ChainName } from '@/schemas';
import type { ChainStatsSummary, NetworkStats, TokenVolume } from '@/stores/stats';
import { computed } from 'vue';

const props = defineProps<{
  /** Resolved stats object (single-chain or network-wide). Null while loading. */
  stats: ChainStatsSummary | NetworkStats | null;
  /** Per-token volume data. Null while loading. */
  tokenVolumes: TokenVolume[] | null;
  /** True while a stats fetch is in-flight. */
  loading: boolean;
  /** True when the "All chains" selector is active shows the breakdown bar. */
  allChains: boolean;
  /** The network's chains, forwarded to `ChainBreakdownBar`. */
  chains: Chain[];
}>();

/** Builds per-chain counts for one stat field, when stats is a NetworkStats. */
const perChainValues = (field: keyof ChainStatsSummary): Partial<Record<ChainName, number>> => {
  if (!props.stats || !isNetworkStats(props.stats)) return {};
  return Object.fromEntries(
    props.stats.perChain.map((s) => [s.chain.name, s[field] as number])
  ) as Partial<Record<ChainName, number>>;
};

/** Type guard distinguishing `NetworkStats` (has `perChain`) from `ChainStatsSummary`. */
const isNetworkStats = (s: ChainStatsSummary | NetworkStats): s is NetworkStats =>
  'perChain' in s;

/** Total for a numeric field across the stats object. */
const get = (field: 'usersCount' | 'payablesCount' | 'userPaymentsCount' | 'payablePaymentsCount' | 'withdrawalsCount' | 'activitiesCount'): number =>
  props.stats ? props.stats[field] ?? 0 : 0;

/**
 * Formats a token volume for display using the most common chain decimals for
 * that token. The decimals are the same across chains for any supported token,
 * so this reads the first available chain entry.
 */
const formatVolume = (vol: TokenVolume): string => {
  const firstEntry = Object.values(vol.token.details)[0];
  const decimals = firstEntry?.decimals ?? 0;
  return formatTokenAmount(vol.totalPayableReceived, decimals);
};
</script>

<template>
  <section aria-label="Network statistics">
    <!-- Main count tiles -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <!-- Payables -->
      <div class="space-y-1">
        <StatTile label="Payables" :value="get('payablesCount').toLocaleString()" :loading="loading" />
        <ChainBreakdownBar
          v-if="allChains && stats"
          :chains="chains"
          :values="perChainValues('payablesCount')"
          :total="get('payablesCount')"
        />
      </div>

      <!-- Payments split hint for made vs received since cross-chain counts on both sides -->
      <div class="space-y-1">
        <StatTile
          label="Payments"
          :value="get('payablePaymentsCount').toLocaleString()"
          :hint="`${get('userPaymentsCount').toLocaleString()} made`"
          :loading="loading"
        />
        <ChainBreakdownBar
          v-if="allChains && stats"
          :chains="chains"
          :values="perChainValues('payablePaymentsCount')"
          :total="get('payablePaymentsCount')"
        />
      </div>

      <!-- Withdrawals -->
      <div class="space-y-1">
        <StatTile label="Withdrawals" :value="get('withdrawalsCount').toLocaleString()" :loading="loading" />
        <ChainBreakdownBar
          v-if="allChains && stats"
          :chains="chains"
          :values="perChainValues('withdrawalsCount')"
          :total="get('withdrawalsCount')"
        />
      </div>

      <!-- Users -->
      <div class="space-y-1">
        <StatTile label="Users" :value="get('usersCount').toLocaleString()" :loading="loading" />
        <ChainBreakdownBar
          v-if="allChains && stats"
          :chains="chains"
          :values="perChainValues('usersCount')"
          :total="get('usersCount')"
        />
      </div>

      <!-- Activities -->
      <div class="space-y-1">
        <StatTile label="Activities" :value="get('activitiesCount').toLocaleString()" :loading="loading" />
        <ChainBreakdownBar
          v-if="allChains && stats"
          :chains="chains"
          :values="perChainValues('activitiesCount')"
          :total="get('activitiesCount')"
        />
      </div>
    </div>

    <!-- Per-token volume tiles (never sum different tokens) -->
    <div v-if="tokenVolumes && tokenVolumes.length > 0" class="mt-4 flex flex-wrap gap-3">
      <div
        v-for="vol in tokenVolumes"
        :key="vol.token.name"
        class="glass-surface glass-frost rounded-2xl px-5 py-4 relative overflow-hidden"
      >
        <span class="glass-sheen" aria-hidden="true"></span>
        <div class="relative">
          <p class="text-xs uppercase tracking-[0.12em] text-muted mb-1">{{ vol.token.name }} received</p>
          <!-- Display the formatted amount directly since TokenAmount requires a specific chain context. -->
          <p class="font-display text-display-md tabular-nums">
            {{ formatVolume(vol) }} <span class="text-muted text-sm">{{ vol.token.name }}</span>
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
