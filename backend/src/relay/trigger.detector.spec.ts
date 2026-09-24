// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Trigger detector tests
//
// Covers: each event type -> correct job type/destination; cross-network
// destinations skipped; disabled destinations skipped; relayScanBlock advances;
// multiple SentPayableUpdateViaCctp in one tx creates separate jobs.
// ──────────────────────────────────────────────────────────────────────────────

import { detectRelayTriggers } from './trigger.detector';
import type { EvmChainConfig } from '../chains/types';
import type { ChainsService } from '../chains/chains.service';
import type { PrismaService } from '../prisma/prisma.service';

// Minimal chain configs for the test.
const TESTNET_CHAIN_A: EvmChainConfig = {
  slug: 'chainA',
  cbChainId: '0xchainA',
  displayName: 'Chain A',
  caip2: 'eip155:1',
  network: 'testnet',
  isEvm: true,
  isSolana: false,
  diamondAddress: '0xdiamondA',
  deploymentBlock: 0n,
  wormholeChainId: 10002,
  circleDomain: 0,
  pollIntervalMs: 1000,
  minGasBalance: 0n,
  viemChain: {} as any,
};

const TESTNET_CHAIN_B: EvmChainConfig = {
  slug: 'chainB',
  cbChainId: '0xchainB',
  displayName: 'Chain B',
  caip2: 'eip155:2',
  network: 'testnet',
  isEvm: true,
  isSolana: false,
  diamondAddress: '0xdiamondB',
  deploymentBlock: 0n,
  wormholeChainId: 10003,
  circleDomain: 26,
  pollIntervalMs: 1000,
  minGasBalance: 0n,
  viemChain: {} as any,
};

const MAINNET_CHAIN: EvmChainConfig = {
  slug: 'mainnetChain',
  cbChainId: '0xmainnet',
  displayName: 'Mainnet',
  caip2: 'eip155:3',
  network: 'mainnet',
  isEvm: true,
  isSolana: false,
  diamondAddress: '0xdiamondM',
  deploymentBlock: 0n,
  wormholeChainId: 1,
  circleDomain: 5,
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

function makePrisma(chainId: string, relayScanBlock = 0n) {
  const upsertMock = vi.fn().mockResolvedValue({});
  return {
    chainCursor: {
      findUnique: vi.fn().mockResolvedValue({ chainId, relayScanBlock }),
      upsert: upsertMock,
    },
    relayJob: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    _upsertMock: upsertMock,
  } as unknown as PrismaService & { _upsertMock: any };
}

function makeClient(logs: { broadcasted?: any[]; cctpUpdate?: any[]; cctpPayment?: any[] } = {}) {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(100n),
    getLogs: vi.fn().mockImplementation(async ({ event }: { event: { name: string } }) => {
      if (event.name === 'PayableUpdateBroadcasted') return logs.broadcasted ?? [];
      if (event.name === 'SentPayableUpdateViaCctp') return logs.cctpUpdate ?? [];
      if (event.name === 'SentForeignPaymentViaCctp') return logs.cctpPayment ?? [];
      return [];
    }),
  };
}

