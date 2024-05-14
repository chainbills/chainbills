import type { Chain } from '@/stores/chain';

export class OnChainSuccess {
  created: string;
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
      return `https://sepolia.etherscan.io/tx/${this.txHash}`;
    }
  }
}
