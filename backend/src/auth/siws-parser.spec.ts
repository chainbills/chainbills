// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — SIWS parser unit tests
// ──────────────────────────────────────────────────────────────────────────────

import { parseSiwsMessage, SiwsParseError } from './siws-parser';

const MINIMAL_MESSAGE = `localhost wants you to sign in with your Solana account:
11111111111111111111111111111111

URI: https://localhost
Version: 1
Chain ID: devnet
Nonce: abc12345
Issued At: 2024-01-01T00:00:00.000Z`;

const FULL_MESSAGE = `chainbills.xyz wants you to sign in with your Solana account:
So11111111111111111111111111111112

Sign in to Chainbills to manage your payables.

URI: https://chainbills.xyz
Version: 1
Chain ID: mainnet
Nonce: ZkLmNpQrSt8
Issued At: 2024-06-15T12:00:00.000Z
Expiration Time: 2024-06-15T12:05:00.000Z
Not Before: 2024-06-15T11:59:00.000Z
Request ID: req-001
Resources:
- https://chainbills.xyz/payables
- https://chainbills.xyz/payments`;

describe('parseSiwsMessage', () => {
  describe('minimal valid message', () => {
    it('parses domain', () => {
      const msg = parseSiwsMessage(MINIMAL_MESSAGE);
      expect(msg.domain).toBe('localhost');
    });

    it('parses address', () => {
      const msg = parseSiwsMessage(MINIMAL_MESSAGE);
      expect(msg.address).toBe('11111111111111111111111111111111');
    });

    it('parses uri', () => {
      const msg = parseSiwsMessage(MINIMAL_MESSAGE);
      expect(msg.uri).toBe('https://localhost');
    });

    it('parses version', () => {
      const msg = parseSiwsMessage(MINIMAL_MESSAGE);
      expect(msg.version).toBe('1');
    });

    it('parses chainId', () => {
      const msg = parseSiwsMessage(MINIMAL_MESSAGE);
      expect(msg.chainId).toBe('devnet');
    });

    it('parses nonce', () => {
      const msg = parseSiwsMessage(MINIMAL_MESSAGE);
      expect(msg.nonce).toBe('abc12345');
    });

    it('parses issuedAt', () => {
      const msg = parseSiwsMessage(MINIMAL_MESSAGE);
      expect(msg.issuedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('has no optional fields', () => {
      const msg = parseSiwsMessage(MINIMAL_MESSAGE);
      expect(msg.statement).toBeUndefined();
      expect(msg.expirationTime).toBeUndefined();
      expect(msg.notBefore).toBeUndefined();
      expect(msg.requestId).toBeUndefined();
      expect(msg.resources).toBeUndefined();
    });
  });

  describe('full message with all optional fields', () => {
    it('parses domain', () => {
      const msg = parseSiwsMessage(FULL_MESSAGE);
      expect(msg.domain).toBe('chainbills.xyz');
    });

    it('parses address', () => {
      const msg = parseSiwsMessage(FULL_MESSAGE);
      expect(msg.address).toBe('So11111111111111111111111111111112');
    });

    it('parses statement', () => {
      const msg = parseSiwsMessage(FULL_MESSAGE);
      expect(msg.statement).toBe('Sign in to Chainbills to manage your payables.');
    });

    it('parses uri', () => {
      const msg = parseSiwsMessage(FULL_MESSAGE);
      expect(msg.uri).toBe('https://chainbills.xyz');
    });

    it('parses version', () => {
      const msg = parseSiwsMessage(FULL_MESSAGE);
      expect(msg.version).toBe('1');
    });

    it('parses chainId', () => {
      const msg = parseSiwsMessage(FULL_MESSAGE);
      expect(msg.chainId).toBe('mainnet');
    });

    it('parses nonce', () => {
      const msg = parseSiwsMessage(FULL_MESSAGE);
      expect(msg.nonce).toBe('ZkLmNpQrSt8');
    });

    it('parses issuedAt', () => {
      const msg = parseSiwsMessage(FULL_MESSAGE);
      expect(msg.issuedAt).toBe('2024-06-15T12:00:00.000Z');
    });

    it('parses expirationTime', () => {
      const msg = parseSiwsMessage(FULL_MESSAGE);
      expect(msg.expirationTime).toBe('2024-06-15T12:05:00.000Z');
    });

    it('parses notBefore', () => {
      const msg = parseSiwsMessage(FULL_MESSAGE);
      expect(msg.notBefore).toBe('2024-06-15T11:59:00.000Z');
    });

    it('parses requestId', () => {
      const msg = parseSiwsMessage(FULL_MESSAGE);
      expect(msg.requestId).toBe('req-001');
    });

    it('parses resources', () => {
      const msg = parseSiwsMessage(FULL_MESSAGE);
      expect(msg.resources).toEqual(['https://chainbills.xyz/payables', 'https://chainbills.xyz/payments']);
    });
  });

  describe('error cases', () => {
    it('throws when message is too short', () => {
      expect(() => parseSiwsMessage('')).toThrow(SiwsParseError);
    });

    it('throws when header line is malformed', () => {
      const bad = `not-a-valid-header
11111111111111111111111111111111

URI: https://localhost
Version: 1
Chain ID: devnet
Nonce: abc12345
Issued At: 2024-01-01T00:00:00.000Z`;
      expect(() => parseSiwsMessage(bad)).toThrow(SiwsParseError);
    });

    it('throws when URI is missing', () => {
      const bad = `localhost wants you to sign in with your Solana account:
11111111111111111111111111111111

Version: 1
Chain ID: devnet
Nonce: abc12345
Issued At: 2024-01-01T00:00:00.000Z`;
      expect(() => parseSiwsMessage(bad)).toThrow(SiwsParseError);
      expect(() => parseSiwsMessage(bad)).toThrow('URI');
    });

    it('throws when Nonce is missing', () => {
      const bad = `localhost wants you to sign in with your Solana account:
11111111111111111111111111111111

URI: https://localhost
Version: 1
Chain ID: devnet
Issued At: 2024-01-01T00:00:00.000Z`;
      expect(() => parseSiwsMessage(bad)).toThrow(SiwsParseError);
      expect(() => parseSiwsMessage(bad)).toThrow('Nonce');
    });

    it('throws when Issued At is missing', () => {
      const bad = `localhost wants you to sign in with your Solana account:
11111111111111111111111111111111

URI: https://localhost
Version: 1
Chain ID: devnet
Nonce: abc12345`;
      expect(() => parseSiwsMessage(bad)).toThrow(SiwsParseError);
      expect(() => parseSiwsMessage(bad)).toThrow('Issued At');
    });

    it('throws when Chain ID is missing', () => {
      const bad = `localhost wants you to sign in with your Solana account:
11111111111111111111111111111111

URI: https://localhost
Version: 1
Nonce: abc12345
Issued At: 2024-01-01T00:00:00.000Z`;
      expect(() => parseSiwsMessage(bad)).toThrow(SiwsParseError);
    });
  });

  describe('edge cases', () => {
    it('handles CRLF line endings', () => {
      const crlf = MINIMAL_MESSAGE.replace(/\n/g, '\r\n');
      const msg = parseSiwsMessage(crlf);
      expect(msg.domain).toBe('localhost');
      expect(msg.nonce).toBe('abc12345');
    });

    it('handles extra whitespace around field values', () => {
      const padded = MINIMAL_MESSAGE.replace('Nonce: abc12345', 'Nonce:  abc12345 ');
      const msg = parseSiwsMessage(padded);
      expect(msg.nonce).toBe('abc12345');
    });

    it('parses message with domain containing a port', () => {
      const msg = parseSiwsMessage(MINIMAL_MESSAGE.replace('localhost', 'localhost:3000'));
      expect(msg.domain).toBe('localhost:3000');
    });

    it('handles message without blank line before URI when no statement', () => {
      const noBlank = `localhost wants you to sign in with your Solana account:
11111111111111111111111111111111
URI: https://localhost
Version: 1
Chain ID: devnet
Nonce: abc12345
Issued At: 2024-01-01T00:00:00.000Z`;
      const msg = parseSiwsMessage(noBlank);
      expect(msg.uri).toBe('https://localhost');
      expect(msg.statement).toBeUndefined();
    });
  });
});
