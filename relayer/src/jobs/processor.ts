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

import { chainByName } from '../chains/index.js';
import { waitForAttestation } from '../resolvers/cctp.js';
import { getVaa } from '../resolvers/wormhole.js';
import { submitPayableUpdateViaCctp, submitPayableUpdateViaWormhole } from '../submitters/payable-update.js';
import { submitForeignPayment } from '../submitters/payment.js';
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
        log.info('Fetching Wormhole VAA for payable update');
        const vaaBytes = await getVaa(sourceChain, job.txHash);
        if (!vaaBytes) throw new Error('VAA not yet available, will retry');
        await patchJob(job.id, { vaa: Buffer.from(vaaBytes).toString('hex') });
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
          getVaa(sourceChain, job.txHash),
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

      default:
        throw new Error(`Unknown job type: ${(job as any).type}`);
    }

    await markDone(job.id);
    log.info('Job completed successfully');
  } catch (err: any) {
    const errMsg = err?.message ?? `${err}`;
    log.error({ err: errMsg }, 'Job failed');

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
