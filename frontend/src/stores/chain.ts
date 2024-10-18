import type { Cluster } from '@solana/web3.js';
import { toChainId } from '@wormhole-foundation/sdk';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const SOLANA_CLUSTER: Cluster = 'devnet';
export const WH_CHAIN_ID_SOLANA = toChainId('Solana');
export const WH_CHAIN_ID_ETH_SEPOLIA = toChainId('Sepolia');
export const WH_CHAIN_ID_BURNT_XION = 50;
export const chains: Chain[] = [
  'Solana',
  'Ethereum Sepolia',
  'Burnt Xion',
];
export type Chain = 'Solana' | 'Ethereum Sepolia' | 'Burnt Xion';

export const getChain = (id: number): Chain => {
  if (id == WH_CHAIN_ID_SOLANA) return 'Solana';
  if (id == WH_CHAIN_ID_ETH_SEPOLIA) return 'Ethereum Sepolia';
  if (id == WH_CHAIN_ID_BURNT_XION) return 'Burnt Xion';
  throw `Unknown chainId: ${id}`;
};

export const useChainStore = defineStore('chain', () => {
  const current = ref<Chain | null>(null);
  const currentId = computed(() => {
    if (!current.value) return null;
    if (current.value == 'Solana') return WH_CHAIN_ID_SOLANA;
    if (current.value == 'Ethereum Sepolia') return WH_CHAIN_ID_ETH_SEPOLIA;
    if (current.value == 'Burnt Xion') return WH_CHAIN_ID_BURNT_XION;
    throw `Unknown chain: ${current.value}`;
  });
  const setChain = (value: Chain | null) => (current.value = value);

  return { current, currentId, setChain };
});
