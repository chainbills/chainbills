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
  createdAt: number;
  paymentsCount: number;
  withdrawalsCount: number;
  isClosed: boolean;

  constructor(id: string, chain: Chain, description: string, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainCount = Number(onChainData.chainCount);

    if (chain == 'Ethereum Sepolia') {
      this.host = onChainData.host.toLowerCase();
    } else if (chain == 'Solana') this.host = onChainData.host.toBase58();
    else throw `Unknown chain: ${chain}`;

    this.hostCount = Number(onChainData.hostCount);
    this.description = description;
    this.allowedTokensAndAmounts = onChainData.allowedTokensAndAmounts.map(
      (aTAA: TokenAndAmountOnChain) => TokenAndAmount.fromOnChain(aTAA, chain)
    );
    this.balances = onChainData.balances.map((bal: TokenAndAmountOnChain) =>
      TokenAndAmount.fromOnChain(bal, chain)
    );
    this.createdAt = Number(onChainData.createdAt);
    this.paymentsCount = Number(onChainData.paymentsCount);
    this.withdrawalsCount = Number(onChainData.withdrawalsCount);
    this.isClosed = onChainData.isClosed;
  }

  getBalsDisplay() {
    const all: TokenAndAmount[] = [];
    const { allowedTokensAndAmounts: ataas, balances } = this;

    // If there are no allowed tokens and amounts (ATAAs), display all balances.
    if (ataas.length == 0) {
      balances.forEach((b) => all.push(b));
    } else {
      // Otherwise, display the balances with the ATAAs in mind.
      // 1. Ensure that the order of the displayed balances is same as ATAAs.
      // 2. Append balances that are not in the ATAAs. That is if for example
      //    the ATAAs were ever updated later on.

      // Firstly, get a temporary copy of balances for mutations.
      const copied = [...balances];
      // Iterate through the ATAAs to ensure the order of the displayed balances
      //
      // Make ATAAs with same token but different amounts to
      // be treated as one (a balance can only be in a token but not an ATAA).
      const uniqued: Token[] = [];
      for (let ataa of ataas) {
        if (!uniqued.some(({ name }) => ataa.name == name))
          uniqued.push(ataa.token());
      }
      for (let token of uniqued) {
        // Find the balance with the token in the ATAAs.
        const found = balances.find((b) => b.name == token.name);
        // Add the token from the ATAA with the amount from the balance (or 0).
        all.push(new TokenAndAmount(token, found?.amount ?? 0));
        // Remove the found balance from the copied balances.
        if (found) copied.splice(copied.indexOf(found), 1);
      }
      // Append the remaining balances that are not in the ATAAs.
      for (let bal of copied) all.push(bal);
    }
    return all;
  }
}
