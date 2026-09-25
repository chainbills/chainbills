// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — EVM indexer dispatch tests
//
// Covers: each ActivityType dispatches to the correct upsert; cursor advances;
// outbox is enqueued; stop-on-failure keeps cursor at last good position.
// ──────────────────────────────────────────────────────────────────────────────

// vi.mock calls are hoisted by Vitest's transform — they must come before imports.
vi.mock('../../chains/clients', () => ({
  createEvmPublicClient: vi.fn(),
  createEvmWalletClient: vi.fn(),
  evmAccountFromPrivateKey: vi.fn(),
}));

import { createEvmPublicClient } from '../../chains/clients';
import { EvmIndexer } from './evm.indexer';
import type { EvmChainConfig } from '../../chains/types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ChainsService } from '../../chains/chains.service';
import type { AppConfigService } from '../../config/app-config.service';

const CHAIN: EvmChainConfig = {
  slug: 'anvil',
  cbChainId: '0xchainId',
  displayName: 'Anvil',
  caip2: 'eip155:31337',
  network: 'local',
  isEvm: true,
  isSolana: false,
  diamondAddress: '0xdiamond',
  wormholeChainId: undefined,
  circleDomain: undefined,
  pollIntervalMs: 500,
  minGasBalance: 0n,
  viemChain: {} as any,
};

const FAKE_PAYABLE_VIEW = {
  payableId: '0xpayable1',
  info: {
    host: '0x1234567890123456789012345678901234567890',
    chainCount: 1n,
    hostCount: 1n,
    createdAt: 1_000_000n,
    paymentsCount: 0n,
    withdrawalsCount: 0n,
    activitiesCount: 1n,
    allowedTokensAndAmountsCount: 0,
    balancesCount: 0,
    isClosed: false,
    isAutoWithdraw: false,
  },
  allowedTokensAndAmounts: [],
  balances: [],
};

const FAKE_USER_PAYMENT = {
  payableId: '0xpayable1',
  payer: '0x1234567890123456789012345678901234567891',
  token: '0xtoken',
  payableChainId: '0xchainId',
  chainCount: 1n,
  payerCount: 1n,
  timestamp: 1_000_000n,
  requestedAmount: 1000n,
  amount: 1000n,
};

const FAKE_PAYABLE_PAYMENT = {
  payableId: '0xpayable1',
  payer: '0x' + '00'.repeat(12) + 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  token: '0xtoken',
  payerChainId: '0xchainId',
  chainCount: 1n,
  localChainCount: 1n,
  payableCount: 1n,
  timestamp: 1_000_000n,
  requestedAmount: 1000n,
  amount: 900n,
  payerPaymentId: '0xpaymentId',
};

const FAKE_WITHDRAWAL = {
  payableId: '0xpayable1',
  host: '0x1234567890123456789012345678901234567890',
  token: '0x1234567890123456789012345678901234567892',
  chainCount: 1n,
  hostCount: 1n,
  payableCount: 1n,
  timestamp: 1_000_000n,
  amount: 900n,
  fee: 18n,
};

function makeActivityRecord(activityType: number, entity = '0xentity1', chainCount = 1n) {
  return {
    chainCount,
    userCount: 0n,
    payableCount: 0n,
    timestamp: 1_000_000n,
    entity,
    activityType,
  };
}

function makePrismaWithTransaction(): PrismaService & { _txMock: any } {
  const txMock = {
    activity: { upsert: vi.fn().mockResolvedValue({}) },
    payable: { upsert: vi.fn().mockResolvedValue({}) },
    payableAllowedToken: { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({}) },
    payableBalance: { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({}) },
    userPayment: { upsert: vi.fn().mockResolvedValue({}) },
    payablePayment: { upsert: vi.fn().mockResolvedValue({}) },
    withdrawal: { upsert: vi.fn().mockResolvedValue({}) },
    outbox: { upsert: vi.fn().mockResolvedValue({}) },
    wallet: { findUnique: vi.fn().mockResolvedValue(null) },
    chainCursor: { upsert: vi.fn().mockResolvedValue({}) },
  };

  return {
    chainCursor: {
      upsert: vi.fn().mockResolvedValue({ activitiesIndexed: 0n }),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({ wormholeRelayed: 0n }),
    },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      await fn(txMock);
    }),
    _txMock: txMock,
  } as unknown as PrismaService & { _txMock: any };
}

function makeEnv() {
  return {
    chains: {
      enabled: [CHAIN],
      byCbChainId: () => CHAIN,
      getRpcUrl: () => 'http://localhost',
    } as unknown as ChainsService,
    config: {
      env: { emailMaxEventAgeMs: 60 * 60 * 1000, pollIntervalMsOverride: undefined },
    } as unknown as AppConfigService,
  };
}

