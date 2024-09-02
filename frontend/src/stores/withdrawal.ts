import { TokenAndAmount, Withdrawal } from '@/schemas';
import {
  useChainStore,
  useEvmStore,
  useServerStore,
  useSolanaStore,
  useUserStore,
  useWalletStore,
  type Chain,
} from '@/stores';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';

export const useWithdrawalStore = defineStore('withdrawal', () => {
  const chain = useChainStore();
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
      const method = chain.current == 'Solana' ? solana.withdraw : evm.withdraw;
      const result = await method(payableId, details);
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

  const get = async (id: string, chain: Chain): Promise<Withdrawal | null> => {
    try {
      const raw =
        chain == 'Solana'
          ? await solana.fetchEntity('withdrawal', id)
          : await evm.fetchWithdrawal(id);
      if (raw) return new Withdrawal(id, chain, raw);
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
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
