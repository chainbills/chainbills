import { Cluster } from '@solana/web3.js';
import { ChainId } from '@wormhole-foundation/sdk';
import { Chain } from '../utils';

export class Auth {
  chainId: ChainId;
  walletAddress: string;
  solanaCluster: Cluster | null;

  constructor(
    chainId: ChainId,
    walletAddress: string,
    solanaCluster: Cluster | null = null
  ) {
    this.chainId = chainId;
    this.walletAddress = walletAddress;
    this.solanaCluster = solanaCluster;
  }

  chain(): Chain {
    if (chainId == WH_CHAIN_ID_SOLANA) chain = 'Solana';
    else if (chainId == WH_CHAIN_ID_ETH_SEPOLIA) chain = 'Ethereum Sepolia';
    else throw `Unknown chainId: ${chainId}`;
  }
}
