// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — NonceService unit tests
// ──────────────────────────────────────────────────────────────────────────────

import { NonceService } from './nonce.service';

function makeNonceService() {
  const mockPrisma = {
    authNonce: {
      create: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  };

  const service = new NonceService(mockPrisma as never);
  return { service, mockPrisma };
}

describe('NonceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateNonce', () => {
    it('generates a non-empty nonce', async () => {
      const { service, mockPrisma } = makeNonceService();
      mockPrisma.authNonce.create.mockResolvedValue({});

      const { nonce } = await service.generateNonce();
      expect(nonce).toBeTruthy();
      expect(nonce.length).toBeGreaterThan(8);
    });

    it('generates different nonces each time', async () => {
      const { service, mockPrisma } = makeNonceService();
      mockPrisma.authNonce.create.mockResolvedValue({});

      const a = await service.generateNonce();
      const b = await service.generateNonce();
      expect(a.nonce).not.toBe(b.nonce);
    });

    it('nonce is alphanumeric (base58 uses alphanumeric chars)', async () => {
      const { service, mockPrisma } = makeNonceService();
      mockPrisma.authNonce.create.mockResolvedValue({});

      const { nonce } = await service.generateNonce();
      expect(nonce).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    });

    it('returns an expiresAt ~5 minutes in the future', async () => {
      const { service, mockPrisma } = makeNonceService();
      mockPrisma.authNonce.create.mockResolvedValue({});

      const before = Date.now();
      const { expiresAt } = await service.generateNonce();
      const after = Date.now();

      const ttl = expiresAt.getTime() - before;
      expect(ttl).toBeGreaterThan(4 * 60 * 1_000);
      expect(ttl).toBeLessThan(5 * 60 * 1_000 + (after - before) + 100);
    });

    it('stores the nonce with prisma.authNonce.create', async () => {
      const { service, mockPrisma } = makeNonceService();
      mockPrisma.authNonce.create.mockResolvedValue({});

      const { nonce, expiresAt } = await service.generateNonce();

      expect(mockPrisma.authNonce.create).toHaveBeenCalledWith({
        data: { nonce, expiresAt },
      });
    });

    it('triggers opportunistic cleanup', async () => {
      const { service, mockPrisma } = makeNonceService();
      mockPrisma.authNonce.create.mockResolvedValue({});

      await service.generateNonce();
      // The cleanup runs asynchronously — wait a tick.
      await new Promise((r) => setTimeout(r, 10));

      expect(mockPrisma.authNonce.deleteMany).toHaveBeenCalledOnce();
      const callArg = mockPrisma.authNonce.deleteMany.mock.calls[0][0];
      expect(callArg.where.expiresAt.lt).toBeInstanceOf(Date);
    });
  });

  describe('findNonce', () => {
    it('delegates to prisma', async () => {
      const { service, mockPrisma } = makeNonceService();
      const row = { nonce: 'abc', expiresAt: new Date(), usedAt: null, createdAt: new Date() };
      mockPrisma.authNonce.findUnique.mockResolvedValue(row);

      const result = await service.findNonce('abc');
      expect(result).toBe(row);
      expect(mockPrisma.authNonce.findUnique).toHaveBeenCalledWith({ where: { nonce: 'abc' } });
    });

    it('returns null when not found', async () => {
      const { service, mockPrisma } = makeNonceService();
      mockPrisma.authNonce.findUnique.mockResolvedValue(null);

      const result = await service.findNonce('unknown');
      expect(result).toBeNull();
    });
  });

  describe('markUsed', () => {
    it('updates the nonce row with usedAt', async () => {
      const { service, mockPrisma } = makeNonceService();
      mockPrisma.authNonce.update.mockResolvedValue({});

      await service.markUsed(mockPrisma as never, 'testnonce');

      expect(mockPrisma.authNonce.update).toHaveBeenCalledWith({
        where: { nonce: 'testnonce' },
        data: { usedAt: expect.any(Date) },
      });
    });
  });
});
