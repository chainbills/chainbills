// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Relay nudge controller
//
// POST /relay/nudge — unauthenticated. Front-end fire-and-forget after tx
// confirmation. Verifies the tx exists on the given chain, scans the receipt
// for SentPayableUpdateViaCctp / SentForeignPaymentViaCctp events emitted by
// the diamond itself, and for each one:
//   1. Upserts a `RelayTxHint` so the source-tx-hash resolver has an instant
//      answer when the relay processor later needs it.
//   2. Immediately upserts a `RelayJob` in PENDING with `notBefore = now()`,
//      using the same log-derivable synthetic key the trigger detector uses.
//      The relay processor loop (≤1 s at busy pace) picks it up right after
//      the endpoint returns — so a successful nudge is what actually triggers
//      the relay, instead of waiting on the next indexer tick.
//
// No auth by design: nothing here trusts client input. The tx receipt is
// re-fetched from our own RPC, and every log is filtered by both `log.address
// == diamond` and event topic before we accept it. A hostile client can only
// nudge relays that would have happened anyway.
// ──────────────────────────────────────────────────────────────────────────────

import { BadRequestException, Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';
import { keccak256, toBytes, type Log, type PublicClient } from 'viem';
import { ChainsService } from '../chains/chains.service';
import { createEvmPublicClient } from '../chains/clients';
import { sameNetwork } from '../chains/registry';
import type { EvmChainConfig } from '../chains/types';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { cctpPayableUpdateJobKey, cctpPaymentJobKey } from '../relay/cctp-job-key';
import { createJob } from '../relay/job.store';

const TOPIC_SENT_PAYABLE_UPDATE_VIA_CCTP = keccak256(toBytes('SentPayableUpdateViaCctp(bytes32,bytes32,uint64)'));
const TOPIC_SENT_FOREIGN_PAYMENT_VIA_CCTP = keccak256(
  toBytes('SentForeignPaymentViaCctp(bytes32,bytes32,bytes32,uint64,uint256,uint256,uint32)')
);

/** POST body: the chain slug and the on-chain tx hash the frontend just confirmed. */
export class RelayNudgeDto {
  /** Chain slug from the registry (e.g. `basesepolia`, `arcmainnet`). */
  @IsString()
  @IsIn([
    'anvil',
    'arcmainnet',
    'arctestnet',
    'base',
    'basesepolia',
    'megaethtestnet',
    'neondevnet',
    'sonicblazetestnet',
    'rootstocktestnet',
    'solanadevnet',
  ])
  chainSlug!: string;

  /** 0x-prefixed 32-byte hex tx hash. */
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/, { message: 'txHash must be 0x + 64 hex chars' })
  txHash!: `0x${string}`;
}

/** Internal per-emission record, produced by `extractEmissions` and consumed by the hint + job upserts. */
interface EmissionRecord {
  jobType: 'PAYABLE_UPDATE_VIA_CCTP' | 'PAYMENT_VIA_CCTP';
  destChainId: `0x${string}`;
  payableId: `0x${string}` | null;
  userPaymentId: `0x${string}` | null;
  chainbillsNonce: bigint;
}

/** Accepts frontend-supplied CCTP-emission tx hashes and stashes them for the relay processor. */
@ApiTags('relay')
@Controller('relay')
export class RelayNudgeController {
  private readonly logger = new Logger('RelayNudge');

  constructor(private readonly prisma: PrismaService, private readonly chains: ChainsService) {}

