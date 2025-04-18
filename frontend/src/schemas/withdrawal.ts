import {
  type Chain,
  getTokenDetails,
  type Receipt,
  type Token,
} from '@/schemas';

export class Withdrawal implements Receipt {
  id: string;
  chain: Chain;
  chainCount: number;
  payableId: string;
  payableCount: number;
  host: string;
  hostCount: number;
  timestamp: number;
  token: Token;
  amount: number;

  constructor(id: string, chain: Chain, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainCount = Number(onChainData.chainCount);

    if (chain.isEvm) this.host = onChainData.host.toLowerCase();
    else if (chain.isSolana) this.host = onChainData.host.toBase58();
    else this.host = onChainData.host;

    this.hostCount = Number(onChainData.hostCount);

    if (chain.isEvm) this.payableId = onChainData.payableId.toLowerCase();
    else if (chain.isSolana) this.payableId = onChainData.payableId.toBase58();
    else this.payableId = onChainData.payableId;

    this.payableCount = Number(onChainData.payableCount);
    this.token = getTokenDetails(onChainData.token, chain);
    this.amount = Number(onChainData.amount);
    this.timestamp = Number(onChainData.timestamp);
  }

  displayDetails() {
    return this.formatAmount() + ' ' + this.token.name;
  }

  formatAmount() {
    return (
      this.amount / 10 ** (this.token.details[this.chain.name]?.decimals ?? 0)
    );
  }

  user(): string {
    return this.host;
  }

  userChain(): Chain {
    return this.chain;
  }
}
