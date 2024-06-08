import { Payable } from '@/schemas/payable';
import { TokenAndAmount } from '@/schemas/tokens-and-amounts';
import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useChainStore } from './chain';
import { useEvmStore } from './evm';
import { useNotificationsStore } from './notifications';
import { useServerStore } from './server';
import { PROGRAM_ID, useSolanaStore } from './solana';
import { useUserStore } from './user';
import { useWalletStore } from './wallet';

export const usePayableStore = defineStore('payable', () => {
  const chain = useChainStore();
  const evm = useEvmStore();
  const notifications = useNotificationsStore();
  const server = useServerStore();
  const solana = useSolanaStore();
  const toast = useToast();
  const user = useUserStore();
  const wallet = useWalletStore();

  const initialize = async (
    email: string,
    description: string,
    tokensAndAmounts: TokenAndAmount[],
    allowsFreePayments: boolean,
  ): Promise<string | null> => {
    if (!wallet.connected || !chain.current) return null;
    if (allowsFreePayments) tokensAndAmounts = [];

    try {
      const method =
        chain.current == 'Solana'
          ? solana.initializePayable
          : evm.initializePayable;
      const result = await method(
        description,
        tokensAndAmounts,
        allowsFreePayments,
      );
      if (!result) return null;

      console.log(
        `Created Payable Transaction Details: ${result.explorerUrl()}`,
      );
      await server.createdPayable(result.created, email);
      toast.add({
        severity: 'success',
        summary: 'Successful Payable Creation',
        detail: 'You have successfully created a Payable.',
        life: 12000,
      });
      notifications.ensure();
      return result.created;
    } catch (e) {
      console.error(e);
      if (!`${e}`.includes('rejected')) toastError(`${e}`);
      return null;
    }
  };

  const get = async (id: string): Promise<Payable | null> => {
    try {
      const data = (await solana
        .program()
        .account.payable.fetch(new PublicKey(id))) as any;
      const { chain, ownerWallet } = await user.get(data.host);
      return new Payable(id, chain, ownerWallet, data);
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
      return null;
    }
  };

  const mines = async (): Promise<Payable[] | null> => {
    if (!wallet.connected) return null;
    if (!(await user.isInitialized())) return [];

    try {
      const { payablesCount: count } = (await user.data())!;
      if (count == 0) return [];

      const payables: Payable[] = [];
      // TODO: Implement pagination instead of this set maximum of 25
      for (let i = Math.min(count, 25); i >= 1; i--) {
        const _pubkey = pubkey(i)!;
        const data = (await solana
          .program()
          .account.payable.fetch(_pubkey)) as any;
        const { chain, ownerWallet } = await user.get(data.host);
        payables.push(
          new Payable(_pubkey.toBase58(), chain, ownerWallet, data),
        );
      }
      return payables;
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
      return null;
    }
  };

  const pubkey = (count: number): PublicKey | null => {
    if (!wallet.whAddress) return null;
    return PublicKey.findProgramAddressSync(
      [
        wallet.whAddress,
        Buffer.from('payable'),
        new BN(count).toArrayLike(Buffer, 'le', 8),
      ],
      new PublicKey(PROGRAM_ID),
    )[0];
  };

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  return { get, initialize, mines, pubkey };
});
