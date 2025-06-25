import { chainNames, chainNamesToChains, Payable, TokenAndAmount, Withdrawal, type ChainName } from '@/schemas';
import {
  useAnalyticsStore,
  useAuthStore,
  useCacheStore,
  useEvmStore,
  usePayableStore,
  useServerStore,
  useSolanaStore,
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
  const server = useServerStore();
  const solana = useSolanaStore();
  const toast = useToast();

  const cacheKey = (chain: string, id: string) => `${chain}::withdrawal::${id}`;

  const exec = async (payableId: string, details: TokenAndAmount): Promise<string | null> => {
    if (!auth.currentUser) return null;

    const result = await {
      basecamptestnet: evm,
      megaethtestnet: evm,
      solanadevnet: solana,
    }[auth.currentUser.chain.name]['withdraw'](payableId, details);
    if (!result) return null;
    await auth.refreshUser();

    console.log(`Made Withdrawal Transaction Details: ${result.explorerUrl}`);
    await server.withdrew(result.created);
    toast.add({
      severity: 'success',
      summary: 'Successfully Withdrew',
      detail: 'You have successfully made a Withdrawal. Check your wallet for your increments.',
      life: 12000,
    });
    analytics.recordEvent('made_withdrawal', {
      withdrawal_id: result.created,
      chain: result.chain.name,
    });
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
      let withdrawal = await getFromCache(id, chainName);
      if (withdrawal) return withdrawal;

      // Fetch from on-chain and return directly
      return await getFromOnChain(id, chainName, ignoreErrors);
    } else {
      // Check if the withdrawal is already in the cache and return if so.
      // Looping through known chain names as the chain is not known (straight from browser URL)
      for (let chainName of chainNames) {
        let withdrawal = await getFromCache(id, chainName);
        if (withdrawal) return withdrawal;
      }

      // Determine the kind of chain to use to fetch the payment
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
      const _chainNames = [
        ...(isEvm ? ['basecamptestnet', 'megaethtestnet'] : []),
        ...(isSolana ? ['solanadevnet'] : []),
      ] as ChainName[];

      // Fetch the Payment directly from the chain and return
      for (let chainName of _chainNames) {
        const withdrawal = await getFromOnChain(id, chainName, ignoreErrors);
        if (withdrawal) return withdrawal;
      }

      // If nothing was found from cache nor could not fetch from network, then return null
      return null;
    }
  };

  const getManyForCurrentUser = async (page: number, count: number): Promise<Withdrawal[] | null> => {
    if (!auth.currentUser) return null;
    const { withdrawalsCount: totalCount } = auth.currentUser;
    if (count === 0) return [];

    let start = (page + 1) * count;
    const target = page * count + 1;
    if (start > totalCount) start = target + (totalCount % count) - 1;
    try {
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
      toastError(`${e}`);
      return null;
    }
  };

  const getManyForPayable = async (payable: Payable, page: number, count: number): Promise<Withdrawal[] | null> => {
    const { withdrawalsCount: totalCount, chain } = payable;
    if (count === 0) return [];

    let start = (page + 1) * count;
    const target = page * count + 1;
    if (start > totalCount) start = target + (totalCount % count) - 1;
    try {
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
      toastError(`${e}`);
      return null;
    }
  };

  const toastError = (detail: string) => toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  return { exec, get, getManyForCurrentUser, getManyForPayable };
});
