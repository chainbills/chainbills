import { User } from '@/schemas/user';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useAnchorWallet } from 'solana-wallets-vue';
import { PROGRAM_ID, useSolanaStore } from './solana';

export const useUserStore = defineStore('user', () => {
  const toast = useToast();
  const wallet = useAnchorWallet();
  const solana = useSolanaStore();
  const { systemProgram, program, globalStats } = solana;

  const address = (): PublicKey | null => {
    if (!wallet.value) return null;
    return PublicKey.findProgramAddressSync(
      [wallet.value!.publicKey.toBuffer()],
      new PublicKey(PROGRAM_ID),
    )[0];
  };

  const isInitialized = async (): Promise<boolean> => {
    if (!wallet.value) return false;
    try {
      await program().account.user.fetch(address()!);
      return true;
    } catch (e) {
      return false;
    }
  };

  const data = async (): Promise<User | null> => {
    if (!wallet.value) return null;
    const addr = address()!.toBase58();
    return new User(addr, await program().account.user.fetch(addr));
  };

  const get = async (addr: string): Promise<User> => {
    return new User(addr, await program().account.user.fetch(addr));
  };

  const initializeStarter = program().methods.initializeUser().accounts({
    user: address()!,
    signer: wallet.value?.publicKey,
    globalStats,
    systemProgram,
  });

  const initialize = async (): Promise<string | null> => {
    if (!wallet.value) return null;
    try {
      const txHash = await initializeStarter.rpc();
      // TODO: Replace this 3 seconds wait with when the txHash was finalized
      await new Promise((resolve) => setTimeout(resolve, 3000));
      console.log(
        `Create Payable Transaction Details: https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
      );
      return address()!.toBase58();
    } catch (e) {
      console.error(e);
      if (!`${e}`.includes('rejected')) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: `${e}`,
          life: 12000,
        });
      }
      return null;
    }
  };

  const initializeInstruction =
    async (): Promise<TransactionInstruction | null> => {
      if (!wallet.value) return null;
      return initializeStarter.instruction();
    };

  return {
    address,
    data,
    get,
    initialize,
    isInitialized,
    initializeInstruction,
  };
});
