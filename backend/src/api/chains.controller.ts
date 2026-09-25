// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Chains controller
//
// GET /chains — public, returns all registry chains with their protocol flags
// and token list. No auth, no pagination (the registry has at most a handful
// of chains).
// ──────────────────────────────────────────────────────────────────────────────

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PublicApiService } from './public-api.service';

@ApiTags('chains')
@Controller('chains')
export class ChainsController {
  constructor(private readonly service: PublicApiService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all registry chains with protocol flags and supported tokens.' })
  @ApiResponse({ status: 200, description: 'Registry chain list.' })
  getChains() {
    return this.service.getChains();
  }
}