  @Public()
  @Post('nudge')
  @HttpCode(202)
  @ApiOperation({ summary: 'Hint the relayer with a fresh source tx hash for a CCTP emission and queue the relay job immediately.' })
  @ApiResponse({ status: 202, description: 'Accepted; hint and job recorded per matching emission.' })
  @ApiResponse({ status: 400, description: 'Unknown chain or tx.' })
  async nudge(@Body() body: RelayNudgeDto): Promise<{ hintsRecorded: number; jobsQueued: number }> {
    const chain = this.chains.enabled.find((c) => c.slug === body.chainSlug);
    if (!chain || !chain.isEvm) throw new BadRequestException(`chain ${body.chainSlug} is not an enabled EVM chain`);

    const evmChain = chain as EvmChainConfig;
    if (!evmChain.diamondAddress) throw new BadRequestException(`chain ${body.chainSlug} has no diamond address configured`);
    const client = createEvmPublicClient(evmChain, this.chains.getRpcUrl(evmChain)) as unknown as PublicClient;

    let receipt;
    try {
      receipt = await client.getTransactionReceipt({ hash: body.txHash });
    } catch {
      throw new BadRequestException('transaction not found on this chain');
    }
    if (receipt.status !== 'success') throw new BadRequestException('transaction reverted');

    // Do not require the tx's top-level `to` to be the diamond — smart-wallet /
    // paymaster / multicall paths route the same call through a wrapper. The
    // per-log `log.address == diamond` filter inside `extractEmissions` is
    // what enforces trust, and it also blocks a hostile contract emitting
    // look-alike topics from getting hints or jobs recorded.
    const emissions = this.extractEmissions(evmChain.diamondAddress, receipt.logs);
    if (emissions.length === 0) return { hintsRecorded: 0, jobsQueued: 0 };

    let hintsRecorded = 0;
    let jobsQueued = 0;
    for (const emission of emissions) {
      const hintOk = await this.upsertHint(evmChain.cbChainId, body.txHash, emission);
      if (hintOk) hintsRecorded++;

      const jobOk = await this.queueJob(evmChain, body.txHash, emission);
      if (jobOk) jobsQueued++;
    }

    this.logger.log(
      { chain: evmChain.slug, txHash: body.txHash, hintsRecorded, jobsQueued },
      'nudge accepted'
    );
    return { hintsRecorded, jobsQueued };
  }

