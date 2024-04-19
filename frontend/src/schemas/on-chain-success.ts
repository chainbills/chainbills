import type { Chain } from '@/stores/chain';

export class OnChainSuccess {
  created: Uint8Array;
  txHash: string;
  chain: Chain;

  constructor(input: any) {
    this.created = input['created'];
    this.txHash = input['txHash'];
    this.chain = input['chain'];
  }

  explorerUrl(): string {
    if (this.chain == 'Solana') {
      return `https://explorer.solana.com/tx/${this.txHash}?cluster=devnet`;
    } else {
      // TODO: Set the explorer url of EVM
      return `"TO BE SET: {txHash: ${this.txHash}}"`;
    }
  }
}
