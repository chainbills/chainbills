import { Payable, TokenAndAmount } from '@/schemas';
import {
  useChainStore,
  useCosmwasmStore,
  useEvmStore,
  useNotificationsStore,
  useServerStore,
  useSolanaStore,
  useUserStore,
  useWalletStore,
  type Chain,
} from '@/stores';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';

export const usePayableStore = defineStore('payable', () => {
  const chain = useChainStore();
  const cosmwasm = useCosmwasmStore();
  const evm = useEvmStore();
  const notifications = useNotificationsStore();
  const server = useServerStore();
  const solana = useSolanaStore();
  const toast = useToast();
  const user = useUserStore();
  const wallet = useWalletStore();

  const create = async (
    description: string,
    tokensAndAmounts: TokenAndAmount[]
  ): Promise<string | null> => {
    if (!wallet.connected || !chain.current) return null;

    try {
      const result = await {
        'Burnt Xion': cosmwasm,
        'Ethereum Sepolia': evm,
        Solana: solana,
      }[chain.current]['createPayable'](tokensAndAmounts);
      if (!result) return null;

      console.log(
        `Created Payable Transaction Details: ${result.explorerUrl()}`
      );
      await server.createPayable(result.created, description);
      await user.refresh();
      toast.add({
        severity: 'success',
        summary: 'Successful Payable Creation',
        detail: 'You have successfully created a Payable.',
        life: 12000,
      });
      // TODO: Remove this checker after integrating sign and verify in Burnt Xion
      if (chain.current != 'Burnt Xion') notifications.ensure();
      return result.created;
    } catch (e) {
      console.error(e);
      if (!`${e}`.includes('rejected')) toastError(`${e}`);
      return null;
    }
  };

  const get = async (id: string): Promise<Payable | null> => {
    const dbData = await server.getPayable(id);
    if (!dbData) return null;

    try {
      let raw: any;
      if (dbData.chain == 'Solana')
        raw = await solana.fetchEntity('payable', id);
      else if (dbData.chain == 'Ethereum Sepolia')
        raw = await evm.fetchPayable(id);
      else if (dbData.chain == 'Burnt Xion')
        raw = await cosmwasm.fetchEntity('payable', id);
      else throw `Unknown chain: ${dbData.chain}`;
      if (raw) return new Payable(id, dbData.chain, dbData.description, raw);
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
    }
    return null;
  };

  const getPaymentId = async (
    payableId: string,
    chain: Chain,
    count: number
  ): Promise<string | null> => {
    return await {
      'Burnt Xion': cosmwasm,
      'Ethereum Sepolia': evm,
      Solana: solana,
    }[chain]['getPayablePaymentId'](payableId, count);
  };

  const mines = async (): Promise<Payable[] | null> => {
    if (!user.current) return null;
    const { payablesCount: count } = user.current;
    if (count === 0) return [];

    try {
      const payables: Payable[] = [];
      // TODO: Implement pagination instead of this set maximum of 25
      let fetched = 0;
      for (let i = count; i >= 1; i--) {
        if (fetched >= 25) break;
        const id = await user.getPayableId(i);
        if (id) {
          const payable = await get(id);
          if (payable) payables.push(payable);
          else return null;
        } else return null;
        fetched++;
      }
      return payables;
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
      return null;
    }
  };

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  return { create, get, getPaymentId, mines };
});
