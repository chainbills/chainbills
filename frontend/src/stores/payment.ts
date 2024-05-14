import { Payment } from '@/schemas/payment';
import { type TokenAndAmountOffChain } from '@/schemas/tokens-and-amounts';
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

export const usePaymentStore = defineStore('payment', () => {
  const chain = useChainStore();
  const evm = useEvmStore();
  const server = useServerStore();
  const solana = useSolanaStore();
  const toast = useToast();
  const user = useUserStore();
  const wallet = useWalletStore();

  const get = async (id: string): Promise<Payment | null> => {
    try {
      const data = (await solana
        .program()
        .account.payment.fetch(new PublicKey(id))) as any;
      const { chain, ownerWallet } = await user.get(data.host);
      return new Payment(id, chain, ownerWallet, data);
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
        Buffer.from('payment'),
        new BN(count).toArrayLike(Buffer, 'le', 8),
      ],
      new PublicKey(PROGRAM_ID),
    )[0];
  };

  const pay = async (
    email: string,
    payableId: string,
    details: TokenAndAmountOffChain,
  ): Promise<string | null> => {
    if (!wallet.whAddress || !chain.current) return null;

    try {
      const method = chain.current == 'Ethereum' ? evm.pay : solana.pay;
      const result = await method(payableId, details);
      if (!result) return null;

      console.log(
        `Created Payment Transaction Details: ${result.explorerUrl()}`,
      );
      await server.paid(result.created, email);
      toast.add({
        severity: 'success',
        summary: 'Successfully Paid',
        detail: 'You have successfully made a Payment.',
        life: 12000,
      });
      return result.created;
    } catch (e) {
      console.error(e);
      if (!`${e}`.includes('rejected')) toastError(`${e}`);
      return null;
    }
  };

  const mines = async (): Promise<Payment[] | null> => {
    if (!wallet.whAddress) return null;
    if (!(await user.isInitialized())) return [];

    try {
      const { paymentsCount: count } = (await user.data())!;
      if (count == 0) return [];

      const payments: Payment[] = [];
      // TODO: Implement pagination instead of this set maximum of 25
      for (let i = Math.min(count, 25); i >= 1; i--) {
        const _pubkey = pubkey(i)!;
        const data = (await solana
          .program()
          .account.payment.fetch(_pubkey)) as any;
        const { chain, ownerWallet } = await user.get(data.host);
        payments.push(
          new Payment(_pubkey.toBase58(), chain, ownerWallet, data),
        );
      }
      return payments;
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
      return null;
    }
  };

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  return { get, mines, pay, pubkey };
});
