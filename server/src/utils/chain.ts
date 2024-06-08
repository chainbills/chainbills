import { ChainId, toChainId } from '@wormhole-foundation/sdk';

export const SOLANA_CLUSTER = 'devnet';
export const WH_CHAIN_ID_SOLANA: ChainId = toChainId('Solana');
export const WH_CHAIN_ID_ETH_SEPOLIA: ChainId = toChainId('Sepolia');
export const chains: Chain[] = ['Solana', 'Ethereum Sepolia'];
export type Chain = 'Solana' | 'Ethereum Sepolia';
