// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Payables controller
//
// Handles all /payables endpoints:
//   GET  /payables           — list payables (public, filter by host/chain)
//   GET  /payables/:id       — single payable (public)
//   PUT  /payables/:id/description — set description (authenticated, host-only)
//   GET  /payables/:id/payments   — list PayablePayments (public)
//   GET  /payables/:id/withdrawals — list Withdrawals (public)
// ──────────────────────────────────────────────────────────────────────────────

// Renamed: DOM global `Body` (fetch mixin) would otherwise clash with `@nestjs/common`'s `Body`.
import { Body as RequestBody, Controller, Get, HttpCode, HttpStatus, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQueryDto } from '../common/pagination/pagination-query.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { PublicApiService } from './public-api.service';

/** Request body for the PUT /payables/:id/description endpoint. */
export class SetDescriptionDto {
  @ApiProperty({
    description: 'Plain-text or lightly formatted description (3–3000 chars). HTML tags are stripped before saving.',
    example: 'Pay for consulting services. Any supported token accepted.',
    minLength: 3,
    maxLength: 3000,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(3000)
  description!: string;
}

/** Query parameters for listing payables, with optional host and chain filters. */
export class ListPayablesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by host address (EVM checksummed or Solana base58) or wallet key ("evm:0x…" / "solana:…").',
    example: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional({
    description: 'Filter by chain: cbChainId (0x-hex) or slug (e.g. "arcmainnet").',
    example: 'arcmainnet',
  })
  @IsOptional()
  @IsString()
  chain?: string;
}

/** Optional chain hint used to locate the payable on-chain when it is not yet indexed. */
export class DescriptionChainQueryDto {
  @ApiPropertyOptional({
    description:
      'Chain hint for on-chain host verification when the payable is not yet indexed. Accepts cbChainId or slug.',
    example: 'arcmainnet',
  })
  @IsOptional()
  @IsString()
  chain?: string;
}

/** Rate limit for the description write endpoint: 5 per wallet per minute. */
const DESCRIPTION_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

/** Public and authenticated endpoints for reading and annotating payables. */
@ApiTags('payables')
@Controller('payables')
export class PayablesController {
  constructor(private readonly service: PublicApiService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List payables, optionally filtered by host address or chain, newest-first.' })
  @ApiQuery({ name: 'host', required: false, description: 'Host address or wallet key.' })
  @ApiQuery({ name: 'chain', required: false, description: 'cbChainId or chain slug.' })
  @ApiResponse({ status: 200, description: 'Paginated payable list.' })
  listPayables(@Query() query: ListPayablesQueryDto) {
    return this.service.listPayables({
      host: query.host,
      chain: query.chain,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single payable by id, including allowed tokens, balances, and lifetime totals.' })
  @ApiParam({ name: 'id', description: 'bytes32 payable id (0x-hex).' })
  @ApiResponse({ status: 200, description: 'Payable details.' })
  @ApiResponse({ status: 404, description: 'Payable not found.' })
  getPayable(@Param('id') id: string) {
    return this.service.getPayable(id);
  }

  @Put(':id/description')
  @Throttle(DESCRIPTION_THROTTLE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Set or update a payable description (host only). Strips HTML; 3–3000 chars.',
  })
  @ApiParam({ name: 'id', description: 'bytes32 payable id (0x-hex).' })
  @ApiBody({ type: SetDescriptionDto })
  @ApiResponse({ status: 204, description: 'Description saved.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 403, description: 'Caller is not the host.' })
  @ApiResponse({ status: 404, description: 'Payable not found.' })
  async setDescription(
    @Param('id') id: string,
    @RequestBody() dto: SetDescriptionDto,
    @Query() q: DescriptionChainQueryDto,
    @CurrentUser() user: AuthUser
  ): Promise<void> {
    await this.service.setDescription(id, user.walletKey, dto.description, q.chain);
  }

  @Public()
  @Get(':id/payments')
  @ApiOperation({ summary: 'List payments received by a payable, newest-first.' })
  @ApiParam({ name: 'id', description: 'bytes32 payable id (0x-hex).' })
  @ApiResponse({ status: 200, description: 'Paginated PayablePayment list.' })
  @ApiResponse({ status: 404, description: 'Payable not found.' })
  listPayablePayments(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.service.listPayablePayments(id, { limit: query.limit, cursor: query.cursor });
  }

  @Public()
  @Get(':id/withdrawals')
  @ApiOperation({ summary: 'List withdrawals from a payable, newest-first.' })
  @ApiParam({ name: 'id', description: 'bytes32 payable id (0x-hex).' })
  @ApiResponse({ status: 200, description: 'Paginated Withdrawal list.' })
  @ApiResponse({ status: 404, description: 'Payable not found.' })
  listPayableWithdrawals(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.service.listPayableWithdrawals(id, { limit: query.limit, cursor: query.cursor });
  }
}
