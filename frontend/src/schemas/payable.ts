// schemas/payable.ts
//
// `Payable` mirrors CbGetters' `getPayable(bytes32)` struct plus the
// payable's `allowedTokensAndAmounts` and `balances` arrays, and the
// off-chain description (the one piece of data Chainbills does not keep
// on-chain). It is the model behind the public payable page, the pay page,
// and the dashboard's payable cards.
//
// Used by: `stores/payable.ts` (constructs it from on-chain reads + the
// server's description), `stores/evm.ts`/`stores/solana.ts` (supply the raw
// on-chain data), and every view that renders a payable
// (`PayableDetailView`, `PayView`, `PayableInfoCard`).
import { TokenAndAmount, type Chain, type Token, type TokenAndAmountOnChain } from '@/schemas';

export class Payable {
  id: string;
  chain: Chain;
  /** This payable's position among all payables created on `chain` (1-based). */
  chainCount: number;
  host: string;
  /** This payable's position among all payables created by `host` (1-based). */
  hostCount: number;
  /** Off-chain decoration: fetched from the server, or `''` if none was saved or the server is unreachable. */
  description: string;
  /** Restrictions on what a payer may pay. Empty means "accept any supported token, any amount". */
  allowedTokensAndAmounts: TokenAndAmount[];
  /** What this payable currently holds per token, before any withdrawal. */
  balances: TokenAndAmount[];
  createdAt: number;
  paymentsCount: number;
  withdrawalsCount: number;
  /** Total activity records for this payable (created + payments + withdrawals + settings changes). */
  activitiesCount: number;
  isClosed: boolean;
  /** When true, a payment auto-triggers a withdrawal of the paid token to the host right after it lands. */
  isAutoWithdraw: boolean;

  constructor(id: string, chain: Chain, description: string, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainCount = Number(onChainData.chainCount);

    if (chain.isEvm) this.host = onChainData.host;
    else if (chain.isSolana) this.host = onChainData.host.toBase58();
    else this.host = onChainData.host;

    this.hostCount = Number(onChainData.hostCount);
    this.description = description;
    this.allowedTokensAndAmounts = onChainData.allowedTokensAndAmounts.map((aTAA: TokenAndAmountOnChain) =>
      TokenAndAmount.fromOnChain(aTAA, chain)
    );
    this.balances = onChainData.balances.map((bal: TokenAndAmountOnChain) => TokenAndAmount.fromOnChain(bal, chain));
    this.createdAt = Number(onChainData.createdAt);
    this.paymentsCount = Number(onChainData.paymentsCount);
    this.withdrawalsCount = Number(onChainData.withdrawalsCount);
    this.activitiesCount = Number(onChainData.activitiesCount ?? 0);
    this.isClosed = onChainData.isClosed;
    this.isAutoWithdraw = !!onChainData.isAutoWithdraw;
  }

  /**
   * The balances to show on the payable page: same order as
   * `allowedTokensAndAmounts` (deduplicated by token), each paired with its
   * current balance (or 0 if never paid), plus any balance for a token that
   * is no longer allowed (for example after the host changed the allow
   * list). Falls back to raw `balances` when there is no allow list at all.
   */
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
      for (const ataa of ataas) {
        if (!uniqued.some(({ name }) => ataa.name == name)) uniqued.push(ataa.token());
      }
      for (const token of uniqued) {
        // Find the balance with the token in the ATAAs.
        const found = balances.find((b) => b.name == token.name);
        // Add the token from the ATAA with the amount from the balance (or 0).
        all.push(new TokenAndAmount(token, found?.amount ?? 0n));
        // Remove the found balance from the copied balances.
        if (found) copied.splice(copied.indexOf(found), 1);
      }
      // Append the remaining balances that are not in the ATAAs.
      for (const bal of copied) all.push(bal);
    }
    return all;
  }
}
