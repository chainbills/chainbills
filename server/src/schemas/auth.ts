import { ChainId } from '@wormhole-foundation/sdk';
import { Chain, WH_CHAIN_ID_ETH_SEPOLIA, WH_CHAIN_ID_SOLANA } from '../utils';

export class Auth {
  chain: Chain;
  chainId: ChainId;
  walletAddress: string;

  constructor(chainId: ChainId, walletAddress: string) {
    if (chainId == WH_CHAIN_ID_SOLANA) this.chain = 'Solana';
    else if (chainId == WH_CHAIN_ID_ETH_SEPOLIA) {
      this.chain = 'Ethereum Sepolia';
    } else throw `Unknown ChainId: ${chainId}`;
    this.chainId = chainId;
    this.walletAddress = walletAddress;
  }
}
