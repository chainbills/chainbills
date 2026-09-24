// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Auth endpoint DTOs
//
// Request and response shapes for all /auth/* endpoints (SPEC.md §9.1).
// Every field has @ApiProperty so Swagger /docs shows complete examples for
// both EVM and Solana flows.
// ──────────────────────────────────────────────────────────────────────────────

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class NonceResponseDto {
  @ApiProperty({
    description: 'Single-use nonce to embed in the SIWE / SIWS message.',
    example: '7mKxEqRyVp9WdNfG3LhBt2',
  })
  nonce!: string;

  @ApiProperty({
    description: 'ISO 8601 datetime when this nonce expires (5 minutes from issuance).',
    example: '2024-06-15T12:05:00.000Z',
  })
  expiresAt!: string;
}

export class VerifyRequestDto {
  @ApiProperty({
    description: 'Wallet namespace — determines which verification path is taken.',
    enum: ['evm', 'solana'],
    example: 'evm',
  })
  @IsEnum(['evm', 'solana'])
  namespace!: 'evm' | 'solana';

  @ApiProperty({
    description: 'Full signed message text (EIP-4361 for EVM; SIWS text format for Solana).',
    example:
      'chainbills.xyz wants you to sign in with your Ethereum account:\n0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\n\nURI: https://chainbills.xyz\nVersion: 1\nChain ID: 5042\nNonce: 7mKxEqRyVp9WdNfG3LhBt2\nIssued At: 2024-06-15T12:00:00.000Z',
  })
  @IsString()
  @MinLength(10)
  message!: string;

  @ApiProperty({
    description: 'Hex-encoded ECDSA signature (EVM) or base58/base64 ed25519 signature (Solana).',
    example:
      '0x4e74b8a0b1d0f47694acf9e2e7e19e2bcd3f8b2aba7d4a2ee4d3f6e7b0c1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d51b',
  })
  @IsString()
  @MinLength(1)
  signature!: string;
}

export class WalletDto {
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

export class AuthUserDto {
  @ApiProperty({ description: 'User id (cuid).', example: 'clxxxxxxxxxxxxx' })
  id!: string;

  @ApiProperty({ description: 'Wallets linked to this user.', type: [WalletDto] })
  wallets!: WalletDto[];

  @ApiProperty({
    description: 'Verified email address, if set.',
    example: 'user@example.com',
    required: false,
    nullable: true,
  })
  email!: string | null;

  @ApiProperty({
    description: 'ISO 8601 timestamp of email verification, or null.',
    required: false,
    nullable: true,
    example: null,
  })
  emailVerifiedAt!: string | null;
}

export class VerifyResponseDto {
  @ApiProperty({
    description: 'Short-lived JWT access token. Send as Authorization: Bearer <token>.',
    example: 'eyJhbGc...',
  })
  accessToken!: string;

  @ApiProperty({ description: 'Access token lifetime in seconds.', example: 900 })
  expiresIn!: number;

  @ApiProperty({ description: 'The authenticated user.', type: AuthUserDto })
  user!: AuthUserDto;
}

export class RefreshResponseDto {
  @ApiProperty({ description: 'New short-lived JWT access token.', example: 'eyJhbGc...' })
  accessToken!: string;

  @ApiProperty({ description: 'Access token lifetime in seconds.', example: 900 })
  expiresIn!: number;
}