/** Returns a mock public client whose readContract method returns preset responses by functionName. */
function makeMockClient(responses: Record<string, any>) {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(100n),
    getLogs: vi.fn().mockResolvedValue([]),
    readContract: vi.fn().mockImplementation(async ({ functionName }: any) => {
      const val = responses[functionName];
      if (val instanceof Error) throw val;
      return val ?? null;
    }),
  };
}

describe('EvmIndexer', () => {
  describe('InitializedUser (activityType=0)', () => {
    it('stores Activity row only, no entity upserts', async () => {
      const client = makeMockClient({
        getChainStats: { activitiesCount: 1n },
        getChainActivities: [['0xactId1'], [makeActivityRecord(0, '0xuser1')]],
      });
      vi.mocked(createEvmPublicClient).mockReturnValue(client as any);

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new EvmIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.activity.upsert).toHaveBeenCalledOnce();
      expect(prisma._txMock.payable.upsert).not.toHaveBeenCalled();
      expect(prisma._txMock.userPayment.upsert).not.toHaveBeenCalled();
    });
  });

  describe('CreatedPayable (activityType=1)', () => {
    it('upserts Payable with allowed tokens and balances', async () => {
      const client = makeMockClient({
        getChainStats: { activitiesCount: 1n },
        getChainActivities: [['0xactId2'], [makeActivityRecord(1, '0xpayable1')]],
        getPayableView: FAKE_PAYABLE_VIEW,
      });
      vi.mocked(createEvmPublicClient).mockReturnValue(client as any);

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new EvmIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.payable.upsert).toHaveBeenCalledOnce();
      expect(prisma._txMock.activity.upsert).toHaveBeenCalledOnce();
    });
  });

  describe('UserPaid (activityType=2)', () => {
    it('upserts UserPayment with requestedAmount and amount', async () => {
      const client = makeMockClient({
        getChainStats: { activitiesCount: 1n },
        getChainActivities: [['0xactId3'], [makeActivityRecord(2, '0xpayment1')]],
        getUserPayment: FAKE_USER_PAYMENT,
      });
      vi.mocked(createEvmPublicClient).mockReturnValue(client as any);

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new EvmIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.userPayment.upsert).toHaveBeenCalledOnce();
      const call = prisma._txMock.userPayment.upsert.mock.calls[0][0];
      expect(call.create.requestedAmount).toBe('1000');
      expect(call.create.amount).toBe('1000');
    });
  });

  describe('PayableReceived (activityType=3)', () => {
    it('upserts PayablePayment and refreshes the payable', async () => {
      const client = makeMockClient({
        getChainStats: { activitiesCount: 1n },
        getChainActivities: [['0xactId4'], [makeActivityRecord(3, '0xpp1')]],
        getPayablePayment: FAKE_PAYABLE_PAYMENT,
        getPayableView: FAKE_PAYABLE_VIEW,
      });
      vi.mocked(createEvmPublicClient).mockReturnValue(client as any);

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new EvmIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.payablePayment.upsert).toHaveBeenCalledOnce();
      expect(prisma._txMock.payable.upsert).toHaveBeenCalledOnce();
    });
  });

  describe('Withdrew (activityType=4)', () => {
    it('upserts Withdrawal with amount and fee, refreshes payable', async () => {
      const client = makeMockClient({
        getChainStats: { activitiesCount: 1n },
        getChainActivities: [['0xactId5'], [makeActivityRecord(4, '0xwd1')]],
        getWithdrawal: FAKE_WITHDRAWAL,
        getPayableView: FAKE_PAYABLE_VIEW,
      });
      vi.mocked(createEvmPublicClient).mockReturnValue(client as any);

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new EvmIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.withdrawal.upsert).toHaveBeenCalledOnce();
      const call = prisma._txMock.withdrawal.upsert.mock.calls[0][0];
      expect(call.create.amount).toBe('900');
      expect(call.create.fee).toBe('18');
    });
  });

  describe('Payable state updates (activityType 5-8)', () => {
    for (const type of [5, 6, 7, 8]) {
      it(`activityType=${type} refreshes the payable view`, async () => {
        const client = makeMockClient({
          getChainStats: { activitiesCount: 1n },
          getChainActivities: [['0xactId6'], [makeActivityRecord(type, '0xpayable1')]],
          getPayableView: FAKE_PAYABLE_VIEW,
        });
        vi.mocked(createEvmPublicClient).mockReturnValue(client as any);

        const prisma = makePrismaWithTransaction();
        const { chains, config } = makeEnv();
        const indexer = new EvmIndexer(prisma, chains, config);
        await indexer.tick(CHAIN);

        expect(prisma._txMock.payable.upsert).toHaveBeenCalled();
      });
    }
  });

  describe('stop-on-failure', () => {
    it('stops at the first failed activity; second activity is not processed', async () => {
      let payableViewCallCount = 0;
      const client = {
        getBlockNumber: vi.fn().mockResolvedValue(100n),
        getLogs: vi.fn().mockResolvedValue([]),
        readContract: vi.fn().mockImplementation(async ({ functionName }: any) => {
          if (functionName === 'getChainStats') return { activitiesCount: 2n };
          if (functionName === 'getChainActivities')
            return [
              ['0xact1', '0xact2'],
              [makeActivityRecord(1, '0xpayable1', 1n), makeActivityRecord(1, '0xpayable2', 2n)],
            ];
          if (functionName === 'getPayableView') {
            payableViewCallCount++;
            if (payableViewCallCount === 1) throw new Error('RPC failed on first item');
            return FAKE_PAYABLE_VIEW;
          }
          return null;
        }),
      };
      vi.mocked(createEvmPublicClient).mockReturnValue(client as any);

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new EvmIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      // Only one getPayableView call (the failed one); second activity not reached.
      expect(payableViewCallCount).toBe(1);
      // Cursor inside tx was not updated for chainCount=2.
      const txCursorCalls = prisma._txMock.chainCursor.upsert.mock.calls;
      const withCount2 = txCursorCalls.find((c: any) => c[0]?.update?.activitiesIndexed?.toString() === '2');
      expect(withCount2).toBeUndefined();
    });
  });

  describe('upsertPayable with non-empty allowed tokens and balances', () => {
    it('creates PayableAllowedToken and PayableBalance rows when view has non-empty arrays', async () => {
      const viewWithTokens = {
        ...FAKE_PAYABLE_VIEW,
        allowedTokensAndAmounts: [{ token: '0x1234567890123456789012345678901234567892', amount: 500n }],
        balances: [{ token: '0x1234567890123456789012345678901234567892', amount: 300n }],
      };

      const client = makeMockClient({
        getChainStats: { activitiesCount: 1n },
        getChainActivities: [['0xactId10'], [makeActivityRecord(1, '0xpayable1')]],
        getPayableView: viewWithTokens,
      });
      vi.mocked(createEvmPublicClient).mockReturnValue(client as any);

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new EvmIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.payableAllowedToken.create).toHaveBeenCalledOnce();
      expect(prisma._txMock.payableBalance.create).toHaveBeenCalledOnce();
    });
  });

  describe('relay trigger scan failure is caught', () => {
    it('does not throw when detectRelayTriggers fails', async () => {
      const client = {
        ...makeMockClient({
          getChainStats: { activitiesCount: 0n },
        }),
        getBlockNumber: vi.fn().mockRejectedValue(new Error('RPC down')),
        getLogs: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(createEvmPublicClient).mockReturnValue(client as any);

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new EvmIndexer(prisma, chains, config);

      // Should not throw; errors in detectRelayTriggers are caught.
      await expect(indexer.tick(CHAIN)).resolves.toBeUndefined();
    });
  });

  describe('unknown activity type', () => {
    it('stores Activity only for an unknown type (default case)', async () => {
      const client = makeMockClient({
        getChainStats: { activitiesCount: 1n },
        getChainActivities: [['0xactId99'], [makeActivityRecord(99, '0xentity99')]],
      });
      vi.mocked(createEvmPublicClient).mockReturnValue(client as any);

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new EvmIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.activity.upsert).toHaveBeenCalledOnce();
      // No entity-specific upserts.
      expect(prisma._txMock.payable.upsert).not.toHaveBeenCalled();
    });
  });

  describe('outbox enqueuing', () => {
    it('enqueues outbox row when wallet has verified email and event is recent', async () => {
      // Use a recent timestamp (within maxEventAgeMs) so the age gate doesn't skip it.
      const recentTimestamp = BigInt(Math.floor(Date.now() / 1000));
      const client = makeMockClient({
        getChainStats: { activitiesCount: 1n },
        getChainActivities: [['0xactId11'], [{ ...makeActivityRecord(1, '0xpayable1'), timestamp: recentTimestamp }]],
        getPayableView: FAKE_PAYABLE_VIEW,
      });
      vi.mocked(createEvmPublicClient).mockReturnValue(client as any);

      const prisma = makePrismaWithTransaction();
      // Simulate a wallet with a verified email.
      prisma._txMock.wallet.findUnique = vi.fn().mockResolvedValue({ user: { emailVerifiedAt: new Date() } });

      const { chains } = makeEnv();
      const config = {
        env: { emailMaxEventAgeMs: 24 * 60 * 60 * 1000, pollIntervalMsOverride: undefined },
      } as unknown as AppConfigService;

      const indexer = new EvmIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.outbox.upsert).toHaveBeenCalledOnce();
    });
  });
});
