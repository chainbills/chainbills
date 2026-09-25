// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Solana indexer dispatch tests
//
// Covers: Stats PDA missing (early exit), each ActivityType dispatches to the
// correct upsert, cursor advances inside the transaction, outbox is enqueued,
// stop-on-failure keeps cursor at last safe position, relay triggers are skipped
// when relayEnabled is false.
// ──────────────────────────────────────────────────────────────────────────────

// vi.mock calls are hoisted — must come before imports.
vi.mock('./solana.client', () => ({
  makeConnection: vi.fn(),
  makeCoder: vi.fn(),
  decodeAccount: vi.fn(),
  getPDA: vi.fn(),
}));

vi.mock('./solana.accounts', () => ({
  statsPDA: vi.fn().mockReturnValue({ toBase58: () => 'statsPDAAddr' }),
  activityRecordPDA: vi.fn().mockReturnValue({ toBase58: () => 'actRecordAddr' }),
}));

vi.mock('../../relay/solana-trigger.detector', () => ({
  detectSolanaRelayTriggers: vi.fn().mockResolvedValue(undefined),
}));

import { SolanaIndexer } from './solana.indexer';
import { makeConnection, makeCoder, decodeAccount } from './solana.client';
import { detectSolanaRelayTriggers } from '../../relay/solana-trigger.detector';
import type { SolanaChainConfig } from '../../chains/types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ChainsService } from '../../chains/chains.service';
import type { AppConfigService } from '../../config/app-config.service';
import { PublicKey } from '@solana/web3.js';

// A valid 32-byte Solana address to use as a test public key.
const FAKE_PUBKEY = new PublicKey('11111111111111111111111111111111');
const FAKE_PAYABLE_ADDR = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const FAKE_TOKEN_ADDR = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

const CHAIN: SolanaChainConfig = {
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
  relayEnabled: false,
  programId: 'DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk',
  usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  wormholeProgramId: '3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5',
  cctpProgramId: 'CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd',
  wormholeShimProgramId: 'EtZMZM22ViKMo4r5y4Anovs3wKQ2owUmDpjygnMMcdEX',
};

const CHAIN_RELAY_ENABLED: SolanaChainConfig = { ...CHAIN, relayEnabled: true };

/** Returns a mock Solana Connection. */
function makeMockConnection(accountData: Record<string, Buffer | null> = {}) {
  return {
    getAccountInfo: vi.fn().mockImplementation(async (addr: { toBase58: () => string }) => {
      const key = addr.toBase58();
      const data = accountData[key];
      if (data === undefined) return null;
      if (data === null) return null;
      return { data };
    }),
  };
}

/** Returns a decoded account by name for test purposes. */
function makeDecodeAccountImpl(decodedByName: Record<string, unknown>) {
  return (_coder: unknown, accountName: string, _data: Buffer) => {
    if (decodedByName[accountName] !== undefined) return decodedByName[accountName];
    throw new Error(`No mock for account: ${accountName}`);
  };
}

function makePrismaWithTransaction(): PrismaService & { _txMock: any } {
  const txMock = {
    activity: { upsert: vi.fn().mockResolvedValue({}) },
    payable: { upsert: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue(null) },
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
      getRpcUrl: () => 'http://localhost:8899',
    } as unknown as ChainsService,
    config: {
      env: { emailMaxEventAgeMs: 60 * 60 * 1000 },
    } as unknown as AppConfigService,
  };
}

/** Builds a fake ActivityRecord with the given variant. */
function makeActivity(variant: string, entityPubkey = FAKE_PAYABLE_ADDR) {
  return {
    activity_type: { [variant]: {} },
    entity: entityPubkey,
    created_at: BigInt(Math.floor(Date.now() / 1000)),
    chain_count: 1n,
    user_count: 0n,
    payable_count: 0n,
  };
}

