import { type Chain } from '@/stores/chain';
import { TokenAndAmount } from './tokens-and-amounts';

export class Payable {
  id: string;
  globalCount: number;
  chain: Chain;
  chainCount: number;
  host: string;
  hostCount: number;
  hostWallet: Uint8Array;
  description: string;
  tokensAndAmounts: TokenAndAmount[];
  balances: TokenAndAmount[];
  allowsFreePayments: boolean;
  createdAt: Date;
  paymentsCount: number;
  withdrawalsCount: number;
  isClosed: boolean;

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
    this.description = onChainData.description;
    this.tokensAndAmounts = onChainData.tokensAndAmounts.map(
      TokenAndAmount.fromOnChain,
    );
    this.balances = onChainData.balances.map(TokenAndAmount.fromOnChain);
    this.allowsFreePayments = onChainData.allowsFreePayments;
    this.createdAt = new Date(onChainData.createdAt.toNumber() * 1000);
    this.paymentsCount = onChainData.paymentsCount.toNumber();
    this.withdrawalsCount = onChainData.withdrawalsCount.toNumber();
    this.isClosed = onChainData.isClosed;
  }
}
