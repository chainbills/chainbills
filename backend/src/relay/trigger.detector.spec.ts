// Chainbills Backend — Trigger detector tests
//
// Covers the getter-based Wormhole path: emissions walked from
// `getEmittedWormholeMessages`, cross-network destinations skipped,
// Wormhole-less destinations skipped, cursor advances by page,
// no-op when nothing new. CCTP paths are exercised via integration tests
// against the real getter/mock chain.

import type { PublicClient } from 'viem';
import { detectRelayTriggers, type CursorSnapshot, type MessagingStats } from './trigger.detector';
import type { EvmChainConfig } from '../chains/types';
import type { ChainsService } from '../chains/chains.service';
import type { PrismaService } from '../prisma/prisma.service';

const TESTNET_CHAIN_A: EvmChainConfig = {
  slug: 'anvil',
  cbChainId: '0xchainA',
  displayName: 'Chain A',
  caip2: 'eip155:1',
  network: 'testnet',
  isEvm: true,
  isSolana: false,
  diamondAddress: '0xdiamondA',
  wormholeChainId: 10002,
  circleDomain: 0,
  pollIntervalMs: 1000,
  minGasBalance: 0n,
  viemChain: {} as any,
};

const TESTNET_CHAIN_B: EvmChainConfig = {
  slug: 'arcmainnet',
  cbChainId: '0xchainB',
  displayName: 'Chain B',
  caip2: 'eip155:2',
  network: 'testnet',
  isEvm: true,
  isSolana: false,
  diamondAddress: '0xdiamondB',
  wormholeChainId: 10003,
  circleDomain: 26,
  pollIntervalMs: 1000,
  minGasBalance: 0n,
  viemChain: {} as any,
};

const MAINNET_CHAIN: EvmChainConfig = {
  slug: 'base',
  cbChainId: '0xmainnet',
  displayName: 'Mainnet',
  caip2: 'eip155:3',
  network: 'mainnet',
  isEvm: true,
  isSolana: false,
  diamondAddress: '0xdiamondM',
  wormholeChainId: 30,
  circleDomain: 6,
  pollIntervalMs: 1000,
  minGasBalance: 0n,
  viemChain: {} as any,
};

function makeChains(enabled: EvmChainConfig[]): ChainsService {
  return {
    enabled,
    byCbChainId: (id: string) => enabled.find((c) => c.cbChainId === id),
    getRpcUrl: () => 'http://localhost',
  } as unknown as ChainsService;
}

function makePrisma() {
  const updateMock = vi.fn().mockResolvedValue({});
  return {
    chainCursor: { update: updateMock },
    relayJob: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    _updateMock: updateMock,
  } as unknown as PrismaService & { _updateMock: any };
}

function makeStats(publishedWormholeMessagesCount: bigint): MessagingStats {
  return {
    wormholeStats: { publishedWormholeMessagesCount },
    cctpStats: { emittedCctpPaymentMessagesCount: 0n, emittedCctpPayableUpdateMessagesCount: 0n },
  };
}

function makeCursor(wormholeRelayed = 0n): CursorSnapshot {
  return { wormholeRelayed, cctpPayableUpdatesRelayed: 0n, cctpPaymentsRelayed: 0n };
}

/**
 * Returns a mock viem PublicClient whose `readContract` responds to
 * `getEmittedWormholeMessages(offset, limit)` with a slice of `emissions`.
 * CCTP getters return `[]` (nothing to walk).
 */
function makeClient(emissions: Array<{ payableId: `0x${string}`; chainbillsNonce: bigint; wormholeSequence: bigint }>) {
  return {
    readContract: vi.fn().mockImplementation(async ({ functionName, args }: any) => {
      if (functionName === 'getEmittedWormholeMessages') {
        const [offset, limit] = args as [bigint, bigint];
        return emissions.slice(Number(offset), Number(offset) + Number(limit));
      }
      if (functionName === 'getEmittedCctpPayableUpdateMessages' || functionName === 'getEmittedCctpPaymentMessages') {
        return [];
      }
      return null;
    }),
  } as unknown as PublicClient;
}

/** Builds one wormhole emission tuple with a payableId + monotonic sequence. */
function emission(sequence: bigint) {
  return {
    payableId: '0xpayable' as `0x${string}`,
    chainbillsNonce: sequence + 1n,
    wormholeSequence: sequence,
  };
}

/** A mock client for CCTP payable-update tests. Wormhole getter returns []. */
function makeCctpUpdateClient(
  cctpUpdates: Array<{ payableId: `0x${string}`; destChainId: `0x${string}`; chainbillsNonce: bigint; messageBodyHash: `0x${string}` }>
) {
  return {
    readContract: vi.fn().mockImplementation(async ({ functionName, args }: any) => {
      if (functionName === 'getEmittedWormholeMessages') return [];
      if (functionName === 'getEmittedCctpPayableUpdateMessages') {
        const [offset, limit] = args as [bigint, bigint];
        return cctpUpdates.slice(Number(offset), Number(offset) + Number(limit));
      }
      if (functionName === 'getEmittedCctpPaymentMessages') return [];
      return null;
    }),
  } as unknown as PublicClient;
}

