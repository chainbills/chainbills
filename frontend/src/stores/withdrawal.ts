import { TokenAndAmount, Withdrawal } from '@/schemas';
import {
  useChainStore,
  useCosmwasmStore,
  useEvmStore,
  useServerStore,
  useSolanaStore,
  useUserStore,
  useWalletStore,
  type Chain,
} from '@/stores';
import { PublicKey } from '@solana/web3.js';
import { encoding } from '@wormhole-foundation/sdk';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';

export const useWithdrawalStore = defineStore('withdrawal', () => {
  const chain = useChainStore();
  const cosmwasm = useCosmwasmStore();
  const evm = useEvmStore();
  const server = useServerStore();
  const solana = useSolanaStore();
  const toast = useToast();
  const user = useUserStore();
  const wallet = useWalletStore();

  const exec = async (
    payableId: string,
    details: TokenAndAmount
  ): Promise<string | null> => {
    if (!wallet.connected || !chain.current) return null;

    try {
      const result = await {
        'Burnt Xion': cosmwasm,
        'Ethereum Sepolia': evm,
        Solana: solana,
      }[chain.current]['withdraw'](payableId, details);
      if (!result) return null;
      await user.refresh();

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

    try {
      let raw: any;
      if (chain == 'Solana') raw = await solana.fetchEntity('withdrawal', id);
      else if (chain == 'Ethereum Sepolia')
        raw = await evm.fetchWithdrawal(id, ignoreErrors);
      else if (chain == 'Burnt Xion')
        raw = await cosmwasm.fetchEntity('withdrawal', id, ignoreErrors);
      else throw `Unknown chain: ${chain}`;
      if (raw) return new Withdrawal(id, chain, raw);
    } catch (e) {
      if (!ignoreErrors) {
        console.error(e);
        toastError(`${e}`);
      }
    }
    return null;
  };

  const mines = async (): Promise<Withdrawal[] | null> => {
    if (!user.current) return null;
    const { withdrawalsCount: count } = user.current;
    if (count === 0) return [];

    try {
      const withdrawals: Withdrawal[] = [];

      // TODO: Implement pagination instead of this set maximum of 25
      let fetched = 0;
      for (let i = count; i >= 1; i--) {
        if (fetched >= 25) break;
        const id = await user.getWithdrawalId(i);
        if (id) {
          const withdrawal = await get(id, user.current.chain);
          if (withdrawal) withdrawals.push(withdrawal);
          else return null;
        } else return null;
        fetched++;
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

  return { exec, get, mines };
});
