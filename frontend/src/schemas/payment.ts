import { type Chain } from '@/stores/chain';
import { TokenAndAmount } from './tokens-and-amounts';

export class Payment {
  id: string;
  globalCount: number;
  chain: Chain;
  chainCount: number;
  payer: string;
  payerCount: number;
  payerWallet: Uint8Array;
  payable: string;
  payableCount: number;
  timestamp: Date;
  details: TokenAndAmount;

  constructor(
    id: string,
    chain: Chain,
    payerWallet: Uint8Array,
    onChainData: any,
  ) {
    this.id = id;
    this.globalCount = onChainData.globalCount.toNumber();
    this.chain = chain;
    this.chainCount = onChainData.chainCount.toNumber();
    this.payer = onChainData.payer.toBase58();
    this.payerCount = onChainData.payerCount.toNumber();
    this.payerWallet = payerWallet;
    this.payable = onChainData.payable.toBase58();
    this.payableCount = onChainData.payableCount.toNumber();
    this.details = TokenAndAmount.fromOnChain(onChainData.details);
    this.timestamp = new Date(onChainData.timestamp.toNumber() * 1000);
  }

  displayDetails(): string {
    return this.details.display(this.chain);
  }
}
