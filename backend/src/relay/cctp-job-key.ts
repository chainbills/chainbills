// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Shared CCTP relay-job key helpers
//
// Both the trigger detector (which walks the diamond's emission arrays) and
// the /relay/nudge endpoint (which parses a fresh receipt's logs) need to
// insert `RelayJob` rows with the SAME synthetic `txHash` key so the
// `@@unique([type, txHash, destChainId])` constraint dedupes them naturally,
// no matter which side gets there first.
//
// The keys below are derivable from information that lives in *both* the
// emission struct AND the on-chain event log, so neither code path needs an
// extra RPC hop just to compute them.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Synthetic key for a `PAYABLE_UPDATE_VIA_CCTP` job.
 *
 * Uniqueness argument: on the source chain, `chainbillsNonce` (a chain-wide
 * monotonic counter incremented per broadcast) uniquely identifies one
 * payable-update broadcast, so `(sourceCbChainId, payableId, chainbillsNonce)`
 * uniquely identifies one CCTP emission of that update. `destChainId` is not
 * baked in here because the unique constraint already includes it.
 */
export function cctpPayableUpdateJobKey(
  sourceCbChainId: string,
  payableId: string,
  chainbillsNonce: bigint | string
): string {
  return `cctp-msg-${sourceCbChainId}-${payableId}-${String(chainbillsNonce)}`;
}

/**
 * Synthetic key for a `PAYMENT_VIA_CCTP` job.
 *
 * Uniqueness argument: `userPaymentId` is globally unique (it's a hash keyed
 * on the payer, payable, and per-payer counter), so `(sourceCbChainId,
 * userPaymentId)` uniquely identifies one CCTP payment emission. `destChainId`
 * is not baked in here because the unique constraint already includes it.
 */
export function cctpPaymentJobKey(sourceCbChainId: string, userPaymentId: string): string {
  return `cctp-pay-${sourceCbChainId}-${userPaymentId}`;
}
