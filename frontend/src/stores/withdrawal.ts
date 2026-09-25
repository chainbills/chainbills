// stores/withdrawal.ts
//
// Withdrawal execution and lookup. `exec()` drives the `'withdraw'`
// tx-flow (just `sign` → `confirm` — a withdrawal never crosses chains).
// `get()` resolves a withdrawal id without knowing its chain up front by
// probing every EVM chain in parallel.
//
// Used by: `views/PayableDetailView.vue`, `views/ReceiptView.vue`,
// `views/UserActivityView.vue`, `stores/activity.ts`.
import { chainNames, chainNamesToChains, Payable, TokenAndAmount, Withdrawal, type ChainName } from '@/schemas';
import {
  errorMsg,
  useAnalyticsStore,
  useAuthStore,
  useCacheStore,
  useEvmStore,
  usePayableStore,
  useSolanaStore,
  useTxFlowStore,
} from '@/stores';
import { PublicKey } from '@solana/web3.js';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import * as encoding from './encoding';

export const useWithdrawalStore = defineStore('withdrawal', () => {
  const analytics = useAnalyticsStore();
  const auth = useAuthStore();
  const cache = useCacheStore();
  const evm = useEvmStore();
  const payableStore = usePayableStore();
  const solana = useSolanaStore();
  const txFlow = useTxFlowStore();
  const toast = useToast();

  const cacheKey = (chain: string, id: string) => `${chain}::withdrawal::${id}`;

  /** Withdraws `details` from a payable's balance. The flow title includes the net amount after the 2% withdrawal fee, capped by `maxWithdrawalFees`. */
  const exec = async (payableId: string, details: TokenAndAmount): Promise<string | null> => {
    if (!auth.currentUser) return null;

    if (auth.currentUser.chain.isSolana) {
      const result = await solana.withdraw(payableId, details);
      return await finishExec(result);
    }

    const flow = txFlow.start('withdraw', `Withdraw ${details.display(auth.currentUser.chain)}`, [
      { key: 'sign', title: 'Sign transaction', description: 'Waiting to sign…' },
      { key: 'confirm', title: 'Confirm on-chain', description: 'Waiting for confirmation…' },
    ]);
    const result = await evm.withdraw(
      payableId,
      details,
      { sign: flow.step('sign'), confirm: flow.step('confirm') },
      flow
    );
    if (!result) return null; // flow is already 'failed' or 'cancelled' — evm.writeContract recorded which.
    flow.finish({ withdrawalId: result.created });
    return await finishExec(result);
  };

  const finishExec = async (
    result: { created: string; explorerUrl: string; chain: any } | null
  ): Promise<string | null> => {
    if (!result) return null;
    await auth.refreshUser();
    toast.add({
      severity: 'success',
      summary: 'Successfully Withdrew',
      detail: 'You have successfully made a Withdrawal. Check your wallet for your increments.',
      life: 12000,
    });
    analytics.recordEvent('made_withdrawal', { withdrawal_id: result.created, chain: result.chain.name });
    return result.created;
  };

  const getFromCache = async (id: string, chainName: ChainName): Promise<Withdrawal | null> => {
    let withdrawal = await cache.retrieve(cacheKey(chainName, id));
    if (withdrawal) {
      // Necessary to restore callable methods on retrieved instance
      withdrawal = Object.setPrototypeOf(withdrawal, Withdrawal.prototype);
      return withdrawal;
    }
    return null;
  };

  const getFromOnChain = async (
    id: string,
    chainName: ChainName,
    ignoreErrors: boolean
  ): Promise<Withdrawal | null> => {
    const chain = chainNamesToChains[chainName];
    let raw: any;
    if (chain.isEvm) raw = await evm.fetchEntity('Withdrawal', id, chainName, ignoreErrors);
    if (chain.isSolana) raw = await solana.tryFetchEntity('withdrawal', id, ignoreErrors);
    if (raw) {
      const withdrawal = new Withdrawal(id, chain, raw);
      // Saving to Cache for retrieval at any other future time
      await cache.save(cacheKey(chainName, id), withdrawal);
      return withdrawal;
    }
    return null;
  };

  const get = async (id: string, chainName?: ChainName, ignoreErrors = false): Promise<Withdrawal | null> => {
    if (chainName) {
      // Check if the withdrawal is already in the cache and return if so.
      const withdrawal = await getFromCache(id, chainName);
      if (withdrawal) return withdrawal;

      // Fetch from on-chain and return directly
      return await getFromOnChain(id, chainName, ignoreErrors);
    }

    // Check if the withdrawal is already in the cache and return if so.
    // Looping through known chain names as the chain is not known (straight from browser URL)
    for (const name of chainNames) {
      const withdrawal = await getFromCache(id, name);
      if (withdrawal) return withdrawal;
    }

    // Determine the kind of chain to use to fetch the withdrawal
    let isEvm = false;
    let isSolana = false;
    try {
      new PublicKey(id);
      isSolana = true;
    } catch (_) {
      if (encoding.hex.valid(id)) isEvm = true;
      // If it's not a valid Solana public key or it is not a hex string,
      // then it's not a valid ID.
      else return null;
    }

    // Probe every candidate chain in parallel — never sequentially.
    if (isEvm) {
      const hit = await evm.probeEntityChain('getWithdrawal', id);
      if (!hit) return null;
      const chain = chainNamesToChains[hit.chainName];
      const withdrawal = new Withdrawal(id, chain, hit.raw);
      await cache.save(cacheKey(hit.chainName, id), withdrawal);
      return withdrawal;
    }
    if (isSolana) return await getFromOnChain(id, 'solanadevnet', ignoreErrors);
    return null;
  };

  const getManyForCurrentUser = async (page: number, count: number): Promise<Withdrawal[] | null> => {
    if (!auth.currentUser) return null;
    const { withdrawalsCount: totalCount } = auth.currentUser;
    if (count === 0) return [];

    let start = (page + 1) * count;
    const target = page * count + 1;
    if (start > totalCount) start = target + (totalCount % count) - 1;
    try {
      const chain = chainNamesToChains[auth.currentUser.chain.name];
      if (chain.isEvm) {
        const offset = page * count;
        const ids: string[] | null = await evm.getUserWithdrawalIdsPaginated(
          auth.currentUser.walletAddress,
          offset,
          count,
          chain.name
        );
        if (!ids || ids.length === 0) return [];

        const withdrawals: Withdrawal[] = [];
        const missingIds: string[] = [];

        for (const id of ids) {
          let withdrawal = await cache.retrieve(cacheKey(chain.name, id));
          if (withdrawal) {
            withdrawal = Object.setPrototypeOf(withdrawal, Withdrawal.prototype);
            withdrawals.push(withdrawal);
          } else {
            missingIds.push(id);
            withdrawals.push(null as any);
          }
        }

        if (missingIds.length > 0) {
          const rawWithdrawals = await evm.getWithdrawalsBulk(missingIds, chain.name);
          if (rawWithdrawals) {
            let missingIndex = 0;
            for (let i = 0; i < withdrawals.length; i++) {
              if (withdrawals[i] === null) {
                const raw = rawWithdrawals[missingIndex];
                const withdrawal = new Withdrawal(ids[i], chain, raw);
                await cache.save(cacheKey(chain.name, ids[i]), withdrawal);
                withdrawals[i] = withdrawal;
                missingIndex++;
              }
            }
          } else return null;
        }
        return withdrawals;
      }

      const withdrawals: Withdrawal[] = [];
      for (let i = start; i >= target; i--) {
        const id = await auth.getWithdrawalId(i);
        if (id) {
          const withdrawal = await get(id, auth.currentUser.chain.name);
          if (withdrawal) withdrawals.push(withdrawal);
          else return null;
        } else return null;
      }
      return withdrawals;
    } catch (e) {
      console.error(e);
      toastError(errorMsg(e));
      return null;
    }
  };

  const getManyForPayable = async (payable: Payable, page: number, count: number): Promise<Withdrawal[] | null> => {
    const totalCount = payable.withdrawalsCount;
    const chain = chainNamesToChains[payable.chain.name];
    if (count === 0) return [];

    let start = (page + 1) * count;
    const target = page * count + 1;
    if (start > totalCount) start = target + (totalCount % count) - 1;
    try {
      if (chain.isEvm) {
        const offset = page * count;
        const xId = (!payable.id.startsWith('0x') ? `0x${payable.id}` : payable.id) as `0x${string}`;
        const ids: string[] | null = await evm.getPayableWithdrawalIdsPaginated(xId, offset, count, chain.name);
        if (!ids || ids.length === 0) return [];

        const withdrawals: Withdrawal[] = [];
        const missingIds: string[] = [];

        for (const id of ids) {
          let withdrawal = await cache.retrieve(cacheKey(chain.name, id));
          if (withdrawal) {
            withdrawal = Object.setPrototypeOf(withdrawal, Withdrawal.prototype);
            withdrawals.push(withdrawal);
          } else {
            missingIds.push(id);
            withdrawals.push(null as any);
          }
        }

        if (missingIds.length > 0) {
          const rawWithdrawals = await evm.getWithdrawalsBulk(missingIds, chain.name);
          if (rawWithdrawals) {
            let missingIndex = 0;
            for (let i = 0; i < withdrawals.length; i++) {
              if (withdrawals[i] === null) {
                const raw = rawWithdrawals[missingIndex];
                const withdrawal = new Withdrawal(ids[i], chain, raw);
                await cache.save(cacheKey(chain.name, ids[i]), withdrawal);
                withdrawals[i] = withdrawal;
                missingIndex++;
              }
            }
          } else return null;
        }
        return withdrawals;
      }

      const withdrawals: Withdrawal[] = [];
      for (let i = start; i >= target; i--) {
        const id = await payableStore.getWithdrawalId(payable.id, chain, i);
        if (id) {
          const withdrawal = await get(id, chain.name);
          if (withdrawal) withdrawals.push(withdrawal);
          else return null;
        } else return null;
      }
      return withdrawals;
    } catch (e) {
      console.error(e);
      toastError(errorMsg(e));
      return null;
    }
  };

  const toastError = (detail: string) => toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  return { exec, get, getManyForCurrentUser, getManyForPayable };
});
