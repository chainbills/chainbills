// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Stats controller
//
// GET /stats — returns per-chain + per-token aggregate payment, received, and
// withdrawal volumes. Public endpoint. Result is cached for 30 s in-process.
// ──────────────────────────────────────────────────────────────────────────────

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PublicApiService } from './public-api.service';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly service: PublicApiService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary:
      'Aggregate stats per chain and token: paymentsCount, paidVolume (sum of UserPayment amounts), receivedVolume (sum of PayablePayment amounts), withdrawnVolume (sum of Withdrawal amounts). Cached for 30 s.',
  })
  @ApiResponse({ status: 200, description: 'Stats buckets.' })
  getStats() {
    return this.service.getStats();
  }
}
