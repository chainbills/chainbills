// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — HealthController tests
//
// Covers the /health endpoint: the ok path (Postgres responds), the error
// path (Postgres throws), and the HTTP status codes for each case.
// ──────────────────────────────────────────────────────────────────────────────

import type { Response as ExpressResponse } from 'express';
import type { AppConfigService } from '../config/app-config.service';
import type { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

function makeRes(): ExpressResponse {
  return { status: vi.fn() } as unknown as ExpressResponse;
}

function makePrisma(succeeds: boolean): PrismaService {
  return {
    $queryRaw: succeeds ? vi.fn().mockResolvedValue([{ 1: 1 }]) : vi.fn().mockRejectedValue(new Error('db down')),
  } as unknown as PrismaService;
}

function makeConfig(role = 'all'): AppConfigService {
  return { env: { role } } as unknown as AppConfigService;
}

describe('HealthController', () => {
  it('returns status=ok and db=ok when Postgres responds', async () => {
    const controller = new HealthController(makePrisma(true), makeConfig());
    const res = makeRes();
    const body = await controller.check(res);
    expect(body.status).toBe('ok');
    expect(body.db).toBe('ok');
    expect(body.role).toBe('all');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns status=error and db=error when Postgres throws', async () => {
    const controller = new HealthController(makePrisma(false), makeConfig('worker'));
    const res = makeRes();
    const body = await controller.check(res);
    expect(body.status).toBe('error');
    expect(body.db).toBe('error');
    expect(body.role).toBe('worker');
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('reflects the api role in the response', async () => {
    const controller = new HealthController(makePrisma(true), makeConfig('api'));
    const res = makeRes();
    const body = await controller.check(res);
    expect(body.role).toBe('api');
  });
});
