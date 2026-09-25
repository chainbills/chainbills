// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Withdrawals controller
//
// GET /withdrawals/:id — returns a single withdrawal with amount, fee, and
// netAmount (amount minus fee). Public endpoint.
// ──────────────────────────────────────────────────────────────────────────────

import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PublicApiService } from './public-api.service';

@ApiTags('withdrawals')
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly service: PublicApiService) {}

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single withdrawal by id.' })
  @ApiParam({ name: 'id', description: 'Withdrawal id (bytes32 0x-hex).' })
  @ApiResponse({ status: 200, description: 'Withdrawal with amount, fee, and netAmount.' })
  @ApiResponse({ status: 404, description: 'Withdrawal not found.' })
  getWithdrawal(@Param('id') id: string) {
    return this.service.getWithdrawal(id);
  }
}
