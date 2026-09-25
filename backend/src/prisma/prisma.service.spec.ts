// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — PrismaService lifecycle tests
//
// Verifies the Nest lifecycle hooks call PrismaClient's connect/disconnect
// exactly once each, without a live database (both are stubbed on the
// prototype).
// ──────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import type { AppConfigService } from '../config/app-config.service';
import { PrismaService } from './prisma.service';

const configStub = { env: { databaseUrl: 'postgresql://user:pass@localhost:5432/db' } } as AppConfigService;

describe('PrismaService', () => {
  it('connects to Postgres on module init', async () => {
    const connectSpy = vi.spyOn(PrismaClient.prototype, '$connect').mockResolvedValue(undefined);
    const service = new PrismaService(configStub);
    await service.onModuleInit();
    expect(connectSpy).toHaveBeenCalledTimes(1);
    connectSpy.mockRestore();
  });

  it('disconnects from Postgres on module destroy', async () => {
    const disconnectSpy = vi.spyOn(PrismaClient.prototype, '$disconnect').mockResolvedValue(undefined);
    const service = new PrismaService(configStub);
    await service.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    disconnectSpy.mockRestore();
  });
});
