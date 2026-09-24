// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Pagination query DTO
//
// Shared `?limit=&cursor=` query shape for every list endpoint (SPEC.md
// §12.1). class-validator enforces the 1-100 limit range under the global
// `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
// ──────────────────────────────────────────────────────────────────────────────

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of items to return, 1-100.',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    description: "Opaque pagination cursor from a previous response's nextCursor. Omit for the first page.",
    example: 'eyJjcmVhdGVkQXQiOiIyMDI2LTA5LTI0VDE2OjAwOjAwLjAwMFoiLCJpZCI6ImFiYzEyMyJ9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
