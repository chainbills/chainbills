// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Health controller
//
// The only HTTP surface every role exposes, including "worker" (SPEC.md
// §2.1). Returns per-chain freshness data when cursors exist. Marks 503
// when any enabled chain's lastTickAt is older than 5× its poll interval
// (SPEC §14).
// ──────────────────────────────────────────────────────────────────────────────

import { Controller, Get, HttpStatus, Logger, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
// Aliased: Node 18+ defines a global `Response` (the fetch API) that would
// otherwise collide with express's same-named type here.
import type { Response as ExpressResponse } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ChainsService } from '../chains/chains.service';
import { HealthResponseDto, ChainHealthDto } from './health-response.dto';

/** Exposes GET /health; returns 200 when Postgres is reachable and all enabled chains are fresh, 503 otherwise. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly chains: ChainsService
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness/readiness check — verifies Postgres connectivity and chain freshness.' })
  @ApiResponse({ status: 200, description: 'Healthy.', type: HealthResponseDto })
  @ApiResponse({ status: 503, description: 'Postgres is unreachable or a chain is stale.', type: HealthResponseDto })
  async check(@Res({ passthrough: true }) res: ExpressResponse): Promise<HealthResponseDto> {
    const db = await this.checkDatabase();
    const chainStatuses = await this.checkChainFreshness();

    const anyStale = chainStatuses.some((c) => c.stale);
    const overallOk = db === 'ok' && !anyStale;

    const body: HealthResponseDto = {
      status: overallOk ? 'ok' : 'error',
      role: this.config.env.role,
      db,
      chains: chainStatuses,
    };

    res.status(overallOk ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return body;
  }

  /**
   * A raw `SELECT 1` rather than any ORM helper, so this check exercises
   * exactly the connection Prisma would use for a real query and nothing
   * more (no schema assumptions, no table reads).
   */
  private async checkDatabase(): Promise<'ok' | 'error'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch (err) {
      this.logger.error({ err }, 'database health check failed');
      return 'error';
    }
  }

  /**
   * Checks per-chain cursor freshness. A chain is stale when its lastTickAt
   * is older than 5x the chain's poll interval. Only enabled EVM chains are
   * checked (Solana indexer arrives in a later phase).
   */
  private async checkChainFreshness(): Promise<ChainHealthDto[]> {
    const result: ChainHealthDto[] = [];

    for (const chain of this.chains.enabled) {
      if (!chain.isEvm) continue;

      try {
        const cursor = await this.prisma.chainCursor.findUnique({
          where: { chainId: chain.cbChainId },
          select: { lastTickAt: true },
        });

        const lastTickAt = cursor?.lastTickAt ?? null;
        const pollIntervalMs = this.config.env.pollIntervalMsOverride ?? chain.pollIntervalMs ?? 12_000;
        const stalenessThresholdMs = 5 * pollIntervalMs;

        const stale = lastTickAt === null || Date.now() - lastTickAt.getTime() > stalenessThresholdMs;

        result.push({ slug: chain.slug, lastTickAt: lastTickAt?.toISOString() ?? null, stale });
      } catch (err) {
        this.logger.error({ chain: chain.slug, err }, 'chain freshness check failed');
        result.push({ slug: chain.slug, lastTickAt: null, stale: true });
      }
    }

    return result;
  }
}
