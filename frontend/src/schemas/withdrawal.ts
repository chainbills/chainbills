import { type Chain } from '@/stores/chain';
import { TokenAndAmount } from './tokens-and-amounts';

export class Withdrawal {
  id: string;
  globalCount: number;
  chain: Chain;
  chainCount: number;
  payable: string;
  payableCount: number;
  host: string;
  hostCount: number;
  hostWallet: Uint8Array;
  timestamp: Date;
  details: TokenAndAmount;

  constructor(
    id: string,
    chain: Chain,
    hostWallet: Uint8Array,
    onChainData: any,
  ) {
    this.id = id;
    this.globalCount = onChainData.globalCount.toNumber();
    this.chain = chain;
    this.chainCount = onChainData.chainCount.toNumber();
    this.host = onChainData.host.toBase58();
    this.hostCount = onChainData.hostCount.toNumber();
    this.hostWallet = hostWallet;
    this.payable = onChainData.payable.toBase58();
    this.payableCount = onChainData.payableCount.toNumber();
    this.details = TokenAndAmount.fromOnChain(onChainData.details);
    this.timestamp = new Date(onChainData.timestamp.toNumber() * 1000);
  }
}
