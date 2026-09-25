// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Users public API controller
//
// Public read endpoints for per-wallet cross-chain data:
//   GET /users/:walletKey/payments  — UserPayments sent by a wallet
//   GET /users/:walletKey/payables  — Payables hosted by a wallet
//   GET /users/:walletKey/activity  — Mixed activity feed (payments, payables,
//                                     withdrawals) across all chains
//
// These routes are @Public() — no auth required. The :walletKey param is the
// standard "evm:0x…" / "solana:…" wallet key used throughout the backend.
// ──────────────────────────────────────────────────────────────────────────────

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQueryDto } from '../common/pagination/pagination-query.dto';
import { PublicApiService } from './public-api.service';

/** Public endpoints for listing payments and payables by wallet key. */
@ApiTags('users')
@Controller('users')
export class UsersApiController {
  constructor(private readonly service: PublicApiService) {}

  @Public()
  @Get(':walletKey/payments')
  @ApiOperation({ summary: 'List UserPayments sent by a wallet, newest-first.' })
  @ApiParam({
    name: 'walletKey',
    description: 'Wallet key: "evm:0x<lowercase>" or "solana:<base58>".',
    example: 'evm:0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
  })
  @ApiResponse({ status: 200, description: 'Paginated UserPayment list.' })
  listUserPayments(@Param('walletKey') walletKey: string, @Query() query: PaginationQueryDto) {
    return this.service.listUserPayments(walletKey, { limit: query.limit, cursor: query.cursor });
  }

  @Public()
  @Get(':walletKey/payables')
  @ApiOperation({ summary: 'List payables hosted by a wallet, newest-first.' })
  @ApiParam({
    name: 'walletKey',
    description: 'Wallet key: "evm:0x<lowercase>" or "solana:<base58>".',
    example: 'evm:0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
  })
  @ApiResponse({ status: 200, description: 'Paginated Payable list.' })
  listUserPayables(@Param('walletKey') walletKey: string, @Query() query: PaginationQueryDto) {
    return this.service.listUserPayables(walletKey, { limit: query.limit, cursor: query.cursor });
  }

  @Public()
  @Get(':walletKey/activity')
  @ApiOperation({
    summary:
      'Mixed activity feed for a wallet: payments sent, payments received on hosted payables, withdrawals, and payables created — all chains, newest-first.',
  })
  @ApiParam({
    name: 'walletKey',
    description: 'Wallet key: "evm:0x<lowercase>" or "solana:<base58>".',
    example: 'evm:0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
  })
  @ApiResponse({ status: 200, description: 'Paginated activity feed.' })
  listUserActivity(@Param('walletKey') walletKey: string, @Query() query: PaginationQueryDto) {
    return this.service.listUserActivity(walletKey, { limit: query.limit, cursor: query.cursor });
  }
}
