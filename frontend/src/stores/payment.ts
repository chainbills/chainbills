import { Payment } from '@/schemas/payment';
import {
  convertTokensForOnChain,
  type TokenAndAmountOffChain,
} from '@/schemas/tokens-and-amounts';
import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useAnchorWallet } from 'solana-wallets-vue';
import { useServerStore } from './server';
import { PROGRAM_ID, useSolanaStore } from './solana';
import { useUserStore } from './user';

export const usePaymentStore = defineStore('payment', () => {
  const server = useServerStore();
  const toast = useToast();
  const anchorWallet = useAnchorWallet();
  const user = useUserStore();
  const solana = useSolanaStore();
  const {
    createATAInstruction,
    getATAAndExists,
    globalStats,
    program,
    systemProgram,
    tokenProgram,
  } = solana;
  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const address = (count: number): PublicKey | null => {
    if (!anchorWallet.value) return null;
    return PublicKey.findProgramAddressSync(
      [
        anchorWallet.value!.publicKey.toBuffer(),
        Buffer.from('payment'),
        new BN(count).toArrayLike(Buffer, 'le', 8),
      ],
      new PublicKey(PROGRAM_ID),
    )[0];
  };

  const pay = async (
    email: string,
    payable: string,
    details: TokenAndAmountOffChain,
  ): Promise<string | null> => {
    if (!anchorWallet.value) return null;

    try {
      const isExistingUser = await user.isInitialized();
      let paymentCount = 1;
      if (isExistingUser) paymentCount = (await user.data())!.paymentsCount + 1;

      const { amount, token: mint } = convertTokensForOnChain([details])[0];
      if (amount == 0) {
        toastError('Cannot withdraw zero');
        return null;
      }
      const payment = address(paymentCount)!;
      const payer = user.address()!;
      const signer = anchorWallet.value!.publicKey;
      const thisProgram = new PublicKey(PROGRAM_ID);

      const { account: payerTokenAccount, exists: payerTAExists } =
        await getATAAndExists(mint, signer);
      const { account: globalTokenAccount, exists: thisProgramTAExists } =
        await getATAAndExists(mint, globalStats);

      const call = program().methods.pay(amount).accounts({
        payment,
        payable,
        payer,
        globalStats,
        thisProgram,
        mint,
        payerTokenAccount,
        globalTokenAccount,
        signer,
        tokenProgram,
        systemProgram,
      });

      call.preInstructions([
        ...(!isExistingUser ? [(await user.initializeInstruction())!] : []),
        ...(!payerTAExists
          ? [createATAInstruction(payerTokenAccount, signer, mint)]
          : []),
        ...(!thisProgramTAExists
          ? [createATAInstruction(globalTokenAccount, globalStats, mint)]
          : []),
      ]);

      const txHash = await call.rpc();
      console.log(
        `Payment Transaction Details: https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
      );
      await server.paid(payment.toBase58(), email);
      toast.add({
        severity: 'success',
        summary: 'Successfully Paid',
        detail: 'You have successfully made a Payment.',
        life: 12000,
      });
      return payment.toBase58();
    } catch (e) {
      console.error(e);
      if (!`${e}`.includes('rejected')) toastError(`${e}`);
      return null;
    }
  };

  const get = async (addr: string): Promise<Payment | null> => {
    try {
      const data = await program().account.payment.fetch(addr);
      const userData = await user.get(data.payer);
      return new Payment(addr, userData.wallet, data);
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
      return null;
    }
  };

  const mines = async (): Promise<Payment[] | null> => {
    if (!anchorWallet.value) return null;

    if (!(await user.isInitialized())) return [];

    try {
      const { paymentsCount: count } = (await user.data())!;
      if (count == 0) return [];

      const payments: Payment[] = [];
      // TODO: Implement pagination instead of this set maximum of 25
      for (let i = Math.min(count, 25); i >= 1; i--) {
        const addr = address(i)!.toBase58();
        const data = await program().account.payment.fetch(addr);
        const userData = await user.get(data.payer);
        payments.push(new Payment(addr, userData.wallet, data));
      }
      return payments;
    } catch (e) {
      console.error(e);
      if (!`${e}`.includes('User rejected the request.')) toastError(`${e}`);
      return null;
    }
  };

  return { address, get, pay, mines };
});
