import type { BN } from '@project-serum/anchor';

export class User {
  address: string;
  globalCount: number;
  payablesCount: number;
  paymentsCount: number;
  withdrawalsCount: number;

  constructor(address: string, onChainData: any) {
    this.address = address;
    this.globalCount = (onChainData.globalCount as BN).toNumber();
    this.payablesCount = (onChainData.payablesCount as BN).toNumber();
    this.paymentsCount = (onChainData.paymentsCount as BN).toNumber();
    this.withdrawalsCount = (onChainData.withdrawalsCount as BN).toNumber();
  }
}
