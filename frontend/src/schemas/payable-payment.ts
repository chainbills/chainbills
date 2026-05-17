import { cbChainIdToChain, getTokenDetails, type Chain, type Payment, type Token } from '@/schemas';
import { denormalizeBytes } from '@/stores';

export class PayablePayment implements Payment {
  id: string;
  chain: Chain;
  payableId: string;
  payableCount: number;
  localChainCount: number;
  payer: string;
  payerChain: Chain;
  timestamp: number;
  token: Token;
  amount: number;

  constructor(id: string, chain: Chain, onChainData: any) {
    this.id = id;
    this.chain = chain;

    if (chain.isEvm) this.payableId = onChainData.payableId;
    else if (chain.isSolana) this.payableId = onChainData.payableId.toBase58();
    else this.payableId = onChainData.payableId;

    this.payerChain = cbChainIdToChain[onChainData.payerChainId];
    if (!this.payerChain) throw new Error(`Unknown cbChainId: ${onChainData.payerChainId}`);
    this.payer = this.payerChain.isEvm
      ? '0x' + onChainData.payer.split('0x')[1].replace(/^0+/, '')
      : denormalizeBytes(onChainData.payer, this.payerChain);

    this.payableCount = Number(onChainData.payableCount);
    this.localChainCount = Number(onChainData.localChainCount);
    this.token = getTokenDetails(onChainData.token, chain);
    this.amount = Number(onChainData.amount);
    this.timestamp = Number(onChainData.timestamp);
  }

  displayDetails() {
    return this.formatAmount() + ' ' + this.token.name;
  }

  formatAmount() {
    return this.amount / 10 ** (this.token.details[this.chain.name]?.decimals ?? 0);
  }

  user(): string {
    return this.payer;
  }

  userChain(): Chain {
    return this.payerChain;
  }
}
