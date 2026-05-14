// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Firestore Job Queue
//
// Every cross-chain relay action (payable update, payment redemption) is
// persisted as a job in Firestore BEFORE any on-chain transaction is attempted.
//
// Why Firestore as a job queue?
//   - No extra infrastructure (Redis, SQS, etc.) required.
//   - Jobs survive process crashes — the processor picks up PENDING / PROCESSING
//     jobs on restart.
//   - Full audit trail of every relay attempt with timestamps and error details.
//   - A simple admin UI can query /relayerJobs to see stuck jobs.
//
// Job lifecycle:
//   PENDING → PROCESSING → DONE
//                       ↘ FAILED (after maxAttempts retries)
// ──────────────────────────────────────────────────────────────────────────────

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../utils/firebase.js';
import type { ChainName } from '../chains/index.js';

export type JobType =
  | 'PAYABLE_UPDATE_VIA_WORMHOLE'
  | 'PAYABLE_UPDATE_VIA_CCTP'
  | 'PAYMENT_VIA_CIRCLE'
  | 'ADMIN_SYNC';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

/**
 * Shape of a job document stored in /relayerJobs/{jobId}.
 * All fields are present at creation; optional ones are added as the job progresses.
 */
export interface RelayerJob {
  id: string;
  type: JobType;
  status: JobStatus;
  /** Chain that emitted the source event. */
  sourceChain: ChainName;
  /** Chain on which the relay transaction must be submitted. */
  destChain: ChainName;
  /** Transaction hash on the source chain that triggered this job. */
  txHash: string;
  /** Block number of the triggering event. */
  blockNumber: number;
  /** Raw event args (payableId, nonce, etc.) as serialized strings. */
  eventData: Record<string, string>;
  /** Number of submission attempts so far. */
  attempts: number;
  createdAt: Timestamp;
  lastAttemptAt?: Timestamp;
  completedAt?: Timestamp;
  /** Error message from the last failed attempt. */
  error?: string;
  // ── Protocol-specific fields added during processing ──────────────────────
  /** Hex-encoded signed Wormhole VAA bytes (added once fetched). */
  vaa?: string;
  /** Hex-encoded Circle message bytes (added once fetched). */
  circleMsg?: string;
  /** Hex-encoded Circle attestation bytes (added once fetched). */
  circleAttestation?: string;
}

const jobsCol = () => db.collection('relayerJobs');

/** Creates a new PENDING job and returns its Firestore document ID. */
export async function createJob(
  data: Omit<RelayerJob, 'id' | 'status' | 'attempts' | 'createdAt'>
): Promise<string> {
  const ref = jobsCol().doc();
  const job: RelayerJob = {
    ...data,
    id: ref.id,
    status: 'PENDING',
    attempts: 0,
    createdAt: Timestamp.now(),
  };
  await ref.set(job);
  return ref.id;
}

/** Marks a job as PROCESSING and increments its attempt counter. */
export async function markProcessing(jobId: string): Promise<void> {
  await jobsCol().doc(jobId).update({
    status: 'PROCESSING',
    attempts: FieldValue.increment(1),
    lastAttemptAt: Timestamp.now(),
  });
}

/** Marks a job as DONE. */
export async function markDone(jobId: string): Promise<void> {
  await jobsCol().doc(jobId).update({
    status: 'DONE',
    completedAt: Timestamp.now(),
  });
}

/** Marks a job as FAILED with the given error message. */
export async function markFailed(jobId: string, error: string): Promise<void> {
  await jobsCol().doc(jobId).update({
    status: 'FAILED',
    error,
    lastAttemptAt: Timestamp.now(),
  });
}

/** Updates arbitrary fields on a job (used to attach vaa, circleMsg, etc.). */
export async function patchJob(jobId: string, data: Partial<RelayerJob>): Promise<void> {
  await jobsCol().doc(jobId).update(data as Record<string, unknown>);
}

/** Returns all PENDING and PROCESSING jobs ordered by creation time. */
export async function getPendingJobs(): Promise<RelayerJob[]> {
  const snap = await jobsCol()
    .where('status', 'in', ['PENDING', 'PROCESSING'])
    .orderBy('createdAt')
    .get();
  return snap.docs.map((d) => d.data() as RelayerJob);
}

/** Checks whether a job already exists for the given txHash + destChain pair (dedup). */
export async function jobExistsForTx(txHash: string, destChain: ChainName): Promise<boolean> {
  const snap = await jobsCol()
    .where('txHash', '==', txHash)
    .where('destChain', '==', destChain)
    .limit(1)
    .get();
  return !snap.empty;
}
