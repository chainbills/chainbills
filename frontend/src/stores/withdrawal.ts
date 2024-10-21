import { TokenAndAmount, Withdrawal } from '@/schemas';
import {
  useAuthStore,
  useCosmwasmStore,
  useEvmStore,
  useServerStore,
  useSolanaStore,
  type Chain,
} from '@/stores';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';

export const useWithdrawalStore = defineStore('withdrawal', () => {
  const auth = useAuthStore();
  const cosmwasm = useCosmwasmStore();
  const evm = useEvmStore();
  const server = useServerStore();
  const solana = useSolanaStore();
  const toast = useToast();

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

  const get = async (id: string, chain: Chain): Promise<Withdrawal | null> => {
    try {
      let raw: any;
      if (chain == 'Solana') raw = await solana.fetchEntity('withdrawal', id);
      else if (chain == 'Ethereum Sepolia') raw = await evm.fetchWithdrawal(id);
      else if (chain == 'Burnt Xion')
        raw = await cosmwasm.fetchEntity('withdrawal', id);
      else throw `Unknown chain: ${chain}`;
      if (raw) return new Withdrawal(id, chain, raw);
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
    }
    return null;
  };

  const mines = async (): Promise<Withdrawal[] | null> => {
    if (!auth.currentUser) return null;
    const { withdrawalsCount: count } = auth.currentUser;
    if (count === 0) return [];

    try {
      const withdrawals: Withdrawal[] = [];

      // TODO: Implement pagination instead of this set maximum of 25
      let fetched = 0;
      for (let i = count; i >= 1; i--) {
        if (fetched >= 25) break;
        const id = await auth.getWithdrawalId(i);
        if (id) {
          const withdrawal = await get(id, auth.currentUser.chain);
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
