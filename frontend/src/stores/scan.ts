// stores/scan.ts
//
// The Chainbills Scan data layer: entity paginators for every chain and
// network, k-way merge helpers (parallel to `activity.ts`'s
// `mergeChainStreams`), and the search function that drives the Scan
// search box.
//
// Relationship to other stores:
//   - `evm.ts` supplies every raw on-chain read used here (bulk getters,
//     paginated id-list wrappers, chain-stats, user-level counts).
//   - `stats.ts` supplies aggregated `ChainStatsSummary`/`NetworkStats`
//     objects that the stats-strip components consume scan.ts does not
//     duplicate that logic.
//   - `activity.ts` owns all `ActivityRecord` reading and the unified
//     activity feed; scan.ts defers to `ActivityFeed` for the Activity tab
//     and does not read activity records itself.
//   - `cache.ts` memoizes immutable entities (payments, withdrawals, users,
//     activity records) across navigations payables are never cached here
//     because their state (balances, isClosed, ...) keeps changing.
//
// Every function works without a connected wallet. All reads go through
// `evm.readGetter` / `evm.readMain` on wallet-less `PublicClient`s.
//
// Newest-first pagination maths (from `reference/onchain-data.md` §2):
//   On-chain lists are stored oldest-first. To serve page P (0-indexed,
//   `pageSize` items each) newest-first:
//     offset = max(0, total - (P+1)*pageSize)
//     limit  = min(pageSize, total - offset)
//   Then reverse the returned array.
//
// K-way merge for "all chains" views:
//   Same algorithm as `activity.ts`'s `mergeChainStreams` but generalised
//   for arbitrary timestamped or un-timestamped entities. Each chain's own
//   newest-first stream is consumed via a `ScanMultiChainCursor`, which
//   records how many items have been yielded per chain so subsequent
//   "load more" calls continue from the right point without gaps or dupes.
//
// Used by: `views/scan/ScanView.vue`, `views/scan/ScanAddressView.vue`,
//   `components/scan/*`.
import {
  chainNamesEvm,
  chainNamesToChains,
  tokens,
  type Chain,
  type ChainName,
  type ChainNetworkType,
} from '@/schemas';
import { useCacheStore, useEvmStore } from '@/stores';
import { defineStore } from 'pinia';
import { useRouter } from 'vue-router';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The network/tab selection the scan URL reflects. */
export type NetworkType = ChainNetworkType;

/** The default network while mainnet activity is too sparse to be interesting as the landing state. */
export const DEFAULT_NETWORK: NetworkType = 'testnet';

/** One result item from a 32-byte id probe across chains. */
export interface EntityMatch {
  /** What kind of entity this id belongs to. */
  type: 'payable' | 'userPayment' | 'payablePayment' | 'withdrawal' | 'activity';
  /** The raw id (hex string). */
  id: string;
  /** The chain this entity lives on. */
  chainName: ChainName;
  /** The network this chain belongs to. */
  networkType: NetworkType;
}

/** The union of outcomes `search()` can return. */
export type SearchResult =
  | { kind: 'address'; address: string }
  | { kind: 'entity'; matches: EntityMatch[] }
  | { kind: 'chain-filter'; chainName: ChainName }
  | { kind: 'token-filter'; tokenSymbol: string }
  | { kind: 'text-filter'; text: string; message: string };

/**
 * Opaque cursor for a multi-chain merged entity list. Pass the cursor
 * returned from one call back into the next call to load the following
 * batch without gaps or duplicates.
 */
export interface ScanMultiChainCursor {
  /** How many items from each chain have already been yielded to the caller. */
  yielded: Partial<Record<ChainName, number>>;
}

/** One batch from a multi-chain merged entity stream. */
export interface ScanMultiChainPage<T> {
  items: T[];
  cursor: ScanMultiChainCursor;
  /** True when at least one chain still has unyielded items. */
  hasMore: boolean;
}

