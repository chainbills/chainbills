import { ChainId, toChainId } from '@wormhole-foundation/sdk';

export const SOLANA_CLUSTER = 'devnet';
export const WH_CHAIN_ID_SOLANA: ChainId = toChainId('Solana');
export const WH_CHAIN_ID_ETH_SEPOLIA: ChainId = toChainId('Sepolia');
export const chains: Chain[] = ['Solana', 'Ethereum Sepolia'];
export type Chain = 'Solana' | 'Ethereum Sepolia';

export const getChain = (id: number): Chain => {
  if (id == WH_CHAIN_ID_SOLANA) return 'Solana';
  if (id == WH_CHAIN_ID_ETH_SEPOLIA) return 'Ethereum Sepolia';
  throw `Unknown ChainId: ${id}`;
};

export const getChainId = (chain: Chain): ChainId => {
  if (chain == 'Solana') return WH_CHAIN_ID_SOLANA;
  if (chain == 'Ethereum Sepolia') return WH_CHAIN_ID_ETH_SEPOLIA;
  throw `Unknown Chain: ${chain}`;
};
