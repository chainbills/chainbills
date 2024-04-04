import {
  convertTokensForOnChain,
  type TokenAndAmountOffChain,
} from '@/schemas/tokens-and-amounts';
import { Withdrawal } from '@/schemas/withdrawal';
import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useAnchorWallet } from 'solana-wallets-vue';
import { useServerStore } from './server';
import { PROGRAM_ID, useSolanaStore } from './solana';
import { useUserStore } from './user';

export const useWithdrawalStore = defineStore('withdrawal', () => {
  const server = useServerStore();
  const toast = useToast();
  const wallet = useAnchorWallet();
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
    if (!wallet.value) return null;
    return PublicKey.findProgramAddressSync(
      [
        wallet.value!.publicKey.toBuffer(),
        Buffer.from('withdrawal'),
        new BN(count).toArrayLike(Buffer, 'le', 8),
      ],
      new PublicKey(PROGRAM_ID),
    )[0];
  };

  const withdraw = async (
    payable: string,
    details: TokenAndAmountOffChain,
  ): Promise<string | null> => {
    if (!wallet.value) return null;

    try {
      const withdrawalCount = (await user.data())!.withdrawalsCount + 1;
      const { amount, token: mint } = convertTokensForOnChain([details])[0];
      if (amount == 0) {
        toastError('Cannot withdraw zero');
        return null;
      }
      const withdrawal = address(withdrawalCount)!;
      const host = user.address()!;
      const signer = wallet.value!.publicKey;
      const thisProgram = new PublicKey(PROGRAM_ID);

      const { account: hostTokenAccount, exists: hostTAExists } =
        await getATAAndExists(mint, signer);
      const globalTokenAccount = (await getATAAndExists(mint, globalStats))
        .account;

      const call = program().methods.withdraw(amount).accounts({
        withdrawal,
        payable,
        host,
        globalStats,
        thisProgram,
        mint,
        hostTokenAccount,
        globalTokenAccount,
        signer,
        tokenProgram,
        systemProgram,
      });

      if (!hostTAExists) {
        call.preInstructions([
          createATAInstruction(hostTokenAccount, signer, mint),
        ]);
      }

      const txHash = await call.rpc();
      console.log(
        `Withdrawal Transaction Details: https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
      );
      await server.withdrew(withdrawal.toBase58());
      toast.add({
        severity: 'success',
        summary: 'Successfully Withdrew',
        detail:
          'You have successfully made a Withdrawal. Check your wallet for your increments.',
        life: 12000,
      });
      return withdrawal.toBase58();
    } catch (e: any) {
      console.error(e);
      if (!`${e}`.includes('rejected')) toastError(`${e}`);
      return null;
    }
  };

  const get = async (addr: string): Promise<Withdrawal | null> => {
    try {
      const data = await program().account.withdrawal.fetch(addr);
      const userData = await user.get(data.host);
      return new Withdrawal(addr, userData.wallet, data);
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
      return null;
    }
  };

  const mines = async (): Promise<Withdrawal[] | null> => {
    if (!wallet.value) return null;

    if (!(await user.isInitialized())) return [];

    try {
      const { paymentsCount: count } = (await user.data())!;
      if (count == 0) return [];

      const payments: Withdrawal[] = [];
      // TODO: Implement pagination instead of this set maximum of 25
      for (let i = Math.min(count, 25); i >= 1; i--) {
        const addr = address(i)!.toBase58();
        const data = await program().account.withdrawal.fetch(addr);
        const userData = await user.get(data.host);
        payments.push(new Withdrawal(addr, userData.wallet, data));
      }
      return payments;
    } catch (e) {
      console.error(e);
      if (!`${e}`.includes('User rejected the request.')) toastError(`${e}`);
      return null;
    }
  };

  return { address, get, mines, withdraw };
});
