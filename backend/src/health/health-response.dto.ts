// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Health response DTO
// ──────────────────────────────────────────────────────────────────────────────

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Role } from '../config/env.schema';

export class ChainHealthDto {
  @ApiProperty({ description: 'Human slug of the chain.', example: 'anvil' })
  slug!: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 timestamp of the last completed indexer tick, or null when never ticked.',
    example: '2026-09-24T10:00:00.000Z',
    nullable: true,
  })
  lastTickAt!: string | null;

  @ApiProperty({
    description: "True when lastTickAt is older than 5× the chain's poll interval.",
    example: false,
  })
  stale!: boolean;
}

export class HealthResponseDto {
  @ApiProperty({ description: 'Overall health: "ok" unless a dependency check below failed.', example: 'ok' })
  status!: 'ok' | 'error';

  @ApiProperty({ description: 'The ROLE this instance is running as.', example: 'all', enum: ['all', 'api', 'worker'] })
  role!: Role;

  @ApiProperty({ description: 'Result of `SELECT 1` against Postgres.', example: 'ok' })
  db!: 'ok' | 'error';

  @ApiPropertyOptional({
    description: 'Per-chain indexer freshness. Present for worker and all roles.',
    type: [ChainHealthDto],
  })
  chains?: ChainHealthDto[];
}
