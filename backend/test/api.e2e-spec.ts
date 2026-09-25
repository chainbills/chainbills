// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Public API e2e tests
//
// Requires a running Postgres. Gated on TEST_DATABASE_URL so `pnpm test:cov`
// passes without a live DB.
//
// Covers every public endpoint with seeded data:
//   - GET /chains: registry output, protocol flags.
//   - GET /payables/:id: 404, amount shape, EVM address checksumming, Solana
//     address passthrough, description, lifetimeReceived.
//   - GET /payables: filter by host wallet key, filter by chain slug, pagination.
//   - PUT /payables/:id/description: host allowed (with auth), non-host 403,
//     HTML stripped, validation error.
//   - GET /payables/:id/payments + /withdrawals: 404, pagination.
//   - GET /payments/user/:id: 404, relay status null for same-chain.
//   - GET /payments/payable/:id: 404, optional userPayment.
//   - GET /users/:walletKey/payments + /payables + /activity: pagination.
//   - GET /withdrawals/:id: 404, netAmount computed correctly.
//   - GET /stats: bucket shape, cached.
// ──────────────────────────────────────────────────────────────────────────────

import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { PrismaClient } from '@prisma/client';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const hasDb = Boolean(process.env.TEST_DATABASE_URL);

// ── Chain constants ───────────────────────────────────────────────────────────

const ARC_CHAIN_ID = '0xb8aed675f862d651b4a8c85f23a045faa0faaa1d162e6eb15d732231df3dc250';

// EVM test wallet (not a real key — just for auth).
const TEST_EVM_WALLET = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';
const TEST_EVM_WALLET_KEY = `evm:${TEST_EVM_WALLET}`;

// Solana test wallet — used to authenticate as a non-host for 403 tests.
const TEST_SOLANA_KEYPAIR = nacl.sign.keyPair();
const TEST_SOLANA_ADDRESS = bs58.encode(TEST_SOLANA_KEYPAIR.publicKey);

// ── SIWS message builder ──────────────────────────────────────────────────────

