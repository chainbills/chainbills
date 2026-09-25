// stores/payable.ts
//
// Payable reads, chain discovery and host-control writes. `get(id)` is the
// one function every payable page/card calls: it resolves which chain a
// payable id lives on by probing every EVM chain in parallel (an id gives
// no clue by itself — see `reference/onchain-data.md` §5.3), then loads the
// on-chain struct plus the off-chain description. None of the read paths
// here require a connected wallet — payables and their activity are
// public. Host-control writes (`close`, `reopen`, `updateTokens`,
// `setAutoWithdraw`, `updateDescription`) each check the caller is the host
// and connected on the payable's own chain, then drive a `useTxFlowStore`
// flow through `stores/evm.ts`.
//
// Used by: `views/CreatePayableView.vue`, `views/PayableDetailView.vue`,
// `views/PayView.vue`, `views/DashboardView.vue`, `components/
// PayableInfoCard.vue`, `stores/payment.ts`, `stores/withdrawal.ts`.
import { usePoller } from '@/composables/usePoller';
import {
  chainNamesEvm,
  chainNamesToChains,
  Payable,
  solanadevnet,
  tokens,
  TokenAndAmount,
  type Chain,
  type ChainName,
} from '@/schemas';
import {
  errorMsg,
  useAnalyticsStore,
  useAuthStore,
  useCacheStore,
  useEvmStore,
  useServerStore,
  useSolanaStore,
  useTxFlowStore,
} from '@/stores';
import type { TxFlowHandle } from '@/stores/tx-flow';
import { PublicKey } from '@solana/web3.js';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';

/** Why a host-control action was refused, or that it failed outright. */
export type PayableActionError = 'not-host' | 'wrong-chain' | 'failed' | 'cancelled';

/** Outcome of a host-control write: either the refreshed `Payable`, or a typed reason the UI can act on (e.g. prompt a chain switch for `'wrong-chain'`). */
export interface PayableActionResult {
  ok: boolean;
  error?: PayableActionError;
  message?: string;
  payable?: Payable;
}

/** Sync status of one destination chain for a payable's settings. */
export interface ChainSyncStatus {
  chain: Chain;
  synced: boolean;
}

/** Whether payers on `chain` can pay a given payable, and why not when they can't. */
export interface PayableAvailability {
  chain: Chain;
  isHome: boolean;
  canPay: boolean;
  reason?: string;
}

const shorten = (v: string) => `${v.substring(0, 6)}…${v.substring(v.length - 4)}`;

