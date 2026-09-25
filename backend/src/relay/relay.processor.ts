// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Relay processor
//
// Sequential loop: claim one job, resolve artefacts (VAA / CCTP attestation)
// if not already fetched, submit to the destination diamond, classify the
// outcome, and persist the result.
//
// Job classification:
//   Idempotent errors -> DONE  (the message was already applied by another path)
//   RelayerOnly       -> FAILED immediately
//   InsufficientFinality / attestation pending -> retryLater
//   Solana dest types -> leave PENDING, log a warning (phase 3a handles them)
//   Other failures    -> retryLater (exponential backoff, max 8 attempts)
//
// Invariants:
//   - One job at a time; the caller (WorkerModule loop) runs this in a serial loop.
//   - Artefacts are persisted as soon as they are resolved so retries skip re-fetch.
//   - The abi field is stripped from viem errors before logging.
// ──────────────────────────────────────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import type { RelayJob } from '@prisma/client';
import type { PrivateKeyAccount } from 'viem/accounts';
import { createEvmPublicClient, createEvmWalletClient } from '../chains/clients';
import { ChainsService } from '../chains/chains.service';
import type { EvmChainConfig } from '../chains/types';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { claimJob, markDone, markFailed, patchArtefacts, retryLater } from './job.store';
import { fetchCctpAttestation } from './resolvers/cctp.resolver';
import { fetchVaa } from './resolvers/wormhole.resolver';
import {
  submitReceiveForeignPaymentViaCctp,
  submitReceivePayableUpdateViaCctp,
  submitReceivePayableUpdateViaWormhole,
} from './submitters/evm.submitter';
import {
  submitPayableUpdateToSolana,
  submitPaymentToSolana,
  SOLANA_NOT_IMPLEMENTED,
} from './submitters/solana.submitter';

/** Error names that mean the message was already applied — treat as success. */
const IDEMPOTENT_ERRORS = new Set([
  'StalePayableUpdateNonce',
  'WormholeMessageAlreadyConsumed',
  'CctpBurnNonceAlreadyConsumed',
  'CctpDataNonceAlreadyConsumed',
  'PaymentNonceAlreadyConsumed',
]);

/** Error names that mean the relayer wallet lacks RELAYER_ROLE — fail immediately. */
const RELAYER_ONLY_ERRORS = new Set(['RelayerOnly']);

/** Error names that mean the attestation is not yet final — retry later. */
const RETRYABLE_ERRORS = new Set(['InsufficientFinality', SOLANA_NOT_IMPLEMENTED]);

/** Claims pending relay jobs and submits cross-chain messages (Wormhole VAA / CCTP) to the destination diamond. */
@Injectable()
export class RelayProcessor {
  private readonly logger = new Logger(RelayProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chains: ChainsService,
    private readonly config: AppConfigService
  ) {}

  /**
   * Claims and processes one pending job. Returns true when a job was claimed
   * (whether it succeeded or not), false when no jobs were ready.
   */
  async processOne(relayerAccount: PrivateKeyAccount): Promise<boolean> {
    const job = await claimJob(this.prisma);
    if (!job) return false;

    const log = this.logger.log.bind(this.logger);
    log({ jobId: job.id, type: job.type }, 'processing relay job');

    try {
      await this.dispatch(job, relayerAccount);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn({ jobId: job.id, err: msg }, 'relay job failed — scheduling retry');
      await retryLater(this.prisma, job, msg);
    }

    return true;
  }

  private async dispatch(job: RelayJob, relayerAccount: PrivateKeyAccount): Promise<void> {
    // Route Solana-destination jobs to the Solana submitter.
    if (job.type === 'SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE' || job.type === 'SOLANA_PAYMENT_VIA_CCTP_WORMHOLE') {
      await this.handleSolanaJob(job);
      return;
    }

    const sourceChain = this.chains.enabled.find((c) => c.cbChainId === job.sourceChainId);
    const destChain = this.chains.enabled.find((c) => c.cbChainId === job.destChainId);

    if (!sourceChain || !destChain || !sourceChain.isEvm || !destChain.isEvm) {
      await markFailed(
        this.prisma,
        job.id,
        `unknown or non-EVM chain: source=${job.sourceChainId} dest=${job.destChainId}`
      );
      return;
    }

    const destPublicClient = createEvmPublicClient(destChain, this.chains.getRpcUrl(destChain));
    const destWalletClient = createEvmWalletClient(destChain, this.chains.getRpcUrl(destChain), relayerAccount);

    switch (job.type) {
      case 'PAYABLE_UPDATE_VIA_WORMHOLE':
        await this.handleWormholeUpdate(job, sourceChain, destChain, destPublicClient, destWalletClient);
        break;
      case 'PAYABLE_UPDATE_VIA_CCTP':
        await this.handleCctpUpdate(job, sourceChain, destChain, destPublicClient, destWalletClient);
        break;
      case 'PAYMENT_VIA_CCTP':
        await this.handleCctpPayment(job, sourceChain, destChain, destPublicClient, destWalletClient);
        break;
      case 'ADMIN_SYNC':
        await markFailed(this.prisma, job.id, 'ADMIN_SYNC jobs are handled out-of-band');
        break;
      default:
        await markFailed(this.prisma, job.id, `unrecognised job type: ${job.type}`);
    }
  }

