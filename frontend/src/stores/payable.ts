import { Payable } from '@/schemas/payable';
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

export const usePayableStore = defineStore('payable', () => {
  const server = useServerStore();
  const toast = useToast();
  const anchorWallet = useAnchorWallet();
  const user = useUserStore();
  const solana = useSolanaStore();
  const { systemProgram, program, globalStats } = solana;
  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const address = (count: number): PublicKey | null => {
    if (!anchorWallet.value) return null;
    return PublicKey.findProgramAddressSync(
      [
        anchorWallet.value!.publicKey.toBuffer(),
        Buffer.from('payable'),
        new BN(count).toArrayLike(Buffer, 'le', 8),
      ],
      new PublicKey(PROGRAM_ID),
    )[0];
  };

  const initialize = async (
    email: string,
    description: string,
    tokensAndAmounts: TokenAndAmountOffChain[],
    allowsFreePayments: boolean,
  ): Promise<string | null> => {
    if (!anchorWallet.value) return null;

    if (allowsFreePayments) tokensAndAmounts = [];

    try {
      const isExistingUser = await user.isInitialized();
      let hostCount = 1;
      if (isExistingUser) hostCount = (await user.data())!.payablesCount + 1;

      const payable = address(hostCount)!;
      const call = program()
        .methods.initializePayable(
          description,
          convertTokensForOnChain(tokensAndAmounts),
          allowsFreePayments,
        )
        .accounts({
          payable,
          host: user.address()!,
          globalStats,
          signer: anchorWallet.value?.publicKey,
          systemProgram,
        });

      if (!isExistingUser) {
        call.preInstructions([(await user.initializeInstruction())!]);
      }

      const txHash = await call.rpc();
      console.log(
        `Create Payable Transaction Details: https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
      );
      await server.createdPayable(payable.toBase58(), email);
      toast.add({
        severity: 'success',
        summary: 'Successful Payable Creation',
        detail: 'You have successfully created a Payable.',
        life: 12000,
      });
      return payable.toBase58();
    } catch (e) {
      console.error(e);
      if (!`${e}`.includes('rejected')) toastError(`${e}`);
      return null;
    }
  };

  const get = async (addr: string): Promise<Payable | null> => {
    try {
      const data = await program().account.payable.fetch(addr);
      const userData = await user.get(data.host);
      return new Payable(addr, userData.wallet, data);
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
      return null;
    }
  };

  const mines = async (): Promise<Payable[] | null> => {
    if (!anchorWallet.value) return null;

    if (!(await user.isInitialized())) return [];

    try {
      const { payablesCount: count } = (await user.data())!;
      if (count == 0) return [];

      const payables: Payable[] = [];
      // TODO: Implement pagination instead of this set maximum of 25
      for (let i = Math.min(count, 25); i >= 1; i--) {
        const addr = address(i)!.toBase58();
        const data = await program().account.payable.fetch(addr);
        const userData = await user.get(data.host);
        payables.push(new Payable(addr, userData.wallet, data));
      }
      return payables;
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
      return null;
    }
  };

  return { address, get, initialize, mines };
});
