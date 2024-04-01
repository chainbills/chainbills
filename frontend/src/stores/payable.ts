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
  const wallet = useAnchorWallet();
  const user = useUserStore();
  const solana = useSolanaStore();

  const { systemProgram, program, globalStats } = solana;

  const initialize = async (
    email: string,
    description: string,
    tokensAndAmounts: TokenAndAmountOffChain[],
    allowsAnyToken: boolean,
  ): Promise<string | null> => {
    if (!wallet.value) return null;

    const isExistingUser = await user.isInitialized();
    let hostCount = 1;
    if (isExistingUser) hostCount = (await user.data())!.payablesCount + 1;

    const payable = PublicKey.findProgramAddressSync(
      [
        wallet.value!.publicKey.toBuffer(),
        Buffer.from('payable'),
        new BN(hostCount).toArrayLike(Buffer, 'le', 8),
      ],
      new PublicKey(PROGRAM_ID),
    )[0];
    const call = program()
      .methods.initializePayable(
        description,
        convertTokensForOnChain(tokensAndAmounts),
        allowsAnyToken,
      )
      .accounts({
        payable,
        host: user.address()!,
        globalStats,
        signer: wallet.value?.publicKey,
        systemProgram,
      });

    if (!isExistingUser) {
      call.preInstructions([(await user.initializeInstruction())!]);
    }

    try {
      const txHash = await call.rpc();
      console.log(
        `Create Payable Transaction Details: https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
      );
      await server.createdPayable(payable.toBase58(), email);
      return payable.toBase58();
    } catch (e) {
      console.error(e);
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: `${e}`,
        life: 12000,
      });
      return null;
    }
  };

  return { initialize };
});
