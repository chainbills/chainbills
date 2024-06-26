import { User } from '@/schemas/user';
import { PublicKey } from '@solana/web3.js';
import { defineStore } from 'pinia';
import { PROGRAM_ID, useSolanaStore } from './solana';
import { useWalletStore } from './wallet';

export const useUserStore = defineStore('user', () => {
  const solana = useSolanaStore();
  const wallet = useWalletStore();

  const pubkey = (): PublicKey | null => {
    if (!wallet.whAddress) return null;
    return PublicKey.findProgramAddressSync(
      [wallet.whAddress],
      new PublicKey(PROGRAM_ID),
    )[0];
  };

  const isInitialized = async (): Promise<boolean> => {
    if (!wallet.connected) return false;
    try {
      await solana.program().account.user.fetch(pubkey()!);
      return true;
    } catch (e) {
      return false;
    }
  };

  const data = async (): Promise<User | null> => {
    if (!wallet.connected) return null;
    return new User(
      pubkey()!.toBase58(),
      await solana.program().account.user.fetch(pubkey()!),
    );
  };

  const get = async (id: string): Promise<User> => {
    return new User(id, await solana.program().account.user.fetch(id));
  };

  return { data, get, isInitialized, pubkey };
});
