// Chainbills Backend — Trigger detector tests
//
// Covers: counter-based Wormhole job creation; cross-network destinations
// skipped; Wormhole-less destinations skipped; wormholeRelayed cursor advances;
// source chain with no wormholeChainId skips all work; no new messages is a no-op.

import { detectRelayTriggers } from './trigger.detector';
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

function makePrisma(chainId: string, wormholeRelayed = 0n) {
  const updateMock = vi.fn().mockResolvedValue({});
  return {
    chainCursor: {
      findUnique: vi.fn().mockResolvedValue({ chainId, wormholeRelayed }),
      update: updateMock,
    },
    relayJob: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    _updateMock: updateMock,
  } as unknown as PrismaService & { _updateMock: any };
}

function makeStats(publishedWormholeMessagesCount: bigint) {
  return { wormholeStats: { publishedWormholeMessagesCount } };
}

describe('detectRelayTriggers', () => {
  it('creates PAYABLE_UPDATE_VIA_WORMHOLE jobs for each new message', async () => {
    const prisma = makePrisma(TESTNET_CHAIN_A.cbChainId, 0n);
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, makeStats(2n));

    const createMany = (prisma as any).relayJob.createMany;
    // 2 new messages x 1 dest = 2 job creation calls
    expect(createMany).toHaveBeenCalledTimes(2);
    const firstCall = createMany.mock.calls[0][0].data[0];
    expect(firstCall.type).toBe('PAYABLE_UPDATE_VIA_WORMHOLE');
    expect(firstCall.destChainId).toBe(TESTNET_CHAIN_B.cbChainId);
    expect(firstCall.eventData.wormholeSequence).toBe('0');
  });

  it('uses synthetic txHash keyed by sequence', async () => {
    const prisma = makePrisma(TESTNET_CHAIN_A.cbChainId, 3n);
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, makeStats(4n));

    const createMany = (prisma as any).relayJob.createMany;
    expect(createMany).toHaveBeenCalledOnce();
    const data = createMany.mock.calls[0][0].data[0];
    expect(data.txHash).toBe(`wormhole-seq-${TESTNET_CHAIN_A.slug}-3`);
    expect(data.eventData.wormholeSequence).toBe('3');
  });

  it('advances wormholeRelayed cursor by the number of queued sequences', async () => {
    const prisma = makePrisma(TESTNET_CHAIN_A.cbChainId, 0n);
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, makeStats(3n));

    const update = (prisma as any)._updateMock;
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][0].data.wormholeRelayed).toBe(3n);
  });

  it('is a no-op when publishedCount equals wormholeRelayed', async () => {
    const prisma = makePrisma(TESTNET_CHAIN_A.cbChainId, 5n);
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, makeStats(5n));

    expect((prisma as any).relayJob.createMany).not.toHaveBeenCalled();
    expect((prisma as any)._updateMock).not.toHaveBeenCalled();
  });

  it('skips destinations on a different network', async () => {
    const prisma = makePrisma(TESTNET_CHAIN_A.cbChainId, 0n);
    const chains = makeChains([TESTNET_CHAIN_A, MAINNET_CHAIN]);

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, makeStats(1n));

    expect((prisma as any).relayJob.createMany).not.toHaveBeenCalled();
  });

  it('skips destinations without a wormholeChainId', async () => {
    const noWormholeDest: EvmChainConfig = { ...TESTNET_CHAIN_B, wormholeChainId: undefined };
    const prisma = makePrisma(TESTNET_CHAIN_A.cbChainId, 0n);
    const chains = makeChains([TESTNET_CHAIN_A, noWormholeDest]);

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, makeStats(1n));

    expect((prisma as any).relayJob.createMany).not.toHaveBeenCalled();
  });

  it('returns immediately when source chain has no wormholeChainId', async () => {
    const chainNoWormhole: EvmChainConfig = { ...TESTNET_CHAIN_A, wormholeChainId: undefined };
    const prisma = makePrisma(chainNoWormhole.cbChainId, 0n);
    const chains = makeChains([chainNoWormhole, TESTNET_CHAIN_B]);

    await detectRelayTriggers(chainNoWormhole, chains, prisma, makeStats(10n));

    expect((prisma as any).chainCursor.findUnique).not.toHaveBeenCalled();
    expect((prisma as any).relayJob.createMany).not.toHaveBeenCalled();
  });

  it('queues one job per destination for the same sequence', async () => {
    const CHAIN_C: EvmChainConfig = { ...TESTNET_CHAIN_B, cbChainId: '0xchainC' };
    const prisma = makePrisma(TESTNET_CHAIN_A.cbChainId, 0n);
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B, CHAIN_C]);

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, makeStats(1n));

    // sequence 0 -> 2 destinations = 2 createMany calls
    const createMany = (prisma as any).relayJob.createMany;
    expect(createMany).toHaveBeenCalledTimes(2);
    const destIds = createMany.mock.calls.map((c: any) => c[0].data[0].destChainId);
    expect(new Set(destIds).size).toBe(2);
  });
});
