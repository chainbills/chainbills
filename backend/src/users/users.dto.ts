// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Users endpoint DTOs
//
// Request and response shapes for /me, /me/email, /me/email/verify,
// /me/preferences (SPEC.md §10). Every field has @ApiProperty so Swagger /docs
// shows complete schemas for each endpoint.
// ──────────────────────────────────────────────────────────────────────────────

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, IsBoolean } from 'class-validator';
import { NotificationType } from '@prisma/client';

export class SetEmailDto {
  @ApiProperty({
    description: 'Email address to verify. Normalised (trimmed, lowercased) before storage.',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;
}

export class VerifyEmailDto {
  @ApiProperty({
    description: '6-digit one-time code sent to the registered email address.',
    example: '048291',
  })
  @IsString()
  @Length(6, 6, { message: 'code must be exactly 6 digits' })
  code!: string;
}

export class PreferenceEntryDto {
  @ApiProperty({
    description: 'Whether email notifications are enabled for this type.',
    example: true,
  })
  @IsBoolean()
  email!: boolean;
}

export class UpdatePreferencesDto {
  @ApiProperty({
    description: 'PAYABLE_CREATED preference update.',
    type: () => PreferenceEntryDto,
    nullable: true,
    required: false,
  })
  PAYABLE_CREATED?: PreferenceEntryDto;

  @ApiProperty({
    description: 'PAYMENT_RECEIVED preference update.',
    type: () => PreferenceEntryDto,
    nullable: true,
    required: false,
  })
  PAYMENT_RECEIVED?: PreferenceEntryDto;

  @ApiProperty({
    description: 'PAYMENT_RECEIPT preference update.',
    type: () => PreferenceEntryDto,
    nullable: true,
    required: false,
  })
  PAYMENT_RECEIPT?: PreferenceEntryDto;

  @ApiProperty({
    description: 'WITHDRAWAL_COMPLETED preference update.',
    type: () => PreferenceEntryDto,
    nullable: true,
    required: false,
  })
  WITHDRAWAL_COMPLETED?: PreferenceEntryDto;
}

/** Per-type preference state in GET /me response. */
export class PreferenceStateDto {
  @ApiProperty({ description: 'Whether email notifications are on for this type.', example: true })
  email!: boolean;
}

/** Full preferences map in GET /me response. */
export class PreferencesDto {
  @ApiProperty({ type: PreferenceStateDto })
  PAYABLE_CREATED!: PreferenceStateDto;

  @ApiProperty({ type: PreferenceStateDto })
  PAYMENT_RECEIVED!: PreferenceStateDto;

  @ApiProperty({ type: PreferenceStateDto })
  PAYMENT_RECEIPT!: PreferenceStateDto;

  @ApiProperty({ type: PreferenceStateDto })
  WITHDRAWAL_COMPLETED!: PreferenceStateDto;
}

/** Wallet entry in GET /me response. */
export class MeWalletDto {
  @ApiProperty({
    description: 'Wallet key: "evm:0x…" or "solana:…"',
    example: 'evm:0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
  })
  key!: string;

  @ApiProperty({ description: 'Wallet namespace.', enum: ['EVM', 'SOLANA'], example: 'EVM' })
  namespace!: string;

  @ApiProperty({
    description: 'Checksummed EVM address or base58 Solana address.',
    example: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  })
  address!: string;
}

/** Response shape for GET /me. */
export class MeResponseDto {
  @ApiProperty({ description: 'User id (cuid).', example: 'clxxxxxxxxxxxxx' })
  id!: string;

  @ApiProperty({ description: 'Wallets linked to this user.', type: [MeWalletDto] })
  wallets!: MeWalletDto[];

  @ApiProperty({
    description: 'Verified email address, or null if not set.',
    nullable: true,
    example: 'user@example.com',
  })
  email!: string | null;

  @ApiProperty({ description: 'ISO 8601 timestamp of email verification, or null.', nullable: true, example: null })
  emailVerifiedAt!: string | null;

  @ApiProperty({ description: 'Per-type notification preferences.', type: PreferencesDto })
  preferences!: PreferencesDto;
}

/** The allowed NotificationType values for run-time checks. */
export const NOTIFICATION_TYPES = Object.values(NotificationType) as NotificationType[];

/** The direction of @IsIn validation (all NotificationType values). */
export const NOTIFICATION_TYPE_VALUES = NOTIFICATION_TYPES as string[];
