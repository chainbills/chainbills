// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Solana trigger detector tests
//
// Covers: Wormhole messages create SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE jobs per
// dest chain; CCTP payment scan creates SOLANA_PAYMENT_VIA_CCTP_WORMHOLE jobs;
// cross-network destinations are skipped; relayEnabled=false prevents any calls
// (the gate is in SolanaIndexer.tick, which we verify separately).
// ──────────────────────────────────────────────────────────────────────────────

import { detectSolanaRelayTriggers } from './solana-trigger.detector';
import type { SolanaChainConfig, EvmChainConfig } from '../chains/types';
import type { ChainsService } from '../chains/chains.service';
import type { PrismaService } from '../prisma/prisma.service';

const SOLANA_CHAIN: SolanaChainConfig = {
  slug: 'solanadevnet',
  cbChainId: '0xsolanachain',
  displayName: 'Solana Devnet',
  caip2: 'solana:devnet',
  network: 'testnet',
  isEvm: false,
  isSolana: true,
  rpcUrl: 'https://api.devnet.solana.com',
  wormholeChainId: 1,
  circleDomain: 5,
  pollIntervalMs: 5000,
  minGasBalance: 50_000_000n,
  relayEnabled: true,
  programId: 'DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk',
  usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  wormholeProgramId: '3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5',
  cctpProgramId: 'CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd',
  wormholeShimProgramId: 'EtZMZM22ViKMo4r5y4Anovs3wKQ2owUmDpjygnMMcdEX',
};

const EVM_TESTNET: EvmChainConfig = {
  slug: 'anvil',
  cbChainId: '0xevmtestnet',
  displayName: 'EVM Testnet',
  caip2: 'eip155:31337',
  network: 'testnet',
  isEvm: true,
  isSolana: false,
  diamondAddress: '0xdiamond',
  wormholeChainId: 10002,
  circleDomain: 0,
  pollIntervalMs: 1000,
  minGasBalance: 0n,
  viemChain: {} as any,
};

const EVM_MAINNET: EvmChainConfig = {
  ...EVM_TESTNET,
  slug: 'arcmainnet',
  cbChainId: '0xevmmainnet',
  network: 'mainnet',
};

function makeChains(enabled: (SolanaChainConfig | EvmChainConfig)[]): ChainsService {
  return {
    enabled,
    byCbChainId: (id: string) => enabled.find((c) => c.cbChainId === id),
    getRpcUrl: () => 'http://localhost:8899',
  } as unknown as ChainsService;
}

