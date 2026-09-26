// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Relay nudge controller
//
// POST /relay/nudge — unauthenticated. Front-end fire-and-forget after tx
// confirmation. Verifies the tx belongs to the diamond, scans the receipt for
// SentPayableUpdateViaCctp / SentForeignPaymentViaCctp events, and upserts a
// RelayTxHint row per emission so the relay processor can skip its fallback
// getLogs scan and query Circle immediately.
//
// No auth by design: nothing here trusts client input. The tx receipt is
// re-fetched from our own RPC and every log is topic-verified before we
// accept it. A hostile client can only nudge relays that would have happened
// anyway (or fail validation and get 400).
// ──────────────────────────────────────────────────────────────────────────────

import { BadRequestException, Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';
import { keccak256, toBytes, type Log, type PublicClient } from 'viem';
import { ChainsService } from '../chains/chains.service';
import { createEvmPublicClient } from '../chains/clients';
import type { EvmChainConfig } from '../chains/types';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

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

/** Accepts frontend-supplied CCTP-emission tx hashes and stashes them for the relay processor. */
@ApiTags('relay')
@Controller('relay')
export class RelayNudgeController {
  private readonly logger = new Logger('RelayNudge');

  constructor(private readonly prisma: PrismaService, private readonly chains: ChainsService) {}

  @Public()
  @Post('nudge')
  @HttpCode(202)
  @ApiOperation({ summary: 'Hint the relayer with a fresh source tx hash for a CCTP emission.' })
  @ApiResponse({ status: 202, description: 'Accepted; hint recorded if applicable.' })
  @ApiResponse({ status: 400, description: 'Unknown chain, unknown tx, or tx did not target the diamond.' })
  async nudge(@Body() body: RelayNudgeDto): Promise<{ hintsRecorded: number }> {
    const chain = this.chains.enabled.find((c) => c.slug === body.chainSlug);
    if (!chain || !chain.isEvm) throw new BadRequestException(`chain ${body.chainSlug} is not an enabled EVM chain`);

    const evmChain = chain as EvmChainConfig;
    const client = createEvmPublicClient(evmChain, this.chains.getRpcUrl(evmChain)) as unknown as PublicClient;

    let receipt;
    try {
      receipt = await client.getTransactionReceipt({ hash: body.txHash });
    } catch {
      throw new BadRequestException('transaction not found on this chain');
    }
    if (receipt.status !== 'success') throw new BadRequestException('transaction reverted');
    if (receipt.to?.toLowerCase() !== evmChain.diamondAddress?.toLowerCase()) {
      throw new BadRequestException('transaction did not target the registered diamond');
    }

    const hints = this.extractHints(evmChain.cbChainId, body.txHash, receipt.logs);
    if (hints.length === 0) return { hintsRecorded: 0 };

    // Prisma's compound-unique upsert doesn't handle nullable columns cleanly,
    // so hand-roll: findFirst by the natural key, then update-or-create.
    let recorded = 0;
    for (const hint of hints) {
      try {
        const existing = await this.prisma.relayTxHint.findFirst({
          where: {
            chainId: hint.chainId,
            destChainId: hint.destChainId,
            payableId: hint.payableId,
            userPaymentId: hint.userPaymentId,
          },
          select: { id: true },
        });
        if (existing) {
          await this.prisma.relayTxHint.update({
            where: { id: existing.id },
            data: { txHash: hint.txHash, receivedAt: new Date() },
          });
        } else {
          await this.prisma.relayTxHint.create({ data: hint });
        }
        recorded++;
      } catch (err) {
        this.logger.warn({ err, hint }, 'failed to upsert RelayTxHint');
      }
    }

    this.logger.log({ chain: evmChain.slug, txHash: body.txHash, hintsRecorded: recorded }, 'nudge accepted');
    return { hintsRecorded: recorded };
  }

  /** Extracts one RelayTxHint per CCTP-emission log on the diamond. */
  private extractHints(
    chainId: string,
    txHash: `0x${string}`,
    logs: readonly Log[]
  ): Array<{
    chainId: string;
    destChainId: string;
    payableId: string | null;
    userPaymentId: string | null;
    txHash: string;
  }> {
    const out: ReturnType<typeof this.extractHints> = [];
    for (const log of logs) {
      const topic0 = log.topics[0];
      if (topic0 === TOPIC_SENT_PAYABLE_UPDATE_VIA_CCTP) {
        // topics: [event, payableId, cbChainId(dest)]
        const payableId = log.topics[1];
        const destChainId = log.topics[2];
        if (payableId && destChainId) {
          out.push({ chainId, destChainId, payableId, userPaymentId: null, txHash });
        }
      } else if (topic0 === TOPIC_SENT_FOREIGN_PAYMENT_VIA_CCTP) {
        // topics: [event, payableId, payableChainId(dest), userPaymentId]
        const destChainId = log.topics[2];
        const userPaymentId = log.topics[3];
        if (destChainId && userPaymentId) {
          out.push({ chainId, destChainId, payableId: null, userPaymentId, txHash });
        }
      }
    }
    return out;
  }
}
