import { type Chain } from '@/stores/chain';
import {
  convertTokensToOffChain,
  type TokenAndAmountOffChain,
} from './tokens-and-amounts';

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
  details: TokenAndAmountOffChain;

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
    this.details = convertTokensToOffChain([onChainData.details])[0];
    this.timestamp = new Date(onChainData.timestamp.toNumber() * 1000);
  }
}
