// schemas/payable-payment.ts
//
// `PayablePayment` mirrors CbGetters' `getPayablePayment(bytes32)` struct:
// the receipt that lives on the *payable's* chain after a payment. For a
// same-chain payment this is a second, linked record next to the payer's
// `UserPayment`; for a cross-chain payment it is what the relayer creates
// once the CCTP transfer + Wormhole/CCTP message land. `payerPaymentId`
// links it back to the payer's `UserPayment` id (which differs from this
// record's own id). `payer` is a left-padded `bytes32` on-chain because the
// payer's chain may not be EVM; `denormalizeBytes` turns it back into a
// wallet address for the payer's own chain type.
//
// Used by: `stores/payment.ts` (constructs it from `evm.fetchEntity`/
// `solana.fetchEntity`), `stores/activity.ts` (resolves `PayableReceived`
// activities and cross-chain arrival), `views/ReceiptView.vue`,
// `components/TransactionsTable.vue`.
import { cbChainIdToChain, formatTokenAmount, getTokenDetails, type Chain, type Payment, type Token } from '@/schemas';
import { denormalizeBytes } from '@/stores';

export class PayablePayment implements Payment {
  id: string;
  chain: Chain;
  payableId: string;
  /** This payment's position among all payments received by the payable (1-based). */
  payableCount: number;
  /** This payment's position among all payments received on `chain` (1-based). */
  localChainCount: number;
  payer: string;
  /** The chain the payer paid from, resolved from the on-chain `payerChainId`. */
  payerChain: Chain;
  /** The id of the matching `UserPayment` on the payer's chain — differs from this record's own `id`. */
  payerPaymentId: string;
  timestamp: number;
  token: Token;
  /** Raw on-chain integer amount. Format with `TokenAndAmount`/`formatTokenAmount`, never divide it directly. */
  amount: bigint;

  constructor(id: string, chain: Chain, onChainData: any) {
    this.id = id;
    this.chain = chain;

    if (chain.isEvm) this.payableId = onChainData.payableId;
    else if (chain.isSolana) this.payableId = onChainData.payableId.toBase58();
    else this.payableId = onChainData.payableId;

    this.payerChain = cbChainIdToChain[onChainData.payerChainId];
    if (!this.payerChain) throw new Error(`Unknown cbChainId: ${onChainData.payerChainId}`);
    this.payer = this.payerChain.isEvm
      ? '0x' + onChainData.payer.split('0x')[1].replace(/^0+/, '')
      : denormalizeBytes(onChainData.payer, this.payerChain);

    this.payableCount = Number(onChainData.payableCount);
    this.localChainCount = Number(onChainData.localChainCount);
    this.payerPaymentId = onChainData.payerPaymentId;
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
    return this.payerChain;
  }

  /** True when the payer paid from a different chain than the payable lives on. */
  get isCrossChain(): boolean {
    return this.payerChain.name !== this.chain.name;
  }
}
