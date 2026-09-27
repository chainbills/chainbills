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
import {
  cbChainIdToChain,
  chainNamesToChains,
  formatTokenAmount,
  getTokenDetails,
  type Chain,
  type Payment,
  type Token,
} from '@/schemas';

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
  /**
   * The invoiced amount — what the payer thinks they paid, and what the payable is
   * promised to receive on the destination chain. This is the number receipts should
   * lead with.
   */
  requestedAmount: bigint;
  /**
   * Raw on-chain integer amount actually debited from the payer. Equal to
   * `requestedAmount` for same-chain payments (and all Solana payments). For a
   * cross-chain CCTP payment this is `requestedAmount + maxFee` — the payer pays
   * the bridge fee on top so the payable still receives the requested amount.
   * Format with `TokenAndAmount`/`formatTokenAmount`, never divide it directly.
   */
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
    // Solana returns the same value for both; older cached rows may lack the field.
    this.requestedAmount =
      onChainData.requestedAmount !== undefined ? BigInt(onChainData.requestedAmount) : this.amount;
    this.timestamp = Number(onChainData.timestamp);
  }

  /** True when the actual debit exceeded the invoiced amount (cross-chain CCTP fee). */
  get hasBridgeFee(): boolean {
    return this.amount > this.requestedAmount;
  }

  /** The bridge fee the payer paid on top of `requestedAmount`. Zero when same-chain. */
  get bridgeFee(): bigint {
    return this.amount > this.requestedAmount ? this.amount - this.requestedAmount : 0n;
  }

  /** Human-readable "amount name" for this payment, e.g. "1.5 USDC". Renders the invoiced amount. */
  displayDetails() {
    return this.format() + ' ' + this.token.name;
  }

  /** Human-readable decimal invoiced amount only (no token name). */
  format() {
    return formatTokenAmount(this.requestedAmount, this.token.details[this.chain.name]?.decimals ?? 0);
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

  /**
   * Restores a cache-retrieved plain object into a real `UserPayment`: swaps
   * the prototype back, and re-inflates `chain` / `payableChain` from the
   * schema registry so viem-derived function tables (stripped by
   * `sanitizeForClone`) are available again if any caller ever needs them.
   */
  static rehydrate(cached: any): UserPayment {
    const inst = Object.setPrototypeOf(cached, UserPayment.prototype) as UserPayment;
    if (inst.chain?.name) inst.chain = chainNamesToChains[inst.chain.name];
    if (inst.payableChain?.name) inst.payableChain = chainNamesToChains[inst.payableChain.name];
    // Older cache entries (saved before requestedAmount was tracked) lack the
    // field; fall back to `amount` so callers never see undefined.
    if (inst.requestedAmount === undefined || inst.requestedAmount === null) {
      inst.requestedAmount = inst.amount;
    } else if (typeof inst.requestedAmount !== 'bigint') {
      inst.requestedAmount = BigInt(inst.requestedAmount as unknown as string | number);
    }
    return inst;
  }
}
