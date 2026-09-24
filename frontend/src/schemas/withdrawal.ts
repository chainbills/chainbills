// schemas/withdrawal.ts
//
// `Withdrawal` mirrors CbGetters' `getWithdrawal(bytes32)` struct: the
// receipt created when a host withdraws a payable's balance (manually, or
// automatically when the payable has auto-withdraw on). The amount here is
// what the host actually received — the 2% withdrawal fee has already been
// deducted on-chain before this record is written.
//
// Used by: `stores/withdrawal.ts` (constructs it from `evm.fetchEntity`/
// `solana.tryFetchEntity`), `stores/activity.ts` (resolves `Withdrew`
// activities), `views/ReceiptView.vue`, `components/TransactionsTable.vue`.
import { type Chain, formatTokenAmount, getTokenDetails, type Receipt, type Token } from '@/schemas';

export class Withdrawal implements Receipt {
  id: string;
  chain: Chain;
  /** This withdrawal's position among all withdrawals made on `chain` (1-based). */
  chainCount: number;
  payableId: string;
  /** This withdrawal's position among all withdrawals made from the payable (1-based). */
  payableCount: number;
  host: string;
  /** This withdrawal's position among all withdrawals made by `host` (1-based). */
  hostCount: number;
  timestamp: number;
  token: Token;
  /** Raw on-chain integer amount received by the host, net of the withdrawal fee. Never divide it directly. */
  amount: bigint;

  constructor(id: string, chain: Chain, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainCount = Number(onChainData.chainCount);

    if (chain.isEvm) this.host = onChainData.host;
    else if (chain.isSolana) this.host = onChainData.host.toBase58();
    else this.host = onChainData.host;

    this.hostCount = Number(onChainData.hostCount);

    if (chain.isEvm) this.payableId = onChainData.payableId;
    else if (chain.isSolana) this.payableId = onChainData.payableId.toBase58();
    else this.payableId = onChainData.payableId;

    this.payableCount = Number(onChainData.payableCount);
    this.token = getTokenDetails(onChainData.token, chain);
    this.amount = BigInt(onChainData.amount);
    this.timestamp = Number(onChainData.timestamp);
  }

  /** Human-readable "amount name" for this withdrawal, e.g. "1.5 USDC". */
  displayDetails() {
    return this.format() + ' ' + this.token.name;
  }

  /** Human-readable decimal amount only (no token name). */
  format() {
    return formatTokenAmount(this.amount, this.token.details[this.chain.name]?.decimals ?? 0);
  }

  user(): string {
    return this.host;
  }

  userChain(): Chain {
    return this.chain;
  }
}
