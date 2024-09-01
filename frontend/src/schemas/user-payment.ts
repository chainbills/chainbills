import { TokenAndAmount, type Payment } from '@/schemas';
import { denormalizeBytes, getChain, type Chain } from '@/stores';

export class UserPayment implements Payment {
  id: string;
  chain: Chain;
  chainCount: number;
  payer: string;
  payerCount: number;
  payableId: string;
  payableChain: Chain;
  payableCount: number;
  timestamp: Date;
  details: TokenAndAmount;

  constructor(id: string, chain: Chain, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainCount = Number(onChainData.chainCount);

    if (chain == 'Ethereum Sepolia') this.payer = onChainData.payer;
    else if (chain == 'Solana') this.payer = onChainData.payer.toBase58();
    else throw `Unknown chain: ${chain}`;

    this.payerCount = Number(onChainData.payerCount);
    this.payableChain = getChain(onChainData.payableChainId);
    this.payableId = denormalizeBytes(onChainData.payable, this.payableChain);
    this.payableCount = Number(onChainData.payableCount);
    this.details = TokenAndAmount.fromOnChain(onChainData.details, chain);
    this.timestamp = new Date(Number(onChainData.timestamp) * 1000);
  }

  displayDetails(): string {
    return this.details.display(this.chain);
  }
}
