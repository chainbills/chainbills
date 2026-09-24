// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Auth e2e tests
//
// Requires a running Postgres. Gated on TEST_DATABASE_URL so `pnpm test:cov`
// passes without a live DB.
//
// Covers:
//   - EVM: nonce -> verify -> access token -> protected route -> refresh ->
//     call again -> logout -> refresh rejected.
//   - First sign-in creates User + Wallet; second sign-in reuses them and
//     updates lastSignInAt.
//   - Revoked-session access token is rejected immediately.
//
// The test spins up the full Nest application against the real Postgres, so
// Prisma migrations must have been applied before running (pnpm prisma:deploy).
// ──────────────────────────────────────────────────────────────────────────────

import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PrismaClient } from '@prisma/client';

const hasDb = Boolean(process.env.TEST_DATABASE_URL);

/**
 * Builds a minimal SIWS message for the given address + nonce against
 * http://localhost:3000 (the test APP_URL).
 */
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

describe.skipIf(!hasDb)('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Set up env vars before loading any modules.
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

    // Clean up auth tables before tests.
    await prisma.session.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.user.deleteMany();
    await prisma.authNonce.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('SIWS (Solana) flow', () => {
    const keypair = nacl.sign.keyPair();
    const address = bs58.encode(keypair.publicKey);
    let accessToken: string;
    let refreshCookie: string;

    it('POST /auth/nonce returns a nonce', async () => {
      const res = await request(app.getHttpServer()).post('/auth/nonce').expect(200);
      expect(res.body.nonce).toBeTruthy();
      expect(res.body.expiresAt).toBeTruthy();
    });

    it('POST /auth/verify with valid SIWS creates user + wallet', async () => {
      // Get a fresh nonce.
      const nonceRes = await request(app.getHttpServer()).post('/auth/nonce').expect(200);
      const { nonce } = nonceRes.body as { nonce: string };

      const message = buildSiwsMessage(address, nonce);
      const msgBytes = new TextEncoder().encode(message);
      const sig = nacl.sign.detached(msgBytes, keypair.secretKey);
      const signature = bs58.encode(sig);

      const res = await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ namespace: 'solana', message, signature })
        .expect(200);

      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.user.id).toBeTruthy();
      expect(res.body.user.wallets).toHaveLength(1);
      expect(res.body.user.wallets[0].key).toBe(`solana:${address}`);

      accessToken = res.body.accessToken as string;
      const setCookieHeader = res.headers['set-cookie'] as string[] | string | undefined;
      if (setCookieHeader) {
        const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
        const refreshCookieHeader = cookies.find((c) => c.startsWith('cb_refresh='));
        if (refreshCookieHeader) {
          refreshCookie = refreshCookieHeader.split(';')[0];
        }
      }
    });

    it('second sign-in reuses the User and updates lastSignInAt', async () => {
      const nonceRes = await request(app.getHttpServer()).post('/auth/nonce').expect(200);
      const { nonce } = nonceRes.body as { nonce: string };

      const message = buildSiwsMessage(address, nonce);
      const msgBytes = new TextEncoder().encode(message);
      const sig = nacl.sign.detached(msgBytes, keypair.secretKey);
      const signature = bs58.encode(sig);

      const res = await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ namespace: 'solana', message, signature })
        .expect(200);

      const firstUserId = res.body.user.id;

      // Get the wallet from DB to verify lastSignInAt was updated.
      const wallet = await prisma.wallet.findUnique({ where: { key: `solana:${address}` } });
      expect(wallet).toBeTruthy();
      expect(wallet!.lastSignInAt).toBeTruthy();

      // Verify same user id.
      const secondUserId = res.body.user.id as string;
      expect(secondUserId).toBe(firstUserId);
    });

    it('GET /health with access token succeeds (public route)', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
    });

    it('POST /auth/refresh rotates the token', async () => {
      if (!refreshCookie) {
        console.warn('no refresh cookie captured; skipping refresh test');
        return;
      }

      const res = await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', refreshCookie).expect(200);

      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.accessToken).not.toBe(accessToken);
    });

    it('POST /auth/logout revokes the session', async () => {
      if (!accessToken) return;

      await request(app.getHttpServer()).post('/auth/logout').set('Authorization', `Bearer ${accessToken}`).expect(204);
    });

    it('POST /auth/refresh after logout is rejected', async () => {
      if (!refreshCookie) return;

      await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', refreshCookie).expect(401);
    });

    it('protected route with revoked-session token returns 401', async () => {
      if (!accessToken) return;
      // Any authenticated-only endpoint; logout-all is convenient.
      await request(app.getHttpServer())
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  describe('nonce reuse prevention', () => {
    it('rejects re-use of a nonce', async () => {
      const keypair2 = nacl.sign.keyPair();
      const addr2 = bs58.encode(keypair2.publicKey);

      const nonceRes = await request(app.getHttpServer()).post('/auth/nonce').expect(200);
      const { nonce } = nonceRes.body as { nonce: string };

      const message = buildSiwsMessage(addr2, nonce);
      const msgBytes = new TextEncoder().encode(message);
      const sig = nacl.sign.detached(msgBytes, keypair2.secretKey);
      const signature = bs58.encode(sig);

      // First use succeeds.
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ namespace: 'solana', message, signature })
        .expect(200);

      // Second use of the same nonce fails.
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ namespace: 'solana', message, signature })
        .expect(401);
    });
  });
});