/** One page of a single-chain entity list (newest first). */
export interface ScanEntityPage<T> {
  items: T[];
  total: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Computes the oldest-first offset and limit for a newest-first page. */
const pageOffsetAndLimit = (total: number, page: number, pageSize: number): { offset: number; limit: number } => {
  // Newest-first means the window we want ends at the newest item:
  //   offset = max(0, total - (page+1)*pageSize)  how many old items to skip
  //   limit  = min(pageSize, total - offset)       how many items actually exist in this window
  const offset = Math.max(0, total - (page + 1) * pageSize);
  const limit = Math.min(pageSize, Math.max(0, total - offset));
  return { offset, limit };
};

const emptyCursor = (): ScanMultiChainCursor => ({ yielded: {} });

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useScanStore = defineStore('scan', () => {
  const cache = useCacheStore();
  const evm = useEvmStore();
  const router = useRouter();

  // -------------------------------------------------------------------------
  // Chain-level entity paginators (single chain, numbered pages)
  // -------------------------------------------------------------------------

  /**
   * Returns one newest-first page of payables created on `chainName`.
   * Reads `chainPayableIdsPaginated` for the ids, then `getPayablesBulk`
   * for the structs (falls back to per-id reads when the bulk call reverts).
   *
   * @param chainName - The EVM chain to query.
   * @param page - 0-based page number (newest first).
   * @param pageSize - How many items per page.
   * @returns Items and total payable count, or an empty page on error.
   */
  const getChainPayables = async (
    chainName: ChainName,
    page: number,
    pageSize: number
  ): Promise<ScanEntityPage<any>> => {
    const stats = await evm.getChainStatsOnChain(chainName);
    const total = stats ? Number(stats.payablesCount) : 0;
    if (total === 0) return { items: [], total };

    const { offset, limit } = pageOffsetAndLimit(total, page, pageSize);
    if (limit <= 0) return { items: [], total };

    const ids = await evm.getChainPayableIdsPaginated(offset, limit, chainName);
    if (!ids || ids.length === 0) return { items: [], total };

    // Newest first: the on-chain list is oldest-first, so reverse the slice.
    const newestFirst = [...ids].reverse();
    const raws = await evm.getPayablesBulk(newestFirst, chainName);
    const items = raws ?? (await perIdFallbackPayables(newestFirst, chainName));
    return { items: items.map((r: any, i: number) => ({ id: newestFirst[i], chainName, ...r })), total };
  };

  /**
   * Returns one newest-first page of payable payments (payments received on
   * `chainName`, including cross-chain arrivals) via
   * `chainPayablePaymentIdsPaginated` + `getPayablePaymentsBulk`.
   *
   * @param chainName - The EVM chain to query.
   * @param page - 0-based page number.
   * @param pageSize - Items per page.
   */
  const getChainPayablePayments = async (
    chainName: ChainName,
    page: number,
    pageSize: number
  ): Promise<ScanEntityPage<any>> => {
    const stats = await evm.getChainStatsOnChain(chainName);
    const total = stats ? Number(stats.payablePaymentsCount) : 0;
    if (total === 0) return { items: [], total };

    const { offset, limit } = pageOffsetAndLimit(total, page, pageSize);
    if (limit <= 0) return { items: [], total };

    const ids = await evm.readGetter(chainName, 'chainPayablePaymentIdsPaginated', [offset, limit], {
      ignoreErrors: true,
    });
    if (!ids || ids.length === 0) return { items: [], total };

    const newestFirst = [...ids].reverse();
    const raws = await evm.getPayablePaymentsBulk(newestFirst, chainName);
    const resolved = raws ?? (await perIdFallback(newestFirst, chainName, 'getPayablePayment'));
    return { items: resolved.map((r: any, i: number) => ({ id: newestFirst[i], chainName, ...r })), total };
  };

  /**
   * Returns one newest-first page of user payments made from `chainName`
   * via `chainUserPaymentIdsPaginated` + `getUserPaymentsBulk`.
   *
   * @param chainName - The EVM chain to query.
   * @param page - 0-based page number.
   * @param pageSize - Items per page.
   */
  const getChainUserPayments = async (
    chainName: ChainName,
    page: number,
    pageSize: number
  ): Promise<ScanEntityPage<any>> => {
    const stats = await evm.getChainStatsOnChain(chainName);
    const total = stats ? Number(stats.userPaymentsCount) : 0;
    if (total === 0) return { items: [], total };

    const { offset, limit } = pageOffsetAndLimit(total, page, pageSize);
    if (limit <= 0) return { items: [], total };

    const ids = await evm.readGetter(chainName, 'chainUserPaymentIdsPaginated', [offset, limit], {
      ignoreErrors: true,
    });
    if (!ids || ids.length === 0) return { items: [], total };

    const newestFirst = [...ids].reverse();
    const raws = await evm.getUserPaymentsBulk(newestFirst, chainName);
    const resolved = raws ?? (await perIdFallback(newestFirst, chainName, 'getUserPayment'));
    return { items: resolved.map((r: any, i: number) => ({ id: newestFirst[i], chainName, ...r })), total };
  };

  /**
   * Returns one newest-first page of withdrawals on `chainName` via
   * `chainWithdrawalIdsPaginated` + `getWithdrawalsBulk`.
   *
   * @param chainName - The EVM chain to query.
   * @param page - 0-based page number.
   * @param pageSize - Items per page.
   */
  const getChainWithdrawals = async (
    chainName: ChainName,
    page: number,
    pageSize: number
  ): Promise<ScanEntityPage<any>> => {
    const stats = await evm.getChainStatsOnChain(chainName);
    const total = stats ? Number(stats.withdrawalsCount) : 0;
    if (total === 0) return { items: [], total };

    const { offset, limit } = pageOffsetAndLimit(total, page, pageSize);
    if (limit <= 0) return { items: [], total };

    const ids = await evm.readGetter(chainName, 'chainWithdrawalIdsPaginated', [offset, limit], {
      ignoreErrors: true,
    });
    if (!ids || ids.length === 0) return { items: [], total };

    const newestFirst = [...ids].reverse();
    const raws = await evm.getWithdrawalsBulk(newestFirst, chainName);
    const resolved = raws ?? (await perIdFallback(newestFirst, chainName, 'getWithdrawal'));
    return { items: resolved.map((r: any, i: number) => ({ id: newestFirst[i], chainName, ...r })), total };
  };

  /**
   * Returns one newest-first page of users on `chainName` via
   * `chainUserAddressesPaginated` + `getUsersBulk`.
   *
   * @param chainName - The EVM chain to query.
   * @param page - 0-based page number.
   * @param pageSize - Items per page.
   */
  const getChainUsers = async (
    chainName: ChainName,
    page: number,
    pageSize: number
  ): Promise<ScanEntityPage<any>> => {
    const stats = await evm.getChainStatsOnChain(chainName);
    const total = stats ? Number(stats.usersCount) : 0;
    if (total === 0) return { items: [], total };

    const { offset, limit } = pageOffsetAndLimit(total, page, pageSize);
    if (limit <= 0) return { items: [], total };

    const addresses = await evm.getChainUserAddressesPaginated(offset, limit, chainName);
    if (!addresses || addresses.length === 0) return { items: [], total };

    // Newest-first for users means most recently registered first (by chain-list order), so reverse.
    const newestFirst = [...addresses].reverse();
    const raws = await evm.getUsersBulk(newestFirst, chainName);
    const resolved = raws ?? (await perIdFallback(newestFirst, chainName, 'getUser'));
    return { items: resolved.map((r: any, i: number) => ({ address: newestFirst[i], chainName, ...r })), total };
  };

  // -------------------------------------------------------------------------
  // Network-wide k-way merge helpers ("all chains" views)
  // -------------------------------------------------------------------------

  /**
   * K-way merges payables from every EVM chain of `networkType` by
   * `createdAt` timestamp, newest first. Continues from `cursor` so
   * "Load more" calls don't re-emit already-yielded items.
   *
   * @param networkType - `'mainnet'` or `'testnet'` never mixed.
   * @param cursor - The cursor from the previous call (or omit for the first call).
   * @param pageSize - How many merged items to return per call.
   */
  const getNetworkPayables = async (
    networkType: NetworkType,
    cursor: ScanMultiChainCursor = emptyCursor(),
    pageSize = 20
  ): Promise<ScanMultiChainPage<any>> => {
    const chains = chainNamesEvm.filter((n) => chainNamesToChains[n].networkType === networkType);
    const statsArr = await Promise.all(chains.map(async (n) => [n, await evm.getChainStatsOnChain(n)] as const));
    const totals: Partial<Record<ChainName, number>> = {};
    for (const [n, s] of statsArr) totals[n] = s ? Number(s.payablesCount) : 0;

    return mergeTimestampedStreams(
      chains,
      totals,
      cursor,
      pageSize,
      async (chainName, offset, limit) => {
        const ids = await evm.getChainPayableIdsPaginated(offset, limit, chainName);
        if (!ids || ids.length === 0) return [];
        const raws = await evm.getPayablesBulk(ids, chainName);
        const resolved = raws ?? (await perIdFallbackPayables(ids, chainName));
        return resolved.map((r: any, i: number) => ({
          id: ids[i],
          chainName,
          timestamp: r ? Number(r.createdAt) : 0,
          ...r,
        }));
      }
    );
  };

  /**
   * K-way merges payable payments (received side) from every EVM chain of
   * `networkType` by `timestamp`, newest first.
   *
   * @param networkType - `'mainnet'` or `'testnet'`.
   * @param cursor - Continuation cursor from the previous call.
   * @param pageSize - Batch size per call.
   */
  const getNetworkPayments = async (
    networkType: NetworkType,
    cursor: ScanMultiChainCursor = emptyCursor(),
    pageSize = 20
  ): Promise<ScanMultiChainPage<any>> => {
    const chains = chainNamesEvm.filter((n) => chainNamesToChains[n].networkType === networkType);
    const statsArr = await Promise.all(chains.map(async (n) => [n, await evm.getChainStatsOnChain(n)] as const));
    const totals: Partial<Record<ChainName, number>> = {};
    for (const [n, s] of statsArr) totals[n] = s ? Number(s.payablePaymentsCount) : 0;

    return mergeTimestampedStreams(
      chains,
      totals,
      cursor,
      pageSize,
      async (chainName, offset, limit) => {
        const ids = await evm.readGetter(chainName, 'chainPayablePaymentIdsPaginated', [offset, limit], {
          ignoreErrors: true,
        });
        if (!ids || ids.length === 0) return [];
        const raws = await evm.getPayablePaymentsBulk(ids, chainName);
        const resolved = raws ?? (await perIdFallback(ids, chainName, 'getPayablePayment'));
        return resolved.map((r: any, i: number) => ({
          id: ids[i],
          chainName,
          timestamp: r ? Number(r.timestamp) : 0,
          ...r,
        }));
      }
    );
  };

  /**
   * K-way merges withdrawals from every EVM chain of `networkType` by
   * `timestamp`, newest first.
   *
   * @param networkType - `'mainnet'` or `'testnet'`.
   * @param cursor - Continuation cursor.
   * @param pageSize - Batch size.
   */
  const getNetworkWithdrawals = async (
    networkType: NetworkType,
    cursor: ScanMultiChainCursor = emptyCursor(),
    pageSize = 20
  ): Promise<ScanMultiChainPage<any>> => {
    const chains = chainNamesEvm.filter((n) => chainNamesToChains[n].networkType === networkType);
    const statsArr = await Promise.all(chains.map(async (n) => [n, await evm.getChainStatsOnChain(n)] as const));
    const totals: Partial<Record<ChainName, number>> = {};
    for (const [n, s] of statsArr) totals[n] = s ? Number(s.withdrawalsCount) : 0;

    return mergeTimestampedStreams(
      chains,
      totals,
      cursor,
      pageSize,
      async (chainName, offset, limit) => {
        const ids = await evm.readGetter(chainName, 'chainWithdrawalIdsPaginated', [offset, limit], {
          ignoreErrors: true,
        });
        if (!ids || ids.length === 0) return [];
        const raws = await evm.getWithdrawalsBulk(ids, chainName);
        const resolved = raws ?? (await perIdFallback(ids, chainName, 'getWithdrawal'));
        return resolved.map((r: any, i: number) => ({
          id: ids[i],
          chainName,
          timestamp: r ? Number(r.timestamp) : 0,
          ...r,
        }));
      }
    );
  };

  /**
   * Returns users across every chain of `networkType`, grouped by chain
   * order (no reliable per-user timestamp exists on-chain). The UI labels
   * this "grouped by chain" so users understand the ordering is structural,
   * not chronological.
   *
   * @param networkType - `'mainnet'` or `'testnet'`.
   * @param cursor - Continuation cursor.
   * @param pageSize - Batch size.
   */
  const getNetworkUsers = async (
    networkType: NetworkType,
    cursor: ScanMultiChainCursor = emptyCursor(),
    pageSize = 20
  ): Promise<ScanMultiChainPage<any>> => {
    const chains = chainNamesEvm.filter((n) => chainNamesToChains[n].networkType === networkType);
    const statsArr = await Promise.all(chains.map(async (n) => [n, await evm.getChainStatsOnChain(n)] as const));
    const totals: Partial<Record<ChainName, number>> = {};
    for (const [n, s] of statsArr) totals[n] = s ? Number(s.usersCount) : 0;

    // Users have no per-record timestamp, so merge by chain order (not by timestamp).
    return mergeOrderedStreams(
      chains,
      totals,
      cursor,
      pageSize,
      async (chainName, offset, limit) => {
        const addresses = await evm.getChainUserAddressesPaginated(offset, limit, chainName);
        if (!addresses || addresses.length === 0) return [];
        const raws = await evm.getUsersBulk(addresses, chainName);
        const resolved = raws ?? (await perIdFallback(addresses, chainName, 'getUser'));
        return resolved.map((r: any, i: number) => ({ address: addresses[i], chainName, ...r }));
      }
    );
  };

  // -------------------------------------------------------------------------
  // Per-user paginators (address page)
  // -------------------------------------------------------------------------

  /**
   * Returns one newest-first page of payables created by `address` on
   * `chainName`. Reverts (returns empty) when the address has no activity
   * on that chain.
   *
   * @param address - EVM wallet address.
   * @param chainName - The chain to query.
   * @param page - 0-based page number.
   * @param pageSize - Items per page.
   */
  const getUserPayables = async (
    address: string,
    chainName: ChainName,
    page: number,
    pageSize: number
  ): Promise<ScanEntityPage<any>> => {
    const user = await evm.fetchUserOnChain(address, chainName);
    const total = user ? Number(user.payablesCount) : 0;
    if (total === 0) return { items: [], total };

    const { offset, limit } = pageOffsetAndLimit(total, page, pageSize);
    if (limit <= 0) return { items: [], total };

    const ids = await evm.getUserPayableIdsPaginated(address, offset, limit, chainName);
    if (!ids || ids.length === 0) return { items: [], total };

    const newestFirst = [...ids].reverse();
    const raws = await evm.getPayablesBulk(newestFirst, chainName);
    const resolved = raws ?? (await perIdFallbackPayables(newestFirst, chainName));
    return { items: resolved.map((r: any, i: number) => ({ id: newestFirst[i], chainName, ...r })), total };
  };

  /**
   * Returns one newest-first page of payments made by `address` on
   * `chainName` (`userPaymentIdsPaginated` + `getUserPaymentsBulk`).
   *
   * @param address - EVM wallet address.
   * @param chainName - The chain to query.
   * @param page - 0-based page number.
   * @param pageSize - Items per page.
   */
  const getUserPaymentsForAddress = async (
    address: string,
    chainName: ChainName,
    page: number,
    pageSize: number
  ): Promise<ScanEntityPage<any>> => {
    const user = await evm.fetchUserOnChain(address, chainName);
    const total = user ? Number(user.paymentsCount) : 0;
    if (total === 0) return { items: [], total };

    const { offset, limit } = pageOffsetAndLimit(total, page, pageSize);
    if (limit <= 0) return { items: [], total };

    const ids = await evm.getUserPaymentIdsPaginated(address, offset, limit, chainName);
    if (!ids || ids.length === 0) return { items: [], total };

    const newestFirst = [...ids].reverse();
    const raws = await evm.getUserPaymentsBulk(newestFirst, chainName);
    const resolved = raws ?? (await perIdFallback(newestFirst, chainName, 'getUserPayment'));
    return { items: resolved.map((r: any, i: number) => ({ id: newestFirst[i], chainName, ...r })), total };
  };

  /**
   * Returns one newest-first page of withdrawals made by `address` on
   * `chainName` (`userWithdrawalIdsPaginated` + `getWithdrawalsBulk`).
   *
   * @param address - EVM wallet address.
   * @param chainName - The chain to query.
   * @param page - 0-based page number.
   * @param pageSize - Items per page.
   */
  const getUserWithdrawalsForAddress = async (
    address: string,
    chainName: ChainName,
    page: number,
    pageSize: number
  ): Promise<ScanEntityPage<any>> => {
    const user = await evm.fetchUserOnChain(address, chainName);
    const total = user ? Number(user.withdrawalsCount) : 0;
    if (total === 0) return { items: [], total };

    const { offset, limit } = pageOffsetAndLimit(total, page, pageSize);
    if (limit <= 0) return { items: [], total };

    const ids = await evm.getUserWithdrawalIdsPaginated(address, offset, limit, chainName);
    if (!ids || ids.length === 0) return { items: [], total };

    const newestFirst = [...ids].reverse();
    const raws = await evm.getWithdrawalsBulk(newestFirst, chainName);
    const resolved = raws ?? (await perIdFallback(newestFirst, chainName, 'getWithdrawal'));
    return { items: resolved.map((r: any, i: number) => ({ id: newestFirst[i], chainName, ...r })), total };
  };

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  /**
   * Resolves a search query to a typed `SearchResult`. Detection order:
   *  1. EVM address (`0x` + 40 hex chars) → navigate to `/scan/address/:address`.
   *  2. 32-byte id (`0x` + 64 hex chars) → probe every chain in `networkType`
   *     (and the other network as a secondary), call `getPayable`,
   *     `getUserPayment`, `getPayablePayment`, `getWithdrawal`,
   *     `getActivityRecord` in parallel; collect successes; if exactly one
   *     in the primary network → navigate directly; if multiple → return
   *     `{ kind: 'entity', matches }` for the caller to show a popover.
   *  3. Chain name/alias (partial, case-insensitive) → `{ kind: 'chain-filter' }`.
   *  4. Token symbol (case-insensitive) → `{ kind: 'token-filter' }`.
   *  5. Anything else → `{ kind: 'text-filter', message: 'No exact on-chain match' }`.
   *
   * The `signal` parameter allows the caller to cancel stale in-flight probes
   * via `AbortController.signal`. When the signal fires, the function returns
   * a text-filter result rather than the stale partial outcome.
   *
   * @param q - The raw search string.
   * @param networkType - Primary network to probe first (`'mainnet'`/`'testnet'`).
   * @param signal - Optional `AbortSignal` to cancel stale in-flight probes.
   * @returns A typed `SearchResult` describing how the query resolved.
   */
  const search = async (
    q: string,
    networkType: NetworkType,
    signal?: AbortSignal
  ): Promise<SearchResult> => {
    const trimmed = q.trim();
    if (!trimmed) return { kind: 'text-filter', text: trimmed, message: '' };

    // Detection 1: EVM address 0x + exactly 40 hex chars.
    if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      return { kind: 'address', address: trimmed };
    }

    // Detection 2: 32-byte entity id 0x + exactly 64 hex chars.
    if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
      const otherNetwork: NetworkType = networkType === 'mainnet' ? 'testnet' : 'mainnet';
      const primaryChains = chainNamesEvm.filter((n) => chainNamesToChains[n].networkType === networkType);
      const secondaryChains = chainNamesEvm.filter((n) => chainNamesToChains[n].networkType === otherNetwork);

      const probeChain = async (chainName: ChainName, nt: NetworkType): Promise<EntityMatch[]> => {
        if (signal?.aborted) return [];
        const getterFns: Array<[string, EntityMatch['type']]> = [
          ['getPayable', 'payable'],
          ['getUserPayment', 'userPayment'],
          ['getPayablePayment', 'payablePayment'],
          ['getWithdrawal', 'withdrawal'],
          ['getActivityRecord', 'activity'],
        ];
        const results = await Promise.all(
          getterFns.map(async ([fn, type]) => {
            const raw = await evm.readGetter(chainName, fn, [trimmed], { ignoreErrors: true });
            if (!raw) return null;
            return { type, id: trimmed, chainName, networkType: nt } as EntityMatch;
          })
        );
        return results.filter((r): r is EntityMatch => r !== null);
      };

      const [primaryMatches, secondaryMatches] = await Promise.all([
        Promise.all(primaryChains.map((c) => probeChain(c, networkType))),
        Promise.all(secondaryChains.map((c) => probeChain(c, otherNetwork))),
      ]);

      if (signal?.aborted) return { kind: 'text-filter', text: trimmed, message: 'Search cancelled' };

      const allPrimary = primaryMatches.flat();
      const allSecondary = secondaryMatches.flat();
      const allMatches = [...allPrimary, ...allSecondary];

      if (allMatches.length === 0) {
        return { kind: 'text-filter', text: trimmed, message: 'No exact on-chain match' };
      }

      // A single primary-network match navigates directly; let the caller handle it.
      if (allPrimary.length === 1) {
        return { kind: 'entity', matches: allPrimary };
      }

      return { kind: 'entity', matches: allMatches };
    }

    // Detection 3: Chain name or alias (partial, case-insensitive).
    const lq = trimmed.toLowerCase();
    for (const chainName of chainNamesEvm) {
      const chain = chainNamesToChains[chainName];
      if (
        chain.name.toLowerCase().includes(lq) ||
        chain.displayName.toLowerCase().includes(lq)
      ) {
        // Only suggest chains in the active network.
        if (chain.networkType === networkType) {
          return { kind: 'chain-filter', chainName };
        }
      }
    }

    // Detection 4: Token symbol.
    for (const token of tokens) {
      if (token.name.toLowerCase() === lq) {
        return { kind: 'token-filter', tokenSymbol: token.name };
      }
    }

    // Detection 5: Anything else substring filter on the loaded window.
    return { kind: 'text-filter', text: trimmed, message: 'No exact on-chain match' };
  };

