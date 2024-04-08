import { defineStore } from 'pinia';
import { ref } from 'vue';

export const chains: Chain[] = ['Solana', 'Ethereum'];
export type Chain = 'Solana' | 'Ethereum';

export const useChainStore = defineStore('chain', () => {
  const current = ref<Chain | null>(null);
  const setChain = (value: Chain | null) => (current.value = value);

  return { current, setChain };
});