/** Builds a fake Payable account. */
function makePayableAccount() {
  return {
    host: FAKE_PUBKEY,
    chain_count: 1n,
    host_count: 1n,
    payments_count: 0n,
    withdrawals_count: 0n,
    is_closed: false,
    is_auto_withdraw: false,
    created_at: BigInt(Math.floor(Date.now() / 1000)),
    allowed_tokens_and_amounts: [],
    balances: [],
  };
}

/** Builds a fake Stats account. */
function makeStats(totalActivities = 1) {
  return {
    total_activities: BigInt(totalActivities),
    published_wormhole_messages: 0n,
    emitted_cctp_payment_messages: 0n,
    emitted_cctp_update_messages: 0n,
  };
}

describe('SolanaIndexer', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Stats PDA missing', () => {
    it('exits early and updates lastTickAt when Stats PDA is not found', async () => {
      const connection = { getAccountInfo: vi.fn().mockResolvedValue(null) };
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      // Should still update lastTickAt.
      // The upsert call has create/update/where shape (not a flat data shape).
      expect((prisma.chainCursor as any).upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ lastTickAt: expect.any(Date) }),
        })
      );
      // Should not start a transaction.
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('userInitialized activity', () => {
    it('stores Activity row only — no entity upserts', async () => {
      const statsData = Buffer.from('stats');
      const actData = Buffer.from('act');
      const connection = makeMockConnection({
        statsPDAAddr: statsData,
        actRecordAddr: actData,
      });
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);
      vi.mocked(decodeAccount).mockImplementation(
        makeDecodeAccountImpl({
          Stats: makeStats(1),
          ActivityRecord: makeActivity('userInitialized'),
        }) as any
      );

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.activity.upsert).toHaveBeenCalledOnce();
      expect(prisma._txMock.payable.upsert).not.toHaveBeenCalled();
      expect(prisma._txMock.userPayment.upsert).not.toHaveBeenCalled();
    });
  });

  describe('createdPayable activity', () => {
    it('upserts Payable with host wallet key set to solana: prefix', async () => {
      const statsData = Buffer.from('stats');
      const actData = Buffer.from('act');
      const payableData = Buffer.from('payable');
      const connection = makeMockConnection({
        statsPDAAddr: statsData,
        actRecordAddr: actData,
        [FAKE_PAYABLE_ADDR.toBase58()]: payableData,
      });
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);
      vi.mocked(decodeAccount).mockImplementation(
        makeDecodeAccountImpl({
          Stats: makeStats(1),
          ActivityRecord: makeActivity('createdPayable', FAKE_PAYABLE_ADDR),
          Payable: makePayableAccount(),
        }) as any
      );

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.payable.upsert).toHaveBeenCalledOnce();
      const call = prisma._txMock.payable.upsert.mock.calls[0][0];
      // Host wallet key must use solana: namespace.
      expect(call.create.hostWalletKey).toMatch(/^solana:/);
    });
  });

  describe('userPaid activity', () => {
    it('upserts UserPayment with requestedAmount equal to amount (Solana has single amount field)', async () => {
      const userPaymentAddr = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      const statsData = Buffer.from('stats');
      const actData = Buffer.from('act');
      const paymentData = Buffer.from('payment');
      const connection = makeMockConnection({
        statsPDAAddr: statsData,
        actRecordAddr: actData,
        [userPaymentAddr.toBase58()]: paymentData,
      });
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);

      const fakePayment = {
        payer: FAKE_PUBKEY,
        payer_count: 1n,
        chain_count: 1n,
        payable: FAKE_PAYABLE_ADDR,
        payable_chain_id: Array(32).fill(0),
        token_mint: FAKE_TOKEN_ADDR,
        amount: 1_000_000n,
        created_at: BigInt(Math.floor(Date.now() / 1000)),
      };

      vi.mocked(decodeAccount).mockImplementation(
        makeDecodeAccountImpl({
          Stats: makeStats(1),
          ActivityRecord: makeActivity('userPaid', userPaymentAddr),
          UserPayment: fakePayment,
        }) as any
      );

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.userPayment.upsert).toHaveBeenCalledOnce();
      const call = prisma._txMock.userPayment.upsert.mock.calls[0][0];
      expect(call.create.requestedAmount).toBe('1000000');
      expect(call.create.amount).toBe('1000000');
      // Payer wallet key must use solana: prefix.
      expect(call.create.payerWalletKey).toMatch(/^solana:/);
    });
  });

  describe('withdrew activity', () => {
    it('upserts Withdrawal with fee=0 (Solana does not expose fee field) and refreshes payable', async () => {
      const withdrawalAddr = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
      const statsData = Buffer.from('stats');
      const actData = Buffer.from('act');
      const wdlData = Buffer.from('wdl');
      const payableData = Buffer.from('payable');
      const connection = makeMockConnection({
        statsPDAAddr: statsData,
        actRecordAddr: actData,
        [withdrawalAddr.toBase58()]: wdlData,
        [FAKE_PAYABLE_ADDR.toBase58()]: payableData,
      });
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);

      const fakeWithdrawal = {
        host: FAKE_PUBKEY,
        payable: FAKE_PAYABLE_ADDR,
        chain_count: 1n,
        host_count: 1n,
        payable_count: 1n,
        token_mint: FAKE_TOKEN_ADDR,
        amount: 980_000n,
        created_at: BigInt(Math.floor(Date.now() / 1000)),
      };

      vi.mocked(decodeAccount).mockImplementation(
        makeDecodeAccountImpl({
          Stats: makeStats(1),
          ActivityRecord: makeActivity('withdrew', withdrawalAddr),
          Withdrawal: fakeWithdrawal,
          Payable: makePayableAccount(),
        }) as any
      );

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.withdrawal.upsert).toHaveBeenCalledOnce();
      const call = prisma._txMock.withdrawal.upsert.mock.calls[0][0];
      expect(call.create.fee).toBe('0');
      expect(call.create.amount).toBe('980000');
      // Should also refresh the payable.
      expect(prisma._txMock.payable.upsert).toHaveBeenCalledOnce();
    });
  });

  describe('stop-on-failure', () => {
    it('stops at the first failed activity; subsequent activities are not processed', async () => {
      const statsData = Buffer.from('stats');
      let callCount = 0;
      const connection = {
        getAccountInfo: vi.fn().mockImplementation(async (addr: any) => {
          const key = addr.toBase58 ? addr.toBase58() : String(addr);
          if (key === 'statsPDAAddr') return { data: statsData };
          if (key === 'actRecordAddr') return { data: Buffer.from('act') };
          return null; // Payable not found -> will throw
        }),
      };
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);
      vi.mocked(decodeAccount).mockImplementation((_coder, accountName) => {
        if (accountName === 'Stats') return makeStats(2) as any;
        if (accountName === 'ActivityRecord') {
          callCount++;
          if (callCount === 1) return makeActivity('createdPayable', FAKE_PAYABLE_ADDR) as any;
          return makeActivity('createdPayable', FAKE_PAYABLE_ADDR) as any;
        }
        throw new Error('Payable account not found');
      });

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      // Should only process one activity (first fails, loop breaks).
      // The Activity row should not have been written since the tx rolls back on failure.
      // But cursor should not advance to index 2.
      const upsertCalls = prisma._txMock.chainCursor.upsert.mock.calls;
      const advancedTo2 = upsertCalls.find((c: any) => {
        const v = c[0]?.create?.activitiesIndexed ?? c[0]?.update?.activitiesIndexed;
        return v === 2n || v?.toString() === '2';
      });
      expect(advancedTo2).toBeUndefined();
    });
  });

  describe('relayEnabled gate', () => {
    it('does not call detectSolanaRelayTriggers when relayEnabled is false', async () => {
      const statsData = Buffer.from('stats');
      const connection = { getAccountInfo: vi.fn().mockResolvedValue({ data: statsData }) };
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);
      vi.mocked(decodeAccount).mockReturnValue(makeStats(0) as any);

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN); // relayEnabled: false

      expect(detectSolanaRelayTriggers).not.toHaveBeenCalled();
    });

    it('calls detectSolanaRelayTriggers when relayEnabled is true', async () => {
      const statsData = Buffer.from('stats');
      const connection = { getAccountInfo: vi.fn().mockResolvedValue({ data: statsData }) };
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);
      vi.mocked(decodeAccount).mockReturnValue(makeStats(0) as any);

      const prisma = makePrismaWithTransaction();
      const chains = {
        ...makeEnv().chains,
        enabled: [CHAIN_RELAY_ENABLED],
      };
      const { config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains as any, config);
      await indexer.tick(CHAIN_RELAY_ENABLED);

      expect(detectSolanaRelayTriggers).toHaveBeenCalledOnce();
    });
  });

  describe('payableReceived activity', () => {
    it('upserts PayablePayment and refreshes the payable', async () => {
      const ppAddr = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const statsData = Buffer.from('stats');
      const actData = Buffer.from('act');
      const ppData = Buffer.from('pp');
      const payableData = Buffer.from('payable');
      const connection = makeMockConnection({
        statsPDAAddr: statsData,
        actRecordAddr: actData,
        [ppAddr.toBase58()]: ppData,
        [FAKE_PAYABLE_ADDR.toBase58()]: payableData,
      });
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);

      const fakePP = {
        payable: FAKE_PAYABLE_ADDR,
        payer: Array(32).fill(0),
        payer_chain_id: Array(32).fill(0),
        chain_count: 1n,
        local_chain_count: 1n,
        payable_count: 1n,
        token_mint: FAKE_TOKEN_ADDR,
        amount: 500_000n,
        created_at: BigInt(Math.floor(Date.now() / 1000)),
        payerPaymentId: ppAddr.toBase58(),
      };

      vi.mocked(decodeAccount).mockImplementation(
        makeDecodeAccountImpl({
          Stats: makeStats(1),
          ActivityRecord: makeActivity('payableReceived', ppAddr),
          PayablePayment: fakePP,
          Payable: makePayableAccount(),
        }) as any
      );

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.payablePayment.upsert).toHaveBeenCalledOnce();
      expect(prisma._txMock.payable.upsert).toHaveBeenCalledOnce();
    });
  });

  describe('closedPayable / reopenedPayable activities', () => {
    for (const variant of ['closedPayable', 'reopenedPayable', 'updatedPayableAtaa', 'updatedAutoWithdraw']) {
      it(`${variant} refreshes the payable view`, async () => {
        const statsData = Buffer.from('stats');
        const actData = Buffer.from('act');
        const payableData = Buffer.from('payable');
        const connection = makeMockConnection({
          statsPDAAddr: statsData,
          actRecordAddr: actData,
          [FAKE_PAYABLE_ADDR.toBase58()]: payableData,
        });
        vi.mocked(makeConnection).mockReturnValue(connection as any);
        vi.mocked(makeCoder).mockReturnValue({} as any);
        vi.mocked(decodeAccount).mockImplementation(
          makeDecodeAccountImpl({
            Stats: makeStats(1),
            ActivityRecord: makeActivity(variant, FAKE_PAYABLE_ADDR),
            Payable: makePayableAccount(),
          }) as any
        );

        const prisma = makePrismaWithTransaction();
        const { chains, config } = makeEnv();
        const indexer = new SolanaIndexer(prisma, chains, config);
        await indexer.tick(CHAIN);

        expect(prisma._txMock.payable.upsert).toHaveBeenCalledOnce();
      });
    }
  });

  describe('createdPayable with non-empty allowed tokens and balances', () => {
    it('creates PayableAllowedToken and PayableBalance rows when payable has non-empty arrays', async () => {
      const statsData = Buffer.from('stats');
      const actData = Buffer.from('act');
      const payableData = Buffer.from('payable');
      const connection = makeMockConnection({
        statsPDAAddr: statsData,
        actRecordAddr: actData,
        [FAKE_PAYABLE_ADDR.toBase58()]: payableData,
      });
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);

      const payableWithTokens = {
        ...makePayableAccount(),
        allowed_tokens_and_amounts: [{ token_mint: FAKE_TOKEN_ADDR, amount: 1_000_000n }],
        balances: [{ token_mint: FAKE_TOKEN_ADDR, amount: 500_000n }],
      };

      vi.mocked(decodeAccount).mockImplementation(
        makeDecodeAccountImpl({
          Stats: makeStats(1),
          ActivityRecord: makeActivity('createdPayable', FAKE_PAYABLE_ADDR),
          Payable: payableWithTokens,
        }) as any
      );

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.payableAllowedToken.create).toHaveBeenCalledOnce();
      expect(prisma._txMock.payableBalance.create).toHaveBeenCalledOnce();
    });
  });

  describe('paidForeignPayable activity (maps to USER_PAID)', () => {
    it('upserts UserPayment with solana: wallet key prefix', async () => {
      const userPaymentAddr = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const statsData = Buffer.from('stats');
      const actData = Buffer.from('act');
      const paymentData = Buffer.from('payment');
      const connection = makeMockConnection({
        statsPDAAddr: statsData,
        actRecordAddr: actData,
        [userPaymentAddr.toBase58()]: paymentData,
      });
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);

      const fakePayment = {
        payer: FAKE_PUBKEY,
        payer_count: 1n,
        chain_count: 1n,
        payable: FAKE_PAYABLE_ADDR,
        payable_chain_id: Array(32).fill(0),
        token_mint: FAKE_TOKEN_ADDR,
        amount: 2_000_000n,
        created_at: BigInt(Math.floor(Date.now() / 1000)),
      };

      vi.mocked(decodeAccount).mockImplementation(
        makeDecodeAccountImpl({
          Stats: makeStats(1),
          ActivityRecord: makeActivity('paidForeignPayable', userPaymentAddr),
          UserPayment: fakePayment,
        }) as any
      );

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.userPayment.upsert).toHaveBeenCalledOnce();
      const call = prisma._txMock.userPayment.upsert.mock.calls[0][0];
      expect(call.create.payerWalletKey).toMatch(/^solana:/);
    });
  });

  describe('foreignPaymentReceived activity (maps to PAYABLE_RECEIVED)', () => {
    it('upserts PayablePayment for cross-chain payment from EVM (payer from EVM chain)', async () => {
      const ppAddr = new PublicKey('9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E');
      const statsData = Buffer.from('stats');
      const actData = Buffer.from('act');
      const ppData = Buffer.from('pp');
      const payableData = Buffer.from('payable');
      const connection = makeMockConnection({
        statsPDAAddr: statsData,
        actRecordAddr: actData,
        [ppAddr.toBase58()]: ppData,
        [FAKE_PAYABLE_ADDR.toBase58()]: payableData,
      });
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);

      // EVM chain id for payer (last 20 bytes will be extracted).
      const evmChainIdBytes = Buffer.from('318e51c37247d03bad135571413b06a083591bcc680967d80bf587ac928cf369', 'hex');

      const fakePP = {
        payable: FAKE_PAYABLE_ADDR,
        payer: Array(32).fill(0xaa), // 32 zero bytes = EVM address: last 20 bytes
        payer_chain_id: Array.from(evmChainIdBytes),
        chain_count: 2n,
        local_chain_count: 1n,
        payable_count: 1n,
        token_mint: FAKE_TOKEN_ADDR,
        amount: 990_000n,
        created_at: BigInt(Math.floor(Date.now() / 1000)),
        payerPaymentId: ppAddr.toBase58(),
      };

      const evmChains = {
        ...makeEnv().chains,
        byCbChainId: () =>
          ({
            isEvm: true,
            isSolana: false,
            cbChainId: '0x' + evmChainIdBytes.toString('hex'),
          }) as any,
      } as any;

      vi.mocked(decodeAccount).mockImplementation(
        makeDecodeAccountImpl({
          Stats: makeStats(1),
          ActivityRecord: makeActivity('foreignPaymentReceived', ppAddr),
          PayablePayment: fakePP,
          Payable: makePayableAccount(),
        }) as any
      );

      const prisma = makePrismaWithTransaction();
      const { config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, evmChains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.payablePayment.upsert).toHaveBeenCalledOnce();
    });
  });

  describe('outbox enqueue', () => {
    it('enqueues PAYABLE_CREATED when wallet has verified email and event is recent', async () => {
      const statsData = Buffer.from('stats');
      const actData = Buffer.from('act');
      const payableData = Buffer.from('payable');
      const connection = makeMockConnection({
        statsPDAAddr: statsData,
        actRecordAddr: actData,
        [FAKE_PAYABLE_ADDR.toBase58()]: payableData,
      });
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);
      vi.mocked(decodeAccount).mockImplementation(
        makeDecodeAccountImpl({
          Stats: makeStats(1),
          ActivityRecord: makeActivity('createdPayable', FAKE_PAYABLE_ADDR),
          Payable: makePayableAccount(),
        }) as any
      );

      const prisma = makePrismaWithTransaction();
      // Simulate wallet with verified email.
      prisma._txMock.wallet.findUnique = vi.fn().mockResolvedValue({ user: { emailVerifiedAt: new Date() } });
      // upsertPayable findUnique returns host wallet key.
      prisma._txMock.payable.findUnique = vi
        .fn()
        .mockResolvedValue({ hostWalletKey: `solana:${FAKE_PUBKEY.toBase58()}` });

      const { chains } = makeEnv();
      const config = {
        env: { emailMaxEventAgeMs: 24 * 60 * 60 * 1000 },
      } as unknown as AppConfigService;

      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.outbox.upsert).toHaveBeenCalledOnce();
    });
  });

  describe('Stats decode failure', () => {
    it('exits early when Stats PDA decoding fails', async () => {
      const statsData = Buffer.from('stats');
      const connection = { getAccountInfo: vi.fn().mockResolvedValue({ data: statsData }) };
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);
      vi.mocked(decodeAccount).mockImplementation(() => {
        throw new Error('Decode failed');
      });

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);

      // Should not throw; exits early.
      await expect(indexer.tick(CHAIN)).resolves.toBeUndefined();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('UserPayment with null optional fields', () => {
    it('falls back to 0 when optional count fields are null/undefined', async () => {
      const userPaymentAddr = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const statsData = Buffer.from('stats');
      const actData = Buffer.from('act');
      const paymentData = Buffer.from('payment');
      const connection = makeMockConnection({
        statsPDAAddr: statsData,
        actRecordAddr: actData,
        [userPaymentAddr.toBase58()]: paymentData,
      });
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);

      const fakePaymentNullFields = {
        payer: FAKE_PUBKEY,
        payer_count: undefined,
        chain_count: null,
        payable: FAKE_PAYABLE_ADDR,
        payable_chain_id: Array(32).fill(0),
        token_mint: FAKE_TOKEN_ADDR,
        amount: undefined,
        created_at: BigInt(Math.floor(Date.now() / 1000)),
      };

      vi.mocked(decodeAccount).mockImplementation(
        makeDecodeAccountImpl({
          Stats: makeStats(1),
          ActivityRecord: makeActivity('userPaid', userPaymentAddr),
          UserPayment: fakePaymentNullFields,
        }) as any
      );

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.userPayment.upsert).toHaveBeenCalledOnce();
      const call = prisma._txMock.userPayment.upsert.mock.calls[0][0];
      expect(call.create.payerCount).toBe(0n);
      expect(call.create.amount).toBe('0');
    });
  });

  describe('Withdrawal with null optional fields', () => {
    it('falls back to 0 when optional count fields are null/undefined', async () => {
      const withdrawalAddr = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
      const statsData = Buffer.from('stats');
      const actData = Buffer.from('act');
      const wdlData = Buffer.from('wdl');
      const payableData = Buffer.from('payable');
      const connection = makeMockConnection({
        statsPDAAddr: statsData,
        actRecordAddr: actData,
        [withdrawalAddr.toBase58()]: wdlData,
        [FAKE_PAYABLE_ADDR.toBase58()]: payableData,
      });
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);

      const fakeWdlNullFields = {
        host: FAKE_PUBKEY,
        payable: FAKE_PAYABLE_ADDR,
        chain_count: null,
        host_count: undefined,
        payable_count: null,
        token_mint: FAKE_TOKEN_ADDR,
        amount: undefined,
        created_at: BigInt(Math.floor(Date.now() / 1000)),
      };

      vi.mocked(decodeAccount).mockImplementation(
        makeDecodeAccountImpl({
          Stats: makeStats(1),
          ActivityRecord: makeActivity('withdrew', withdrawalAddr),
          Withdrawal: fakeWdlNullFields,
          Payable: makePayableAccount(),
        }) as any
      );

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.withdrawal.upsert).toHaveBeenCalledOnce();
      const call = prisma._txMock.withdrawal.upsert.mock.calls[0][0];
      expect(call.create.chainCount).toBe(0n);
      expect(call.create.amount).toBe('0');
    });
  });

  describe('relay trigger detection error is caught', () => {
    it('does not throw when detectSolanaRelayTriggers fails', async () => {
      const statsData = Buffer.from('stats');
      const connection = { getAccountInfo: vi.fn().mockResolvedValue({ data: statsData }) };
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);
      vi.mocked(decodeAccount).mockReturnValue(makeStats(0) as any);
      vi.mocked(detectSolanaRelayTriggers).mockRejectedValue(new Error('RPC error'));

      const prisma = makePrismaWithTransaction();
      const chains = {
        ...makeEnv().chains,
        enabled: [CHAIN_RELAY_ENABLED],
      };
      const { config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains as any, config);

      // Should not throw.
      await expect(indexer.tick(CHAIN_RELAY_ENABLED)).resolves.toBeUndefined();
    });
  });

  describe('unknown activity type', () => {
    it('stores Activity only for unknown variant, no entity upserts', async () => {
      const statsData = Buffer.from('stats');
      const actData = Buffer.from('act');
      const connection = makeMockConnection({
        statsPDAAddr: statsData,
        actRecordAddr: actData,
      });
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);
      vi.mocked(decodeAccount).mockImplementation(
        makeDecodeAccountImpl({
          Stats: makeStats(1),
          ActivityRecord: makeActivity('unknownVariant2099'),
        }) as any
      );

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.activity.upsert).toHaveBeenCalledOnce();
      expect(prisma._txMock.payable.upsert).not.toHaveBeenCalled();
    });
  });

  describe('payablePayment without hostWalletKey found', () => {
    it('does not enqueue outbox when payable has no host wallet key', async () => {
      const ppAddr = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const statsData = Buffer.from('stats');
      const actData = Buffer.from('act');
      const ppData = Buffer.from('pp');
      const payableData = Buffer.from('payable');
      const connection = makeMockConnection({
        statsPDAAddr: statsData,
        actRecordAddr: actData,
        [ppAddr.toBase58()]: ppData,
        [FAKE_PAYABLE_ADDR.toBase58()]: payableData,
      });
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);

      const fakePP = {
        payable: FAKE_PAYABLE_ADDR,
        payer: Array(32).fill(0),
        payer_chain_id: Array(32).fill(0),
        chain_count: 1n,
        local_chain_count: 1n,
        payable_count: 1n,
        token_mint: FAKE_TOKEN_ADDR,
        amount: 500_000n,
        created_at: BigInt(Math.floor(Date.now() / 1000)),
        payerPaymentId: ppAddr.toBase58(),
      };

      vi.mocked(decodeAccount).mockImplementation(
        makeDecodeAccountImpl({
          Stats: makeStats(1),
          ActivityRecord: makeActivity('payableReceived', ppAddr),
          PayablePayment: fakePP,
          Payable: makePayableAccount(),
        }) as any
      );

      const prisma = makePrismaWithTransaction();
      // Return null from findUnique so hostWalletKey is undefined.
      prisma._txMock.payable.findUnique = vi.fn().mockResolvedValue(null);

      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      // outbox should not be enqueued when no host wallet key.
      expect(prisma._txMock.outbox.upsert).not.toHaveBeenCalled();
    });
  });

  describe('upsertPayable with null/undefined optional fields', () => {
    it('falls back to 0 when count fields are undefined/null in the decoded payable', async () => {
      const statsData = Buffer.from('stats');
      const actData = Buffer.from('act');
      const payableData = Buffer.from('payable');
      const connection = makeMockConnection({
        statsPDAAddr: statsData,
        actRecordAddr: actData,
        [FAKE_PAYABLE_ADDR.toBase58()]: payableData,
      });
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);

      // All optional count fields as undefined — tests the ?? '0' branches.
      const payableWithNullFields = {
        host: FAKE_PUBKEY,
        chain_count: undefined,
        host_count: null,
        payments_count: undefined,
        withdrawals_count: null,
        is_closed: undefined,
        is_auto_withdraw: null,
        created_at: BigInt(Math.floor(Date.now() / 1000)),
        allowed_tokens_and_amounts: undefined,
        balances: null,
      };

      vi.mocked(decodeAccount).mockImplementation(
        makeDecodeAccountImpl({
          Stats: makeStats(1),
          ActivityRecord: makeActivity('createdPayable', FAKE_PAYABLE_ADDR),
          Payable: payableWithNullFields,
        }) as any
      );

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      expect(prisma._txMock.payable.upsert).toHaveBeenCalledOnce();
      const call = prisma._txMock.payable.upsert.mock.calls[0][0];
      // All counts should fall back to 0n.
      expect(call.create.chainCount).toBe(0n);
      expect(call.create.isClosed).toBe(false);
      expect(call.create.isAutoWithdraw).toBe(false);
    });
  });

  describe('cursor advance', () => {
    it('advances cursor to globalIndex+1 inside the transaction after each activity', async () => {
      const statsData = Buffer.from('stats');
      const actData = Buffer.from('act');
      const connection = makeMockConnection({
        statsPDAAddr: statsData,
        actRecordAddr: actData,
      });
      vi.mocked(makeConnection).mockReturnValue(connection as any);
      vi.mocked(makeCoder).mockReturnValue({} as any);
      vi.mocked(decodeAccount).mockImplementation(
        makeDecodeAccountImpl({
          Stats: makeStats(1),
          ActivityRecord: makeActivity('userInitialized'),
        }) as any
      );

      const prisma = makePrismaWithTransaction();
      const { chains, config } = makeEnv();
      const indexer = new SolanaIndexer(prisma, chains, config);
      await indexer.tick(CHAIN);

      const upsertCalls = prisma._txMock.chainCursor.upsert.mock.calls;
      // The cursor should advance to 1 (0 + 1) after the first activity.
      const advancedTo1 = upsertCalls.find((c: any) => {
        const v = c[0]?.create?.activitiesIndexed ?? c[0]?.update?.activitiesIndexed;
        return v === 1n;
      });
      expect(advancedTo1).toBeDefined();
    });
  });
});
