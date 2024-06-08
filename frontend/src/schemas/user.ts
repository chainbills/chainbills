import {
  WH_CHAIN_ID_ETH_SEPOLIA,
  WH_CHAIN_ID_SOLANA,
  type Chain,
} from '@/stores/chain';
import type { BN } from '@project-serum/anchor';

export class User {
  id: string;
  ownerWallet: Uint8Array;
  chain: Chain;
  chainCount: number;
  globalCount: number;
  payablesCount: number;
  paymentsCount: number;
  withdrawalsCount: number;

  constructor(id: string, onChainData: any) {
    this.id = id;
    this.ownerWallet = onChainData.ownerWallet;

    const chainId = onChainData.chainId;
    if (chainId == WH_CHAIN_ID_SOLANA) this.chain = 'Solana';
    else if (chainId == WH_CHAIN_ID_ETH_SEPOLIA) {
      this.chain = 'Ethereum Sepolia';
    } else throw `Unknown chainId: ${chainId}`;

    this.globalCount = (onChainData.globalCount as BN).toNumber();
    this.chainCount = onChainData.chainCount.toNumber();
    this.payablesCount = (onChainData.payablesCount as BN).toNumber();
    this.paymentsCount = (onChainData.paymentsCount as BN).toNumber();
    this.withdrawalsCount = (onChainData.withdrawalsCount as BN).toNumber();
  }
}
