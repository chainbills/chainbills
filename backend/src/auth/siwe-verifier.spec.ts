// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — SIWE verifier unit tests
//
// Uses viem's `privateKeyToAccount` + `createSiweMessage` to build real
// EIP-4361 messages. The on-chain verifyMessage call is mocked via vi.mock so
// no RPC call happens.
// ──────────────────────────────────────────────────────────────────────────────

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { privateKeyToAccount } from 'viem/accounts';
import { createSiweMessage, parseSiweMessage } from 'viem/siwe';
import { anvil as viemAnvil } from 'viem/chains';
import { SiweVerifier } from './siwe-verifier';

// ── Module mocks (hoisted by Vitest) ─────────────────────────────────────────

const mockVerifyMessage = vi.fn();

vi.mock('../chains/clients', () => ({
  createEvmPublicClient: () => ({ verifyMessage: mockVerifyMessage }),
}));

vi.mock('viem/siwe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem/siwe')>();
  return { ...actual, parseSiweMessage: vi.fn(actual.parseSiweMessage) };
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const account = privateKeyToAccount(PRIVATE_KEY);

const DOMAIN = 'localhost';
const APP_URL = 'http://localhost:3000'; // used as URI in SIWE messages
const CHAIN_ID = 31337; // anvil
const NONCE = 'testNonce123';

async function buildMessage(overrides: { domain?: string; uri?: string; nonce?: string; expirationTime?: Date } = {}) {
  return createSiweMessage({
    domain: overrides.domain ?? DOMAIN,
    address: account.address,
    statement: 'Sign in to Chainbills',
    uri: overrides.uri ?? APP_URL,
    version: '1',
    chainId: CHAIN_ID,
    nonce: overrides.nonce ?? NONCE,
    issuedAt: new Date(),
    expirationTime: overrides.expirationTime,
  });
}

function makeVerifier() {
  const anvil = {
    slug: 'anvil',
    viemChain: viemAnvil,
    isEvm: true,
    isSolana: false,
  };

  const mockChainsService = {
    evmChains: [anvil],
    getRpcUrl: vi.fn().mockReturnValue('http://localhost:8545'),
  };

  return { verifier: new SiweVerifier(mockChainsService as never) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SiweVerifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a malformed message string', async () => {
    const { verifier } = makeVerifier();
    await expect(verifier.verify('not a siwe message', '0xabc')).rejects.toThrow(BadRequestException);
  });

  it('throws with invalid SIWE message format message when parseSiweMessage throws', async () => {
    vi.mocked(parseSiweMessage).mockImplementationOnce(() => {
      throw new Error('viem parse error');
    });
    const { verifier } = makeVerifier();
    await expect(verifier.verify('any string', '0xabc')).rejects.toThrow('invalid SIWE message format');
  });

  it('throws missing chainId when parsed message has no chainId', async () => {
    // Build a raw EIP-4361-ish message that viem can parse (has address) but lacks Chain ID.
    // parseSiweMessage does not throw on a missing chain ID — it just leaves chainId undefined.
    const rawMessage = [
      'localhost wants you to sign in with your Ethereum account:',
      '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      '',
      'URI: http://localhost:3000',
      'Version: 1',
      'Nonce: abc123',
      'Issued At: 2026-01-01T00:00:00.000Z',
    ].join('\n');
    const { verifier } = makeVerifier();
    await expect(verifier.verify(rawMessage, '0xabc')).rejects.toThrow('SIWE message missing chainId');
  });

  it('rejects an unknown chainId', async () => {
    const { verifier } = makeVerifier();
    const message = await createSiweMessage({
      domain: DOMAIN,
      address: account.address,
      uri: APP_URL,
      version: '1',
      chainId: 99999,
      nonce: NONCE,
      issuedAt: new Date(),
    });
    await expect(verifier.verify(message, '0xabc')).rejects.toThrow(BadRequestException);
    await expect(verifier.verify(message, '0xabc')).rejects.toThrow('chainId 99999');
  });

  it('rejects an invalid signature (verifyMessage returns false)', async () => {
    const { verifier } = makeVerifier();
    const message = await buildMessage();
    mockVerifyMessage.mockResolvedValue(false);
    await expect(verifier.verify(message, '0xinvalid')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when verifyMessage throws', async () => {
    const { verifier } = makeVerifier();
    const message = await buildMessage();
    mockVerifyMessage.mockRejectedValue(new Error('RPC error'));
    await expect(verifier.verify(message, '0xabc')).rejects.toThrow(UnauthorizedException);
  });

  it('returns the lower-cased address on success', async () => {
    const { verifier } = makeVerifier();
    const message = await buildMessage();
    mockVerifyMessage.mockResolvedValue(true);
    const result = await verifier.verify(message, '0xok');
    expect(result.address).toBe(account.address.toLowerCase());
  });

  it('returns the parsed message on success', async () => {
    const { verifier } = makeVerifier();
    const message = await buildMessage();
    mockVerifyMessage.mockResolvedValue(true);
    const result = await verifier.verify(message, '0xok');
    expect(result.parsed.nonce).toBe(NONCE);
    expect(result.parsed.domain).toBe(DOMAIN);
  });
});
