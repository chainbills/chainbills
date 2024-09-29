import { ChainId, toChainId } from '@wormhole-foundation/sdk';

export const SOLANA_CLUSTER = 'devnet';
export const WH_CHAIN_ID_SOLANA: ChainId = toChainId('Solana');
export const WH_CHAIN_ID_ETH_SEPOLIA: ChainId = toChainId('Sepolia');
export const WH_CHAIN_ID_BURNT_XION = 50;
export const chains: Chain[] = ['Solana', 'Ethereum Sepolia', 'Burnt Xion'];
export type Chain = 'Solana' | 'Ethereum Sepolia' | 'Burnt Xion';

export const getChain = (id: number): Chain => {
  if (id == WH_CHAIN_ID_SOLANA) return 'Solana';
  if (id == WH_CHAIN_ID_ETH_SEPOLIA) return 'Ethereum Sepolia';
  if (id == WH_CHAIN_ID_BURNT_XION) return 'Burnt Xion';
  throw `Unknown ChainId: ${id}`;
};

export const getChainId = (chain: Chain): ChainId | 50 => {
  if (chain == 'Solana') return WH_CHAIN_ID_SOLANA;
  if (chain == 'Ethereum Sepolia') return WH_CHAIN_ID_ETH_SEPOLIA;
  if (chain == 'Burnt Xion') return WH_CHAIN_ID_BURNT_XION;
  throw `Unknown Chain: ${chain}`;
};
