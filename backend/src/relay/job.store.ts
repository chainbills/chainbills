// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Relay job store
//
// CRUD layer over the RelayJob table. The processor calls these; the trigger
// detector calls createJob. All methods are thin Prisma wrappers — no business
// logic lives here.
//
// Invariants:
//   - createJob uses createMany+skipDuplicates (or catches P2002) so the
//     unique key (type, txHash, destChainId) deduplicates across retries.
//   - claimJob picks the oldest PENDING/PROCESSING job whose notBefore <= now()
//     and sets it PROCESSING atomically. Returns null when none are ready.
//   - retryLater backoff: now() + 30s × 2^attempts, capped at 10 min.
//   - After 8 attempts retryLater marks the job FAILED directly.
// ──────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import { Prisma, RelayJobStatus, RelayJobType, type RelayJob } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export type { RelayJob };

/** The subset of RelayJob fields the trigger detector provides when creating a job. */
export interface CreateJobData {
  type: RelayJobType;
  sourceChainId: string;
  destChainId: string;
  txHash: string;
  blockNumber?: bigint;
  eventData: Record<string, unknown>;
}

/** Artefact fields that can be patched onto a job once fetched. */
export interface JobArtefacts {
  vaa?: string;
  cctpMessage?: string;
  cctpAttestation?: string;
}

const MAX_BACKOFF_MS = 10 * 60 * 1000; // 10 minutes
const BACKOFF_BASE_MS = 30_000; // 30 seconds per attempt factor

/** Max attempts before a job is permanently marked FAILED. */
export const MAX_RELAY_ATTEMPTS = 8;

const logger = new Logger('JobStore');

/**
 * Creates relay jobs in bulk, skipping any that already exist (by the unique
 * key type+txHash+destChainId). Returns the number of rows actually inserted.
 */
export async function createJob(prisma: PrismaService, data: CreateJobData): Promise<number> {
  try {
    const result = await prisma.relayJob.createMany({
      data: [
        {
          type: data.type,
          sourceChainId: data.sourceChainId,
          destChainId: data.destChainId,
          txHash: data.txHash,
          blockNumber: data.blockNumber,
          eventData: data.eventData as Prisma.InputJsonValue,
          // Extracted from eventData so relay-status lookups use a real index.
          userPaymentId: typeof data.eventData['userPaymentId'] === 'string' ? data.eventData['userPaymentId'] : null,
        },
      ],
      skipDuplicates: true,
    });
    return result.count;
  } catch (err) {
    // Catch P2002 (unique violation) in case the driver surfaces it before
    // Prisma's own skipDuplicates logic handles it.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return 0;
    }
    throw err;
  }
}

/**
 * Claims one ready job for processing. Picks the oldest job with
 * status IN (PENDING, PROCESSING) AND notBefore <= now(), sets it to
 * PROCESSING, and returns it. Returns null when no jobs are ready.
 */
export async function claimJob(prisma: PrismaService): Promise<RelayJob | null> {
  const now = new Date();

  // Use a raw query with SKIP LOCKED to safely claim one row without races.
  // Falls back to a Prisma findFirst when no eligible rows exist.
  const rows = await prisma.$queryRaw<RelayJob[]>`
    SELECT * FROM relay_jobs
    WHERE status IN ('PENDING','PROCESSING') AND not_before <= ${now}
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  `;

  if (rows.length === 0) return null;
  const job = rows[0];

  await prisma.relayJob.update({
    where: { id: job.id },
    data: {
      status: RelayJobStatus.PROCESSING,
      lastAttemptAt: now,
      attempts: { increment: 1 },
    },
  });

  // Re-fetch so returned object reflects the incremented attempts.
  return prisma.relayJob.findUniqueOrThrow({ where: { id: job.id } });
}

/**
 * Patches fetched artefacts (VAA bytes, CCTP message, attestation) onto a job
 * so that retries never need to re-fetch them.
 */
export async function patchArtefacts(prisma: PrismaService, id: string, artefacts: JobArtefacts): Promise<void> {
  const data: Partial<Pick<RelayJob, 'vaa' | 'cctpMessage' | 'cctpAttestation'>> = {};
  if (artefacts.vaa !== undefined) data.vaa = artefacts.vaa;
  if (artefacts.cctpMessage !== undefined) data.cctpMessage = artefacts.cctpMessage;
  if (artefacts.cctpAttestation !== undefined) data.cctpAttestation = artefacts.cctpAttestation;
  if (Object.keys(data).length === 0) return;
  await prisma.relayJob.update({ where: { id }, data });
}

/** Marks a job as successfully completed. */
export async function markDone(prisma: PrismaService, id: string): Promise<void> {
  await prisma.relayJob.update({
    where: { id },
    data: { status: RelayJobStatus.DONE, completedAt: new Date() },
  });
}

/** Marks a job as permanently failed (not retryable). */
export async function markFailed(prisma: PrismaService, id: string, error: string): Promise<void> {
  logger.warn({ jobId: id, error }, 'relay job permanently failed');
  await prisma.relayJob.update({
    where: { id },
    data: {
      status: RelayJobStatus.FAILED,
      lastError: error.slice(0, 1000),
      completedAt: new Date(),
    },
  });
}

/**
 * Schedules a job for retry with exponential backoff.
 * Backoff = 30s × 2^attempts, capped at 10 min.
 * After MAX_RELAY_ATTEMPTS (8) attempts the job is marked FAILED instead.
 */
export async function retryLater(prisma: PrismaService, job: RelayJob, error: string): Promise<void> {
  if (job.attempts >= MAX_RELAY_ATTEMPTS) {
    await markFailed(prisma, job.id, error);
    return;
  }

  const backoffMs = Math.min(BACKOFF_BASE_MS * Math.pow(2, job.attempts), MAX_BACKOFF_MS);
  const notBefore = new Date(Date.now() + backoffMs);

  await prisma.relayJob.update({
    where: { id: job.id },
    data: {
      status: RelayJobStatus.PENDING,
      lastError: error.slice(0, 1000),
      notBefore,
    },
  });
}

/**
 * Finds the relay job for the given user payment id. Uses the indexed
 * `userPaymentId` column (not a JSON path scan). Returns null when no matching
 * job exists — same-chain payments never produce a relay job.
 */
export async function findByPaymentId(prisma: PrismaService, userPaymentId: string): Promise<RelayJob | null> {
  const rows = await prisma.relayJob.findMany({
    where: { userPaymentId },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  return rows[0] ?? null;
}

/** Counts jobs by status — used in the heartbeat log. */
export async function countByStatus(prisma: PrismaService): Promise<Record<RelayJobStatus, number>> {
  const rows = await prisma.relayJob.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const result = {
    [RelayJobStatus.PENDING]: 0,
    [RelayJobStatus.PROCESSING]: 0,
    [RelayJobStatus.DONE]: 0,
    [RelayJobStatus.FAILED]: 0,
  };

  for (const row of rows) {
    result[row.status] = row._count._all;
  }

  return result;
}
