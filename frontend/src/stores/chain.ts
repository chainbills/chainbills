import { toChainId } from '@wormhole-foundation/sdk';
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const WH_CHAIN_ID_SOLANA = toChainId('Solana');
export const WH_CHAIN_ID_ETHEREUM = toChainId('Ethereum');
export const chains: Chain[] = ['Solana', 'Ethereum'];
export type Chain = 'Solana' | 'Ethereum';

export const useChainStore = defineStore('chain', () => {
  const current = ref<Chain | null>(null);
  const setChain = (value: Chain | null) => (current.value = value);

  return { current, setChain };
});
