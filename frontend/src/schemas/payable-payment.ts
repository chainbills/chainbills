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

    if (chain.isEvm) this.payableId = onChainData.payableId.toLowerCase();
    else if (chain.isSolana) this.payableId = onChainData.payableId.toBase58();
    else this.payableId = onChainData.payableId;

    const payerChain = cbChainIdToChain[onChainData.payerChainId];
    if (!payerChain) throw new Error(`Unknown cbChainId: ${onChainData.payerChainId}`);

    if (chain.isEvm && chain.name == payerChain.name) {
      this.payer = '0x' + onChainData.payer.split('0x')[1].replace(/^0+/, '');
    } else {
      this.payer = denormalizeBytes(onChainData.payer, payerChain);
    }

    this.payerChain = payerChain;

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
