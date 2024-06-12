import type { Cluster } from '@solana/web3.js';
import { toChainId } from '@wormhole-foundation/sdk';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const SOLANA_CLUSTER: Cluster = 'devnet';
export const WH_CHAIN_ID_SOLANA = toChainId('Solana');
export const WH_CHAIN_ID_ETH_SEPOLIA = toChainId('Sepolia');
export const chains: Chain[] = ['Solana', 'Ethereum Sepolia'];
export type Chain = 'Solana' | 'Ethereum Sepolia';

export const useChainStore = defineStore('chain', () => {
  const current = ref<Chain | null>(null);
  const currentId = computed(() => {
    if (!current.value) return null;
    return current.value == 'Solana'
      ? WH_CHAIN_ID_SOLANA
      : WH_CHAIN_ID_ETH_SEPOLIA;
  });
  const setChain = (value: Chain | null) => (current.value = value);

  return { current, currentId, setChain };
});
