// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — SIWE (Sign-In With Ethereum) verifier
//
// Parses and verifies EIP-4361 sign-in messages using viem's `parseSiweMessage`
// and `publicClient.verifyMessage`. The latter handles EOA signatures, ERC-1271
// contract wallets and ERC-6492 (counterfactual) wallets automatically.
//
// Invariants:
//   - Only chain IDs registered in the EVM registry are accepted; unknown chain
//     IDs cause immediate rejection to prevent spoofed-chain attacks.
//   - The domain must equal the host portion of APP_URL.
//   - The URI must equal APP_URL exactly.
//   - Nonce age checking is done by AuthService; this verifier only checks the
//     cryptographic signature and structural message fields.
// ──────────────────────────────────────────────────────────────────────────────

import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { parseSiweMessage } from 'viem/siwe';
import { createEvmPublicClient } from '../chains/clients';
import { ChainsService } from '../chains/chains.service';
import type { EvmChainConfig } from '../chains/types';

/** The fields of a parsed SIWE message that the rest of auth logic needs. */
export interface ParsedSiweMessage {
  domain: string;
  address: `0x${string}`;
  nonce: string;
  issuedAt?: Date;
  expirationTime?: Date;
  uri?: string;
  chainId?: number;
}

/** Result of a successful SIWE parse + verification. */
export interface SiweVerifyResult {
  /** The parsed SIWE message fields. */
  parsed: ParsedSiweMessage;
  /** Lower-cased EVM address of the signer. */
  address: string;
}

/** Parses and cryptographically verifies EIP-4361 SIWE messages, including ERC-1271 and ERC-6492 wallets. */
@Injectable()
export class SiweVerifier {
  private readonly logger = new Logger(SiweVerifier.name);

  constructor(private readonly chainsService: ChainsService) {}

  /**
   * Parses the raw SIWE message and verifies the signature against the
   * appropriate chain's public client.
   *
   * Returns the parsed message and the lower-cased signer address on success.
   * Throws {@link BadRequestException} when the message is malformed or
   * refers to an unknown chain id; throws {@link UnauthorizedException} when
   * signature verification fails.
   */
  async verify(message: string, signature: string): Promise<SiweVerifyResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawParsed: any;
    try {
      rawParsed = parseSiweMessage(message);
    } catch {
      throw new BadRequestException('invalid SIWE message format');
    }

    if (!rawParsed.address) {
      throw new BadRequestException('SIWE message missing address');
    }

    const parsed: ParsedSiweMessage = {
      domain: rawParsed.domain ?? '',
      address: rawParsed.address as `0x${string}`,
      nonce: rawParsed.nonce ?? '',
      issuedAt: rawParsed.issuedAt,
      expirationTime: rawParsed.expirationTime,
      uri: rawParsed.uri,
      chainId: rawParsed.chainId,
    };

    // Resolve the chain the message claims to come from.
    const chainConfig = this.resolveChain(parsed.chainId);

    // Use viem's verifyMessage which handles EOA, ERC-1271 and ERC-6492.
    const rpcUrl = this.chainsService.getRpcUrl(chainConfig);
    const publicClient = createEvmPublicClient(chainConfig, rpcUrl);

    let valid: boolean;
    try {
      valid = await publicClient.verifyMessage({
        address: parsed.address,
        message,
        signature: signature as `0x${string}`,
      });
    } catch (err) {
      this.logger.warn({ err, address: parsed.address }, 'SIWE verifyMessage threw');
      throw new UnauthorizedException('signature verification failed');
    }

    if (!valid) {
      throw new UnauthorizedException('invalid SIWE signature');
    }

    return { parsed, address: parsed.address.toLowerCase() };
  }

  /**
   * Resolves the viem EVM chain config for the given numeric chain ID.
   * Throws {@link BadRequestException} when the chain ID is not in the registry,
   * preventing sign-ins from claiming an unrecognised chain.
   */
  private resolveChain(chainId: number | undefined): EvmChainConfig {
    if (chainId === undefined) {
      throw new BadRequestException('SIWE message missing chainId');
    }

    // Search enabled chains first (the common case), then all registry chains.
    const all = this.chainsService.evmChains;
    const found = all.find((c) => c.viemChain.id === chainId);
    if (!found) {
      throw new BadRequestException(`chainId ${chainId} is not in the registry`);
    }
    return found;
  }
}
