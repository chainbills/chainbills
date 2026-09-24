// stores/activity.ts
//
// Builds the unified activity feed (every `ActivityType`, one row per
// on-chain `ActivityRecord`) for a payable, a user, or a whole chain, and
// merges those per-chain feeds into one newest-first stream across a whole
// network (mainnet or testnet) for the user-activity page and Scan.
//
// Every on-chain paginated list is stored oldest-first; `pageOffsetAndLimit`
// is the one place the "reverse offset" maths that turns that into a
// newest-first UI page lives (see `reference/onchain-data.md` §2).
// `resolveEntities` turns a page of bare `ActivityRecord`s into `Activity`
// instances with their concrete entity (`Payable`/`UserPayment`/
// `PayablePayment`/`Withdrawal`/`User`) attached, batching one bulk getter
// per (chain, type) group and falling back to per-id reads if a bulk call
// reverts. `getForUserAcrossChains`/`getForNetwork` k-way-merge each
// chain's own newest-first stream into one, using a cursor that survives
// across "load more" calls without ever re-emitting or skipping an item.
//
// Used by: `components/activity/*`, `views/UserActivityView.vue`,
// `views/PayableDetailView.vue`, `views/scan/*`.
import {
  Activity,
  ActivityType,
  chainNamesEvm,
  chainNamesToChains,
  Payable,
  PayablePayment,
  User,
  UserPayment,
  Withdrawal,
  type ActivityCategory,
  type Chain,
  type ChainName,
  type ChainNetworkType,
} from '@/schemas';
import { useCacheStore, useEvmStore } from '@/stores';
import { defineStore } from 'pinia';

/** One page of an activity feed: `items` newest first, `total` the feed's full size (for pagination controls). */
export interface ActivityPage {
  items: Activity[];
  total: number;
}

/** How far a multi-chain merged stream has consumed each chain's own stream so far. Opaque to callers — pass it back verbatim to continue. */
export interface MultiChainCursor {
  yielded: Partial<Record<ChainName, number>>;
}

/** One page of a multi-chain merged stream, plus the cursor to pass to the next call for more. */
export interface MultiChainPage {
  items: Activity[];
  cursor: MultiChainCursor;
  hasMore: boolean;
}

const emptyCursor = (): MultiChainCursor => ({ yielded: {} });

/**
 * On-chain paginated lists are stored oldest-first, and `offset` always
 * counts from the oldest item. To render page `page` (0-based, `size`
 * items per page) newest-first, the window we want is the `size` items
 * ending at the newest not-yet-shown item: `offset = max(0, total -
 * (page+1)*size)`, `limit = min(size, total - offset)`. The caller then
 * reverses the returned slice (which itself comes back oldest→newest) to
 * get newest-first.
 */
const pageOffsetAndLimit = (total: number, page: number, size: number): { offset: number; limit: number } => {
  const offset = Math.max(0, total - (page + 1) * size);
  const limit = Math.min(size, Math.max(0, total - offset));
  return { offset, limit };
};

