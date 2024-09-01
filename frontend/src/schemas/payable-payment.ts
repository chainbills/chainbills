import { TokenAndAmount, type Payment } from '@/schemas';
import { denormalizeBytes, getChain, type Chain } from '@/stores';

export class PayablePayment implements Payment {
  id: string;
  chain: Chain;
  chainCount: number;
  payableId: string;
  payableCount: number;
  localChainCount: number;
  payer: string;
  payerChain: Chain;
  payerCount: number;
  timestamp: Date;
  details: TokenAndAmount;

  constructor(id: string, chain: Chain, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainCount = Number(onChainData.chainCount);

    if (chain == 'Ethereum Sepolia') this.payableId = onChainData.payableId;
    else if (chain == 'Solana') {
      this.payableId = onChainData.payableId.toBase58();
    } else throw `Unknown chain: ${chain}`;

    this.payableCount = Number(onChainData.payableCount);
    this.localChainCount = Number(onChainData.localChainCount);
    this.payerChain = getChain(onChainData.payerChainId);
    this.payer = denormalizeBytes(onChainData.payer, this.payerChain);
    this.payerCount = Number(onChainData.payerCount);
    this.details = TokenAndAmount.fromOnChain(onChainData.details, chain);
    this.timestamp = new Date(Number(onChainData.timestamp) * 1000);
  }

  displayDetails(): string {
    return this.details.display(this.chain);
  }
}
