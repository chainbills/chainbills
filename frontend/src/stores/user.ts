import { User } from '@/schemas/user';
import {
  useChainStore,
  useEvmStore,
  useSolanaStore,
  useWalletStore,
} from '@/stores';
import { defineStore } from 'pinia';
import { onMounted, ref, watch } from 'vue';

export const useUserStore = defineStore('user', () => {
  const chain = useChainStore();
  const current = ref<User | null>(null);
  const evm = useEvmStore();
  const solana = useSolanaStore();
  const wallet = useWalletStore();

  const getPayableId = async (count: number): Promise<string | null> => {
    if (!wallet.address) return null;
    if (chain.current === 'Solana') return solana.getUserPayableId(count);
    else return await evm.getUserPayableId(count);
  };

  const getPaymentId = async (count: number): Promise<string | null> => {
    if (!wallet.address) return null;
    if (chain.current === 'Solana') return solana.getUserPaymentId(count);
    else return await evm.getUserPaymentId(count);
  };

  const getWithdrawalId = async (count: number): Promise<string | null> => {
    if (!wallet.address) return null;
    if (chain.current === 'Solana') return solana.getUserWithdrawalId(count);
    else return await evm.getUserWithdrawalId(count);
  };

  const refresh = async (): Promise<void> => {
    if (!wallet.address || !chain.current) current.value = null;
    else if (chain.current === 'Solana') {
      current.value = await solana.getCurrentUser();
    } else current.value = await evm.getCurrentUser();
  }

  onMounted(() => {
    watch(
      () => wallet.address,
      async (addr) => {
        if (!addr || !chain.current) current.value = null;
        else if (chain.current === 'Solana') {
          current.value = await solana.getCurrentUser();
        } else current.value = await evm.getCurrentUser();
      }
    );
  });

  return { current, getPayableId, getPaymentId, getWithdrawalId, refresh };
});
