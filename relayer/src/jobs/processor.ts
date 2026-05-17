// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Job Processor
//
// Picks up PENDING and stale PROCESSING jobs from Firestore and executes
// them with exponential back-off retries.
//
// Processing loop:
//   1. Query /relayerJobs for PENDING | PROCESSING jobs.
//   2. For each job, attempt the appropriate relay transaction.
//   3. On success → mark DONE.
//   4. On failure → mark FAILED if maxAttempts reached, else leave PENDING
//      for the next processor run (the job.attempts counter acts as the retry counter).
//
// The processor runs on a fixed interval (PROCESSOR_INTERVAL_MS) from index.ts.
// For payable update jobs we need the VAA or CCTP attestation first.
// For payment jobs we need both the VAA AND the CCTP attestation.
// ──────────────────────────────────────────────────────────────────────────────

import { chainByName } from '../chains.js';
import { waitForAllAttestations, waitForAttestation } from '../resolvers/cctp.js';
import { getVaaBySequence, getVaaByTxHash } from '../resolvers/wormhole.js';
import {
  submitAdminSyncPayable,
  submitPayableUpdateViaCctp,
  submitPayableUpdateViaWormhole,
} from '../submitters/payable-update.js';
import { submitForeignPayment, submitForeignPaymentViaCctp } from '../submitters/payment.js';
import { logger } from '../utils/logger.js';
import { getPendingJobs, markDone, markFailed, markProcessing, patchJob, type RelayerJob } from './store.js';

/** Max relay attempts before a job is permanently marked FAILED. */
const MAX_ATTEMPTS = 5;

/** Processes all pending and stale jobs. Called periodically from index.ts. */
export async function processJobs(): Promise<void> {
  const jobs = await getPendingJobs();
  if (jobs.length === 0) return;

  logger.info({ count: jobs.length }, 'Processing pending relay jobs');

  // Process jobs sequentially to avoid nonce conflicts on the relayer wallet.
  for (const job of jobs) {
    if (job.attempts >= MAX_ATTEMPTS) {
      await markFailed(job.id, `Exceeded max attempts (${MAX_ATTEMPTS})`);
      continue;
    }
    await processJob(job);
  }
}

