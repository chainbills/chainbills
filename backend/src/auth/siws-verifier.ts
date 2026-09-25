// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — SIWS (Sign-In With Solana) verifier
//
// Verifies a SIWS message + ed25519 signature using tweetnacl. The signature
// may be encoded as base58 (the Solana wallet-standard default) or base64.
//
// Invariants:
//   - The message bytes are the UTF-8 encoding of the raw message string —
//     the same bytes the wallet signed.
//   - tweetnacl.sign.detached.verify does constant-time comparison internally.
//   - The public key is derived solely from the address field in the parsed
//     message (base58-decoded); no key storage or lookup.
// ──────────────────────────────────────────────────────────────────────────────

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { parseSiwsMessage, type SiwsMessage } from './siws-parser';

/** Result of a successful SIWS parse + verification. */
export interface SiwsVerifyResult {
  /** The parsed SIWS message fields. */
  parsed: SiwsMessage;
  /** Solana address (base58) of the signer. */
  address: string;
}

/** Parses and verifies SIWS messages using tweetnacl ed25519 verify; accepts base58 or base64 signatures. */
@Injectable()
export class SiwsVerifier {
  /**
   * Parses the raw SIWS text message and verifies the ed25519 signature.
   *
   * Returns the parsed message and the Solana address on success.
   * Throws {@link BadRequestException} when the message is malformed;
   * throws {@link UnauthorizedException} when signature verification fails.
   *
   * The signature is accepted as base58 (Solana wallet-standard default) or
   * base64. Detection: base58 strings never contain `+`, `/` or `=`; if any
   * of those characters are present the string is treated as base64.
   */
  verify(message: string, signature: string): SiwsVerifyResult {
    let parsed: SiwsMessage;
    try {
      parsed = parseSiwsMessage(message);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'invalid SIWS message');
    }

    const messageBytes = new TextEncoder().encode(message);
    const sigBytes = this.decodeSignature(signature);
    const pubkeyBytes = this.decodeAddress(parsed.address);

    // ed25519 signatures are exactly 64 bytes; nacl throws a raw error on wrong size.
    if (sigBytes.length !== 64) {
      throw new UnauthorizedException('invalid SIWS signature');
    }

    const valid = nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes);
    if (!valid) {
      throw new UnauthorizedException('invalid SIWS signature');
    }

    return { parsed, address: parsed.address };
  }

  /**
   * Decodes a signature from base58 or base64. Base64 is identified by the
   * presence of `+`, `/` or `=` characters (none of which appear in base58).
   */
  private decodeSignature(sig: string): Uint8Array {
    try {
      const isBase64 = /[+/=]/.test(sig);
      if (isBase64) {
        const buf = Buffer.from(sig, 'base64');
        if (buf.length === 0 && sig.length > 0) {
          throw new Error('empty decode');
        }
        return new Uint8Array(buf);
      }
      return bs58.decode(sig);
    } catch {
      throw new BadRequestException('signature is not valid base58 or base64');
    }
  }

  /**
   * Decodes a Solana base58 address to the 32-byte public key.
   * ed25519 public keys are always 32 bytes.
   */
  private decodeAddress(address: string): Uint8Array {
    let bytes: Uint8Array;
    try {
      bytes = bs58.decode(address);
    } catch {
      throw new BadRequestException('address is not valid base58');
    }
    if (bytes.length !== 32) {
      throw new BadRequestException(`address decodes to ${bytes.length} bytes; expected 32`);
    }
    return bytes;
  }
}
