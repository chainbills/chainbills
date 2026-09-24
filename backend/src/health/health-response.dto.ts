// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Health response DTO
// ──────────────────────────────────────────────────────────────────────────────

import { ApiProperty } from '@nestjs/swagger';
import type { Role } from '../config/env.schema';

export class HealthResponseDto {
  @ApiProperty({ description: 'Overall health: "ok" unless a dependency check below failed.', example: 'ok' })
  status!: 'ok' | 'error';

  @ApiProperty({ description: 'The ROLE this instance is running as.', example: 'all', enum: ['all', 'api', 'worker'] })
  role!: Role;

  @ApiProperty({ description: 'Result of `SELECT 1` against Postgres.', example: 'ok' })
  db!: 'ok' | 'error';
}