  private async handleWormholeUpdate(
    job: RelayJob,
    sourceChain: EvmChainConfig,
    destChain: EvmChainConfig,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    destPublicClient: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    destWalletClient: any
  ): Promise<void> {
    let vaaBytes: Uint8Array;

    if (job.vaa) {
      vaaBytes = Buffer.from(job.vaa, 'hex');
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eventData = job.eventData as any;
      const sequence = BigInt(eventData?.wormholeSequence ?? 0);

      if (!sourceChain.wormholeChainId) {
        await markFailed(this.prisma, job.id, 'source chain has no Wormhole chain id');
        return;
      }

      const fetched = await fetchVaa(
        sourceChain.network,
        sourceChain.wormholeChainId,
        sourceChain.diamondAddress!,
        sequence
      );

      if (!fetched) {
        // VAA not yet available — retry later.
        await retryLater(this.prisma, job, 'VAA not yet available');
        return;
      }

      vaaBytes = fetched;
      await patchArtefacts(this.prisma, job.id, { vaa: Buffer.from(vaaBytes).toString('hex') });
    }

    const errorName = await submitReceivePayableUpdateViaWormhole(
      destChain,
      destPublicClient,
      destWalletClient,
      vaaBytes
    );

    await this.classifyResult(job, errorName);
  }

