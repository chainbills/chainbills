import { ChainId } from '@wormhole-foundation/sdk';
import { Chain, WH_CHAIN_ID_ETH_SEPOLIA, WH_CHAIN_ID_SOLANA } from '../utils';

export class Auth {
  chainId: ChainId;
  walletAddress: string;

  constructor(chainId: ChainId, walletAddress: string) {
    this.chainId = chainId;
    this.walletAddress = walletAddress;
  }

  chain(): Chain {
    if (this.chainId == WH_CHAIN_ID_SOLANA) return 'Solana';
    else if (this.chainId == WH_CHAIN_ID_ETH_SEPOLIA) return 'Ethereum Sepolia';
    else throw `Unknown chainId: ${this.chainId}`;
  }
}