  // -------------------------------------------------------------------------
  // Internal merge helpers
  // -------------------------------------------------------------------------

  /**
   * K-way merge for entities that carry a numeric `timestamp` field.
   * Fetches the next batch from every chain that still has unyielded items,
   * then greedily takes the newest head until `pageSize` items are collected
   * or all batches are exhausted. The cursor advances only by the number of
   * items actually emitted from each chain, so the next call resumes cleanly.
   */
  const mergeTimestampedStreams = async <T extends { timestamp: number }>(
    chains: ChainName[],
    totals: Partial<Record<ChainName, number>>,
    cursor: ScanMultiChainCursor,
    pageSize: number,
    fetchBatch: (chainName: ChainName, offset: number, limit: number) => Promise<T[]>
  ): Promise<ScanMultiChainPage<T>> => {
    const yielded = { ...cursor.yielded };
    const active = chains.filter((c) => (yielded[c] ?? 0) < (totals[c] ?? 0));

    const batches = await Promise.all(
      active.map(async (chainName) => {
        const already = yielded[chainName] ?? 0;
        const total = totals[chainName] ?? 0;
        const remaining = total - already;
        const limit = Math.min(pageSize, remaining);
        // Fetch oldest-first window that starts right after what we've already yielded.
        const offset = total - already - limit;
        const oldestFirst = await fetchBatch(chainName, offset, limit);
        return { chainName, items: [...oldestFirst].reverse() }; // newest-first within the batch
      })
    );

    const pointers = new Map(batches.map((b) => [b.chainName, 0]));
    const merged: T[] = [];

    // Greedy k-way merge: always take the batch head with the largest timestamp.
    while (merged.length < pageSize) {
      let best: { chainName: ChainName; item: T } | null = null;
      for (const b of batches) {
        const p = pointers.get(b.chainName)!;
        if (p >= b.items.length) continue;
        const candidate = b.items[p];
        if (!best || candidate.timestamp > best.item.timestamp) {
          best = { chainName: b.chainName, item: candidate };
        }
      }
      if (!best) break;
      merged.push(best.item);
      pointers.set(best.chainName, pointers.get(best.chainName)! + 1);
      yielded[best.chainName] = (yielded[best.chainName] ?? 0) + 1;
    }

    const hasMore = chains.some((c) => (yielded[c] ?? 0) < (totals[c] ?? 0));
    return { items: merged, cursor: { yielded }, hasMore };
  };

