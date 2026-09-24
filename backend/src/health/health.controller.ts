// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Health controller
//
// The only HTTP surface every role exposes, including "worker" (SPEC.md
// §2.1's table: worker = "health only"). Chain-freshness reporting
// (`chains: [{ slug, lastTickAt }]`) arrives in phase 2a once a worker
// actually has cursors to report on; this phase only checks Postgres.
// ──────────────────────────────────────────────────────────────────────────────

import { Controller, Get, HttpStatus, Logger, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
// Aliased: Node 18+ defines a global `Response` (the fetch API) that would
// otherwise collide with express's same-named type here.
import type { Response as ExpressResponse } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { HealthResponseDto } from './health-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness/readiness check — verifies Postgres connectivity.' })
  @ApiResponse({ status: 200, description: 'Healthy.', type: HealthResponseDto })
  @ApiResponse({ status: 503, description: 'Postgres is unreachable.', type: HealthResponseDto })
  async check(@Res({ passthrough: true }) res: ExpressResponse): Promise<HealthResponseDto> {
    const db = await this.checkDatabase();
    const body: HealthResponseDto = { status: db === 'ok' ? 'ok' : 'error', role: this.config.env.role, db };
    res.status(body.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
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
}