function makePrisma(
  cursor?: Partial<{ wormholeRelayed: bigint; cctpPaymentsRelayed: bigint; cctpPayableUpdatesRelayed: bigint }>
) {
  return {
    chainCursor: {
      findUnique: vi.fn().mockResolvedValue({
        chainId: SOLANA_CHAIN.cbChainId,
        wormholeRelayed: 0n,
        cctpPaymentsRelayed: 0n,
        cctpPayableUpdatesRelayed: 0n,
        ...cursor,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    relayJob: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaService;
}

function makeStats(overrides: Partial<Record<string, bigint>> = {}) {
  return {
    published_wormhole_messages: 0n,
    emitted_cctp_payment_messages: 0n,
    emitted_cctp_update_messages: 0n,
    ...overrides,
  };
}

/** A mock Connection that returns empty signature list by default. */
function makeConnection(sigs: Array<{ signature: string; logMessages?: string[] }> = []) {
  return {
    getSignaturesForAddress: vi.fn().mockResolvedValue(sigs.map((s) => ({ signature: s.signature, err: null }))),
    getParsedTransaction: vi.fn().mockImplementation(async (sig: string) => {
      const entry = sigs.find((s) => s.signature === sig);
      if (!entry || !entry.logMessages) return null;
      return { meta: { logMessages: entry.logMessages } };
    }),
  };
}

describe('detectSolanaRelayTriggers', () => {
  describe('Wormhole messages', () => {
    it('creates SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE for each new sequence per dest chain', async () => {
      const prisma = makePrisma({ wormholeRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, EVM_TESTNET]);
      const connection = makeConnection();
      const stats = makeStats({ published_wormhole_messages: 2n });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      const createMany = (prisma as any).relayJob.createMany;
      const jobs = createMany.mock.calls.filter(
        (c: any) => c[0].data[0]?.type === 'SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE'
      );
      // 2 sequences × 1 dest chain = 2 job creation calls
      expect(jobs.length).toBe(2);
    });

    it('skips dest chains on a different network', async () => {
      const prisma = makePrisma({ wormholeRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, EVM_MAINNET]);
      const connection = makeConnection();
      const stats = makeStats({ published_wormhole_messages: 1n });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      const createMany = (prisma as any).relayJob.createMany;
      expect(createMany).not.toHaveBeenCalled();
    });

    it('advances cursor.wormholeRelayed after queuing', async () => {
      const prisma = makePrisma({ wormholeRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, EVM_TESTNET]);
      const connection = makeConnection();
      const stats = makeStats({ published_wormhole_messages: 1n });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      expect((prisma as any).chainCursor.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ wormholeRelayed: 1n }) })
      );
    });
  });

  describe('CCTP payment messages', () => {
    it('creates SOLANA_PAYMENT_VIA_CCTP_WORMHOLE for cross-chain UserPaid transactions', async () => {
      const prisma = makePrisma({ cctpPaymentsRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, EVM_TESTNET]);
      const connection = makeConnection([
        {
          signature: 'sig1',
          logMessages: ['Program log: UserPaid'],
        },
      ]);
      const stats = makeStats({ emitted_cctp_payment_messages: 1n });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      const createMany = (prisma as any).relayJob.createMany;
      const jobs = createMany.mock.calls.filter((c: any) => c[0].data[0]?.type === 'SOLANA_PAYMENT_VIA_CCTP_WORMHOLE');
      expect(jobs.length).toBeGreaterThan(0);
    });

    it('does not create jobs for cross-network EVM dest chains', async () => {
      const prisma = makePrisma({ cctpPaymentsRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, EVM_MAINNET]);
      const connection = makeConnection([
        {
          signature: 'sig2',
          logMessages: ['Program log: UserPaid'],
        },
      ]);
      const stats = makeStats({ emitted_cctp_payment_messages: 1n });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      const createMany = (prisma as any).relayJob.createMany;
      expect(createMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: [expect.objectContaining({ type: 'SOLANA_PAYMENT_VIA_CCTP_WORMHOLE' })] })
      );
    });
  });

  describe('CCTP update messages', () => {
    it('creates SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE for PayableUpdateBroadcasted transactions', async () => {
      const prisma = makePrisma({ cctpPayableUpdatesRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, EVM_TESTNET]);
      const connection = makeConnection([
        {
          signature: 'sig3',
          logMessages: ['Program log: PayableUpdateBroadcasted'],
        },
      ]);
      const stats = makeStats({ emitted_cctp_update_messages: 1n });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      const createMany = (prisma as any).relayJob.createMany;
      // EVM_TESTNET has circleDomain=0 (not undefined), so it matches
      expect(createMany).toHaveBeenCalled();
    });

    it('warns and does not advance cursor when scan finds fewer than expected', async () => {
      const prisma = makePrisma({ cctpPayableUpdatesRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, EVM_TESTNET]);
      // Empty signature list -> finds 0 update transactions
      const connection = makeConnection([]);
      const stats = makeStats({ emitted_cctp_update_messages: 2n });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      // Cursor should NOT be updated since 0 < 2
      const updateCalls = (prisma as any).chainCursor.update.mock.calls;
      const updatesRelayed = updateCalls.find((c: any) => c[0]?.data?.cctpPayableUpdatesRelayed !== undefined);
      expect(updatesRelayed).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('stops Wormhole relay job creation on first error and does not advance cursor', async () => {
      const prisma = makePrisma({ wormholeRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, EVM_TESTNET]);
      const connection = makeConnection();
      const stats = makeStats({ published_wormhole_messages: 2n });

      // Make createMany throw on first call.
      (prisma as any).relayJob.createMany = vi.fn().mockRejectedValue(new Error('DB error'));

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      // cursor should NOT advance since done=0
      const updateCalls = (prisma as any).chainCursor.update.mock.calls;
      const wormholeUpdate = updateCalls.find((c: any) => c[0]?.data?.wormholeRelayed !== undefined);
      expect(wormholeUpdate).toBeUndefined();
    });

    it('handles getSignaturesForAddress throwing in CCTP payment scan', async () => {
      const prisma = makePrisma({ cctpPaymentsRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, EVM_TESTNET]);
      const connection = {
        getSignaturesForAddress: vi.fn().mockRejectedValue(new Error('RPC timeout')),
        getParsedTransaction: vi.fn(),
      };
      const stats = makeStats({ emitted_cctp_payment_messages: 1n });

      // Should not throw.
      await expect(
        detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats)
      ).resolves.toBeUndefined();
    });

    it('handles getSignaturesForAddress throwing in CCTP update scan', async () => {
      const prisma = makePrisma({ cctpPayableUpdatesRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, EVM_TESTNET]);
      const connection = {
        getSignaturesForAddress: vi.fn().mockRejectedValue(new Error('RPC timeout')),
        getParsedTransaction: vi.fn(),
      };
      const stats = makeStats({ emitted_cctp_update_messages: 1n });

      // Should not throw.
      await expect(
        detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats)
      ).resolves.toBeUndefined();
    });
  });

  describe('no new messages', () => {
    it('does not create any jobs when all counters are at cursor', async () => {
      const prisma = makePrisma({ wormholeRelayed: 1n, cctpPaymentsRelayed: 1n, cctpPayableUpdatesRelayed: 1n });
      const chains = makeChains([SOLANA_CHAIN, EVM_TESTNET]);
      const connection = makeConnection();
      const stats = makeStats({
        published_wormhole_messages: 1n,
        emitted_cctp_payment_messages: 1n,
        emitted_cctp_update_messages: 1n,
      });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      const createMany = (prisma as any).relayJob.createMany;
      expect(createMany).not.toHaveBeenCalled();
    });
  });

  describe('missing chain capabilities', () => {
    it('skips Wormhole processing when chain has no wormholeChainId', async () => {
      const chainNoWormhole: typeof SOLANA_CHAIN = { ...SOLANA_CHAIN, wormholeChainId: undefined as any };
      const prisma = makePrisma({ wormholeRelayed: 0n });
      const chains = makeChains([chainNoWormhole, EVM_TESTNET]);
      const connection = makeConnection();
      const stats = makeStats({ published_wormhole_messages: 3n });

      await detectSolanaRelayTriggers(chainNoWormhole, chains, prisma as any, connection as any, {} as any, stats);

      const createMany = (prisma as any).relayJob.createMany;
      expect(createMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: [expect.objectContaining({ type: 'SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE' })] })
      );
    });

    it('skips CCTP processing when chain has no circleDomain', async () => {
      const chainNoCctp: typeof SOLANA_CHAIN = { ...SOLANA_CHAIN, circleDomain: undefined as any };
      const prisma = makePrisma({ cctpPaymentsRelayed: 0n, cctpPayableUpdatesRelayed: 0n });
      const chains = makeChains([chainNoCctp, EVM_TESTNET]);
      const connection = makeConnection([{ signature: 'sig1', logMessages: ['Program log: UserPaid'] }]);
      const stats = makeStats({ emitted_cctp_payment_messages: 1n, emitted_cctp_update_messages: 1n });

      await detectSolanaRelayTriggers(chainNoCctp, chains, prisma as any, connection as any, {} as any, stats);

      const createMany = (prisma as any).relayJob.createMany;
      expect(createMany).not.toHaveBeenCalled();
    });
  });

  describe('cursor row missing from DB', () => {
    it('defaults all cursors to 0n when findUnique returns null', async () => {
      const prisma = {
        chainCursor: {
          findUnique: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue({}),
        },
        relayJob: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      } as unknown as PrismaService;
      const chains = makeChains([SOLANA_CHAIN, EVM_TESTNET]);
      const connection = makeConnection();
      const stats = makeStats({ published_wormhole_messages: 1n });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      const createMany = (prisma as any).relayJob.createMany;
      expect(createMany).toHaveBeenCalled();
    });
  });

  describe('getParsedTransaction returns null', () => {
    it('skips signatures where getParsedTransaction returns null', async () => {
      const prisma = makePrisma({ cctpPaymentsRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, EVM_TESTNET]);
      // Provide a sig but no logMessages — makeConnection returns null for those
      const connection = makeConnection([{ signature: 'sig-null' }]);
      const stats = makeStats({ emitted_cctp_payment_messages: 1n });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      const createMany = (prisma as any).relayJob.createMany;
      expect(createMany).not.toHaveBeenCalled();
    });
  });

  describe('CCTP keyword variants', () => {
    it('creates payment job when log contains pay_foreign_via_cctp keyword', async () => {
      const prisma = makePrisma({ cctpPaymentsRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, EVM_TESTNET]);
      const connection = makeConnection([
        { signature: 'sig-pay-cctp', logMessages: ['Program log: Instruction: pay_foreign_via_cctp'] },
      ]);
      const stats = makeStats({ emitted_cctp_payment_messages: 1n });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      const createMany = (prisma as any).relayJob.createMany;
      const jobs = createMany.mock.calls.filter((c: any) => c[0].data[0]?.type === 'SOLANA_PAYMENT_VIA_CCTP_WORMHOLE');
      expect(jobs.length).toBeGreaterThan(0);
    });

    it('creates update job when log contains broadcast_payable_update keyword', async () => {
      const prisma = makePrisma({ cctpPayableUpdatesRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, EVM_TESTNET]);
      const connection = makeConnection([
        { signature: 'sig-broadcast', logMessages: ['Program log: Instruction: broadcast_payable_update'] },
      ]);
      const stats = makeStats({ emitted_cctp_update_messages: 1n });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      const createMany = (prisma as any).relayJob.createMany;
      expect(createMany).toHaveBeenCalled();
    });
  });

  describe('CCTP cursor advance when found >= emitted', () => {
    it('advances cctpPaymentsRelayed cursor when found count meets emitted count', async () => {
      const prisma = makePrisma({ cctpPaymentsRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, EVM_TESTNET]);
      // 1 matching tx = found=1 >= emitted=1
      const connection = makeConnection([
        { signature: 'sig-pay', logMessages: ['Program log: UserPaid'] },
      ]);
      const stats = makeStats({ emitted_cctp_payment_messages: 1n });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      expect((prisma as any).chainCursor.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ cctpPaymentsRelayed: 1n }) })
      );
    });

    it('advances cctpPayableUpdatesRelayed cursor when found count meets emitted count', async () => {
      const prisma = makePrisma({ cctpPayableUpdatesRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, EVM_TESTNET]);
      const connection = makeConnection([
        { signature: 'sig-upd', logMessages: ['Program log: PayableUpdateBroadcasted'] },
      ]);
      const stats = makeStats({ emitted_cctp_update_messages: 1n });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      expect((prisma as any).chainCursor.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ cctpPayableUpdatesRelayed: 1n }) })
      );
    });
  });

  describe('dest chain capability filters', () => {
    it('skips Wormhole dest chain that has no wormholeChainId', async () => {
      const destNoWormhole: typeof EVM_TESTNET = { ...EVM_TESTNET, wormholeChainId: undefined as any };
      const prisma = makePrisma({ wormholeRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, destNoWormhole]);
      const connection = makeConnection();
      const stats = makeStats({ published_wormhole_messages: 1n });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      const createMany = (prisma as any).relayJob.createMany;
      expect(createMany).not.toHaveBeenCalled();
    });

    it('skips CCTP payment dest chain that has no circleDomain', async () => {
      const destNoCctp: typeof EVM_TESTNET = { ...EVM_TESTNET, circleDomain: undefined as any };
      const prisma = makePrisma({ cctpPaymentsRelayed: 0n });
      const chains = makeChains([SOLANA_CHAIN, destNoCctp]);
      const connection = makeConnection([
        { signature: 'sig-nodest', logMessages: ['Program log: UserPaid'] },
      ]);
      const stats = makeStats({ emitted_cctp_payment_messages: 1n });

      await detectSolanaRelayTriggers(SOLANA_CHAIN, chains, prisma as any, connection as any, {} as any, stats);

      const createMany = (prisma as any).relayJob.createMany;
      expect(createMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: [expect.objectContaining({ type: 'SOLANA_PAYMENT_VIA_CCTP_WORMHOLE' })] })
      );
    });
  });
});
