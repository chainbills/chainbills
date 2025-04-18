import {
  type Chain,
  getTokenDetails,
  type Payment,
  type Token,
} from '@/schemas';

export class UserPayment implements Payment {
  id: string;
  chain: Chain;
  chainCount: number;
  payer: string;
  payerCount: number;
  payableId: string;
  payableChain: Chain;
  timestamp: number;
  token: Token;
  amount: number;

  constructor(id: string, chain: Chain, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainCount = Number(onChainData.chainCount);

    if (chain.isEvm) this.payer = onChainData.payer.toLowerCase();
    else if (chain.isSolana) this.payer = onChainData.payer.toBase58();
    else this.payer = onChainData.payer;

    if (onChainData.payableChainId == 0) this.payableChain = chain;
    else throw `Unhandled payableChain: ${onChainData.payableChainId}`;

    if (chain.isEvm) this.payableId = onChainData.payableId.toLowerCase();
    else if (chain.isSolana) this.payableId = onChainData.payableId.toBase58();
    else this.payableId = onChainData.payableId;

    this.payerCount = Number(onChainData.payerCount);
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
    return this.payer;
  }

  userChain(): Chain {
    return this.chain;
  }
}
