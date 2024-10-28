import { TokenAndAmount, type Payment } from '@/schemas';
import { denormalizeBytes, getChain, type Chain } from '@/stores';
import { encoding, UniversalAddress } from '@wormhole-foundation/sdk';

export class PayablePayment implements Payment {
  id: string;
  chain: Chain;
  payableId: string;
  payableCount: number;
  localChainCount: number;
  payer: string;
  payerChain: Chain;
  timestamp: number;
  details: TokenAndAmount;

  constructor(id: string, chain: Chain, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.payerChain = getChain(onChainData.payerChainId);

    if (chain == 'Burnt Xion') {
      this.payableId = encoding.hex.encode(
        Uint8Array.from(onChainData.payableId),
        false
      );
      this.payer = denormalizeBytes(onChainData.payer, this.payerChain);
    } else if (chain == 'Ethereum Sepolia') {
      this.payableId = onChainData.payableId.toLowerCase();

      if (this.payerChain == 'Ethereum Sepolia') {
        this.payer = new UniversalAddress(onChainData.payer, 'hex')
          .toNative('Sepolia')
          .address.toLowerCase();
      } else if (this.payerChain == 'Solana') {
        this.payer = denormalizeBytes(onChainData.payer, this.payerChain);
      } else throw `Unknown payerChain: ${this.payerChain}`;
    } else if (chain == 'Solana') {
      this.payableId = onChainData.payableId.toBase58();
      this.payer = denormalizeBytes(onChainData.payer, this.payerChain);
    } else throw `Unknown chain: ${chain}`;

    this.payableCount = Number(onChainData.payableCount);
    this.localChainCount = Number(onChainData.localChainCount);
    this.details = TokenAndAmount.fromOnChain(onChainData.details, chain);
    this.timestamp = Number(onChainData.timestamp);
  }

  displayDetails(): string {
    return this.details.display(this.chain);
  }

  user(): string {
    return this.payer;
  }
}
