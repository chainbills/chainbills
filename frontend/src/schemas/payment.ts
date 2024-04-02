import {
  convertTokensToOffChain,
  type TokenAndAmountOffChain,
} from './tokens-and-amounts';

export class Payment {
  address: string;
  globalCount: number;
  payer: string;
  payerCount: number;
  payerWallet: string;
  payable: string;
  payableCount: number;
  timestamp: Date;
  details: TokenAndAmountOffChain;

  constructor(address: string, payerWallet: string, onChainData: any) {
    this.address = address;
    this.globalCount = onChainData.globalCount.toNumber();
    this.payer = onChainData.payer.toBase58();
    this.payerCount = onChainData.payerCount.toNumber();
    this.payerWallet = payerWallet;
    this.payable = onChainData.payable.toBase58();
    this.payableCount = onChainData.payableCount.toNumber();
    this.details = convertTokensToOffChain([onChainData.details])[0];
    this.timestamp = new Date(onChainData.timestamp.toNumber() * 1000);
  }
}
