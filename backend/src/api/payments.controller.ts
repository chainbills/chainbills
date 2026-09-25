// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Payments controller
//
// Handles /payments endpoints:
//   GET /payments/user/:id    — single UserPayment + relay status + matching
//                               PayablePayment if indexed
//   GET /payments/payable/:id — single PayablePayment + matching UserPayment
//                               if indexed
// ──────────────────────────────────────────────────────────────────────────────

import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PublicApiService } from './public-api.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PublicApiService) {}

  @Public()
  @Get('user/:id')
  @ApiOperation({
    summary:
      'Get a single UserPayment by id. Includes relay status (null for same-chain payments) and the matching PayablePayment when indexed.',
  })
  @ApiParam({ name: 'id', description: 'UserPayment id (bytes32 0x-hex).' })
  @ApiResponse({ status: 200, description: 'UserPayment with relay status and optional PayablePayment.' })
  @ApiResponse({ status: 404, description: 'UserPayment not found.' })
  getUserPayment(@Param('id') id: string) {
    return this.service.getUserPayment(id);
  }

  @Public()
  @Get('payable/:id')
  @ApiOperation({
    summary: 'Get a single PayablePayment by id, plus the matching UserPayment when indexed.',
  })
  @ApiParam({ name: 'id', description: 'PayablePayment id (bytes32 0x-hex).' })
  @ApiResponse({ status: 200, description: 'PayablePayment with optional UserPayment.' })
  @ApiResponse({ status: 404, description: 'PayablePayment not found.' })
  getPayablePayment(@Param('id') id: string) {
    return this.service.getPayablePayment(id);
  }
}
