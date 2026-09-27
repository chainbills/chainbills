// TxHashResolver unit tests.
// Covers resolveCctpPayableUpdateTxHash and resolveCctpPaymentTxHash: hint table
// fast-path, no-entity early return, getLogs fallback, block time cache, and error handling.

import { resolveCctpPayableUpdateTxHash, resolveCctpPaymentTxHash } from './tx-hash.resolver';
import type { EvmChainConfig } from '../../chains/types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { PublicClient } from 'viem';

const CHAIN = {
  slug: 'testsepolia',
  cbChainId: '0xchain001',
  displayName: 'Test Sepolia',
  caip2: 'eip155:11155111',
  network: 'testnet',
  isEvm: true,
  isSolana: false,
  diamondAddress: '0xdiamond0000000000000000000000000000000000',
  wormholeChainId: 10003,
  circleDomain: 0,
  pollIntervalMs: 2000,
  minGasBalance: 0n,
  viemChain: {} as never,
} as unknown as EvmChainConfig;

const PAYABLE_ID = `0x${'1'.repeat(64)}` as `0x${string}`;
const DEST_CHAIN_ID = `0x${'2'.repeat(64)}` as `0x${string}`;
const USER_PAYMENT_ID = `0x${'3'.repeat(64)}` as `0x${string}`;
const TX_HASH = `0x${'f'.repeat(64)}` as `0x${string}`;

function makePrisma(overrides: Partial<{
  hint: { txHash: string } | null;
  payable: { createdAt: Date; updatedAt: Date } | null;
  payment: { timestamp: Date } | null;
}> = {}) {
  const { hint = null, payable = null, payment = null } = overrides;
  return {
    relayTxHint: {
      findFirst: vi.fn().mockResolvedValue(hint),
    },
    payable: {
      findUnique: vi.fn().mockResolvedValue(payable),
    },
    userPayment: {
      findUnique: vi.fn().mockResolvedValue(payment),
    },
  } as unknown as PrismaService;
}

function makeClient(logs: Array<{ transactionHash: `0x${string}` }> | null = [], shouldThrow = false) {
  const blockResponse = {
    number: 1000n,
    timestamp: 1_700_000_000n,
  };
  const anchorBlock = {
    number: 1n,
    timestamp: 1_699_998_000n,
  };

  return {
    getBlock: vi.fn().mockImplementation(async ({ blockTag, blockNumber }: { blockTag?: string; blockNumber?: bigint }) => {
      if (blockTag === 'latest') return blockResponse;
      if (blockNumber === 1n) return anchorBlock;
      return blockResponse;
    }),
    request: shouldThrow
      ? vi.fn().mockRejectedValue(new Error('RPC error'))
      : vi.fn().mockResolvedValue(logs),
  } as unknown as PublicClient;
}

// Clear the module-level block time cache between tests.
beforeEach(() => {
  // The blockTimeCache is module-level — reset by using a unique chain slug per test group
  // or by reimporting. We use a fresh slug per describe block where needed.
  vi.clearAllMocks();
});

