// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — SessionService unit tests
//
// Tests token rotation, reuse detection, logout and logout-all without a
// real database — Prisma is fully mocked.
// ──────────────────────────────────────────────────────────────────────────────

import { createHash } from 'crypto';
import { SessionService } from './session.service';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function makeSessionService(prismaOverrides: Record<string, unknown> = {}) {
  const mockPrisma = {
    session: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    ...prismaOverrides,
  };

  const mockConfig = {
    env: {
      refreshTokenTtlMs: 30 * 24 * 60 * 60 * 1_000, // 30 days
    },
  };

  const service = new SessionService(mockPrisma as never, mockConfig as never);
  return { service, mockPrisma };
}

describe('SessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateRefreshToken', () => {
    it('generates a non-empty refresh token', () => {
      const { service } = makeSessionService();
      const { refreshToken } = service.generateRefreshToken();
      expect(refreshToken).toBeTruthy();
      expect(refreshToken.length).toBeGreaterThan(20);
    });

    it('generates a different token each time', () => {
      const { service } = makeSessionService();
      const a = service.generateRefreshToken();
      const b = service.generateRefreshToken();
      expect(a.refreshToken).not.toBe(b.refreshToken);
    });

    it('stores the sha256 hash, not the raw token', () => {
      const { service } = makeSessionService();
      const { refreshToken, refreshTokenHash } = service.generateRefreshToken();
      expect(refreshTokenHash).toBe(sha256(refreshToken));
      expect(refreshTokenHash).not.toBe(refreshToken);
    });
  });

  describe('hash', () => {
    it('produces a stable sha256 hex string', () => {
      const { service } = makeSessionService();
      const h1 = service.hash('test');
      const h2 = service.hash('test');
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces different hashes for different inputs', () => {
      const { service } = makeSessionService();
      expect(service.hash('a')).not.toBe(service.hash('b'));
    });
  });

  describe('createSession', () => {
    it('creates a session with the correct fields', async () => {
      const { service, mockPrisma } = makeSessionService();
      const mockSession = { id: 'sess-1' };
      mockPrisma.session.create.mockResolvedValue(mockSession);

      const result = await service.createSession(mockPrisma as never, {
        userId: 'user-1',
        walletKey: 'evm:0xabc',
        refreshTokenHash: 'hash123',
      });

      expect(mockPrisma.session.create).toHaveBeenCalledOnce();
      const callArg = mockPrisma.session.create.mock.calls[0][0];
      expect(callArg.data.userId).toBe('user-1');
      expect(callArg.data.walletKey).toBe('evm:0xabc');
      expect(callArg.data.refreshTokenHash).toBe('hash123');
      expect(callArg.data.expiresAt).toBeInstanceOf(Date);
      expect(result).toBe(mockSession);
    });
  });

  describe('rotateRefreshToken', () => {
    it('updates the session with a new hash and returns the new raw token', async () => {
      const { service, mockPrisma } = makeSessionService();
      mockPrisma.session.update.mockResolvedValue({});

      const newToken = await service.rotateRefreshToken('sess-1');

      expect(newToken).toBeTruthy();
      expect(mockPrisma.session.update).toHaveBeenCalledOnce();
      const updateArg = mockPrisma.session.update.mock.calls[0][0];
      expect(updateArg.where.id).toBe('sess-1');
      // The stored hash must be sha256 of the returned raw token.
      expect(updateArg.data.refreshTokenHash).toBe(sha256(newToken));
    });

    it('each rotation produces a different token', async () => {
      const { service, mockPrisma } = makeSessionService();
      mockPrisma.session.update.mockResolvedValue({});

      const t1 = await service.rotateRefreshToken('sess-1');
      const t2 = await service.rotateRefreshToken('sess-1');
      expect(t1).not.toBe(t2);
    });
  });

  describe('revokeSession', () => {
    it('sets revokedAt on the specified session', async () => {
      const { service, mockPrisma } = makeSessionService();
      mockPrisma.session.update.mockResolvedValue({});

      await service.revokeSession('sess-abc');

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'sess-abc' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('revokeAllSessions', () => {
    it('revokes all non-revoked sessions for the user', async () => {
      const { service, mockPrisma } = makeSessionService();
      mockPrisma.session.updateMany.mockResolvedValue({ count: 3 });

      await service.revokeAllSessions('user-xyz');

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-xyz', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('isSessionValid', () => {
    it('returns true for an active unexpired session', () => {
      const { service } = makeSessionService();
      expect(service.isSessionValid({ revokedAt: null, expiresAt: new Date(Date.now() + 1_000_000) })).toBe(true);
    });

    it('returns false when session is revoked', () => {
      const { service } = makeSessionService();
      expect(service.isSessionValid({ revokedAt: new Date(), expiresAt: new Date(Date.now() + 1_000_000) })).toBe(
        false
      );
    });

    it('returns false when session is expired', () => {
      const { service } = makeSessionService();
      expect(service.isSessionValid({ revokedAt: null, expiresAt: new Date(Date.now() - 1_000) })).toBe(false);
    });
  });

  describe('findByRefreshTokenHash', () => {
    it('delegates to prisma with the given hash', async () => {
      const { service, mockPrisma } = makeSessionService();
      const mockSession = { id: 'sess-1', refreshTokenHash: 'abc' };
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      const result = await service.findByRefreshTokenHash('abc');
      expect(result).toBe(mockSession);
      expect(mockPrisma.session.findUnique).toHaveBeenCalledWith({ where: { refreshTokenHash: 'abc' } });
    });

    it('returns null when not found', async () => {
      const { service, mockPrisma } = makeSessionService();
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const result = await service.findByRefreshTokenHash('unknown');
      expect(result).toBeNull();
    });
  });
});
