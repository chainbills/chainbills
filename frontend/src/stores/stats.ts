// stores/stats.ts
//
// Chain- and network-wide statistics: entity counts (`getChainStats`),
// Wormhole/CCTP wiring and the withdrawal fee (`getConfig`), and per-token
// on-chain volume (`getTokenDetails`). Every result is memoized in-process
// for 30 seconds, since these numbers back dashboards/Scan that many
// components on the same page can ask for at once without needing
// sub-30s freshness.
//
// Mainnet and testnet are never mixed: `getNetworkStats` takes an explicit
// `ChainNetworkType` and only ever aggregates the chains that match it.
// Volumes are kept per token and only ever summed across chains for the
// *same* token — never across different tokens (a USDC total and an ETH
// total are never added together).
//
// Used by: `views/DashboardView.vue`, `views/scan/*`.
import { chainNamesEvm, chainNamesToChains, tokens, type Chain, type ChainNetworkType, type Token } from '@/schemas';
import { useEvmStore } from '@/stores';
import { defineStore } from 'pinia';

/** `getChainStats()` counters plus the `getConfig()` facts the UI needs (fee, Wormhole/CCTP availability). */
export interface ChainStatsSummary {
  chain: Chain;
  usersCount: number;
  payablesCount: number;
  foreignPayablesCount: number;
  userPaymentsCount: number;
  payablePaymentsCount: number;
  withdrawalsCount: number;
  activitiesCount: number;
  /** Withdrawal fee, in basis points (divide by 10_000 for a fraction). */
  withdrawalFeePercentage: number;
  /** True when this chain has a Wormhole core contract configured (`wormholeChainId != 0`). */
  hasWormhole: boolean;
  /** True when this chain has a Circle CCTP transmitter configured (non-zero address). */
  hasCctp: boolean;
}

/** On-chain lifetime volume for one token on one chain, straight from `getTokenDetails`. */
export interface TokenVolume {
  token: Token;
  totalUserPaid: bigint;
  totalPayableReceived: bigint;
  totalWithdrawn: bigint;
  totalWithdrawalFeesCollected: bigint;
}

/** Aggregated stats across every chain of one network type (mainnet or testnet — never mixed). */
export interface NetworkStats {
  networkType: ChainNetworkType;
  usersCount: number;
  payablesCount: number;
  userPaymentsCount: number;
  payablePaymentsCount: number;
  withdrawalsCount: number;
  activitiesCount: number;
  /** Volume summed per token across the network's chains, keyed by token name. Never summed across different tokens. */
  volumesByToken: Record<string, TokenVolume>;
  /** The same counters/config, broken out per chain, for a per-chain breakdown UI. */
  perChain: ChainStatsSummary[];
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const CACHE_TTL_MS = 30_000;

export const useStatsStore = defineStore('stats', () => {
  const evm = useEvmStore();

  // In-memory memoization, keyed by call signature. Deliberately not persisted (unlike `stores/cache.ts`) — these
  // numbers are cheap to refresh and should not survive a reload, only a burst of near-simultaneous callers.
  const memo = new Map<string, { value: any; expiresAt: number }>();

  const cached = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const hit = memo.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value as T;
    const value = await fn();
    memo.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  };

  /** `getChainStats()` + `getConfig()` for one chain. `null` for a non-EVM chain or if either read fails. */
  const getChainStats = async (chain: Chain): Promise<ChainStatsSummary | null> => {
    if (!chain.isEvm) return null;
    return cached(`chain-stats::${chain.name}`, async () => {
      const [stats, config] = await Promise.all([
        evm.getChainStatsOnChain(chain.name),
        evm.fetchChainConfig(chain.name),
      ]);
      if (!stats || !config) return null;
      return {
        chain,
        usersCount: Number(stats.usersCount),
        payablesCount: Number(stats.payablesCount),
        foreignPayablesCount: Number(stats.foreignPayablesCount),
        userPaymentsCount: Number(stats.userPaymentsCount),
        payablePaymentsCount: Number(stats.payablePaymentsCount),
        withdrawalsCount: Number(stats.withdrawalsCount),
        activitiesCount: Number(stats.activitiesCount),
        withdrawalFeePercentage: Number(config.withdrawalFeePercentage),
        hasWormhole: Number(config.wormholeChainId) !== 0,
        hasCctp: !!config.circleTransmitter && `${config.circleTransmitter}`.toLowerCase() !== ZERO_ADDRESS,
      };
    });
  };

  /** On-chain volume for every token that has details on `chain` (skipping tokens the chain does not support). */
  const getTokenVolumes = async (chain: Chain): Promise<TokenVolume[]> => {
    if (!chain.isEvm) return [];
    return cached(`token-volumes::${chain.name}`, async () => {
      const candidates = tokens.filter((t) => !!t.details[chain.name]);
      const results = await Promise.all(
        candidates.map(async (token): Promise<TokenVolume | null> => {
          const address = token.details[chain.name]!.address;
          const raw = await evm.getTokenDetailsOnChain(address, chain.name);
          if (!raw || !raw.isSupported) return null;
          return {
            token,
            totalUserPaid: BigInt(raw.totalUserPaid),
            totalPayableReceived: BigInt(raw.totalPayableReceived),
            totalWithdrawn: BigInt(raw.totalWithdrawn),
            totalWithdrawalFeesCollected: BigInt(raw.totalWithdrawalFeesCollected),
          };
        })
      );
      return results.filter((r): r is TokenVolume => r !== null);
    });
  };

  /** Aggregates counts and per-token volume across every EVM chain of `networkType`. Mainnet and testnet are never mixed. */
  const getNetworkStats = async (networkType: ChainNetworkType): Promise<NetworkStats> => {
    const chains = chainNamesEvm.map((n) => chainNamesToChains[n]).filter((c) => c.networkType === networkType);
    return cached(`network-stats::${networkType}`, async () => {
      const perChain = (await Promise.all(chains.map((c) => getChainStats(c)))).filter(
        (s): s is ChainStatsSummary => !!s
      );
      const volumesPerChain = await Promise.all(chains.map((c) => getTokenVolumes(c)));

      // Sum per token, across chains, never across different tokens.
      const volumesByToken: Record<string, TokenVolume> = {};
      for (const v of volumesPerChain.flat()) {
        const existing = volumesByToken[v.token.name];
        if (existing) {
          existing.totalUserPaid += v.totalUserPaid;
          existing.totalPayableReceived += v.totalPayableReceived;
          existing.totalWithdrawn += v.totalWithdrawn;
          existing.totalWithdrawalFeesCollected += v.totalWithdrawalFeesCollected;
        } else {
          volumesByToken[v.token.name] = { ...v };
        }
      }

      const sum = (
        field:
          | 'usersCount'
          | 'payablesCount'
          | 'userPaymentsCount'
          | 'payablePaymentsCount'
          | 'withdrawalsCount'
          | 'activitiesCount'
      ) => perChain.reduce((acc, s) => acc + s[field], 0);

      return {
        networkType,
        usersCount: sum('usersCount'),
        payablesCount: sum('payablesCount'),
        userPaymentsCount: sum('userPaymentsCount'),
        payablePaymentsCount: sum('payablePaymentsCount'),
        withdrawalsCount: sum('withdrawalsCount'),
        activitiesCount: sum('activitiesCount'),
        volumesByToken,
        perChain,
      };
    });
  };

  return { getChainStats, getNetworkStats, getTokenVolumes };
});