describe('resolveCctpPayableUpdateTxHash', () => {
  it('returns hint txHash immediately when hint exists in DB', async () => {
    const prisma = makePrisma({ hint: { txHash: TX_HASH } });
    const client = makeClient();

    const result = await resolveCctpPayableUpdateTxHash(CHAIN, prisma, client, PAYABLE_ID, DEST_CHAIN_ID);

    expect(result).toBe(TX_HASH);
    expect(prisma.relayTxHint.findFirst).toHaveBeenCalledOnce();
    expect(prisma.payable.findUnique).not.toHaveBeenCalled();
  });

  it('returns null when no hint and payable does not exist', async () => {
    const prisma = makePrisma({ hint: null, payable: null });
    const client = makeClient();

    const result = await resolveCctpPayableUpdateTxHash(CHAIN, prisma, client, PAYABLE_ID, DEST_CHAIN_ID);

    expect(result).toBeNull();
    expect(client.request).not.toHaveBeenCalled();
  });

  it('returns tx hash from getLogs when payable exists and log found', async () => {
    const prisma = makePrisma({
      hint: null,
      payable: { createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-02') },
    });
    const chainWithSlug = { ...CHAIN, slug: 'test-payable-update-1' } as unknown as EvmChainConfig;
    const client = makeClient([{ transactionHash: TX_HASH }]);

    const result = await resolveCctpPayableUpdateTxHash(chainWithSlug, prisma, client, PAYABLE_ID, DEST_CHAIN_ID);

    expect(result).toBe(TX_HASH);
    expect(client.request).toHaveBeenCalledOnce();
  });

  it('returns null when getLogs returns empty array', async () => {
    const prisma = makePrisma({
      hint: null,
      payable: { createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-02') },
    });
    const chainWithSlug = { ...CHAIN, slug: 'test-payable-update-2' } as unknown as EvmChainConfig;
    const client = makeClient([]);

    const result = await resolveCctpPayableUpdateTxHash(chainWithSlug, prisma, client, PAYABLE_ID, DEST_CHAIN_ID);

    expect(result).toBeNull();
  });

  it('returns null when getLogs throws', async () => {
    const prisma = makePrisma({
      hint: null,
      payable: { createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-02') },
    });
    const chainWithSlug = { ...CHAIN, slug: 'test-payable-update-throws' } as unknown as EvmChainConfig;
    const client = makeClient(null, true);

    const result = await resolveCctpPayableUpdateTxHash(chainWithSlug, prisma, client, PAYABLE_ID, DEST_CHAIN_ID);

    expect(result).toBeNull();
  });
});

describe('resolveCctpPaymentTxHash', () => {
  it('returns hint txHash immediately when hint exists', async () => {
    const prisma = makePrisma({ hint: { txHash: TX_HASH } });
    const client = makeClient();

    const result = await resolveCctpPaymentTxHash(CHAIN, prisma, client, USER_PAYMENT_ID, DEST_CHAIN_ID);

    expect(result).toBe(TX_HASH);
    expect(prisma.userPayment.findUnique).not.toHaveBeenCalled();
  });

  it('returns null when no hint and no payment row', async () => {
    const prisma = makePrisma({ hint: null, payment: null });
    const client = makeClient();

    const result = await resolveCctpPaymentTxHash(CHAIN, prisma, client, USER_PAYMENT_ID, DEST_CHAIN_ID);

    expect(result).toBeNull();
    expect(client.request).not.toHaveBeenCalled();
  });

  it('returns tx hash from getLogs when payment exists and log found', async () => {
    const prisma = makePrisma({
      hint: null,
      payment: { timestamp: new Date('2024-03-15') },
    });
    const chainWithSlug = { ...CHAIN, slug: 'test-payment-1' } as unknown as EvmChainConfig;
    const client = makeClient([{ transactionHash: TX_HASH }]);

    const result = await resolveCctpPaymentTxHash(chainWithSlug, prisma, client, USER_PAYMENT_ID, DEST_CHAIN_ID);

    expect(result).toBe(TX_HASH);
    expect(client.request).toHaveBeenCalledOnce();
  });
});

describe('block time cache', () => {
  it('reuses cached block time on second call with same chain slug', async () => {
    const prisma = makePrisma({
      hint: null,
      payable: { createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
    });
    const chainWithSlug = { ...CHAIN, slug: 'test-cache-reuse' } as unknown as EvmChainConfig;
    const client = makeClient([{ transactionHash: TX_HASH }]);

    // First call — populates cache
    await resolveCctpPayableUpdateTxHash(chainWithSlug, prisma, client, PAYABLE_ID, DEST_CHAIN_ID);

    // Reset findFirst to return no hint so we go through getLogs again
    (prisma.relayTxHint.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.payable.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    });

    const getBlockCallsBefore = (client.getBlock as ReturnType<typeof vi.fn>).mock.calls.length;

    // Second call — should reuse cache, no additional getBlock calls
    await resolveCctpPayableUpdateTxHash(chainWithSlug, prisma, client, PAYABLE_ID, DEST_CHAIN_ID);

    const getBlockCallsAfter = (client.getBlock as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(getBlockCallsAfter).toBe(getBlockCallsBefore);
  });
});

describe('estimateBlockAt: blocksSpanned = 0 fallback', () => {
  it('uses 2 s default block time when anchor block equals latest block', async () => {
    const prisma = makePrisma({
      hint: null,
      payable: { createdAt: new Date('2024-06-01'), updatedAt: new Date('2024-06-01') },
    });
    const chainWithSlug = { ...CHAIN, slug: 'test-zero-span' } as unknown as EvmChainConfig;

    // latest and anchor are the same block number -> blocksSpanned = 0
    const sameBlock = { number: 1n, timestamp: 1_717_200_000n };
    const client = {
      getBlock: vi.fn().mockResolvedValue(sameBlock),
      request: vi.fn().mockResolvedValue([{ transactionHash: TX_HASH }]),
    } as unknown as PublicClient;

    const result = await resolveCctpPayableUpdateTxHash(chainWithSlug, prisma, client, PAYABLE_ID, DEST_CHAIN_ID);

    // Should not throw; falls back to 2 s/block and returns the hash
    expect(result).toBe(TX_HASH);
    expect(client.request).toHaveBeenCalledOnce();
  });
});