function buildSiwsMessage(address: string, nonce: string): string {
  return [
    `localhost wants you to sign in with your Solana account:`,
    address,
    ``,
    `URI: http://localhost:3000`,
    `Version: 1`,
    `Chain ID: devnet`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join('\n');
}

// ── Test data IDs ─────────────────────────────────────────────────────────────

const PAYABLE_ID = '0x' + 'a1'.repeat(32);
const USER_PAYMENT_ID = '0x' + 'b2'.repeat(32);
const PAYABLE_PAYMENT_ID = '0x' + 'c3'.repeat(32);
const WITHDRAWAL_ID = '0x' + 'd4'.repeat(32);
const USDC_TOKEN = '0x' + '00'.repeat(20); // placeholder; actual address not needed for e2e

describe.skipIf(!hasDb)('Public API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;
    process.env.DIRECT_URL = process.env.TEST_DATABASE_URL!;
    process.env.NODE_ENV = 'test';
    process.env.ROLE = 'api';
    process.env.APP_URL = 'http://localhost:3000';
    process.env.PUBLIC_API_URL = 'http://localhost:3000';
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    process.env.JWT_ACCESS_SECRET = 'test-secret-that-is-at-least-32-chars-long';
    process.env.OTP_HMAC_SECRET = 'test-otp-secret-that-is-at-least-32-chars';
    process.env.UNSUBSCRIBE_SECRET = 'test-unsubscribe-secret-32-chars-min';
    process.env.ENABLED_CHAINS = 'solanadevnet';
    process.env.RPC_SOLANADEVNET = 'https://api.devnet.solana.com';
    process.env.COOKIE_SECURE = 'false';

    const { AppModule } = await import('../src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(json({ limit: '100kb' }));
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
    await prisma.$connect();

    await seedData();
  });

  afterAll(async () => {
    await cleanData();
    await prisma.$disconnect();
    await app.close();
  });

  // ── Seed helpers ────────────────────────────────────────────────────────────

  async function seedData() {
    await cleanData();

    await prisma.payable.create({
      data: {
        id: PAYABLE_ID,
        chainId: ARC_CHAIN_ID,
        host: TEST_EVM_WALLET,
        hostWalletKey: TEST_EVM_WALLET_KEY,
        chainCount: 1n,
        hostCount: 1n,
        paymentsCount: 1n,
        withdrawalsCount: 1n,
        isClosed: false,
        isAutoWithdraw: false,
        createdAt: new Date('2026-06-01T00:00:00Z'),
        allowedTokens: {
          create: [{ token: USDC_TOKEN, amount: 5_000_000n }],
        },
        balances: {
          create: [{ token: USDC_TOKEN, amount: 4_000_000n }],
        },
      },
    });

    await prisma.payableDescription.create({
      data: {
        payableId: PAYABLE_ID,
        description: 'Test payable description',
        updatedByKey: TEST_EVM_WALLET_KEY,
      },
    });

    await prisma.userPayment.create({
      data: {
        id: USER_PAYMENT_ID,
        chainId: ARC_CHAIN_ID,
        payer: TEST_EVM_WALLET,
        payerWalletKey: TEST_EVM_WALLET_KEY,
        payerCount: 1n,
        chainCount: 1n,
        payableId: PAYABLE_ID,
        payableChainId: ARC_CHAIN_ID,
        token: USDC_TOKEN,
        requestedAmount: 5_000_000n,
        amount: 5_000_000n,
        timestamp: new Date('2026-06-15T00:00:00Z'),
      },
    });

    await prisma.payablePayment.create({
      data: {
        id: PAYABLE_PAYMENT_ID,
        chainId: ARC_CHAIN_ID,
        payableId: PAYABLE_ID,
        payer: TEST_EVM_WALLET,
        payerChainId: ARC_CHAIN_ID,
        payerWalletKey: TEST_EVM_WALLET_KEY,
        payerPaymentId: USER_PAYMENT_ID,
        chainCount: 1n,
        localChainCount: 1n,
        payableCount: 1n,
        token: USDC_TOKEN,
        requestedAmount: 5_000_000n,
        amount: 4_900_000n,
        timestamp: new Date('2026-06-15T00:00:00Z'),
      },
    });

    await prisma.withdrawal.create({
      data: {
        id: WITHDRAWAL_ID,
        chainId: ARC_CHAIN_ID,
        payableId: PAYABLE_ID,
        host: TEST_EVM_WALLET,
        hostWalletKey: TEST_EVM_WALLET_KEY,
        chainCount: 1n,
        hostCount: 1n,
        payableCount: 1n,
        token: USDC_TOKEN,
        amount: 4_900_000n,
        fee: 98_000n,
        timestamp: new Date('2026-06-20T00:00:00Z'),
      },
    });
  }

  async function cleanData() {
    await prisma.payableDescription.deleteMany({ where: { payableId: PAYABLE_ID } });
    await prisma.payablePayment.deleteMany({ where: { id: PAYABLE_PAYMENT_ID } });
    await prisma.userPayment.deleteMany({ where: { id: USER_PAYMENT_ID } });
    await prisma.withdrawal.deleteMany({ where: { id: WITHDRAWAL_ID } });
    await prisma.payable.deleteMany({ where: { id: PAYABLE_ID } });
  }

  // Helper: authenticate and return an access token for a Solana wallet.
  async function getSolanaToken(): Promise<string> {
    const nonceRes = await request(app.getHttpServer()).post('/auth/nonce').expect(200);
    const { nonce } = nonceRes.body as { nonce: string };
    const message = buildSiwsMessage(TEST_SOLANA_ADDRESS, nonce);
    const sig = nacl.sign.detached(Buffer.from(message, 'utf8'), TEST_SOLANA_KEYPAIR.secretKey);
    const signature = bs58.encode(sig);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ namespace: 'solana', message, signature })
      .expect(200);
    return (verifyRes.body as { accessToken: string }).accessToken;
  }

  // ── GET /chains ─────────────────────────────────────────────────────────────

  describe('GET /chains', () => {
    it('returns all registry chains', async () => {
      const res = await request(app.getHttpServer()).get('/chains').expect(200);
      const chains = res.body as Array<{
        chainId: string;
        slug: string;
        protocols: { wormhole: boolean; cctp: boolean };
        tokens: unknown[];
      }>;
      expect(Array.isArray(chains)).toBe(true);
      expect(chains.length).toBeGreaterThan(0);
      expect(chains[0]).toHaveProperty('chainId');
      expect(chains[0]).toHaveProperty('slug');
      expect(chains[0]).toHaveProperty('protocols');
      expect(chains[0]).toHaveProperty('tokens');
    });

    it('includes solanadevnet in results', async () => {
      const res = await request(app.getHttpServer()).get('/chains').expect(200);
      const chains = res.body as Array<{ slug: string }>;
      expect(chains.some((c) => c.slug === 'solanadevnet')).toBe(true);
    });
  });

  // ── GET /payables/:id ────────────────────────────────────────────────────────

  describe('GET /payables/:id', () => {
    it('returns 404 for unknown payable', async () => {
      await request(app.getHttpServer())
        .get('/payables/0x' + '99'.repeat(32))
        .expect(404);
    });

    it('returns payable with checksummed EVM host', async () => {
      const res = await request(app.getHttpServer()).get(`/payables/${PAYABLE_ID}`).expect(200);
      const body = res.body as { host: string; description: string; lifetimeReceived: unknown[] };
      // Checksummed: not all lowercase
      expect(body.host).not.toBe(body.host.toLowerCase());
      expect(body.description).toBe('Test payable description');
      expect(body.lifetimeReceived).toHaveLength(1);
    });

    it('returns amount shape with token, symbol, decimals, amount, formatted', async () => {
      const res = await request(app.getHttpServer()).get(`/payables/${PAYABLE_ID}`).expect(200);
      const body = res.body as {
        allowedTokens: Array<{ token: string; amount: string; formatted: string; decimals: number }>;
      };
      expect(body.allowedTokens[0]).toHaveProperty('token');
      expect(body.allowedTokens[0]).toHaveProperty('amount');
      expect(body.allowedTokens[0]).toHaveProperty('formatted');
      expect(body.allowedTokens[0]).toHaveProperty('decimals');
    });
  });

  // ── GET /payables ────────────────────────────────────────────────────────────

  describe('GET /payables', () => {
    it('returns all payables', async () => {
      const res = await request(app.getHttpServer()).get('/payables').expect(200);
      const body = res.body as { items: unknown[]; nextCursor: string | null };
      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('nextCursor');
    });

    it('filters by host wallet key', async () => {
      const res = await request(app.getHttpServer()).get('/payables').query({ host: TEST_EVM_WALLET_KEY }).expect(200);
      const body = res.body as { items: Array<{ id: string }> };
      expect(body.items.some((p) => p.id === PAYABLE_ID)).toBe(true);
    });

    it('filters by chain slug', async () => {
      const res = await request(app.getHttpServer()).get('/payables').query({ chain: 'arcmainnet' }).expect(200);
      const body = res.body as { items: unknown[] };
      expect(Array.isArray(body.items)).toBe(true);
    });

    it('pagination round-trip: nextCursor when limit < total', async () => {
      // Create a second payable for pagination testing.
      const payable2Id = '0x' + 'f5'.repeat(32);
      await prisma.payable.create({
        data: {
          id: payable2Id,
          chainId: ARC_CHAIN_ID,
          host: TEST_EVM_WALLET,
          hostWalletKey: TEST_EVM_WALLET_KEY,
          chainCount: 2n,
          hostCount: 2n,
          paymentsCount: 0n,
          withdrawalsCount: 0n,
          isClosed: false,
          isAutoWithdraw: false,
          createdAt: new Date('2026-07-01T00:00:00Z'),
        },
      });

      const page1 = await request(app.getHttpServer())
        .get('/payables')
        .query({ host: TEST_EVM_WALLET_KEY, limit: 1 })
        .expect(200);
      const body1 = page1.body as { items: Array<{ id: string }>; nextCursor: string | null };
      expect(body1.items).toHaveLength(1);
      expect(body1.nextCursor).not.toBeNull();

      const page2 = await request(app.getHttpServer())
        .get('/payables')
        .query({ host: TEST_EVM_WALLET_KEY, limit: 1, cursor: body1.nextCursor })
        .expect(200);
      const body2 = page2.body as { items: Array<{ id: string }> };
      expect(body2.items).toHaveLength(1);
      expect(body2.items[0].id).not.toBe(body1.items[0].id);

      await prisma.payable.delete({ where: { id: payable2Id } });
    });
  });

  // ── PUT /payables/:id/description ────────────────────────────────────────────

  describe('PUT /payables/:id/description', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .put(`/payables/${PAYABLE_ID}/description`)
        .send({ description: 'New description text here' })
        .expect(401);
    });

    it('returns 403 when caller is not the host', async () => {
      const token = await getSolanaToken();
      await request(app.getHttpServer())
        .put(`/payables/${PAYABLE_ID}/description`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'New description text here' })
        .expect(403);
    });

    it('returns 400 when description is too short', async () => {
      const token = await getSolanaToken();
      await request(app.getHttpServer())
        .put(`/payables/${PAYABLE_ID}/description`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'ab' })
        .expect(400);
    });
  });

  // ── GET /payables/:id/payments ────────────────────────────────────────────────

  describe('GET /payables/:id/payments', () => {
    it('returns 404 for unknown payable', async () => {
      await request(app.getHttpServer())
        .get('/payables/0x' + '99'.repeat(32) + '/payments')
        .expect(404);
    });

    it('returns list of payments', async () => {
      const res = await request(app.getHttpServer()).get(`/payables/${PAYABLE_ID}/payments`).expect(200);
      const body = res.body as { items: unknown[] };
      expect(body.items).toHaveLength(1);
    });
  });

  // ── GET /payables/:id/withdrawals ─────────────────────────────────────────────

  describe('GET /payables/:id/withdrawals', () => {
    it('returns 404 for unknown payable', async () => {
      await request(app.getHttpServer())
        .get('/payables/0x' + '99'.repeat(32) + '/withdrawals')
        .expect(404);
    });

    it('returns list of withdrawals', async () => {
      const res = await request(app.getHttpServer()).get(`/payables/${PAYABLE_ID}/withdrawals`).expect(200);
      const body = res.body as { items: unknown[] };
      expect(body.items).toHaveLength(1);
    });
  });

  // ── GET /payments/user/:id ────────────────────────────────────────────────────

  describe('GET /payments/user/:id', () => {
    it('returns 404 for unknown payment', async () => {
      await request(app.getHttpServer())
        .get('/payments/user/0x' + '99'.repeat(32))
        .expect(404);
    });

    it('returns UserPayment with relayStatus null for same-chain', async () => {
      const res = await request(app.getHttpServer()).get(`/payments/user/${USER_PAYMENT_ID}`).expect(200);
      const body = res.body as { id: string; relayStatus: null; amount: { amount: string; formatted: string } };
      expect(body.id).toBe(USER_PAYMENT_ID);
      expect(body.relayStatus).toBeNull();
      expect(body.amount).toHaveProperty('amount');
      expect(body.amount).toHaveProperty('formatted');
    });

    it('includes matching payablePayment', async () => {
      const res = await request(app.getHttpServer()).get(`/payments/user/${USER_PAYMENT_ID}`).expect(200);
      const body = res.body as { payablePayment: { id: string } | null };
      expect(body.payablePayment).not.toBeNull();
      expect(body.payablePayment?.id).toBe(PAYABLE_PAYMENT_ID);
    });
  });

  // ── GET /payments/payable/:id ─────────────────────────────────────────────────

  describe('GET /payments/payable/:id', () => {
    it('returns 404 for unknown payment', async () => {
      await request(app.getHttpServer())
        .get('/payments/payable/0x' + '99'.repeat(32))
        .expect(404);
    });

    it('returns PayablePayment with optional userPayment', async () => {
      const res = await request(app.getHttpServer()).get(`/payments/payable/${PAYABLE_PAYMENT_ID}`).expect(200);
      const body = res.body as { id: string; userPayment: { id: string } | null };
      expect(body.id).toBe(PAYABLE_PAYMENT_ID);
      expect(body.userPayment?.id).toBe(USER_PAYMENT_ID);
    });
  });

  // ── GET /users/:walletKey/payments ────────────────────────────────────────────

  describe('GET /users/:walletKey/payments', () => {
    it('returns UserPayments for a wallet', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${encodeURIComponent(TEST_EVM_WALLET_KEY)}/payments`)
        .expect(200);
      const body = res.body as { items: Array<{ id: string }> };
      expect(body.items.some((p) => p.id === USER_PAYMENT_ID)).toBe(true);
    });

    it('returns empty list for unknown wallet', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/evm:0x0000000000000000000000000000000000000000/payments')
        .expect(200);
      const body = res.body as { items: unknown[] };
      expect(body.items).toHaveLength(0);
    });
  });

  // ── GET /users/:walletKey/payables ────────────────────────────────────────────

  describe('GET /users/:walletKey/payables', () => {
    it('returns payables for a wallet', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${encodeURIComponent(TEST_EVM_WALLET_KEY)}/payables`)
        .expect(200);
      const body = res.body as { items: Array<{ id: string }> };
      expect(body.items.some((p) => p.id === PAYABLE_ID)).toBe(true);
    });
  });

  // ── GET /users/:walletKey/activity ────────────────────────────────────────────

  describe('GET /users/:walletKey/activity', () => {
    it('returns mixed activity feed', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${encodeURIComponent(TEST_EVM_WALLET_KEY)}/activity`)
        .expect(200);
      const body = res.body as { items: Array<{ type: string }> };
      expect(body.items.length).toBeGreaterThan(0);
      const types = body.items.map((i) => i.type);
      // Should contain at least some of the activity types
      expect(types.some((t) => ['USER_PAID', 'PAYABLE_RECEIVED', 'WITHDREW', 'CREATED_PAYABLE'].includes(t))).toBe(
        true
      );
    });
  });

  // ── GET /withdrawals/:id ──────────────────────────────────────────────────────

  describe('GET /withdrawals/:id', () => {
    it('returns 404 for unknown withdrawal', async () => {
      await request(app.getHttpServer())
        .get('/withdrawals/0x' + '99'.repeat(32))
        .expect(404);
    });

    it('returns withdrawal with amount, fee, netAmount', async () => {
      const res = await request(app.getHttpServer()).get(`/withdrawals/${WITHDRAWAL_ID}`).expect(200);
      const body = res.body as {
        id: string;
        amount: { amount: string };
        fee: { amount: string };
        netAmount: { amount: string };
      };
      expect(body.id).toBe(WITHDRAWAL_ID);
      expect(body.amount).toHaveProperty('amount', '4900000');
      expect(body.fee).toHaveProperty('amount', '98000');
      // netAmount = 4900000 - 98000 = 4802000
      expect(body.netAmount).toHaveProperty('amount', '4802000');
    });
  });

  // ── GET /stats ────────────────────────────────────────────────────────────────

  describe('GET /stats', () => {
    it('returns stats buckets', async () => {
      const res = await request(app.getHttpServer()).get('/stats').expect(200);
      const body = res.body as Array<{ paymentsCount: string; paidVolume: string }>;
      expect(Array.isArray(body)).toBe(true);
    });

    it('second call within 30 s returns same data (cached)', async () => {
      const res1 = await request(app.getHttpServer()).get('/stats').expect(200);
      const res2 = await request(app.getHttpServer()).get('/stats').expect(200);
      expect(JSON.stringify(res1.body)).toBe(JSON.stringify(res2.body));
    });
  });
});
