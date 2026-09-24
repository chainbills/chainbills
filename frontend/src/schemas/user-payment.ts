// schemas/user-payment.ts
//
// `UserPayment` mirrors CbGetters' `getUserPayment(bytes32)` struct: the
// receipt that lives on the *payer's* chain after a payment (same-chain or
// cross-chain). Its `payableChain` is resolved from the on-chain
// `payableChainId` via `cbChainIdToChain`. For a cross-chain payment, the
// matching `PayablePayment` (on the payable's chain) links back to this
// record through `payerPaymentId`.
//
// Used by: `stores/payment.ts` (constructs it from `evm.fetchEntity`/
// `solana.fetchEntity`), `stores/activity.ts` (resolves `UserPaid`
// activities), `views/ReceiptView.vue`, `components/TransactionsTable.vue`.
import { cbChainIdToChain, formatTokenAmount, getTokenDetails, type Chain, type Payment, type Token } from '@/schemas';

export class UserPayment implements Payment {
  id: string;
  chain: Chain;
  /** This payment's position among all payments made from `chain` (1-based). */
  chainCount: number;
  payer: string;
  /** This payment's position among all payments made by `payer` (1-based). */
  payerCount: number;
  payableId: string;
  /** The chain the target payable lives on, resolved from the on-chain `payableChainId`. */
  payableChain: Chain;
  timestamp: number;
  token: Token;
  /** Raw on-chain integer amount. Format with `TokenAndAmount`/`formatTokenAmount`, never divide it directly. */
  amount: bigint;

  constructor(id: string, chain: Chain, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainCount = Number(onChainData.chainCount);

    if (chain.isEvm) this.payer = onChainData.payer;
    else if (chain.isSolana) this.payer = onChainData.payer.toBase58();
    else this.payer = onChainData.payer;

    this.payableChain = cbChainIdToChain[onChainData.payableChainId];
    if (!this.payableChain) throw new Error(`Unknown cbChainId: ${onChainData.payableChainId}`);
    if (this.payableChain.isEvm) this.payableId = onChainData.payableId;
    else if (this.payableChain.isSolana) this.payableId = onChainData.payableId.toBase58();
    else this.payableId = onChainData.payableId;

    this.payerCount = Number(onChainData.payerCount);
    this.token = getTokenDetails(onChainData.token, chain);
    this.amount = BigInt(onChainData.amount);
    this.timestamp = Number(onChainData.timestamp);
  }

  /** Human-readable "amount name" for this payment, e.g. "1.5 USDC". */
  displayDetails() {
    return this.format() + ' ' + this.token.name;
  }

  /** Human-readable decimal amount only (no token name). */
  format() {
    return formatTokenAmount(this.amount, this.token.details[this.chain.name]?.decimals ?? 0);
  }

  user(): string {
    return this.payer;
  }

  userChain(): Chain {
    return this.chain;
  }

  /** True when the payable this payment targets lives on a different chain than the payment itself. */
  get isCrossChain(): boolean {
    return this.payableChain.name !== this.chain.name;
  }
}
