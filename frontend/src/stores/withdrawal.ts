import { TokenAndAmount } from '@/schemas/tokens-and-amounts';
import { Withdrawal } from '@/schemas/withdrawal';
import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useChainStore } from './chain';
import { useEvmStore } from './evm';
import { useServerStore } from './server';
import { PROGRAM_ID, useSolanaStore } from './solana';
import { useUserStore } from './user';
import { useWalletStore } from './wallet';

export const useWithdrawalStore = defineStore('withdrawal', () => {
  const chain = useChainStore();
  const evm = useEvmStore();
  const server = useServerStore();
  const solana = useSolanaStore();
  const toast = useToast();
  const user = useUserStore();
  const wallet = useWalletStore();

  const get = async (id: string): Promise<Withdrawal | null> => {
    try {
      const data = (await solana
        .program()
        .account.withdrawal.fetch(new PublicKey(id))) as any;
      const { chain, ownerWallet } = await user.get(data.host);
      return new Withdrawal(id, chain, ownerWallet, data);
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
      return null;
    }
  };

  const mines = async (): Promise<Withdrawal[] | null> => {
    if (!wallet.connected) return null;
    if (!(await user.isInitialized())) return [];

    try {
      const { withdrawalsCount: count } = (await user.data())!;
      if (count == 0) return [];

      const withdrawals: Withdrawal[] = [];
      // TODO: Implement pagination instead of this set maximum of 25
      for (let i = Math.min(count, 25); i >= 1; i--) {
        const _pubkey = pubkey(i)!;
        const data = (await solana
          .program()
          .account.withdrawal.fetch(_pubkey)) as any;
        const { chain, ownerWallet } = await user.get(data.host);
        withdrawals.push(
          new Withdrawal(_pubkey.toBase58(), chain, ownerWallet, data),
        );
      }
      return withdrawals;
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
        Buffer.from('withdrawal'),
        new BN(count).toArrayLike(Buffer, 'le', 8),
      ],
      new PublicKey(PROGRAM_ID),
    )[0];
  };

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const withdraw = async (
    payableId: string,
    details: TokenAndAmount,
  ): Promise<string | null> => {
    if (!wallet.connected || !chain.current) return null;

    try {
      const method = chain.current == 'Solana' ? solana.withdraw : evm.withdraw;
      const result = await method(payableId, details);
      if (!result) return null;

      console.log(
        `Made Withdrawal Transaction Details: ${result.explorerUrl()}`,
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

  return { get, mines, pubkey, withdraw };
});
