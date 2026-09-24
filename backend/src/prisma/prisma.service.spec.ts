// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — PrismaService lifecycle tests
//
// Verifies the Nest lifecycle hooks call PrismaClient's connect/disconnect
// exactly once each, without a live database (both are stubbed on the
// prototype).
// ──────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('connects to Postgres on module init', async () => {
    const connectSpy = vi.spyOn(PrismaClient.prototype, '$connect').mockResolvedValue(undefined);
    const service = new PrismaService();
    await service.onModuleInit();
    expect(connectSpy).toHaveBeenCalledTimes(1);
    connectSpy.mockRestore();
  });

  it('disconnects from Postgres on module destroy', async () => {
    const disconnectSpy = vi.spyOn(PrismaClient.prototype, '$disconnect').mockResolvedValue(undefined);
    const service = new PrismaService();
    await service.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    disconnectSpy.mockRestore();
  });
});