async function processJob(job: RelayerJob): Promise<void> {
  await markProcessing(job.id);
  const log = logger.child({ jobId: job.id, type: job.type });

  try {
    const destChain = chainByName.get(job.destChain);
    const sourceChain = chainByName.get(job.sourceChain);
    if (!destChain || !sourceChain) {
      throw new Error(`Unknown chain in job: source=${job.sourceChain} dest=${job.destChain}`);
    }

    switch (job.type) {
      case 'PAYABLE_UPDATE_VIA_WORMHOLE': {
        let vaaBytes: Uint8Array;
        if (job.vaa) {
          vaaBytes = Buffer.from(job.vaa, 'hex');
        } else if (job.eventData?.sequence !== undefined) {
          const sequence = Number(job.eventData.sequence);
          log.info({ sequence }, 'Fetching Wormhole VAA by sequence');
          const fetched = await getVaaBySequence(sourceChain, sequence);
          if (!fetched) throw new Error('VAA not yet available by sequence, will retry');
          vaaBytes = fetched;
          await patchJob(job.id, { vaa: Buffer.from(vaaBytes).toString('hex') });
        } else {
          // Legacy path: job created with a real txHash (no sequence in eventData).
          log.info('Fetching Wormhole VAA by txHash (legacy)');
          const fetched = await getVaaByTxHash(sourceChain, job.txHash);
          if (!fetched) throw new Error('VAA not yet available, will retry');
          vaaBytes = fetched;
          await patchJob(job.id, { vaa: Buffer.from(vaaBytes).toString('hex') });
        }
        // Skip non-payable-update VAAs (type 2 = payment, handled via payment relay path).
        const payloadOffset = wormholePayloadOffset(vaaBytes);
        if (payloadOffset !== null && vaaBytes[payloadOffset] !== 1) {
          log.debug({ payloadType: vaaBytes[payloadOffset] }, 'Skipping non-payable-update VAA');
          await markDone(job.id);
          return;
        }
        await submitPayableUpdateViaWormhole(destChain, vaaBytes);
        break;
      }

      case 'PAYABLE_UPDATE_VIA_CCTP': {
        log.info('Fetching CCTP attestation for payable update');
        if (!sourceChain.hasCctp || sourceChain.circleDomain === undefined) {
          throw new Error(`Source chain ${sourceChain.name} has no CCTP`);
        }
        const { message, attestation } = await waitForAttestation(sourceChain, job.txHash);
        await patchJob(job.id, { circleMsg: message, circleAttestation: attestation });
        await submitPayableUpdateViaCctp(destChain, message, attestation);
        break;
      }

      case 'PAYMENT_VIA_CIRCLE': {
        log.info('Fetching VAA + CCTP attestation for cross-chain payment');
        if (!sourceChain.hasCctp || sourceChain.circleDomain === undefined) {
          throw new Error(`Source chain ${sourceChain.name} has no CCTP for payment`);
        }
        if (!sourceChain.hasWormhole) {
          throw new Error(`Source chain ${sourceChain.name} has no Wormhole for payment VAA`);
        }

        // Fetch VAA and attestation in parallel to reduce latency.
        const [vaaBytes, { message, attestation }] = await Promise.all([
          getVaaByTxHash(sourceChain, job.txHash),
          waitForAttestation(sourceChain, job.txHash),
        ]);

        if (!vaaBytes) throw new Error('VAA not yet available, will retry');

        await patchJob(job.id, {
          vaa: Buffer.from(vaaBytes).toString('hex'),
          circleMsg: message,
          circleAttestation: attestation,
        });
        await submitForeignPayment(destChain, vaaBytes, message, attestation);
        break;
      }

      case 'PAYMENT_VIA_CCTP_ONLY': {
        log.info('Fetching two CCTP attestations for CCTP-only payment');
        if (!sourceChain.hasCctp || sourceChain.circleDomain === undefined) {
          throw new Error(`Source chain ${sourceChain.name} has no CCTP`);
        }
        const attestations = await waitForAllAttestations(sourceChain, job.txHash, 2);
        if (attestations.length < 2) {
          throw new Error(`Expected 2 CCTP attestations, got ${attestations.length}`);
        }
        const [tokenBurn, payloadMsg] = attestations;
        await patchJob(job.id, {
          circleMsg: tokenBurn.message,
          circleAttestation: tokenBurn.attestation,
          circleMsgPayload: payloadMsg.message,
          circleAttestPayload: payloadMsg.attestation,
        });
        await submitForeignPaymentViaCctp(
          destChain,
          tokenBurn.message,
          tokenBurn.attestation,
          payloadMsg.message,
          payloadMsg.attestation
        );
        break;
      }

      case 'ADMIN_SYNC': {
        let vaaBytes: Uint8Array;
        if (job.vaa) {
          vaaBytes = new Uint8Array(Buffer.from(job.vaa, 'hex'));
        } else if (job.eventData?.sequence !== undefined) {
          const sequence = Number(job.eventData.sequence);
          log.info({ sequence }, 'Fetching Wormhole VAA for admin sync by sequence');
          const fetched = await getVaaBySequence(sourceChain, sequence);
          if (!fetched) throw new Error('VAA not yet available by sequence, will retry');
          vaaBytes = fetched;
          await patchJob(job.id, { vaa: Buffer.from(vaaBytes).toString('hex') });
        } else {
          throw new Error('ADMIN_SYNC job missing both vaa and sequence');
        }
        // Skip non-payable-update VAAs.
        const payloadOffset = wormholePayloadOffset(vaaBytes);
        if (payloadOffset !== null && vaaBytes[payloadOffset] !== 1) {
          log.debug({ payloadType: vaaBytes[payloadOffset] }, 'Skipping non-payable-update VAA in ADMIN_SYNC');
          await markDone(job.id);
          return;
        }
        await submitAdminSyncPayable(sourceChain, destChain, vaaBytes);
        break;
      }

      default:
        throw new Error(`Unknown job type: ${(job as any).type}`);
    }

    await markDone(job.id);
    log.info('Job completed successfully');
  } catch (err: any) {
    const errMsg = err?.message ?? `${err}`;
    log.error({ err: errMsg }, 'Job failed');

    // StalePayableUpdateNonce: the update was already applied via another protocol path — mark DONE.
    if (errMsg.includes('StalePayableUpdateNonce')) {
      await markDone(job.id);
      return;
    }

    if (job.attempts + 1 >= MAX_ATTEMPTS) {
      await markFailed(job.id, errMsg);
    } else {
      // Leave as PENDING so the next processor run picks it up.
      // markProcessing already incremented attempts.
      // We reset status to PENDING so it shows up in the next getPendingJobs() query.
      const { db } = await import('../utils/firebase.js');
      await db.doc(`relayerJobs/${job.id}`).update({ status: 'PENDING', error: errMsg });
    }
  }
}

/**
 * Returns the byte offset of the payload within a serialized signed VAA.
 * VAA layout: version(1) + guardianSetIndex(4) + numSigs(1) + sigs(66*n) + header(51) + payload
 */
function wormholePayloadOffset(vaa: Uint8Array): number | null {
  try {
    const numSigs = vaa[5];
    return 6 + 66 * numSigs + 51;
  } catch {
    return null;
  }
}