/** A mock client for CCTP payment tests. Wormhole and update getters return []. */
function makeCctpPaymentClient(
  cctpPayments: Array<{ payableId: `0x${string}`; destChainId: `0x${string}`; userPaymentId: `0x${string}`; chainbillsNonce: bigint; hookDataHash: `0x${string}` }>
) {
  return {
    readContract: vi.fn().mockImplementation(async ({ functionName, args }: any) => {
      if (functionName === 'getEmittedWormholeMessages') return [];
      if (functionName === 'getEmittedCctpPayableUpdateMessages') return [];
      if (functionName === 'getEmittedCctpPaymentMessages') {
        const [offset, limit] = args as [bigint, bigint];
        return cctpPayments.slice(Number(offset), Number(offset) + Number(limit));
      }
      return null;
    }),
  } as unknown as PublicClient;
}

describe('detectRelayTriggers', () => {
  it('creates PAYABLE_UPDATE_VIA_WORMHOLE jobs for each new message', async () => {
    const prisma = makePrisma();
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);
    const client = makeClient([emission(0n), emission(1n)]);

    const result = await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, makeStats(2n), makeCursor(0n), client);

    expect(result.wormholeAdvanced).toBe(true);
    const createMany = (prisma as any).relayJob.createMany;
    expect(createMany).toHaveBeenCalledTimes(2);
    const firstCall = createMany.mock.calls[0][0].data[0];
    expect(firstCall.type).toBe('PAYABLE_UPDATE_VIA_WORMHOLE');
    expect(firstCall.destChainId).toBe(TESTNET_CHAIN_B.cbChainId);
    expect(firstCall.eventData.wormholeSequence).toBe('0');
  });

  it('uses synthetic txHash keyed by wormholeSequence', async () => {
    const prisma = makePrisma();
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);
    // 4 total emissions in the on-chain array, cursor already at 3 — detector
    // should consume only emission[3] and derive txHash from its wormholeSequence.
    const client = makeClient([emission(0n), emission(1n), emission(2n), emission(3n)]);

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, makeStats(4n), makeCursor(3n), client);

    const createMany = (prisma as any).relayJob.createMany;
    expect(createMany).toHaveBeenCalledOnce();
    const data = createMany.mock.calls[0][0].data[0];
    expect(data.txHash).toBe(`wormhole-seq-${TESTNET_CHAIN_A.slug}-3`);
    expect(data.eventData.wormholeSequence).toBe('3');
  });

  it('advances wormholeRelayed cursor to publishedCount when all emissions processed', async () => {
    const prisma = makePrisma();
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);
    const client = makeClient([emission(0n), emission(1n), emission(2n)]);

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, makeStats(3n), makeCursor(0n), client);

    const update = (prisma as any)._updateMock;
    expect(update).toHaveBeenCalled();
    // Final cursor write should reflect all 3 emissions consumed.
    const lastCall = update.mock.calls[update.mock.calls.length - 1][0];
    expect(lastCall.data.wormholeRelayed).toBe(3n);
  });

  it('is a no-op when publishedCount equals cursor', async () => {
    const prisma = makePrisma();
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);
    const client = makeClient([]);

    const result = await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, makeStats(5n), makeCursor(5n), client);

    expect(result.wormholeAdvanced).toBe(false);
    expect((prisma as any).relayJob.createMany).not.toHaveBeenCalled();
    expect((prisma as any)._updateMock).not.toHaveBeenCalled();
  });

  it('skips destinations on a different network', async () => {
    const prisma = makePrisma();
    const chains = makeChains([TESTNET_CHAIN_A, MAINNET_CHAIN]);
    const client = makeClient([emission(0n)]);

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, makeStats(1n), makeCursor(0n), client);

    expect((prisma as any).relayJob.createMany).not.toHaveBeenCalled();
  });

  it('skips destinations without a wormholeChainId', async () => {
    const noWormholeDest: EvmChainConfig = { ...TESTNET_CHAIN_B, wormholeChainId: undefined };
    const prisma = makePrisma();
    const chains = makeChains([TESTNET_CHAIN_A, noWormholeDest]);
    const client = makeClient([emission(0n)]);

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, makeStats(1n), makeCursor(0n), client);

    expect((prisma as any).relayJob.createMany).not.toHaveBeenCalled();
  });

  it('returns immediately when source chain has no wormholeChainId', async () => {
    const chainNoWormhole: EvmChainConfig = { ...TESTNET_CHAIN_A, wormholeChainId: undefined };
    const prisma = makePrisma();
    const chains = makeChains([chainNoWormhole, TESTNET_CHAIN_B]);
    const client = makeClient([emission(0n)]);

    const result = await detectRelayTriggers(chainNoWormhole, chains, prisma, makeStats(10n), makeCursor(0n), client);

    expect(result.wormholeAdvanced).toBe(false);
    expect((prisma as any).relayJob.createMany).not.toHaveBeenCalled();
  });

  it('queues one job per destination for the same emission', async () => {
    const CHAIN_C: EvmChainConfig = { ...TESTNET_CHAIN_B, cbChainId: '0xchainC' };
    const prisma = makePrisma();
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B, CHAIN_C]);
    const client = makeClient([emission(0n)]);

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, makeStats(1n), makeCursor(0n), client);

    // one emission x 2 destinations = 2 createMany calls
    const createMany = (prisma as any).relayJob.createMany;
    expect(createMany).toHaveBeenCalledTimes(2);
    const destIds = createMany.mock.calls.map((c: any) => c[0].data[0].destChainId);
    expect(new Set(destIds).size).toBe(2);
  });

  // CCTP payable-update path

  it('returns immediately when source chain has no circleDomain (CCTP update)', async () => {
    const chainNoCctp: EvmChainConfig = { ...TESTNET_CHAIN_A, circleDomain: undefined };
    const prisma = makePrisma();
    const chains = makeChains([chainNoCctp, TESTNET_CHAIN_B]);
    const cctpStats: MessagingStats = {
      wormholeStats: { publishedWormholeMessagesCount: 0n },
      cctpStats: { emittedCctpPaymentMessagesCount: 0n, emittedCctpPayableUpdateMessagesCount: 5n },
    };
    const client = makeCctpUpdateClient([]);

    const result = await detectRelayTriggers(chainNoCctp, chains, prisma, cctpStats, makeCursor(0n), client);

    expect(result.cctpPayableUpdateAdvanced).toBe(false);
    expect((prisma as any).relayJob.createMany).not.toHaveBeenCalled();
  });

  it('creates PAYABLE_UPDATE_VIA_CCTP jobs for CCTP payable update emissions', async () => {
    const prisma = makePrisma();
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);
    const cctpUpdateEmissions = [
      {
        payableId: '0xpayable01' as `0x${string}`,
        destChainId: TESTNET_CHAIN_B.cbChainId as `0x${string}`,
        chainbillsNonce: 1n,
        messageBodyHash: '0xhash01' as `0x${string}`,
      },
    ];
    const cctpStats: MessagingStats = {
      wormholeStats: { publishedWormholeMessagesCount: 0n },
      cctpStats: { emittedCctpPaymentMessagesCount: 0n, emittedCctpPayableUpdateMessagesCount: 1n },
    };
    const client = makeCctpUpdateClient(cctpUpdateEmissions);

    const result = await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, cctpStats, makeCursor(0n), client);

    expect(result.cctpPayableUpdateAdvanced).toBe(true);
    const createMany = (prisma as any).relayJob.createMany;
    const cctpJobs = createMany.mock.calls.filter((c: any) => c[0].data[0]?.type === 'PAYABLE_UPDATE_VIA_CCTP');
    expect(cctpJobs.length).toBe(1);
    expect(cctpJobs[0][0].data[0].destChainId).toBe(TESTNET_CHAIN_B.cbChainId);
  });

  it('skips CCTP update job when dest not found in enabled chains', async () => {
    const prisma = makePrisma();
    const chains = makeChains([TESTNET_CHAIN_A]); // CHAIN_B not enabled
    const cctpUpdateEmissions = [
      {
        payableId: '0xpayable02' as `0x${string}`,
        destChainId: '0xunknowndest' as `0x${string}`,
        chainbillsNonce: 1n,
        messageBodyHash: '0xhash02' as `0x${string}`,
      },
    ];
    const cctpStats: MessagingStats = {
      wormholeStats: { publishedWormholeMessagesCount: 0n },
      cctpStats: { emittedCctpPaymentMessagesCount: 0n, emittedCctpPayableUpdateMessagesCount: 1n },
    };
    const client = makeCctpUpdateClient(cctpUpdateEmissions);

    const result = await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, cctpStats, makeCursor(0n), client);

    expect(result.cctpPayableUpdateAdvanced).toBe(true);
    const createMany = (prisma as any).relayJob.createMany;
    expect(createMany).not.toHaveBeenCalled();
  });

  // CCTP payment path

  it('returns immediately when source chain has no circleDomain (CCTP payment)', async () => {
    const chainNoCctp: EvmChainConfig = { ...TESTNET_CHAIN_A, circleDomain: undefined };
    const prisma = makePrisma();
    const chains = makeChains([chainNoCctp, TESTNET_CHAIN_B]);
    const cctpStats: MessagingStats = {
      wormholeStats: { publishedWormholeMessagesCount: 0n },
      cctpStats: { emittedCctpPaymentMessagesCount: 5n, emittedCctpPayableUpdateMessagesCount: 0n },
    };
    const client = makeCctpPaymentClient([]);

    const result = await detectRelayTriggers(chainNoCctp, chains, prisma, cctpStats, makeCursor(0n), client);

    expect(result.cctpPaymentAdvanced).toBe(false);
    expect((prisma as any).relayJob.createMany).not.toHaveBeenCalled();
  });

  it('creates PAYMENT_VIA_CCTP jobs for CCTP payment emissions', async () => {
    const prisma = makePrisma();
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);
    const cctpPaymentEmissions = [
      {
        payableId: '0xpayable03' as `0x${string}`,
        destChainId: TESTNET_CHAIN_B.cbChainId as `0x${string}`,
        userPaymentId: '0xuserpayment01' as `0x${string}`,
        chainbillsNonce: 1n,
        hookDataHash: '0xhook01' as `0x${string}`,
      },
    ];
    const cctpStats: MessagingStats = {
      wormholeStats: { publishedWormholeMessagesCount: 0n },
      cctpStats: { emittedCctpPaymentMessagesCount: 1n, emittedCctpPayableUpdateMessagesCount: 0n },
    };
    const client = makeCctpPaymentClient(cctpPaymentEmissions);

    const result = await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, cctpStats, makeCursor(0n), client);

    expect(result.cctpPaymentAdvanced).toBe(true);
    const createMany = (prisma as any).relayJob.createMany;
    const paymentJobs = createMany.mock.calls.filter((c: any) => c[0].data[0]?.type === 'PAYMENT_VIA_CCTP');
    expect(paymentJobs.length).toBe(1);
    expect(paymentJobs[0][0].data[0].destChainId).toBe(TESTNET_CHAIN_B.cbChainId);
  });

  it('skips CCTP payment job when dest not found in enabled chains', async () => {
    const prisma = makePrisma();
    const chains = makeChains([TESTNET_CHAIN_A]);
    const cctpPaymentEmissions = [
      {
        payableId: '0xpayable04' as `0x${string}`,
        destChainId: '0xunknown' as `0x${string}`,
        userPaymentId: '0xupay' as `0x${string}`,
        chainbillsNonce: 1n,
        hookDataHash: '0xhook02' as `0x${string}`,
      },
    ];
    const cctpStats: MessagingStats = {
      wormholeStats: { publishedWormholeMessagesCount: 0n },
      cctpStats: { emittedCctpPaymentMessagesCount: 1n, emittedCctpPayableUpdateMessagesCount: 0n },
    };
    const client = makeCctpPaymentClient(cctpPaymentEmissions);

    const result = await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, cctpStats, makeCursor(0n), client);

    expect(result.cctpPaymentAdvanced).toBe(true);
    const createMany = (prisma as any).relayJob.createMany;
    expect(createMany).not.toHaveBeenCalled();
  });

  it('is a no-op when cctpPayableUpdatesRelayed equals emitted count', async () => {
    const prisma = makePrisma();
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);
    const cctpStats: MessagingStats = {
      wormholeStats: { publishedWormholeMessagesCount: 0n },
      cctpStats: { emittedCctpPaymentMessagesCount: 0n, emittedCctpPayableUpdateMessagesCount: 3n },
    };
    const client = makeCctpUpdateClient([]);

    const result = await detectRelayTriggers(
      TESTNET_CHAIN_A,
      chains,
      prisma,
      cctpStats,
      { wormholeRelayed: 0n, cctpPayableUpdatesRelayed: 3n, cctpPaymentsRelayed: 0n },
      client
    );

    expect(result.cctpPayableUpdateAdvanced).toBe(false);
    expect((prisma as any).relayJob.createMany).not.toHaveBeenCalled();
  });

  it('is a no-op when cctpPaymentsRelayed equals emitted count', async () => {
    const prisma = makePrisma();
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);
    const cctpStats: MessagingStats = {
      wormholeStats: { publishedWormholeMessagesCount: 0n },
      cctpStats: { emittedCctpPaymentMessagesCount: 2n, emittedCctpPayableUpdateMessagesCount: 0n },
    };
    const client = makeCctpPaymentClient([]);

    const result = await detectRelayTriggers(
      TESTNET_CHAIN_A,
      chains,
      prisma,
      cctpStats,
      { wormholeRelayed: 0n, cctpPayableUpdatesRelayed: 0n, cctpPaymentsRelayed: 2n },
      client
    );

    expect(result.cctpPaymentAdvanced).toBe(false);
    expect((prisma as any).relayJob.createMany).not.toHaveBeenCalled();
  });
});
