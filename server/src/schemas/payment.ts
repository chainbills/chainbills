import { Chain } from '../utils/chain';
import { TokenAndAmount, TokenAndAmountOffChain } from './tokens-and-amounts';

export class Payment {
  id: string;
  globalCount: number;
  chain: Chain;
  chainCount: number;
  payer: string;
  payerCount: number;
  payerWallet: string;
  payable: string;
  payableCount: number;
  timestamp: number;
  details: TokenAndAmountOffChain;

  constructor(id: string, chain: Chain, payerWallet: string, onChainData: any) {
    this.id = id;
    this.globalCount = onChainData.globalCount.toNumber();
    this.chain = chain;
    this.chainCount = onChainData.chainCount.toNumber();
    this.payer = onChainData.payer.toBase58();
    this.payerCount = onChainData.payerCount.toNumber();
    this.payerWallet = payerWallet;
    this.payable = onChainData.payable.toBase58();
    this.payableCount = onChainData.payableCount.toNumber();
    this.details = TokenAndAmount.fromOnChain(onChainData.details, chain);
    this.timestamp = onChainData.timestamp.toNumber();
  }
}
