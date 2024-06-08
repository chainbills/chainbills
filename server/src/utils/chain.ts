import { toChainId } from '@wormhole-foundation/sdk';

export const WH_CHAIN_ID_SOLANA = toChainId('Solana');
export const WH_CHAIN_ID_ETHEREUM = toChainId('Sepolia');
export const chains: Chain[] = ['Solana', 'Ethereum'];
export type Chain = 'Solana' | 'Ethereum';
