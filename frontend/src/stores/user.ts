import { User } from '@/schemas/user';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { defineStore } from 'pinia';
import { useAnchorWallet } from 'solana-wallets-vue';
import { PROGRAM_ID, useSolanaStore } from './solana';

export const useUserStore = defineStore('user', () => {
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

  const initializeInstruction =
    async (): Promise<TransactionInstruction | null> => {
      if (!wallet.value) return null;
      return program()
        .methods.initializeUser()
        .accounts({
          user: address()!,
          signer: wallet.value?.publicKey,
          globalStats,
          systemProgram,
        })
        .instruction();
    };

  return { address, data, get, isInitialized, initializeInstruction };
});