  private async handleCctpUpdate(
    job: RelayJob,
    sourceChain: EvmChainConfig,
    destChain: EvmChainConfig,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    destPublicClient: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    destWalletClient: any
  ): Promise<void> {
    let message: string;
    let attestation: string;

    if (job.cctpMessage && job.cctpAttestation) {
      message = job.cctpMessage;
      attestation = job.cctpAttestation;
    } else {
      if (sourceChain.circleDomain === undefined || destChain.circleDomain === undefined) {
        await markFailed(this.prisma, job.id, 'source or dest chain has no Circle domain');
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const originalTxHash = (job.eventData as any)?.originalTxHash ?? job.txHash;
      const fetched = await fetchCctpAttestation(
        sourceChain.network,
        sourceChain.circleDomain,
        originalTxHash,
        destChain.circleDomain
      );

      if (!fetched) {
        await retryLater(this.prisma, job, 'CCTP attestation not yet available');
        return;
      }

      message = fetched.message;
      attestation = fetched.attestation;
      await patchArtefacts(this.prisma, job.id, { cctpMessage: message, cctpAttestation: attestation });
    }

    const errorName = await submitReceivePayableUpdateViaCctp(
      destChain,
      destPublicClient,
      destWalletClient,
      message,
      attestation
    );

    await this.classifyResult(job, errorName);
  }

  private async handleCctpPayment(
    job: RelayJob,
    sourceChain: EvmChainConfig,
    destChain: EvmChainConfig,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    destPublicClient: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    destWalletClient: any
  ): Promise<void> {
    let message: string;
    let attestation: string;

    if (job.cctpMessage && job.cctpAttestation) {
      message = job.cctpMessage;
      attestation = job.cctpAttestation;
    } else {
      if (sourceChain.circleDomain === undefined || destChain.circleDomain === undefined) {
        await markFailed(this.prisma, job.id, 'source or dest chain has no Circle domain');
        return;
      }

      const fetched = await fetchCctpAttestation(
        sourceChain.network,
        sourceChain.circleDomain,
        job.txHash,
        destChain.circleDomain
      );

      if (!fetched) {
        await retryLater(this.prisma, job, 'CCTP payment attestation not yet available');
        return;
      }

      message = fetched.message;
      attestation = fetched.attestation;
      await patchArtefacts(this.prisma, job.id, { cctpMessage: message, cctpAttestation: attestation });
    }

    const errorName = await submitReceiveForeignPaymentViaCctp(
      destChain,
      destPublicClient,
      destWalletClient,
      message,
      attestation
    );

    await this.classifyResult(job, errorName);
  }

  /**
   * Routes SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE and SOLANA_PAYMENT_VIA_CCTP_WORMHOLE
   * jobs to the Solana submitter. The destination chain must be an enabled Solana chain.
   * When no Solana keypair is configured (SOLANA_RELAYER_KEYPAIR not set) the job is
   * marked FAILED immediately with a clear message.
   */
  private async handleSolanaJob(job: RelayJob): Promise<void> {
    const keypairBytes = this.config.env.solanaRelayerKeypair;
    if (!keypairBytes) {
      await markFailed(this.prisma, job.id, 'SOLANA_RELAYER_KEYPAIR not configured');
      return;
    }

    const destChain = this.chains.enabled.find((c) => c.cbChainId === job.destChainId);
    if (!destChain || !destChain.isSolana) {
      await markFailed(
        this.prisma,
        job.id,
        `Solana job has no enabled Solana dest chain: destChainId=${job.destChainId}`
      );
      return;
    }

    const rpcUrl = this.chains.getRpcUrl(destChain);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventData = job.eventData as Record<string, any>;
    let errorName: string | null;

    if (job.type === 'SOLANA_PAYMENT_VIA_CCTP_WORMHOLE') {
      let vaaBytes: Uint8Array;
      let burnMessage: string;
      let attestation: string;

      if (job.vaa && job.cctpMessage && job.cctpAttestation) {
        vaaBytes = Buffer.from(job.vaa, 'hex');
        burnMessage = job.cctpMessage;
        attestation = job.cctpAttestation;
      } else {
        // VAA and CCTP artefacts are fetched by the processor's existing
        // resolver logic in handleWormholeUpdate / handleCctpPayment before
        // this method is called. If they are absent here, retry later.
        const sequence = BigInt(eventData?.sequence ?? '0');
        const sourceChain = this.chains.enabled.find((c) => c.cbChainId === job.sourceChainId);
        if (!sourceChain?.wormholeChainId) {
          await retryLater(this.prisma, job, 'source chain has no Wormhole chain id');
          return;
        }

        const { fetchVaa } = await import('./resolvers/wormhole.resolver');
        const fetched = await fetchVaa(
          sourceChain.network,
          sourceChain.wormholeChainId,
          sourceChain.isSolana
            ? destChain.programId
            : (sourceChain as import('../chains/types').EvmChainConfig).diamondAddress!,
          sequence
        );
        if (!fetched) {
          await retryLater(this.prisma, job, 'VAA not yet available');
          return;
        }
        vaaBytes = fetched;
        await patchArtefacts(this.prisma, job.id, { vaa: Buffer.from(vaaBytes).toString('hex') });

        // CCTP artefacts: use Circle V1 Iris (Solana uses CCTP V1).
        const { fetchCctpAttestation } = await import('./resolvers/cctp.resolver');
        const sourceForCctp = this.chains.enabled.find((c) => c.cbChainId === job.sourceChainId);
        if (sourceForCctp?.circleDomain === undefined || destChain.circleDomain === undefined) {
          await markFailed(this.prisma, job.id, 'source or dest chain has no Circle domain');
          return;
        }
        const cctpFetched = await fetchCctpAttestation(
          sourceForCctp.network,
          sourceForCctp.circleDomain,
          job.txHash,
          destChain.circleDomain
        );
        if (!cctpFetched) {
          await retryLater(this.prisma, job, 'CCTP attestation not yet available');
          return;
        }
        burnMessage = cctpFetched.message;
        attestation = cctpFetched.attestation;
        await patchArtefacts(this.prisma, job.id, { cctpMessage: burnMessage, cctpAttestation: attestation });
      }

      errorName = await submitPaymentToSolana(destChain, rpcUrl, keypairBytes, vaaBytes, burnMessage, attestation);
    } else {
      // SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE
      let vaaBytes: Uint8Array;

      if (job.vaa) {
        vaaBytes = Buffer.from(job.vaa, 'hex');
      } else {
        const sequence = BigInt(eventData?.sequence ?? '0');
        const sourceChain = this.chains.enabled.find((c) => c.cbChainId === job.sourceChainId);
        if (!sourceChain?.wormholeChainId) {
          await retryLater(this.prisma, job, 'source chain has no Wormhole chain id');
          return;
        }

        const emitter = sourceChain.isSolana
          ? destChain.programId
          : (sourceChain as import('../chains/types').EvmChainConfig).diamondAddress!;

        const { fetchVaa } = await import('./resolvers/wormhole.resolver');
        const fetched = await fetchVaa(sourceChain.network, sourceChain.wormholeChainId, emitter, sequence);
        if (!fetched) {
          await retryLater(this.prisma, job, 'VAA not yet available');
          return;
        }
        vaaBytes = fetched;
        await patchArtefacts(this.prisma, job.id, { vaa: Buffer.from(vaaBytes).toString('hex') });
      }

      errorName = await submitPayableUpdateToSolana(destChain, rpcUrl, keypairBytes, vaaBytes);
    }

    await this.classifyResult(job, errorName);
  }

  /**
   * Maps a decoded error name (or null for success) to the appropriate job outcome.
   */
  private async classifyResult(job: RelayJob, errorName: string | null): Promise<void> {
    if (errorName === null) {
      await markDone(this.prisma, job.id);
      return;
    }

    if (IDEMPOTENT_ERRORS.has(errorName)) {
      this.logger.log({ jobId: job.id, errorName }, 'idempotent error — marking DONE');
      await markDone(this.prisma, job.id);
      return;
    }

    if (RELAYER_ONLY_ERRORS.has(errorName)) {
      this.logger.error({ jobId: job.id, errorName }, 'RelayerOnly error — relayer lacks RELAYER_ROLE, marking FAILED');
      await markFailed(this.prisma, job.id, `RelayerOnly: relayer wallet lacks RELAYER_ROLE on destination diamond`);
      return;
    }

    if (RETRYABLE_ERRORS.has(errorName)) {
      await retryLater(this.prisma, job, `retryable error: ${errorName}`);
      return;
    }

    // Unknown error — retry with backoff.
    await retryLater(this.prisma, job, `diamond error: ${errorName}`);
  }
}
