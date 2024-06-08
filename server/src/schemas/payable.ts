import { Chain } from '../utils/chain';
import { TokenAndAmount, TokenAndAmountOffChain } from './tokens-and-amounts';

export class Payable {
  id: string;
  globalCount: number;
  chain: Chain;
  chainCount: number;
  host: string;
  hostCount: number;
  hostWallet: string;
  description: string;
  tokensAndAmounts: TokenAndAmountOffChain[];
  balances: TokenAndAmountOffChain[];
  allowsFreePayments: boolean;
  createdAt: number;
  paymentsCount: number;
  withdrawalsCount: number;
  isClosed: boolean;

  constructor(id: string, chain: Chain, hostWallet: string, onChainData: any) {
    this.id = id;
    this.globalCount = onChainData.globalCount.toNumber();
    this.chain = chain;
    this.chainCount = onChainData.chainCount.toNumber();
    this.host = onChainData.host.toBase58();
    this.hostCount = onChainData.hostCount.toNumber();
    this.hostWallet = hostWallet;
    this.description = onChainData.description;

    const convertTAA = (details) => TokenAndAmount.fromOnChain(details, chain);
    this.tokensAndAmounts = onChainData.tokensAndAmounts.map(convertTAA);
    this.balances = onChainData.balances.map(convertTAA);

    this.allowsFreePayments = onChainData.allowsFreePayments;
    this.createdAt = onChainData.createdAt.toNumber();
    this.paymentsCount = onChainData.paymentsCount.toNumber();
    this.withdrawalsCount = onChainData.withdrawalsCount.toNumber();
    this.isClosed = onChainData.isClosed;
  }
}
