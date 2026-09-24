// schemas/receipt.ts
//
// `Receipt` is the shared shape of the three entities a payer or host can
// land on a receipt/activity row for: `UserPayment`, `PayablePayment` and
// `Withdrawal`. It lets `TransactionsTable` and `ReceiptView` render any of
// the three without caring which one they got.
//
// Used by: `schemas/user-payment.ts`, `schemas/payable-payment.ts`,
// `schemas/withdrawal.ts` (implementers), `components/TransactionsTable.vue`
// and `views/ReceiptView.vue` (consumers).
import { type Chain, type Token } from '@/schemas';

export interface Receipt {
  id: string;
  chain: Chain;
  payableId: string;
  timestamp: number;
  token: Token;
  /** Raw on-chain integer amount. Format it with `TokenAndAmount`/`formatTokenAmount`, never divide it directly. */
  amount: bigint;

  /** Human-readable "amount name" for this receipt, e.g. "1.5 USDC". */
  displayDetails(): string;
  /** The wallet that owns this receipt: the payer for a payment, the host for a withdrawal. */
  user(): string;
  /** The chain `user()` acted from (may differ from `chain` for a cross-chain `PayablePayment`). */
  userChain(): Chain;
}
