// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — SIWS verifier unit tests
//
// Uses tweetnacl to generate real keypairs and produce real ed25519 signatures
// so the tests exercise the actual crypto path, not a mock.
// ──────────────────────────────────────────────────────────────────────────────

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { SiwsVerifier } from './siws-verifier';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeKeypair() {
  return nacl.sign.keyPair();
}

function signMessage(message: string, secretKey: Uint8Array): Uint8Array {
  const msgBytes = new TextEncoder().encode(message);
  return nacl.sign.detached(msgBytes, secretKey);
}

function buildMessage(overrides: {
  domain?: string;
  address?: string;
  nonce?: string;
  uri?: string;
  chainId?: string;
  issuedAt?: string;
  expirationTime?: string;
  statement?: string;
}) {
  const domain = overrides.domain ?? 'localhost';
  const address = overrides.address ?? 'So11111111111111111111111111111112';
  const nonce = overrides.nonce ?? 'testNonce123';
  const uri = overrides.uri ?? 'https://localhost';
  const chainId = overrides.chainId ?? 'devnet';
  const issuedAt = overrides.issuedAt ?? new Date().toISOString();
  const statement = overrides.statement;

  let msg = `${domain} wants you to sign in with your Solana account:\n${address}\n`;
  if (statement) msg += `\n${statement}\n`;
  msg += `\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
  if (overrides.expirationTime) msg += `\nExpiration Time: ${overrides.expirationTime}`;
  return msg;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SiwsVerifier', () => {
  const verifier = new SiwsVerifier();

  describe('happy path', () => {
    it('verifies a base58-encoded signature', () => {
      const kp = makeKeypair();
      const address = bs58.encode(kp.publicKey);
      const message = buildMessage({ address });
      const sig = signMessage(message, kp.secretKey);
      const sigBase58 = bs58.encode(sig);

      const result = verifier.verify(message, sigBase58);
      expect(result.address).toBe(address);
      expect(result.parsed.nonce).toBe('testNonce123');
    });

    it('verifies a base64-encoded signature', () => {
      const kp = makeKeypair();
      const address = bs58.encode(kp.publicKey);
      const message = buildMessage({ address });
      const sig = signMessage(message, kp.secretKey);
      const sigBase64 = Buffer.from(sig).toString('base64');

      const result = verifier.verify(message, sigBase64);
      expect(result.address).toBe(address);
    });

    it('returns the parsed message fields', () => {
      const kp = makeKeypair();
      const address = bs58.encode(kp.publicKey);
      const message = buildMessage({ address, chainId: 'mainnet', statement: 'Test statement' });
      const sig = signMessage(message, kp.secretKey);

      const result = verifier.verify(message, bs58.encode(sig));
      expect(result.parsed.chainId).toBe('mainnet');
      expect(result.parsed.statement).toBe('Test statement');
    });
  });

  describe('signature failures', () => {
    it('rejects wrong signature (different message signed)', () => {
      const kp = makeKeypair();
      const address = bs58.encode(kp.publicKey);
      const message = buildMessage({ address });
      const wrongSig = signMessage('wrong message', kp.secretKey);

      expect(() => verifier.verify(message, bs58.encode(wrongSig))).toThrow(UnauthorizedException);
    });

    it('rejects signature from a different keypair', () => {
      const kp1 = makeKeypair();
      const kp2 = makeKeypair();
      const address = bs58.encode(kp1.publicKey);
      const message = buildMessage({ address });
      const sig = signMessage(message, kp2.secretKey);

      expect(() => verifier.verify(message, bs58.encode(sig))).toThrow(UnauthorizedException);
    });

    it('rejects a truncated / invalid base58 signature', () => {
      const kp = makeKeypair();
      const address = bs58.encode(kp.publicKey);
      const message = buildMessage({ address });

      expect(() => verifier.verify(message, 'notvalidbase58!@#')).toThrow(BadRequestException);
    });

    it('rejects an invalid base64 signature', () => {
      const kp = makeKeypair();
      const address = bs58.encode(kp.publicKey);
      const message = buildMessage({ address });

      // Use a string that triggers the base64 path (contains '=') but is wrong length.
      expect(() => verifier.verify(message, 'aGVsbG8=')).toThrow(UnauthorizedException);
    });
  });

  describe('message failures', () => {
    it('rejects a malformed SIWS message', () => {
      expect(() => verifier.verify('not a siws message', 'abc')).toThrow(BadRequestException);
    });

    it('rejects when domain is missing from message', () => {
      expect(() =>
        verifier.verify(
          ' wants you to sign in with your Solana account:\naddr\n\nURI: x\nVersion: 1\nChain ID: d\nNonce: n\nIssued At: i',
          'abc'
        )
      ).toThrow(BadRequestException);
    });
  });

  describe('wrong domain / uri / nonce', () => {
    it('still verifies signature regardless of domain (domain check is AuthService job)', () => {
      // Domain mismatch checking is done by AuthService — the verifier only
      // checks the cryptographic signature. This test confirms the verifier
      // itself does not reject on a wrong domain.
      const kp = makeKeypair();
      const address = bs58.encode(kp.publicKey);
      const message = buildMessage({ address, domain: 'evil.com' });
      const sig = signMessage(message, kp.secretKey);

      const result = verifier.verify(message, bs58.encode(sig));
      expect(result.parsed.domain).toBe('evil.com');
    });
  });
});