  /**
   * Merge for entities with no reliable timestamp (users). Returns items
   * chain-by-chain in `chains` order, batching each chain's next window
   * round-robin until `pageSize` total items are collected.
   */
  const mergeOrderedStreams = async <T>(
    chains: ChainName[],
    totals: Partial<Record<ChainName, number>>,
    cursor: ScanMultiChainCursor,
    pageSize: number,
    fetchBatch: (chainName: ChainName, offset: number, limit: number) => Promise<T[]>
  ): Promise<ScanMultiChainPage<T>> => {
    const yielded = { ...cursor.yielded };
    const active = chains.filter((c) => (yielded[c] ?? 0) < (totals[c] ?? 0));

    const merged: T[] = [];
    const newYielded = { ...yielded };

    for (const chainName of active) {
      if (merged.length >= pageSize) break;
      const already = yielded[chainName] ?? 0;
      const total = totals[chainName] ?? 0;
      const remaining = total - already;
      const limit = Math.min(pageSize - merged.length, remaining);
      const offset = total - already - limit;
      const items = await fetchBatch(chainName, offset, limit);
      const newestFirst = [...items].reverse();
      merged.push(...newestFirst);
      newYielded[chainName] = already + newestFirst.length;
    }

    const hasMore = chains.some((c) => (newYielded[c] ?? 0) < (totals[c] ?? 0));
    return { items: merged, cursor: { yielded: newYielded }, hasMore };
  };

  // -------------------------------------------------------------------------
  // Per-id fallback helpers
  // -------------------------------------------------------------------------

  /** Fallback to per-id `getPayable` reads when `getPayablesBulk` reverts. */
  const perIdFallbackPayables = (ids: string[], chainName: ChainName): Promise<any[]> =>
    Promise.all(ids.map((id) => evm.readGetter(chainName, 'getPayable', [id], { ignoreErrors: true })));

  /** Generic fallback to per-id reads when a bulk getter reverts. */
  const perIdFallback = (ids: string[], chainName: ChainName, fn: string): Promise<any[]> =>
    Promise.all(ids.map((id) => evm.readGetter(chainName, fn, [id], { ignoreErrors: true })));

  // -------------------------------------------------------------------------

  return {
    DEFAULT_NETWORK,
    getChainPayablePayments,
    getChainPayables,
    getChainUserPayments,
    getChainUsers,
    getChainWithdrawals,
    getNetworkPayables,
    getNetworkPayments,
    getNetworkUsers,
    getNetworkWithdrawals,
    getUserPayables,
    getUserPaymentsForAddress,
    getUserWithdrawalsForAddress,
    search,
  };
});
