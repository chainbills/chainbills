import { Payable, TokenAndAmount, Withdrawal } from '@/schemas';
import {
  useAuthStore,
  useCacheStore,
  useCosmwasmStore,
  useEvmStore,
  usePayableStore,
  useServerStore,
  useSolanaStore,
  type Chain,
} from '@/stores';
import { PublicKey } from '@solana/web3.js';
import { encoding } from '@wormhole-foundation/sdk';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';

export const useWithdrawalStore = defineStore('withdrawal', () => {
  const auth = useAuthStore();
  const cache = useCacheStore();
  const cosmwasm = useCosmwasmStore();
  const evm = useEvmStore();
  const payableStore = usePayableStore();
  const server = useServerStore();
  const solana = useSolanaStore();
  const toast = useToast();

  const cacheKey = (chain: string, id: string) => `${chain}::withdrawal::${id}`;

  const exec = async (
    payableId: string,
    details: TokenAndAmount
  ): Promise<string | null> => {
    if (!auth.currentUser) return null;

    try {
      const result = await {
        'Burnt Xion': cosmwasm,
        'Ethereum Sepolia': evm,
        Solana: solana,
      }[auth.currentUser.chain]['withdraw'](payableId, details);
      if (!result) return null;
      await auth.refreshUser();

      console.log(
        `Made Withdrawal Transaction Details: ${result.explorerUrl()}`
      );
      await server.withdrew(result.created);
      toast.add({
        severity: 'success',
        summary: 'Successfully Withdrew',
        detail:
          'You have successfully made a Withdrawal. Check your wallet for your increments.',
        life: 12000,
      });
      return result.created;
    } catch (e: any) {
      console.error(e);
      if (!`${e}`.includes('rejected')) toastError(`${e}`);
      return null;
    }
  };

  const get = async (
    id: string,
    chain?: Chain,
    ignoreErrors?: boolean
  ): Promise<Withdrawal | null> => {
    // A simple trick to guess the chain based on the ID's format
    // (if not provided)
    if (!chain) {
      chain = 'Solana';
      try {
        new PublicKey(id);
      } catch (_) {
        if (encoding.hex.valid(id)) {
          if (id.startsWith('0x')) chain = 'Ethereum Sepolia';
          else chain = 'Burnt Xion';
        }
        // If it's not a valid Solana public key or it is not a hex string,
        // then it's not a valid ID.
        else return null;
      }
    }

    // Check if the withdrawal is already in the cache and return if so.
    let withdrawal = await cache.retrieve(cacheKey(chain, id));
    if (withdrawal) {
      withdrawal = Object.setPrototypeOf(withdrawal, Withdrawal.prototype);
      withdrawal.details = Object.setPrototypeOf(
        withdrawal.details,
        TokenAndAmount.prototype
      );
      return withdrawal;
    }

    try {
      let raw: any;
      if (chain == 'Solana') raw = await solana.tryFetchEntity('withdrawal', id, ignoreErrors);
      else if (chain == 'Ethereum Sepolia')
        raw = await evm.fetchWithdrawal(id, ignoreErrors);
      else if (chain == 'Burnt Xion')
        raw = await cosmwasm.fetchEntity('withdrawal', id, ignoreErrors);
      else throw `Unknown chain: ${chain}`;
      if (raw) withdrawal = new Withdrawal(id, chain, raw);
    } catch (e) {
      if (!ignoreErrors) {
        console.error(e);
        toastError(`${e}`);
      }
    }

    // If a withdrawal was found, cache it and return it.
    if (withdrawal) await cache.save(cacheKey(chain, id), withdrawal);

    return withdrawal;
  };

  const getManyForCurrentUser = async (
    page: number,
    count: number
  ): Promise<Withdrawal[] | null> => {
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
          const withdrawal = await get(id, auth.currentUser.chain);
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

  const getManyForPayable = async (
    payable: Payable,
    page: number,
    count: number
  ): Promise<Withdrawal[] | null> => {
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
          const withdrawal = await get(id, chain);
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

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  return { exec, get, getManyForCurrentUser, getManyForPayable };
});
