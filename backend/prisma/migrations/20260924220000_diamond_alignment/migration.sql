-- AlterEnum
BEGIN;
CREATE TYPE "relay_job_type_new" AS ENUM ('PAYABLE_UPDATE_VIA_WORMHOLE', 'PAYABLE_UPDATE_VIA_CCTP', 'PAYMENT_VIA_CCTP', 'ADMIN_SYNC', 'SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE', 'SOLANA_PAYMENT_VIA_CCTP_WORMHOLE');
ALTER TABLE "relay_jobs" ALTER COLUMN "type" TYPE "relay_job_type_new" USING ("type"::text::"relay_job_type_new");
ALTER TYPE "relay_job_type" RENAME TO "relay_job_type_old";
ALTER TYPE "relay_job_type_new" RENAME TO "relay_job_type";
DROP TYPE "public"."relay_job_type_old";
COMMIT;

-- AlterTable
ALTER TABLE "chain_cursors" ADD COLUMN     "relay_scan_block" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payable_payments" ADD COLUMN     "requested_amount" DECIMAL(78,0) NOT NULL;

-- AlterTable
ALTER TABLE "relay_jobs" DROP COLUMN "circle_attest_payload",
DROP COLUMN "circle_attestation",
DROP COLUMN "circle_msg",
DROP COLUMN "circle_msg_payload",
ADD COLUMN     "cctp_attestation" TEXT,
ADD COLUMN     "cctp_message" TEXT;

-- AlterTable
ALTER TABLE "user_payments" ADD COLUMN     "requested_amount" DECIMAL(78,0) NOT NULL;

-- AlterTable
ALTER TABLE "withdrawals" ADD COLUMN     "fee" DECIMAL(78,0) NOT NULL;

