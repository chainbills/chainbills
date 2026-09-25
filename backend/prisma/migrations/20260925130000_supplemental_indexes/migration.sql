-- AuthNonce: index expiresAt for cleanup queries (delete expired rows on each nonce issue)
CREATE INDEX "auth_nonces_expires_at_idx" ON "auth_nonces"("expires_at");

-- RelayJob: add userPaymentId column (extracted from eventData) so relay-status lookups
-- avoid a full JSON scan on the eventData column
ALTER TABLE "relay_jobs" ADD COLUMN "user_payment_id" TEXT;
CREATE INDEX "relay_jobs_user_payment_id_idx" ON "relay_jobs"("user_payment_id");

-- PayablePayment: index payerWalletKey + timestamp for direct payer-side queries
CREATE INDEX "payable_payments_payer_wallet_key_timestamp_idx" ON "payable_payments"("payer_wallet_key", "timestamp");