export const usePayableStore = defineStore('payable', () => {
  const analytics = useAnalyticsStore();
  const auth = useAuthStore();
  const cache = useCacheStore();
  const evm = useEvmStore();
  const server = useServerStore();
  const solana = useSolanaStore();
  const txFlow = useTxFlowStore();
  const toast = useToast();

  const cacheKey = (chainName: string, id: string, entity: string, count: number) =>
    `${chainName}::payable::${id}::${entity}::${count}`;
  const chainCacheKey = (id: string) => `payable::${id}::chain`;

  const toastError = (detail: string) => toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  /**
   * Resolves which chain a payable id lives on, without needing a
   * connected wallet: probes `getPayable(id)` on every EVM chain in
   * parallel (only one can succeed — every other chain reverts), falling
   * back to a Solana lookup when the id parses as a Solana public key. The
   * resolved chain name is cached so repeat visits skip the probe.
   */
  const resolveChain = async (id: string): Promise<Chain | null> => {
    const cachedName = await cache.retrieve(chainCacheKey(id));
    if (cachedName) return chainNamesToChains[cachedName as ChainName];

    const probe = await evm.probeEntityChain('getPayable', id);
    if (probe) {
      await cache.save(chainCacheKey(id), probe.chainName);
      return chainNamesToChains[probe.chainName];
    }

    try {
      new PublicKey(id);
    } catch {
      return null; // Not a valid Solana id either — nothing left to probe.
    }
    const raw = await solana.tryFetchEntity('payable', id, true);
    if (!raw) return null;
    await cache.save(chainCacheKey(id), solanadevnet.name);
    return solanadevnet;
  };

  /**
   * Reads a single entity id "by count" for a payable (e.g. its 3rd
   * payment). Used only by the Solana fallback pagination in
   * `stores/payment.ts`/`stores/withdrawal.ts` — the EVM path pages ids in
   * bulk instead.
   */
  const getEntityId = async (
    payableId: string,
    chain: Chain,
    entity: 'payment' | 'withdrawal',
    count: number
  ): Promise<string | null> => {
    const key = cacheKey(chain.name, payableId, entity, count);
    let id = await cache.retrieve(key);
    if (id) return id;

    if (chain.isEvm) {
      const ids =
        entity === 'payment'
          ? await evm.getPayablePaymentIdsPaginated(payableId, count - 1, 1, chain.name)
          : await evm.getPayableWithdrawalIdsPaginated(payableId, count - 1, 1, chain.name);
      id = ids?.[0] ?? null;
    } else if (chain.isSolana) {
      id = entity === 'payment' ? solana.getPayablePaymentId(payableId, count) : null;
    }

    if (id) await cache.save(key, id);
    return id;
  };

  const getPaymentId = async (payableId: string, chain: Chain, count: number): Promise<string | null> =>
    getEntityId(payableId, chain, 'payment', count);

  const getWithdrawalId = async (payableId: string, chain: Chain, count: number): Promise<string | null> =>
    getEntityId(payableId, chain, 'withdrawal', count);

  /**
   * Creates a new payable. Wires the `'create-payable'` tx-flow: `prepare`
   * (reads the Wormhole fee) → `sign` → `confirm` → `description` (saved
   * via the server; a failure here is non-fatal — the payable still exists
   * on-chain) → `sync` (background: polls the other same-network chains
   * until the create broadcast lands on each of them).
   */
  const create = async (
    description: string,
    tokensAndAmounts: TokenAndAmount[],
    isAutoWithdraw: boolean
  ): Promise<string | null> => {
    if (!auth.currentUser) return null;
    const chain = auth.currentUser.chain;

    if (chain.isSolana) {
      const result = await solana.createPayable(tokensAndAmounts, isAutoWithdraw);
      if (!result) return null;
      return await finishCreate(result, description);
    }

    const flow = txFlow.start(
      'create-payable',
      'Create payable',
      [
        { key: 'prepare', title: 'Prepare', description: 'Reading the network fee…' },
        { key: 'sign', title: 'Sign transaction', description: 'Waiting to sign…' },
        { key: 'confirm', title: 'Confirm on-chain', description: 'Waiting for confirmation…' },
        { key: 'description', title: 'Save description', description: 'Saving your payable’s description…' },
        { key: 'sync', title: 'Sync to other chains', description: 'Broadcasting to other chains…' },
      ],
      { canRunInBackground: true }
    );

    flow.step('prepare').activate();
    const result = await evm.createPayable(
      tokensAndAmounts,
      isAutoWithdraw,
      { sign: flow.step('sign'), confirm: flow.step('confirm') },
      flow
    );
    if (!result) {
      flow.step('prepare').skip();
      return null;
    }
    flow.step('prepare').done();
    return await finishCreate(result, description, flow, chain);
  };

  const finishCreate = async (
    result: { created: string; explorerUrl: string; chain: Chain; broadcastNonce?: bigint },
    description: string,
    flow?: TxFlowHandle,
    chain?: Chain
  ): Promise<string> => {
    const descStep = flow?.step('description');
    descStep?.activate();
    const saved = await server.saveDescription(result.created, description);
    if (saved) descStep?.done();
    else descStep?.fail('Description can be added later from the payable page');

    await auth.refreshUser();
    toast.add({
      severity: 'success',
      summary: 'Successful Payable Creation',
      detail: 'You have successfully created a Payable.',
      life: 12000,
    });
    analytics.recordEvent('created_payable', {
      payable_id: result.created,
      chain: result.chain.name,
      has_description: !!description,
    });

    if (flow && chain) scheduleSync(flow, chain, result.created, result.broadcastNonce);
    else flow?.finish({ payableId: result.created });

    return result.created;
  };

  const get = async (id: string, ignoreErrors?: boolean): Promise<Payable | null> => {
    const fetchRaw = async (chain: Chain) => {
      if (chain.isEvm) return await evm.fetchPayable(id, chain.name, ignoreErrors);
      if (chain.isSolana) return await solana.tryFetchEntity('payable', id, ignoreErrors);
      return null;
    };

    try {
      let chain = await resolveChain(id);
      if (!chain) {
        if (!ignoreErrors) toastError("Couldn't find that Payable on any known chain.");
        return null;
      }

      let raw = await fetchRaw(chain);

      // Self-heal a stale `chainCacheKey` entry: if the resolved chain no
      // longer holds the payable, invalidate the cache and probe again once
      // so users carrying poisoned cache entries recover on next visit.
      if (!raw) {
        await cache.remove(chainCacheKey(id));
        chain = await resolveChain(id);
        if (!chain) return null;
        raw = await fetchRaw(chain);
        if (!raw) return null;
      }

      // The description is off-chain decoration only — a failed/empty fetch never blocks the rest of the page.
      const dbData = await server.getPayable(id, true);
      return new Payable(id, chain, dbData?.description ?? '', raw);
    } catch (e) {
      console.error(e);
      if (!ignoreErrors) toastError(errorMsg(e));
      return null;
    }
  };

  const getIdsForCurrentUser = async (page: number, count: number): Promise<string[] | null> => {
    if (!auth.currentUser) return null;
    const { payablesCount: totalCount } = auth.currentUser;
    if (totalCount === 0) return [];

    try {
      if (auth.currentUser.chain.isEvm) {
        // Reverse offset: get latest payables first
        const reverseOffset = Math.max(0, totalCount - (page + 1) * count);
        const ids = await evm.getUserPayableIdsPaginated(
          auth.currentUser.walletAddress,
          reverseOffset,
          count,
          auth.currentUser.chain.name
        );
        return ids ? ids.reverse() : null;
      }

      // Solana path: already counting down from latest
      let start = (page + 1) * count;
      const target = page * count + 1;
      if (start > totalCount) start = target + (totalCount % count) - 1;

      const ids = [];
      for (let i = start; i >= target; i--) {
        const id = await auth.getPayableId(i);
        if (id) ids.push(id);
        else return null;
      }
      return ids;
    } catch (e) {
      console.error(e);
      toastError(errorMsg(e));
      return null;
    }
  };

  /** Refuses a host-control write unless the caller is the payable's host, connected on the payable's own chain. */
  const requireHostOnChain = (payable: Payable): PayableActionResult | null => {
    if (!auth.currentUser || auth.currentUser.walletAddress.toLowerCase() !== payable.host.toLowerCase()) {
      return { ok: false, error: 'not-host', message: "You are not this payable's host." };
    }
    if (auth.currentUser.chain.name !== payable.chain.name) {
      return {
        ok: false,
        error: 'wrong-chain',
        message: `Switch your wallet to ${payable.chain.displayName} to manage this payable.`,
      };
    }
    return null;
  };

  const outcomeFor = (flow: TxFlowHandle): PayableActionResult => ({
    ok: false,
    error: flow.flow.status === 'cancelled' ? 'cancelled' : 'failed',
  });

  /**
   * Polls `payableUpdateNonces` on every other chain of the payable's
   * network type until each one reports `>= nonce` (or 10 minutes pass).
   * Runs in the background — it does not block the caller — and updates
   * the flow's `sync` step's hints as each destination chain catches up.
   * Skipped entirely on a chain with no other chains to sync to, or when
   * the write did not broadcast (e.g. Wormhole disabled on this chain).
   */
  const scheduleSync = (flow: TxFlowHandle, homeChain: Chain, payableId: string, nonce?: bigint) => {
    const targets = chainNamesEvm.filter(
      (n) => n !== homeChain.name && chainNamesToChains[n].networkType === homeChain.networkType
    );
    const syncStep = flow.step('sync');
    if (targets.length === 0 || nonce === undefined) {
      syncStep.skip();
      flow.finish({ payableId });
      return;
    }

    syncStep.activate(`Broadcasting to ${targets.length} other chain${targets.length > 1 ? 's' : ''}…`);
    flow.moveToBackground();
    const pending = new Set(targets);

    usePoller(
      async () => {
        const results = await Promise.all(
          targets.map(async (chainName) => ({
            chainName,
            synced: (await evm.payableUpdateNonce(chainName, payableId)) >= nonce,
          }))
        );
        for (const r of results) if (r.synced) pending.delete(r.chainName);
        syncStep.progress({ hints: [`Synced to ${targets.length - pending.size}/${targets.length} chains…`] });
        if (pending.size === 0) {
          syncStep.done();
          flow.finish({ payableId });
        }
        return pending.size === 0;
      },
      {
        intervalMs: 6_000,
        backoffAfterMs: 3 * 60_000,
        maxIntervalMs: 20_000,
        timeoutMs: 10 * 60_000,
        onTimeout: () => {
          syncStep.progress({
            description: 'Still syncing — this can take a while and will finish in the background.',
          });
          flow.finish({ payableId });
        },
      }
    );
  };

  /** Closes a payable to new payments. */
  const close = async (payable: Payable): Promise<PayableActionResult> => {
    const guard = requireHostOnChain(payable);
    if (guard) return guard;

    const flow = txFlow.start(
      'close-payable',
      `Close ${shorten(payable.id)}`,
      [
        { key: 'prepare', title: 'Prepare', description: 'Reading the network fee…' },
        { key: 'sign', title: 'Sign transaction', description: 'Waiting to sign…' },
        { key: 'confirm', title: 'Confirm on-chain', description: 'Waiting for confirmation…' },
        { key: 'sync', title: 'Sync to other chains', description: 'Broadcasting to other chains…' },
      ],
      { canRunInBackground: true }
    );

    flow.step('prepare').activate();
    const result = await evm.closePayable(payable.id, { sign: flow.step('sign'), confirm: flow.step('confirm') }, flow);
    if (!result) {
      flow.step('prepare').skip();
      return outcomeFor(flow);
    }
    flow.step('prepare').done();

    scheduleSync(flow, payable.chain, payable.id, result.broadcastNonce);
    const refreshed = await get(payable.id, true);
    analytics.recordEvent('closed_payable', { payable_id: payable.id });
    return { ok: true, payable: refreshed ?? payable };
  };

  /** Reopens a closed payable. */
  const reopen = async (payable: Payable): Promise<PayableActionResult> => {
    const guard = requireHostOnChain(payable);
    if (guard) return guard;

    const flow = txFlow.start(
      'reopen-payable',
      `Reopen ${shorten(payable.id)}`,
      [
        { key: 'prepare', title: 'Prepare', description: 'Reading the network fee…' },
        { key: 'sign', title: 'Sign transaction', description: 'Waiting to sign…' },
        { key: 'confirm', title: 'Confirm on-chain', description: 'Waiting for confirmation…' },
        { key: 'sync', title: 'Sync to other chains', description: 'Broadcasting to other chains…' },
      ],
      { canRunInBackground: true }
    );

    flow.step('prepare').activate();
    const result = await evm.reopenPayable(
      payable.id,
      { sign: flow.step('sign'), confirm: flow.step('confirm') },
      flow
    );
    if (!result) {
      flow.step('prepare').skip();
      return outcomeFor(flow);
    }
    flow.step('prepare').done();

    scheduleSync(flow, payable.chain, payable.id, result.broadcastNonce);
    const refreshed = await get(payable.id, true);
    analytics.recordEvent('reopened_payable', { payable_id: payable.id });
    return { ok: true, payable: refreshed ?? payable };
  };

  /** Replaces a payable's whole accepted-tokens-and-amounts list. */
  const updateTokens = async (payable: Payable, tokensAndAmounts: TokenAndAmount[]): Promise<PayableActionResult> => {
    const guard = requireHostOnChain(payable);
    if (guard) return guard;

    const flow = txFlow.start(
      'update-payable-tokens',
      `Update accepted tokens for ${shorten(payable.id)}`,
      [
        { key: 'prepare', title: 'Prepare', description: 'Reading the network fee…' },
        { key: 'sign', title: 'Sign transaction', description: 'Waiting to sign…' },
        { key: 'confirm', title: 'Confirm on-chain', description: 'Waiting for confirmation…' },
        { key: 'sync', title: 'Sync to other chains', description: 'Broadcasting to other chains…' },
      ],
      { canRunInBackground: true }
    );

    flow.step('prepare').activate();
    const result = await evm.updatePayableAllowedTokensAndAmounts(
      payable.id,
      tokensAndAmounts,
      { sign: flow.step('sign'), confirm: flow.step('confirm') },
      flow
    );
    if (!result) {
      flow.step('prepare').skip();
      return outcomeFor(flow);
    }
    flow.step('prepare').done();

    scheduleSync(flow, payable.chain, payable.id, result.broadcastNonce);
    const refreshed = await get(payable.id, true);
    analytics.recordEvent('updated_payable_tokens', { payable_id: payable.id });
    return { ok: true, payable: refreshed ?? payable };
  };

  /** Toggles a payable's auto-withdraw setting. Never broadcast — the setting stays on the payable's home chain. */
  const setAutoWithdraw = async (payable: Payable, isAutoWithdraw: boolean): Promise<PayableActionResult> => {
    const guard = requireHostOnChain(payable);
    if (guard) return guard;

    const flow = txFlow.start(
      'update-payable-auto-withdraw',
      `${isAutoWithdraw ? 'Enable' : 'Disable'} auto-withdraw`,
      [
        {
          key: 'sign',
          title: 'Sign transaction',
          description: 'This setting stays on this chain only — it is not broadcast to other chains.',
        },
        { key: 'confirm', title: 'Confirm on-chain', description: 'Waiting for confirmation…' },
      ]
    );

    const result = await evm.updatePayableAutoWithdraw(
      payable.id,
      isAutoWithdraw,
      { sign: flow.step('sign'), confirm: flow.step('confirm') },
      flow
    );
    if (!result) return outcomeFor(flow);

    const refreshed = await get(payable.id, true);
    flow.finish({ payableId: payable.id });
    analytics.recordEvent('updated_payable_auto_withdraw', {
      payable_id: payable.id,
      is_auto_withdraw: isAutoWithdraw,
    });
    return { ok: true, payable: refreshed ?? payable };
  };

  /** Saves (creates or edits) a payable's off-chain description. The host must be connected on the payable's own chain. */
  const updateDescription = async (payable: Payable, description: string): Promise<PayableActionResult> => {
    const guard = requireHostOnChain(payable);
    if (guard) return guard;

    const flow = txFlow.start('update-payable-description', 'Update description', [
      { key: 'save', title: 'Save description', description: 'Saving…' },
    ]);
    flow.step('save').activate();
    const saved = await server.saveDescription(payable.id, description);
    if (!saved) {
      flow.step('save').fail('Could not save the description.');
      return { ok: false, error: 'failed', message: 'Could not save the description.' };
    }
    flow.step('save').done();
    flow.finish({ payableId: payable.id });
    analytics.recordEvent('updated_payable_description', { payable_id: payable.id });

    const refreshed = await get(payable.id, true);
    return { ok: true, payable: refreshed ?? new Payable(payable.id, payable.chain, description, payable) };
  };

  /**
   * Per-chain sync status for a payable's settings.
   * - With `nonce`, compares each destination's `payableUpdateNonces` against it (exact — matches a specific write's broadcast).
   * - Without `nonce` (e.g. on page load, with no receipt to read a nonce from), a chain counts as synced once `getForeignPayable`
   *   succeeds there at all; deeper `isClosed`/token-list staleness is `availability`'s job, not this function's.
   */
  const trackSync = async (payableId: string, homeChain: Chain, nonce?: bigint): Promise<ChainSyncStatus[]> => {
    const targets = chainNamesEvm.filter(
      (n) => n !== homeChain.name && chainNamesToChains[n].networkType === homeChain.networkType
    );
    return Promise.all(
      targets.map(async (chainName) => {
        const chain = chainNamesToChains[chainName];
        if (nonce !== undefined) {
          const current = await evm.payableUpdateNonce(chainName, payableId);
          return { chain, synced: current >= nonce };
        }
        const foreign = await evm.fetchForeignPayable(payableId, chainName);
        return { chain, synced: !!foreign };
      })
    );
  };

  /**
   * For every EVM chain in the payable's network, whether a payer there
   * can pay this payable right now, and why not when they can't. The home
   * chain can always pay. Another chain can pay when the payable has
   * synced there (a `getForeignPayable` that matches the home state) *and*
   * a USDC route exists between the two chains — required whenever the
   * payable restricts tokens (only USDC is bridgeable this round), or
   * simply when USDC is configured on both chains for an "any amount"
   * payable.
   */
  const availability = async (payable: Payable): Promise<PayableAvailability[]> => {
    const homeChain = payable.chain;
    const results: PayableAvailability[] = [{ chain: homeChain, isHome: true, canPay: true }];
    if (!homeChain.isEvm) return results;

    const others = chainNamesEvm.filter(
      (n) => n !== homeChain.name && chainNamesToChains[n].networkType === homeChain.networkType
    );
    const usdc = tokens.find((t) => t.name === 'USDC');

    for (const chainName of others) {
      const chain = chainNamesToChains[chainName];
      const foreign = await evm.fetchForeignPayable(payable.id, chainName);
      if (!foreign) {
        results.push({ chain, isHome: false, canPay: false, reason: 'Not synced yet' });
        continue;
      }
      const restrictsTokens = payable.allowedTokensAndAmounts.length > 0;
      const usdcAllowed = restrictsTokens ? payable.allowedTokensAndAmounts.some((t) => t.name === 'USDC') : true;
      const usdcRouteExists = !!usdc?.details[homeChain.name] && !!usdc?.details[chain.name];
      const canPay = usdcAllowed && usdcRouteExists;
      results.push({ chain, isHome: false, canPay, reason: canPay ? undefined : 'USDC not supported' });
    }
    return results;
  };

  return {
    availability,
    close,
    create,
    get,
    getIdsForCurrentUser,
    getPaymentId,
    getWithdrawalId,
    reopen,
    resolveChain,
    setAutoWithdraw,
    trackSync,
    updateDescription,
    updateTokens,
  };
});
