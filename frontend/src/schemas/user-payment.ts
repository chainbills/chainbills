import { TokenAndAmount, type Payment } from '@/schemas';
import { denormalizeBytes, getChain, type Chain } from '@/stores';
import { encoding } from '@wormhole-foundation/sdk';

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
    this.payableChain = getChain(onChainData.payableChainId);

    if (chain == 'Ethereum Sepolia' || chain == 'Burnt Xion') {
      this.payer = onChainData.payer.toLowerCase();

      if (this.payableChain == 'Ethereum Sepolia') {
        this.payableId = onChainData.payableId.toLowerCase();
      } else if (this.payableChain == 'Burnt Xion') {
        this.payableId = encoding.hex.encode(
          Uint8Array.from(onChainData.payableId),
          false
        );
      } else if (this.payableChain == 'Solana') {
        this.payableId = denormalizeBytes(onChainData.payableId, 'Solana');
      } else throw `Unknown payableChain: ${this.payableChain}`;
    } else if (chain == 'Solana') {
      this.payer = onChainData.payer.toBase58();
      // TODO: Review this denormalization if destination chain is Burnt Xion
      this.payableId = denormalizeBytes(
        onChainData.payableId,
        this.payableChain
      );
    } else throw `Unknown chain: ${chain}`;

    this.payerCount = Number(onChainData.payerCount);
    this.payableCount = Number(onChainData.payableCount);
    this.details = TokenAndAmount.fromOnChain(onChainData.details, chain);
    this.timestamp = new Date(Number(onChainData.timestamp) * 1000);
  }

  displayDetails(): string {
    return this.details.display(this.chain);
  }
}
