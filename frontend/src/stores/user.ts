import { User } from '@/schemas/user';
import {
  useChainStore,
  useCosmwasmStore,
  useEvmStore,
  useSolanaStore,
  useWalletStore,
} from '@/stores';
import { defineStore } from 'pinia';
import { onMounted, ref, watch } from 'vue';

export const useUserStore = defineStore('user', () => {
  const chain = useChainStore();
  const cosmwasm = useCosmwasmStore();
  const current = ref<User | null>(null);
  const evm = useEvmStore();
  const solana = useSolanaStore();
  const wallet = useWalletStore();

  const getPayableId = async (count: number): Promise<string | null> => {
    if (!wallet.address || !chain.current) return null;
    return await {
      'Burnt Xion': cosmwasm,
      'Ethereum Sepolia': evm,
      Solana: solana,
    }[chain.current!]['getUserPayableId'](count);
  };

  const getPaymentId = async (count: number): Promise<string | null> => {
    if (!wallet.address || !chain.current) return null;
    return await {
      'Burnt Xion': cosmwasm,
      'Ethereum Sepolia': evm,
      Solana: solana,
    }[chain.current!]['getUserPaymentId'](count);
  };

  const getWithdrawalId = async (count: number): Promise<string | null> => {
    if (!wallet.address || !chain.current) return null;
    return await {
      'Burnt Xion': cosmwasm,
      'Ethereum Sepolia': evm,
      Solana: solana,
    }[chain.current!]['getUserWithdrawalId'](count);
  };

  const refresh = async () => {
    if (!wallet.address || !chain.current) return (current.value = null);
    current.value = await {
      'Burnt Xion': cosmwasm,
      'Ethereum Sepolia': evm,
      Solana: solana,
    }[chain.current!]['getCurrentUser']();
  };

  onMounted(() => {
    watch(
      () => wallet.address,
      async (addr) => {
        if (!addr || !chain.current) return (current.value = null);
        current.value = await {
          'Burnt Xion': cosmwasm,
          'Ethereum Sepolia': evm,
          Solana: solana,
        }[chain.current!]['getCurrentUser']();
      }
    );
  });

  return { current, getPayableId, getPaymentId, getWithdrawalId, refresh };
});