  /**
   * Upserts a `RelayTxHint` for one emission. Payable-update hints key on
   * `payableId`; payment hints key on `userPaymentId` — mirrors the contract
   * comment on `RelayTxHint` in schema.prisma and matches how the tx-hash
   * resolver looks hints back up.
   */
  private async upsertHint(chainId: string, txHash: string, emission: EmissionRecord): Promise<boolean> {
    const hintPayableId = emission.jobType === 'PAYABLE_UPDATE_VIA_CCTP' ? emission.payableId : null;
    const hintUserPaymentId = emission.jobType === 'PAYMENT_VIA_CCTP' ? emission.userPaymentId : null;
    try {
      const existing = await this.prisma.relayTxHint.findFirst({
        where: {
          chainId,
          destChainId: emission.destChainId,
          payableId: hintPayableId,
          userPaymentId: hintUserPaymentId,
        },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.relayTxHint.update({
          where: { id: existing.id },
          data: { txHash, receivedAt: new Date() },
        });
      } else {
        await this.prisma.relayTxHint.create({
          data: {
            chainId,
            destChainId: emission.destChainId,
            payableId: hintPayableId,
            userPaymentId: hintUserPaymentId,
            txHash,
          },
        });
      }

      // Backfill: if the indexer already wrote the target row before the nudge
      // landed (a fast RPC beat the frontend nudge to it), the row still has
      // tx_hash = null because resolveActivityTxHash saw no hint at the time.
      // Fill it now, but only when the column is still null so we never
      // overwrite a value the indexer authoritatively recorded.
      if (hintUserPaymentId) {
        await this.prisma.userPayment.updateMany({
          where: { id: hintUserPaymentId, chainId, txHash: null },
          data: { txHash },
        });
      }
      if (hintPayableId) {
        await this.prisma.activity.updateMany({
          where: { chainId, entity: hintPayableId, txHash: null },
          data: { txHash },
        });
      }
      return true;
    } catch (err) {
      this.logger.warn({ err, chainId, txHash, emission }, 'failed to upsert RelayTxHint');
      return false;
    }
  }

  /** Queues a `RelayJob` in PENDING for one emission, or no-ops when the destination isn't enabled on this instance. Returns true when a job was newly inserted (skipDuplicates suppresses re-insertion of one the trigger detector already made). */
  private async queueJob(source: EvmChainConfig, txHash: `0x${string}`, emission: EmissionRecord): Promise<boolean> {
    const dest = this.chains.enabled.find((c) => c.cbChainId === emission.destChainId);
    if (!dest || !dest.isEvm) return false;
    const destEvm = dest as EvmChainConfig;
    if (destEvm.circleDomain === undefined || !sameNetwork(source, destEvm)) return false;

    try {
      if (emission.jobType === 'PAYABLE_UPDATE_VIA_CCTP' && emission.payableId) {
        const created = await createJob(this.prisma, {
          type: 'PAYABLE_UPDATE_VIA_CCTP',
          sourceChainId: source.cbChainId,
          destChainId: destEvm.cbChainId,
          txHash: cctpPayableUpdateJobKey(source.cbChainId, emission.payableId, emission.chainbillsNonce),
          eventData: {
            payableId: emission.payableId,
            chainbillsNonce: emission.chainbillsNonce.toString(),
            sourceDiamond: source.diamondAddress,
            queuedByNudge: true,
            nudgeTxHash: txHash,
          },
        });
        return created > 0;
      }
      if (emission.jobType === 'PAYMENT_VIA_CCTP' && emission.userPaymentId && emission.payableId) {
        const created = await createJob(this.prisma, {
          type: 'PAYMENT_VIA_CCTP',
          sourceChainId: source.cbChainId,
          destChainId: destEvm.cbChainId,
          txHash: cctpPaymentJobKey(source.cbChainId, emission.userPaymentId),
          eventData: {
            payableId: emission.payableId,
            userPaymentId: emission.userPaymentId,
            chainbillsNonce: emission.chainbillsNonce.toString(),
            sourceDiamond: source.diamondAddress,
            queuedByNudge: true,
            nudgeTxHash: txHash,
          },
        });
        return created > 0;
      }
    } catch (err) {
      this.logger.warn({ err, source: source.slug, txHash, emission }, 'failed to queue RelayJob from nudge');
    }
    return false;
  }

  /**
   * Extracts one `EmissionRecord` per CCTP-emission log *from the diamond itself*. Logs
   * from other contracts are ignored even if their topic0 matches, so a hostile contract
   * cannot get hints or jobs recorded.
   */
  private extractEmissions(diamondAddress: string, logs: readonly Log[]): EmissionRecord[] {
    const out: EmissionRecord[] = [];
    const diamondLower = diamondAddress.toLowerCase();
    for (const log of logs) {
      if (log.address.toLowerCase() !== diamondLower) continue;
      const topic0 = log.topics[0];

      if (topic0 === TOPIC_SENT_PAYABLE_UPDATE_VIA_CCTP) {
        // topics: [event, payableId, cbChainId(dest)]; data: uint64 nonce (padded to 32 bytes).
        const payableId = log.topics[1] as `0x${string}` | undefined;
        const destChainId = log.topics[2] as `0x${string}` | undefined;
        const nonce = parseUint64FromDataWord(log.data, 0);
        if (payableId && destChainId && nonce !== null) {
          out.push({
            jobType: 'PAYABLE_UPDATE_VIA_CCTP',
            destChainId,
            payableId,
            userPaymentId: null,
            chainbillsNonce: nonce,
          });
        }
      } else if (topic0 === TOPIC_SENT_FOREIGN_PAYMENT_VIA_CCTP) {
        // topics: [event, payableId, payableChainId(dest), userPaymentId]; data starts with uint64 paymentNonce.
        const payableId = log.topics[1] as `0x${string}` | undefined;
        const destChainId = log.topics[2] as `0x${string}` | undefined;
        const userPaymentId = log.topics[3] as `0x${string}` | undefined;
        const nonce = parseUint64FromDataWord(log.data, 0);
        if (payableId && destChainId && userPaymentId && nonce !== null) {
          out.push({
            jobType: 'PAYMENT_VIA_CCTP',
            destChainId,
            payableId,
            userPaymentId,
            chainbillsNonce: nonce,
          });
        }
      }
    }
    return out;
  }
}

/** Reads the Nth 32-byte word from `data` and returns its value as a bigint (works for any uintN <= 256). Returns null on malformed input. */
function parseUint64FromDataWord(data: string, wordIndex: number): bigint | null {
  if (!data || !data.startsWith('0x')) return null;
  const hex = data.slice(2);
  const start = wordIndex * 64;
  if (hex.length < start + 64) return null;
  try {
    return BigInt('0x' + hex.slice(start, start + 64));
  } catch {
    return null;
  }
}