export const useActivityStore = defineStore('activity', () => {
  const cache = useCacheStore();
  const evm = useEvmStore();

  const activityCacheKey = (chainName: ChainName, id: string) => `${chainName}::activity::${id}`;

  /** Fetches the raw `ActivityRecord`s for `ids` (in the given order) on `chain`, one bulk call with a per-id fallback, and builds unresolved `Activity` instances. */
  const fetchActivityRecords = async (ids: string[], chain: Chain): Promise<Activity[]> => {
    if (ids.length === 0) return [];

    const cached = await Promise.all(ids.map((id) => cache.retrieve(activityCacheKey(chain.name, id))));
    const missingIds = ids.filter((_, i) => !cached[i]);

    let fetchedRaws: any[] | null = null;
    if (missingIds.length) {
      fetchedRaws = await evm.getActivityRecordsBulk(missingIds, chain.name);
      if (!fetchedRaws) {
        // The bulk call reverted outright — fall back to individually ignoring per-id errors.
        fetchedRaws = await Promise.all(
          missingIds.map((id) => evm.readGetter(chain.name, 'getActivityRecord', [id], { ignoreErrors: true }))
        );
      }
      await Promise.all(
        missingIds.map((id, i) =>
          fetchedRaws![i] ? cache.save(activityCacheKey(chain.name, id), fetchedRaws![i]) : null
        )
      );
    }

    const activities: Activity[] = [];
    let missingIndex = 0;
    for (let i = 0; i < ids.length; i++) {
      const raw = cached[i] ?? fetchedRaws?.[missingIndex++];
      if (raw) activities.push(new Activity(ids[i], chain, raw));
    }
    return activities;
  };

  /**
   * Fills in each `Activity`'s `entity` field. Groups activities by
   * `(chain, type)` so each group resolves with exactly one bulk getter
   * call (`getPayablesBulk`, `getUserPaymentsBulk`, `getPayablePaymentsBulk`,
   * `getWithdrawalsBulk`, or `getUsersBulk` for `InitializedUser`, whose
   * `entity` is the wallet left-padded to bytes32). Falls back to per-id
   * reads (with `ignoreErrors`) if a bulk call reverts. Resolved payments
   * and withdrawals are cached — they never change once written — but
   * payables never are, since their state (balances, closed/open, ...)
   * keeps changing.
   */
  const resolveEntities = async (activities: Activity[]): Promise<Activity[]> => {
    const groups = new Map<string, Activity[]>();
    for (const a of activities) {
      const key = `${a.chain.name}::${a.type}`;
      const group = groups.get(key);
      if (group) group.push(a);
      else groups.set(key, [a]);
    }

    await Promise.all(
      Array.from(groups.values()).map(async (group) => {
        const chain = group[0].chain;
        const chainName = chain.name;
        const type = group[0].type;

        if (type === ActivityType.InitializedUser) {
          const wallets = group.map((a) => `0x${a.entityId.slice(-40)}`);
          const raws =
            (await evm.getUsersBulk(wallets, chainName)) ?? (await perIdFallback(wallets, chainName, 'getUser'));
          group.forEach((a, i) => raws?.[i] && (a.entity = new User(chain, wallets[i], raws[i])));
          return;
        }

        const payableSettingsTypes: ActivityType[] = [
          ActivityType.CreatedPayable,
          ActivityType.ClosedPayable,
          ActivityType.ReopenedPayable,
          ActivityType.UpdatedPayableAllowedTokensAndAmounts,
          ActivityType.UpdatedPayableAutoWithdrawStatus,
        ];
        if (payableSettingsTypes.includes(type)) {
          const ids = group.map((a) => a.entityId);
          const raws =
            (await evm.getPayablesBulk(ids, chainName)) ?? (await perIdFallback(ids, chainName, 'getPayable'));
          group.forEach((a, i) => {
            // getPayablesBulk returns only counts, not the ATAA/balances arrays — activity rows never need those, only counters/host/isClosed.
            if (raws?.[i])
              a.entity = new Payable(ids[i], chain, '', { ...raws[i], allowedTokensAndAmounts: [], balances: [] });
          });
          return;
        }

        if (type === ActivityType.UserPaid) {
          const ids = group.map((a) => a.entityId);
          const raws =
            (await evm.getUserPaymentsBulk(ids, chainName)) ?? (await perIdFallback(ids, chainName, 'getUserPayment'));
          group.forEach((a, i) => {
            if (!raws?.[i]) return;
            const payment = new UserPayment(ids[i], chain, raws[i]);
            a.entity = payment;
            cache.save(`${chainName}::payment::user::${ids[i]}`, payment);
          });
          return;
        }

        if (type === ActivityType.PayableReceived) {
          const ids = group.map((a) => a.entityId);
          const raws =
            (await evm.getPayablePaymentsBulk(ids, chainName)) ??
            (await perIdFallback(ids, chainName, 'getPayablePayment'));
          group.forEach((a, i) => {
            if (!raws?.[i]) return;
            const payment = new PayablePayment(ids[i], chain, raws[i]);
            a.entity = payment;
            cache.save(`${chainName}::payment::payable::${ids[i]}`, payment);
          });
          return;
        }

        if (type === ActivityType.Withdrew) {
          const ids = group.map((a) => a.entityId);
          const raws =
            (await evm.getWithdrawalsBulk(ids, chainName)) ?? (await perIdFallback(ids, chainName, 'getWithdrawal'));
          group.forEach((a, i) => {
            if (!raws?.[i]) return;
            const withdrawal = new Withdrawal(ids[i], chain, raws[i]);
            a.entity = withdrawal;
            cache.save(`${chainName}::withdrawal::${ids[i]}`, withdrawal);
          });
          return;
        }
      })
    );

    return activities;
  };

  const perIdFallback = (ids: string[], chainName: ChainName, fn: string) =>
    Promise.all(ids.map((id) => evm.readGetter(chainName, fn, [id], { ignoreErrors: true })));

  /** Unified activity feed for one payable: `payableActivityIdsPaginated`, newest first. */
  const getForPayable = async (
    payable: Payable,
    { page, size }: { page: number; size: number }
  ): Promise<ActivityPage> => {
    const total = payable.activitiesCount;
    if (!payable.chain.isEvm || total === 0) return { items: [], total };
    const { offset, limit } = pageOffsetAndLimit(total, page, size);
    if (limit <= 0) return { items: [], total };
    const ids = await evm.getPayableActivityIdsPaginated(payable.id, offset, limit, payable.chain.name);
    if (!ids) return { items: [], total };
    const activities = await fetchActivityRecords(ids.reverse(), payable.chain);
    return { items: await resolveEntities(activities), total };
  };

  /** Unified activity feed for one user on one chain: `userActivityIdsPaginated`, newest first. */
  const getForUser = async (
    address: string,
    chain: Chain,
    { page, size }: { page: number; size: number }
  ): Promise<ActivityPage> => {
    if (!chain.isEvm) return { items: [], total: 0 };
    const user = await evm.fetchUserOnChain(address, chain.name);
    const total = user ? Number(user.activitiesCount) : 0;
    if (total === 0) return { items: [], total };
    const { offset, limit } = pageOffsetAndLimit(total, page, size);
    if (limit <= 0) return { items: [], total };
    const ids = await evm.getUserActivityIdsPaginated(address, offset, limit, chain.name);
    if (!ids) return { items: [], total };
    const activities = await fetchActivityRecords(ids.reverse(), chain);
    return { items: await resolveEntities(activities), total };
  };

  /** Unified activity feed for a whole chain: `chainActivityIdsPaginated`, newest first. Used by Scan's per-chain view. */
  const getForChain = async (chain: Chain, { page, size }: { page: number; size: number }): Promise<ActivityPage> => {
    if (!chain.isEvm) return { items: [], total: 0 };
    const stats = await evm.getChainStatsOnChain(chain.name);
    const total = stats ? Number(stats.activitiesCount) : 0;
    if (total === 0) return { items: [], total };
    const { offset, limit } = pageOffsetAndLimit(total, page, size);
    if (limit <= 0) return { items: [], total };
    const ids = await evm.getChainActivityIdsPaginated(offset, limit, chain.name);
    if (!ids) return { items: [], total };
    const activities = await fetchActivityRecords(ids.reverse(), chain);
    return { items: await resolveEntities(activities), total };
  };

  /**
   * K-way merges several chains' own newest-first activity streams into
   * one. On each call it fetches, from every chain that still has
   * unyielded items, the next batch of up to `size` items immediately
   * following what has already been yielded from that chain (this is
   * always that chain's true newest not-yet-emitted window, since
   * `yielded` only ever grows and on-chain lists never reorder). It then
   * repeatedly takes the newest head across all fetched batches until
   * `size` items are collected or every batch is drained.
   *
   * This guarantees the merged output is strictly newest-first with no
   * duplicates: an item is only ever emitted once, `yielded[chain]`
   * advances by exactly the count actually emitted from that chain, and
   * anything fetched-but-not-emitted this call is simply re-fetched (from
   * the same, unmoved offset) on the next call rather than lost.
   */
  const mergeChainStreams = async (
    chains: ChainName[],
    totals: Partial<Record<ChainName, number>>,
    fetchBatch: (chainName: ChainName, offset: number, limit: number) => Promise<Activity[]>,
    cursor: MultiChainCursor,
    size: number
  ): Promise<MultiChainPage> => {
    const yielded = { ...cursor.yielded };
    const active = chains.filter((c) => (yielded[c] ?? 0) < (totals[c] ?? 0));

    const batches = await Promise.all(
      active.map(async (chainName) => {
        const already = yielded[chainName] ?? 0;
        const total = totals[chainName] ?? 0;
        const remaining = total - already;
        const limit = Math.min(size, remaining);
        const offset = total - already - limit;
        const oldestFirst = await fetchBatch(chainName, offset, limit);
        return { chainName, items: [...oldestFirst].reverse() }; // newest first within this chain's batch
      })
    );

    const pointers = new Map(batches.map((b) => [b.chainName, 0]));
    const merged: Activity[] = [];
    while (merged.length < size) {
      let best: { chainName: ChainName; activity: Activity } | null = null;
      for (const b of batches) {
        const p = pointers.get(b.chainName)!;
        if (p >= b.items.length) continue;
        const candidate = b.items[p];
        if (!best || candidate.timestamp > best.activity.timestamp)
          best = { chainName: b.chainName, activity: candidate };
      }
      if (!best) break;
      merged.push(best.activity);
      pointers.set(best.chainName, pointers.get(best.chainName)! + 1);
      yielded[best.chainName] = (yielded[best.chainName] ?? 0) + 1;
    }

    const hasMore = chains.some((c) => (yielded[c] ?? 0) < (totals[c] ?? 0));
    return { items: await resolveEntities(merged), cursor: { yielded }, hasMore };
  };

  /** Merged, newest-first activity stream for one wallet across every EVM chain of `networkType` (skips chains the wallet has never used). */
  const getForUserAcrossChains = async (
    address: string,
    networkType: ChainNetworkType,
    cursor: MultiChainCursor = emptyCursor(),
    size = 20
  ): Promise<MultiChainPage> => {
    const chains = chainNamesEvm.filter((n) => chainNamesToChains[n].networkType === networkType);
    const users = await Promise.all(chains.map(async (n) => [n, await evm.fetchUserOnChain(address, n)] as const));
    const totals: Partial<Record<ChainName, number>> = {};
    for (const [n, user] of users) totals[n] = user ? Number(user.activitiesCount) : 0;

    return mergeChainStreams(
      chains,
      totals,
      async (chainName, offset, limit) => {
        if (limit <= 0) return [];
        const ids = await evm.getUserActivityIdsPaginated(address, offset, limit, chainName);
        return ids ? fetchActivityRecords(ids, chainNamesToChains[chainName]) : [];
      },
      cursor,
      size
    );
  };

  /** Merged, newest-first activity stream across every EVM chain of `networkType` — Scan's "all chains" view. */
  const getForNetwork = async (
    networkType: ChainNetworkType,
    cursor: MultiChainCursor = emptyCursor(),
    size = 20
  ): Promise<MultiChainPage> => {
    const chains = chainNamesEvm.filter((n) => chainNamesToChains[n].networkType === networkType);
    const stats = await Promise.all(chains.map(async (n) => [n, await evm.getChainStatsOnChain(n)] as const));
    const totals: Partial<Record<ChainName, number>> = {};
    for (const [n, s] of stats) totals[n] = s ? Number(s.activitiesCount) : 0;

    return mergeChainStreams(
      chains,
      totals,
      async (chainName, offset, limit) => {
        if (limit <= 0) return [];
        const ids = await evm.getChainActivityIdsPaginated(offset, limit, chainName);
        return ids ? fetchActivityRecords(ids, chainNamesToChains[chainName]) : [];
      },
      cursor,
      size
    );
  };

  /** Filters a loaded window of activities to one feed category (`payments`, `withdrawals`, `payables`, `users`). */
  const byCategory = (items: Activity[], category: ActivityCategory): Activity[] =>
    items.filter((a) => a.meta.category === category);

  /** Filters a loaded window of activities to a specific set of activity types. */
  const byTypes = (items: Activity[], types: ActivityType[]): Activity[] => items.filter((a) => types.includes(a.type));

  /**
   * There is no server-side filtering on-chain — a filter can only ever
   * apply to whatever window of items has already been loaded. This keeps
   * calling `loadPage(page)` (0-based) and accumulating items until either
   * `predicate` matches at least `minCount` of them, or a page comes back
   * short of `size` items (the underlying stream has ended) — whichever
   * happens first. Callers use this to back a "keep loading until enough
   * filtered rows exist" UI.
   */
  const loadUntil = async (
    loadPage: (page: number) => Promise<ActivityPage>,
    size: number,
    predicate: (a: Activity) => boolean,
    minCount: number
  ): Promise<{ items: Activity[]; exhausted: boolean }> => {
    const all: Activity[] = [];
    let page = 0;
     
    while (true) {
      const { items, total } = await loadPage(page);
      all.push(...items);
      const matched = all.filter(predicate);
      const loadedSoFar = (page + 1) * size;
      const exhausted = loadedSoFar >= total || items.length === 0;
      if (matched.length >= minCount || exhausted) return { items: all, exhausted };
      page++;
    }
  };

  return {
    byCategory,
    byTypes,
    getForChain,
    getForNetwork,
    getForPayable,
    getForUser,
    getForUserAcrossChains,
    loadUntil,
    resolveEntities,
  };
});
