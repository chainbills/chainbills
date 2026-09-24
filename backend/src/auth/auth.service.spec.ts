// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — AuthService unit tests
//
// Tests the orchestration layer: nonce checks, domain/URI validation, session
// rotation, reuse detection and logout. All dependencies are mocked; no DB or
// network calls happen.
// ──────────────────────────────────────────────────────────────────────────────

import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

// ── Mock factories ────────────────────────────────────────────────────────────

const APP_URL = 'https://chainbills.xyz';

function makeAuthService(
  overrides: {
    nonceRow?: unknown;
    siweResult?: unknown;
    siwsResult?: unknown;
    sessionValid?: boolean;
    walletExists?: boolean;
  } = {}
) {
  const userId = 'user-1';
  const sessionId = 'sess-1';
  const walletKey = 'evm:0xd8da6bf26964af9d7eed9e03e53415d37aa96045';

  const mockNonces = {
    generateNonce: vi.fn().mockResolvedValue({ nonce: 'abc123', expiresAt: new Date(Date.now() + 300_000) }),
    findNonce: vi.fn().mockResolvedValue(
      'nonceRow' in overrides
        ? overrides.nonceRow
        : {
            nonce: 'testNonce',
            expiresAt: new Date(Date.now() + 300_000),
            usedAt: null,
          }
    ),
    markUsed: vi.fn().mockResolvedValue(undefined),
  };

  const mockSessions = {
    generateRefreshToken: vi.fn().mockReturnValue({ refreshToken: 'raw-token', refreshTokenHash: 'hashed-token' }),
    createSession: vi.fn().mockResolvedValue({ id: sessionId, userId, walletKey }),
    findByRefreshTokenHash: vi.fn(),
    rotateRefreshToken: vi.fn().mockResolvedValue('new-raw-token'),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    revokeAllSessions: vi.fn().mockResolvedValue(undefined),
    isSessionValid: vi.fn().mockReturnValue(overrides.sessionValid ?? true),
    hash: vi.fn((v: string) => `sha256:${v}`),
  };

  const mockSiwe = {
    verify: vi.fn().mockResolvedValue(
      overrides.siweResult ?? {
        parsed: {
          domain: 'chainbills.xyz',
          address: '0xD8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          nonce: 'testNonce',
          issuedAt: new Date(),
          expirationTime: undefined,
          uri: APP_URL,
        },
        address: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
      }
    ),
  };

  const mockSiws = {
    verify: vi.fn().mockReturnValue(
      overrides.siwsResult ?? {
        parsed: {
          domain: 'chainbills.xyz',
          address: 'So11111111111111111111111111111112',
          nonce: 'testNonce',
          issuedAt: new Date().toISOString(),
          expirationTime: undefined,
          uri: APP_URL,
        },
        address: 'So11111111111111111111111111111112',
      }
    ),
  };

  const mockWallet =
    overrides.walletExists !== false
      ? { key: walletKey, userId, user: { id: userId, wallets: [], email: null, emailVerifiedAt: null } }
      : null;

  const mockPrisma = {
    session: {
      findUnique: vi.fn().mockResolvedValue({ revokedAt: null, expiresAt: new Date(Date.now() + 1_000_000) }),
    },
    wallet: {
      findUnique: vi.fn().mockResolvedValue(mockWallet),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
    user: {
      create: vi.fn().mockResolvedValue({ id: userId }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: userId,
        email: null,
        emailVerifiedAt: null,
        wallets: [{ key: walletKey, namespace: 'EVM', address: '0xD8dA6BF26964aF9D7eEd9e03E53415D37aA96045' }],
      }),
    },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    }),
    authNonce: {
      update: vi.fn().mockResolvedValue({}),
    },
  };

  const mockJwt = {
    sign: vi.fn().mockReturnValue('jwt-token'),
  };

  const mockConfig = {
    env: {
      appUrl: APP_URL,
      accessTokenTtlMs: 15 * 60 * 1_000,
      refreshTokenTtlMs: 30 * 24 * 60 * 60 * 1_000,
      signInMessageTtlMs: 10 * 60 * 1_000,
    },
  };

  const service = new AuthService(
    mockPrisma as never,
    mockConfig as never,
    mockJwt as never,
    mockNonces as never,
    mockSessions as never,
    mockSiwe as never,
    mockSiws as never
  );

  return { service, mockNonces, mockSessions, mockSiwe, mockSiws, mockPrisma, mockJwt, userId, sessionId, walletKey };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNonce', () => {
    it('returns nonce and expiresAt as ISO string', async () => {
      const { service } = makeAuthService();
      const result = await service.getNonce();
      expect(result.nonce).toBe('abc123');
      expect(result.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('verify — EVM', () => {
    it('returns an access token and user on success', async () => {
      const { service } = makeAuthService();
      const { response } = await service.verify('evm', 'message', '0xsig', {});
      expect(response.accessToken).toBe('jwt-token');
      expect(response.user.id).toBeTruthy();
    });

    it('throws UnauthorizedException when domain does not match APP_URL host', async () => {
      const { service, mockSiwe } = makeAuthService();
      mockSiwe.verify.mockResolvedValue({
        parsed: {
          domain: 'evil.com',
          address: '0xabc',
          nonce: 'testNonce',
          issuedAt: new Date(),
          uri: APP_URL,
        },
        address: '0xabc',
      });

      await expect(service.verify('evm', 'msg', '0xsig', {})).rejects.toThrow(UnauthorizedException);
      await expect(service.verify('evm', 'msg', '0xsig', {})).rejects.toThrow('domain mismatch');
    });

    it('throws UnauthorizedException when nonce does not exist', async () => {
      const { service } = makeAuthService({ nonceRow: null });
      await expect(service.verify('evm', 'msg', '0xsig', {})).rejects.toThrow(UnauthorizedException);
      await expect(service.verify('evm', 'msg', '0xsig', {})).rejects.toThrow('nonce not found');
    });

    it('throws UnauthorizedException when nonce is already used', async () => {
      const { service } = makeAuthService({
        nonceRow: { nonce: 'testNonce', expiresAt: new Date(Date.now() + 300_000), usedAt: new Date() },
      });
      await expect(service.verify('evm', 'msg', '0xsig', {})).rejects.toThrow(UnauthorizedException);
      await expect(service.verify('evm', 'msg', '0xsig', {})).rejects.toThrow('already used');
    });

    it('throws UnauthorizedException when nonce is expired', async () => {
      const { service } = makeAuthService({
        nonceRow: { nonce: 'testNonce', expiresAt: new Date(Date.now() - 1_000), usedAt: null },
      });
      await expect(service.verify('evm', 'msg', '0xsig', {})).rejects.toThrow(UnauthorizedException);
      await expect(service.verify('evm', 'msg', '0xsig', {})).rejects.toThrow('nonce expired');
    });

    it('throws UnauthorizedException when issuedAt is too old', async () => {
      const { service, mockSiwe } = makeAuthService();
      const oldDate = new Date(Date.now() - 20 * 60 * 1_000); // 20 minutes ago
      mockSiwe.verify.mockResolvedValue({
        parsed: {
          domain: 'chainbills.xyz',
          address: '0xabc',
          nonce: 'testNonce',
          issuedAt: oldDate,
          uri: APP_URL,
        },
        address: '0xabc',
      });

      await expect(service.verify('evm', 'msg', '0xsig', {})).rejects.toThrow(UnauthorizedException);
      await expect(service.verify('evm', 'msg', '0xsig', {})).rejects.toThrow('sign-in window');
    });

    it('throws UnauthorizedException when message is past expirationTime', async () => {
      const { service, mockSiwe } = makeAuthService();
      mockSiwe.verify.mockResolvedValue({
        parsed: {
          domain: 'chainbills.xyz',
          address: '0xabc',
          nonce: 'testNonce',
          issuedAt: new Date(),
          expirationTime: new Date(Date.now() - 1_000),
          uri: APP_URL,
        },
        address: '0xabc',
      });

      await expect(service.verify('evm', 'msg', '0xsig', {})).rejects.toThrow(UnauthorizedException);
      await expect(service.verify('evm', 'msg', '0xsig', {})).rejects.toThrow('expired');
    });

    it('creates a new user on first sign-in (wallet does not exist)', async () => {
      const { service, mockPrisma } = makeAuthService({ walletExists: false });
      await service.verify('evm', 'msg', '0xsig', {});
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.wallet.create).toHaveBeenCalled();
    });

    it('reuses the existing user on subsequent sign-ins', async () => {
      const { service, mockPrisma } = makeAuthService({ walletExists: true });
      await service.verify('evm', 'msg', '0xsig', {});
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lastSignInAt: expect.any(Date) }) })
      );
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when cookie is missing', async () => {
      const { service } = makeAuthService();
      await expect(service.refresh(undefined)).rejects.toThrow(UnauthorizedException);
      await expect(service.refresh(undefined)).rejects.toThrow('missing refresh token');
    });

    it('throws UnauthorizedException when token not found in DB', async () => {
      const { service, mockSessions } = makeAuthService();
      mockSessions.findByRefreshTokenHash.mockResolvedValue(null);

      await expect(service.refresh('unknown-token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refresh('unknown-token')).rejects.toThrow('not found');
    });

    it('throws UnauthorizedException when session is revoked', async () => {
      const { service, mockSessions } = makeAuthService({ sessionValid: false });
      mockSessions.findByRefreshTokenHash.mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        walletKey: 'evm:0xabc',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1_000_000),
      });
      mockSessions.isSessionValid.mockReturnValue(false);

      await expect(service.refresh('some-token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refresh('some-token')).rejects.toThrow('revoked');
    });

    it('returns a new access token on success', async () => {
      const { service, mockSessions } = makeAuthService();
      mockSessions.findByRefreshTokenHash.mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        walletKey: 'evm:0xabc',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1_000_000),
      });
      mockSessions.isSessionValid.mockReturnValue(true);
      mockSessions.rotateRefreshToken.mockResolvedValue('new-raw-token');

      const { response, refreshToken } = await service.refresh('valid-token');
      expect(response.accessToken).toBe('jwt-token');
      expect(refreshToken).toBe('new-raw-token');
    });
  });

  describe('logout', () => {
    it('delegates to sessions.revokeSession', async () => {
      const { service, mockSessions } = makeAuthService();
      await service.logout('sess-abc');
      expect(mockSessions.revokeSession).toHaveBeenCalledWith('sess-abc');
    });
  });

  describe('logoutAll', () => {
    it('delegates to sessions.revokeAllSessions', async () => {
      const { service, mockSessions } = makeAuthService();
      await service.logoutAll('user-xyz');
      expect(mockSessions.revokeAllSessions).toHaveBeenCalledWith('user-xyz');
    });
  });

  describe('validateSession', () => {
    it('returns true for a valid session', async () => {
      const { service } = makeAuthService();
      const valid = await service.validateSession('sess-1');
      expect(valid).toBe(true);
    });

    it('returns false when session not found', async () => {
      const { service, mockPrisma } = makeAuthService();
      mockPrisma.session.findUnique.mockResolvedValue(null);
      const valid = await service.validateSession('unknown');
      expect(valid).toBe(false);
    });

    it('returns false for a revoked session', async () => {
      const { service, mockPrisma } = makeAuthService();
      mockPrisma.session.findUnique.mockResolvedValue({
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1_000_000),
      });
      const valid = await service.validateSession('sess-1');
      expect(valid).toBe(false);
    });
  });
});
