-- CreateEnum
CREATE TYPE "activity_type" AS ENUM ('INITIALIZED_USER', 'CREATED_PAYABLE', 'USER_PAID', 'PAYABLE_RECEIVED', 'WITHDREW', 'CLOSED_PAYABLE', 'REOPENED_PAYABLE', 'UPDATED_PAYABLE_ALLOWED_TOKENS_AND_AMOUNTS', 'UPDATED_PAYABLE_AUTO_WITHDRAW_STATUS');

-- CreateEnum
CREATE TYPE "relay_job_type" AS ENUM ('PAYABLE_UPDATE_VIA_WORMHOLE', 'PAYABLE_UPDATE_VIA_CCTP', 'PAYMENT_VIA_CCTP_WORMHOLE', 'PAYMENT_VIA_CCTP_ONLY', 'ADMIN_SYNC', 'SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE', 'SOLANA_PAYMENT_VIA_CCTP_WORMHOLE');

-- CreateEnum
CREATE TYPE "relay_job_status" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "wallet_namespace" AS ENUM ('EVM', 'SOLANA');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('PAYABLE_CREATED', 'PAYMENT_RECEIVED', 'PAYMENT_RECEIPT', 'WITHDRAWAL_COMPLETED');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "chain_cursors" (
    "chain_id" TEXT NOT NULL,
    "activities_indexed" BIGINT NOT NULL DEFAULT 0,
    "wormhole_relayed" BIGINT NOT NULL DEFAULT 0,
    "cctp_payments_relayed" BIGINT NOT NULL DEFAULT 0,
    "cctp_payable_updates_relayed" BIGINT NOT NULL DEFAULT 0,
    "last_tick_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chain_cursors_pkey" PRIMARY KEY ("chain_id")
);

-- CreateTable
CREATE TABLE "payables" (
    "id" TEXT NOT NULL,
    "chain_id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "host_wallet_key" TEXT NOT NULL,
    "chain_count" BIGINT NOT NULL,
    "host_count" BIGINT NOT NULL,
    "payments_count" BIGINT NOT NULL DEFAULT 0,
    "withdrawals_count" BIGINT NOT NULL DEFAULT 0,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "is_auto_withdraw" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL,
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payable_allowed_tokens" (
    "payableId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,

    CONSTRAINT "payable_allowed_tokens_pkey" PRIMARY KEY ("payableId","token")
);

-- CreateTable
CREATE TABLE "payable_balances" (
    "payableId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,

    CONSTRAINT "payable_balances_pkey" PRIMARY KEY ("payableId","token")
);

-- CreateTable
CREATE TABLE "payable_descriptions" (
    "payable_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "updated_by_key" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payable_descriptions_pkey" PRIMARY KEY ("payable_id")
);

-- CreateTable
CREATE TABLE "user_payments" (
    "id" TEXT NOT NULL,
    "chain_id" TEXT NOT NULL,
    "payer" TEXT NOT NULL,
    "payer_wallet_key" TEXT NOT NULL,
    "payer_count" BIGINT NOT NULL,
    "chain_count" BIGINT NOT NULL,
    "payable_id" TEXT NOT NULL,
    "payable_chain_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payable_payments" (
    "id" TEXT NOT NULL,
    "chain_id" TEXT NOT NULL,
    "payable_id" TEXT NOT NULL,
    "payer" TEXT NOT NULL,
    "payer_chain_id" TEXT NOT NULL,
    "payer_wallet_key" TEXT NOT NULL,
    "payer_payment_id" TEXT NOT NULL,
    "chain_count" BIGINT NOT NULL,
    "local_chain_count" BIGINT NOT NULL,
    "payable_count" BIGINT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payable_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "chain_id" TEXT NOT NULL,
    "payable_id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "host_wallet_key" TEXT NOT NULL,
    "chain_count" BIGINT NOT NULL,
    "host_count" BIGINT NOT NULL,
    "payable_count" BIGINT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "chain_id" TEXT NOT NULL,
    "chain_count" BIGINT NOT NULL,
    "user_count" BIGINT NOT NULL,
    "payable_count" BIGINT NOT NULL,
    "entity" TEXT NOT NULL,
    "type" "activity_type" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relay_jobs" (
    "id" TEXT NOT NULL,
    "type" "relay_job_type" NOT NULL,
    "status" "relay_job_status" NOT NULL DEFAULT 'PENDING',
    "source_chain_id" TEXT NOT NULL,
    "dest_chain_id" TEXT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "block_number" BIGINT,
    "event_data" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "not_before" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "vaa" TEXT,
    "circle_msg" TEXT,
    "circle_attestation" TEXT,
    "circle_msg_payload" TEXT,
    "circle_attest_payload" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_attempt_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "relay_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "key" TEXT NOT NULL,
    "namespace" "wallet_namespace" NOT NULL,
    "address" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sign_in_at" TIMESTAMP(3),

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "auth_nonces" (
    "nonce" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_nonces_pkey" PRIMARY KEY ("nonce")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "wallet_key" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" TEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "email" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id","type")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "wallet_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "outbox_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "provider_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payables_host_wallet_key_created_at_idx" ON "payables"("host_wallet_key", "created_at");

-- CreateIndex
CREATE INDEX "payables_chain_id_created_at_idx" ON "payables"("chain_id", "created_at");

-- CreateIndex
CREATE INDEX "user_payments_payer_wallet_key_timestamp_idx" ON "user_payments"("payer_wallet_key", "timestamp");

-- CreateIndex
CREATE INDEX "user_payments_payable_id_idx" ON "user_payments"("payable_id");

-- CreateIndex
CREATE INDEX "payable_payments_payable_id_timestamp_idx" ON "payable_payments"("payable_id", "timestamp");

-- CreateIndex
CREATE INDEX "payable_payments_payer_payment_id_idx" ON "payable_payments"("payer_payment_id");

-- CreateIndex
CREATE INDEX "withdrawals_payable_id_timestamp_idx" ON "withdrawals"("payable_id", "timestamp");

-- CreateIndex
CREATE INDEX "withdrawals_host_wallet_key_timestamp_idx" ON "withdrawals"("host_wallet_key", "timestamp");

-- CreateIndex
CREATE INDEX "activities_entity_idx" ON "activities"("entity");

-- CreateIndex
CREATE UNIQUE INDEX "activities_chain_id_chain_count_key" ON "activities"("chain_id", "chain_count");

-- CreateIndex
CREATE INDEX "relay_jobs_status_not_before_idx" ON "relay_jobs"("status", "not_before");

-- CreateIndex
CREATE UNIQUE INDEX "relay_jobs_type_tx_hash_dest_chain_id_key" ON "relay_jobs"("type", "tx_hash", "dest_chain_id");

-- CreateIndex
CREATE INDEX "wallets_user_id_idx" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "email_verifications_user_id_created_at_idx" ON "email_verifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "email_verifications_email_created_at_idx" ON "email_verifications"("email", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_dedupe_key_key" ON "outbox"("dedupe_key");

-- CreateIndex
CREATE INDEX "outbox_status_next_attempt_at_idx" ON "outbox"("status", "next_attempt_at");

-- AddForeignKey
ALTER TABLE "payable_allowed_tokens" ADD CONSTRAINT "payable_allowed_tokens_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "payables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_balances" ADD CONSTRAINT "payable_balances_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "payables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_payments" ADD CONSTRAINT "payable_payments_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "payables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "payables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
