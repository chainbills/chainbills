import { TokenAndAmount, type TokenAndAmountOnChain } from '@/schemas';
import { type Chain } from '@/stores';

export class Payable {
  id: string;
  chain: Chain;
  chainCount: number;
  host: string;
  hostCount: number;
  description: string;
  allowedTokensAndAmounts: TokenAndAmount[];
  balances: TokenAndAmount[];
  createdAt: Date;
  paymentsCount: number;
  withdrawalsCount: number;
  isClosed: boolean;

  constructor(id: string, chain: Chain, description: string, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainCount = Number(onChainData.chainCount);

    if (chain == 'Ethereum Sepolia') this.host = onChainData.host;
    else if (chain == 'Solana') this.host = onChainData.host.toBase58();
    else throw `Unknown chain: ${chain}`;

    this.hostCount = Number(onChainData.hostCount);
    this.description = description;
    this.allowedTokensAndAmounts = onChainData.allowedTokensAndAmounts.map(
      (aTAA: TokenAndAmountOnChain) => TokenAndAmount.fromOnChain(aTAA, chain)
    );
    this.balances = onChainData.balances.map((bal: TokenAndAmountOnChain) =>
      TokenAndAmount.fromOnChain(bal, chain)
    );
    this.createdAt = new Date(Number(onChainData.createdAt) * 1000);
    this.paymentsCount = Number(onChainData.paymentsCount);
    this.withdrawalsCount = Number(onChainData.withdrawalsCount);
    this.isClosed = onChainData.isClosed;
  }
}
