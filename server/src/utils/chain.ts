import { Cluster } from '@solana/web3.js';
import { toChainId } from '@wormhole-foundation/sdk';

export const SOLANA_CLUSTER: Cluster = 'devnet';
export const WH_CHAIN_ID_SOLANA = toChainId('Solana');
export const WH_CHAIN_ID_ETH_SEPOLIA = toChainId('Sepolia');
export const chains: Chain[] = ['Solana', 'Ethereum Sepolia'];
export type Chain = 'Solana' | 'Ethereum Sepolia';
