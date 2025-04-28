import { getWalletUrl, type Chain } from './chain';

export class User {
  chain!: Chain;
  chainCount!: number;
  payablesCount!: number;
  paymentsCount!: number;
  walletAddress!: string;
  withdrawalsCount!: number;

  constructor(chain: Chain, walletAddress: string, onChainData: any) {
    this.chain = chain;
    this.walletAddress = walletAddress;
    this.chainCount = Number(onChainData?.chainCount ?? 0);
    this.payablesCount = Number(onChainData?.payablesCount ?? 0);
    this.paymentsCount = Number(onChainData?.paymentsCount ?? 0);
    this.withdrawalsCount = Number(onChainData?.withdrawalsCount ?? 0);
  }

  get explorerUrl() {
    return getWalletUrl(this.walletAddress, this.chain);
  }
}
