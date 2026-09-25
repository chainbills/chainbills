-- Add indexes for the public API query patterns added in the public-api phase.
-- Activity: filter and sort by chain + timestamp for the per-wallet activity feed.
-- PayablePayment: filter and sort by chain + timestamp for cross-chain payment feeds.
-- UserPayment: filter and sort by chain + timestamp for cross-chain payment feeds.

CREATE INDEX "activities_chain_id_timestamp_idx" ON "activities"("chain_id", "timestamp");
CREATE INDEX "payable_payments_chain_id_timestamp_idx" ON "payable_payments"("chain_id", "timestamp");
CREATE INDEX "user_payments_chain_id_timestamp_idx" ON "user_payments"("chain_id", "timestamp");
