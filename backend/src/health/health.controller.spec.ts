// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — HealthController tests
//
// Covers the /health endpoint: the ok path (Postgres responds), the error
// path (Postgres throws), per-chain staleness, and the HTTP status codes.
// ──────────────────────────────────────────────────────────────────────────────

import type { Response as ExpressResponse } from 'express';
import type { AppConfigService } from '../config/app-config.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ChainsService } from '../chains/chains.service';
import { HealthController } from './health.controller';

function makeRes(): ExpressResponse {
  return { status: vi.fn() } as unknown as ExpressResponse;
}

function makePrisma(succeeds: boolean, lastTickAt: Date | null = null): PrismaService {
  return {
    $queryRaw: succeeds ? vi.fn().mockResolvedValue([{ 1: 1 }]) : vi.fn().mockRejectedValue(new Error('db down')),
    chainCursor: {
      findUnique: vi.fn().mockResolvedValue(lastTickAt !== undefined ? { lastTickAt } : null),
    },
  } as unknown as PrismaService;
}

function makeConfig(role = 'all', pollOverride?: number): AppConfigService {
  return { env: { role, pollIntervalMsOverride: pollOverride } } as unknown as AppConfigService;
}

function makeChains(slugs: string[] = []): ChainsService {
  const chains = slugs.map((slug) => ({
    slug,
    isEvm: true,
    cbChainId: `0x${slug}`,
    pollIntervalMs: 1000,
  }));
  return { enabled: chains } as unknown as ChainsService;
}

describe('HealthController', () => {
  it('returns status=ok and db=ok when Postgres responds and no chains configured', async () => {
    const controller = new HealthController(makePrisma(true), makeConfig(), makeChains());
    const res = makeRes();
    const body = await controller.check(res);
    expect(body.status).toBe('ok');
    expect(body.db).toBe('ok');
    expect(body.role).toBe('all');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns status=error and db=error when Postgres throws', async () => {
    const controller = new HealthController(makePrisma(false), makeConfig('worker'), makeChains());
    const res = makeRes();
    const body = await controller.check(res);
    expect(body.status).toBe('error');
    expect(body.db).toBe('error');
    expect(body.role).toBe('worker');
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('reflects the api role in the response', async () => {
    const controller = new HealthController(makePrisma(true), makeConfig('api'), makeChains());
    const res = makeRes();
    const body = await controller.check(res);
    expect(body.role).toBe('api');
  });

  it('marks a chain as stale when lastTickAt is null', async () => {
    const prisma = makePrisma(true, null);
    const controller = new HealthController(prisma, makeConfig(), makeChains(['anvil']));
    const res = makeRes();
    const body = await controller.check(res);
    expect(body.chains).toBeDefined();
    expect(body.chains![0].stale).toBe(true);
    expect(body.chains![0].slug).toBe('anvil');
    expect(body.status).toBe('error');
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('marks a chain as fresh when lastTickAt is recent', async () => {
    const recent = new Date(Date.now() - 500);
    const prisma = makePrisma(true, recent);
    const controller = new HealthController(prisma, makeConfig(), makeChains(['anvil']));
    const res = makeRes();
    const body = await controller.check(res);
    expect(body.chains![0].stale).toBe(false);
    expect(body.status).toBe('ok');
  });

  it('marks a chain as stale when lastTickAt exceeds 5x poll interval', async () => {
    // poll = 1000ms, threshold = 5000ms; set lastTickAt to 6000ms ago
    const staleTime = new Date(Date.now() - 6000);
    const prisma = makePrisma(true, staleTime);
    const controller = new HealthController(prisma, makeConfig(), makeChains(['anvil']));
    const res = makeRes();
    const body = await controller.check(res);
    expect(body.chains![0].stale).toBe(true);
    expect(body.status).toBe('error');
  });
});
