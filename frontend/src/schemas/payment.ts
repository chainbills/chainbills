// schemas/payment.ts
//
// `Payment` narrows `Receipt` to the two payment receipt types
// (`UserPayment` and `PayablePayment`), adding the `payer` wallet address.
// It is the type `stores/payment.ts` returns from lookups where the caller
// does not need to know which of the two concrete classes it got.
//
// Used by: `stores/payment.ts`, `views/ReceiptView.vue`.
import { type Receipt } from '@/schemas';

export interface Payment extends Receipt {
  payer: string;
}
