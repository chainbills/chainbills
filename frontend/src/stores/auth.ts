import { defineStore } from 'pinia';
import { onMounted, ref, watch } from 'vue';
import { useChainStore } from './chain';
import { useWalletStore } from './wallet';

export const AUTH_MESSAGE = 'Authentication';

export const useAuthStore = defineStore('auth', () => {
  const chain = useChainStore();
  const wallet = useWalletStore();
  const signature = ref<string | null>(null);

  const key = () => `chainId:${chain.currentId};signature:${wallet.address}`;
  const getSaved = () => localStorage.getItem(key());

  const ensureSigned = async (): Promise<void> => {
    if (!chain.currentId || !wallet.connected) {
      signature.value = null;
    } else if (getSaved()) {
      signature.value = getSaved();
    } else {
      const signed = await wallet.sign(AUTH_MESSAGE);
      if (signed) localStorage.setItem(key(), signed);
      else await wallet.disconnect();
      signature.value = signed;
    }
  };

  onMounted(() => {
    watch([() => chain.currentId, () => wallet.address], ensureSigned);
  });

  return { signature };
});