describe('detectRelayTriggers', () => {
  it('creates PAYABLE_UPDATE_VIA_WORMHOLE jobs for Wormhole-enabled dest chains', async () => {
    const prisma = makePrisma(TESTNET_CHAIN_A.cbChainId);
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);
    const client = makeClient({
      broadcasted: [
        {
          args: { payableId: '0xpayable1', nonce: 1n, wormholeSequence: 5n },
          transactionHash: '0xtx1',
          blockNumber: 10n,
        },
      ],
    });

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, client as any);

    const createMany = (prisma as any).relayJob.createMany;
    const call = createMany.mock.calls.find((c: any) => c[0].data[0]?.type === 'PAYABLE_UPDATE_VIA_WORMHOLE');
    expect(call).toBeDefined();
    expect(call![0].data[0].destChainId).toBe(TESTNET_CHAIN_B.cbChainId);
  });

  it('skips PAYABLE_UPDATE_VIA_WORMHOLE for cross-network destinations', async () => {
    const prisma = makePrisma(TESTNET_CHAIN_A.cbChainId);
    const chains = makeChains([TESTNET_CHAIN_A, MAINNET_CHAIN]);
    const client = makeClient({
      broadcasted: [
        {
          args: { payableId: '0xpayable1', nonce: 1n, wormholeSequence: 5n },
          transactionHash: '0xtx1',
          blockNumber: 10n,
        },
      ],
    });

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, client as any);

    const createMany = (prisma as any).relayJob.createMany;
    const wormholeJobs = createMany.mock.calls.filter((c: any) => c[0].data[0]?.type === 'PAYABLE_UPDATE_VIA_WORMHOLE');
    expect(wormholeJobs.length).toBe(0);
  });

  it('creates PAYABLE_UPDATE_VIA_CCTP for the specific cbChainId in SentPayableUpdateViaCctp', async () => {
    const prisma = makePrisma(TESTNET_CHAIN_A.cbChainId);
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);
    const client = makeClient({
      cctpUpdate: [
        {
          args: { payableId: '0xpayable2', cbChainId: TESTNET_CHAIN_B.cbChainId, nonce: 2n },
          transactionHash: '0xtx2',
          blockNumber: 20n,
        },
      ],
    });

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, client as any);

    const createMany = (prisma as any).relayJob.createMany;
    const cctpJobs = createMany.mock.calls.filter((c: any) => c[0].data[0]?.type === 'PAYABLE_UPDATE_VIA_CCTP');
    expect(cctpJobs.length).toBe(1);
    expect(cctpJobs[0][0].data[0].destChainId).toBe(TESTNET_CHAIN_B.cbChainId);
  });

  it('creates separate jobs for multiple SentPayableUpdateViaCctp events in one tx', async () => {
    const CHAIN_C: EvmChainConfig = { ...TESTNET_CHAIN_B, slug: 'chainC', cbChainId: '0xchainC' };
    const prisma = makePrisma(TESTNET_CHAIN_A.cbChainId);
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B, CHAIN_C]);
    const TX = '0xtx3';
    const client = makeClient({
      cctpUpdate: [
        {
          args: { payableId: '0xpayable3', cbChainId: TESTNET_CHAIN_B.cbChainId, nonce: 3n },
          transactionHash: TX,
          blockNumber: 30n,
        },
        {
          args: { payableId: '0xpayable3', cbChainId: CHAIN_C.cbChainId, nonce: 3n },
          transactionHash: TX,
          blockNumber: 30n,
        },
      ],
    });

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, client as any);

    const createMany = (prisma as any).relayJob.createMany;
    const cctpJobs = createMany.mock.calls.filter((c: any) => c[0].data[0]?.type === 'PAYABLE_UPDATE_VIA_CCTP');
    // One job per event, different dest chain ids, unique txHash keys
    expect(cctpJobs.length).toBe(2);
    const txHashes = cctpJobs.map((c: any) => c[0].data[0].txHash);
    expect(new Set(txHashes).size).toBe(2);
  });

  it('creates PAYMENT_VIA_CCTP for SentForeignPaymentViaCctp', async () => {
    const prisma = makePrisma(TESTNET_CHAIN_A.cbChainId);
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);
    const client = makeClient({
      cctpPayment: [
        {
          args: {
            payableId: '0xpayable4',
            payableChainId: TESTNET_CHAIN_B.cbChainId,
            userPaymentId: '0xpayment1',
            paymentNonce: 7n,
            burnAmount: 1000n,
            maxFee: 10n,
            minFinalityThreshold: 1000,
          },
          transactionHash: '0xtx4',
          blockNumber: 40n,
        },
      ],
    });

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, client as any);

    const createMany = (prisma as any).relayJob.createMany;
    const paymentJobs = createMany.mock.calls.filter((c: any) => c[0].data[0]?.type === 'PAYMENT_VIA_CCTP');
    expect(paymentJobs.length).toBe(1);
    expect(paymentJobs[0][0].data[0].destChainId).toBe(TESTNET_CHAIN_B.cbChainId);
  });

  it('skips logs with null args', async () => {
    const prisma = makePrisma(TESTNET_CHAIN_A.cbChainId);
    const chains = makeChains([TESTNET_CHAIN_A, TESTNET_CHAIN_B]);
    const client = makeClient({
      broadcasted: [{ args: null, transactionHash: '0xtx1', blockNumber: 10n }],
      cctpUpdate: [{ args: null, transactionHash: '0xtx2', blockNumber: 10n }],
      cctpPayment: [{ args: null, transactionHash: '0xtx3', blockNumber: 10n }],
    });

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, client as any);

    // No jobs should be created since all logs have null args.
    const createMany = (prisma as any).relayJob.createMany;
    expect(createMany).not.toHaveBeenCalled();
  });

  it('skips PayableUpdateBroadcasted when source chain has no Wormhole', async () => {
    const chainNoWormhole = { ...TESTNET_CHAIN_A, wormholeChainId: undefined };
    const prisma = makePrisma(chainNoWormhole.cbChainId);
    const chains = makeChains([chainNoWormhole, TESTNET_CHAIN_B]);
    const client = makeClient({
      broadcasted: [
        {
          args: { payableId: '0xpayable1', nonce: 1n, wormholeSequence: 5n },
          transactionHash: '0xtx1',
          blockNumber: 10n,
        },
      ],
    });

    await detectRelayTriggers(chainNoWormhole, chains, prisma, client as any);

    const createMany = (prisma as any).relayJob.createMany;
    expect(createMany).not.toHaveBeenCalled();
  });

  it('skips SentPayableUpdateViaCctp for unknown dest chain', async () => {
    const prisma = makePrisma(TESTNET_CHAIN_A.cbChainId);
    // Only chain A enabled; dest chain is not enabled
    const chains = makeChains([TESTNET_CHAIN_A]);
    const client = makeClient({
      cctpUpdate: [
        {
          args: { payableId: '0xpayable2', cbChainId: '0xunknown', nonce: 2n },
          transactionHash: '0xtx2',
          blockNumber: 20n,
        },
      ],
    });

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, client as any);

    const createMany = (prisma as any).relayJob.createMany;
    expect(createMany).not.toHaveBeenCalled();
  });

  it('advances relayScanBlock to the latest block', async () => {
    const prisma = makePrisma(TESTNET_CHAIN_A.cbChainId, 0n);
    const chains = makeChains([TESTNET_CHAIN_A]);
    const client = makeClient();

    await detectRelayTriggers(TESTNET_CHAIN_A, chains, prisma, client as any);

    const upsertCall = (prisma as any)._upsertMock.mock.calls.find(
      (c: any) => c[0].update?.relayScanBlock !== undefined
    );
    expect(upsertCall).toBeDefined();
    expect(upsertCall![0].update.relayScanBlock).toBe(100n);
  });
});
