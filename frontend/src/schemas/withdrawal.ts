import { TokenAndAmount, type Receipt } from '@/schemas';
import { type Chain } from '@/stores';
import { encoding } from '@wormhole-foundation/sdk';

export class Withdrawal implements Receipt {
  id: string;
  chain: Chain;
  chainCount: number;
  payableId: string;
  payableCount: number;
  host: string;
  hostCount: number;
  timestamp: number;
  details: TokenAndAmount;

  constructor(id: string, chain: Chain, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainCount = Number(onChainData.chainCount);

    if (chain == 'Ethereum Sepolia' || chain == 'Burnt Xion') {
      this.host = onChainData.host.toLowerCase();
    } else if (chain == 'Solana') this.host = onChainData.host.toBase58();
    else throw `Unknown chain: ${chain}`;

    this.hostCount = Number(onChainData.hostCount);

    if (chain == 'Burnt Xion') {
      this.payableId = encoding.hex.encode(
        Uint8Array.from(onChainData.payableId),
        false
      );
    } else if (chain == 'Ethereum Sepolia') {
      this.payableId = onChainData.payableId.toLowerCase();
    } else if (chain == 'Solana') {
      this.payableId = onChainData.payableId.toBase58();
    } else throw `Unknown chain: ${chain}`;

    this.payableCount = Number(onChainData.payableCount);
    this.details = TokenAndAmount.fromOnChain(onChainData.details, chain);
    this.timestamp = Number(onChainData.timestamp);
  }

  displayDetails(): string {
    return this.details.display(this.chain);
  }

  user(): string {
    return this.host;
  }
}
