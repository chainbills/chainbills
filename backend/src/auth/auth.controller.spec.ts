// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — AuthController unit tests
//
// Tests the HTTP controller layer: cookie management, delegation to AuthService,
// and proper HTTP status codes. AuthService is fully mocked.
// ──────────────────────────────────────────────────────────────────────────────

import { AuthController } from './auth.controller';

function makeConfig(overrides: { cookieSecure?: boolean; cookieDomain?: string } = {}) {
  return {
    env: {
      cookieSecure: overrides.cookieSecure ?? false,
      cookieDomain: overrides.cookieDomain,
      refreshTokenTtlMs: 30 * 24 * 60 * 60 * 1_000,
      accessTokenTtlMs: 15 * 60 * 1_000,
    },
  };
}

function makeCookieRes() {
  const cookies: Record<string, unknown> = {};
  const clearedCookies: string[] = [];
  return {
    cookie: vi.fn((name: string, value: string, opts: unknown) => {
      cookies[name] = { value, opts };
    }),
    clearCookie: vi.fn((name: string) => {
      clearedCookies.push(name);
    }),
    _cookies: cookies,
    _cleared: clearedCookies,
  };
}

function makeReq(cookies: Record<string, string> = {}, headers: Record<string, string> = {}) {
  return {
    cookies,
    headers,
    ip: '127.0.0.1',
  };
}

describe('AuthController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('nonce', () => {
    it('delegates to authService.getNonce', async () => {
      const mockAuthService = {
        getNonce: vi.fn().mockResolvedValue({ nonce: 'abc', expiresAt: '2024-01-01T00:05:00.000Z' }),
      };
      const controller = new AuthController(mockAuthService as never, makeConfig() as never);

      const result = await controller.nonce();
      expect(result).toEqual({ nonce: 'abc', expiresAt: '2024-01-01T00:05:00.000Z' });
      expect(mockAuthService.getNonce).toHaveBeenCalledOnce();
    });
  });

  describe('verify', () => {
    it('sets the refresh cookie on success', async () => {
      const mockAuthService = {
        verify: vi.fn().mockResolvedValue({
          response: { accessToken: 'jwt', expiresIn: 900, user: { id: 'u1' } },
          refreshToken: 'raw-refresh',
        }),
      };
      const controller = new AuthController(mockAuthService as never, makeConfig() as never);
      const res = makeCookieRes();

      await controller.verify(
        { namespace: 'evm', message: 'msg', signature: '0xsig' },
        makeReq() as never,
        res as never
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'cb_refresh',
        'raw-refresh',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/auth',
        })
      );
    });

    it('returns the auth response', async () => {
      const expectedResponse = { accessToken: 'jwt', expiresIn: 900, user: { id: 'u1' } };
      const mockAuthService = {
        verify: vi.fn().mockResolvedValue({ response: expectedResponse, refreshToken: 'raw' }),
      };
      const controller = new AuthController(mockAuthService as never, makeConfig() as never);
      const res = makeCookieRes();

      const result = await controller.verify(
        { namespace: 'solana', message: 'msg', signature: 'sig' },
        makeReq() as never,
        res as never
      );

      expect(result).toBe(expectedResponse);
    });
  });

  describe('refresh', () => {
    it('reads the cb_refresh cookie and rotates the token', async () => {
      const mockAuthService = {
        refresh: vi.fn().mockResolvedValue({
          response: { accessToken: 'new-jwt', expiresIn: 900 },
          refreshToken: 'new-raw',
        }),
      };
      const controller = new AuthController(mockAuthService as never, makeConfig() as never);
      const res = makeCookieRes();

      await controller.refresh(makeReq({ cb_refresh: 'old-token' }) as never, res as never);

      expect(mockAuthService.refresh).toHaveBeenCalledWith('old-token');
      expect(res.cookie).toHaveBeenCalledWith('cb_refresh', 'new-raw', expect.any(Object));
    });

    it('passes undefined when no cookie is set', async () => {
      const mockAuthService = {
        refresh: vi.fn().mockResolvedValue({ response: { accessToken: 'jwt', expiresIn: 900 }, refreshToken: 'r' }),
      };
      const controller = new AuthController(mockAuthService as never, makeConfig() as never);
      const res = makeCookieRes();

      await controller.refresh(makeReq({}) as never, res as never);

      expect(mockAuthService.refresh).toHaveBeenCalledWith(undefined);
    });
  });

  describe('logout', () => {
    it('revokes the session and clears the cookie', async () => {
      const mockAuthService = {
        logout: vi.fn().mockResolvedValue(undefined),
      };
      const controller = new AuthController(mockAuthService as never, makeConfig() as never);
      const res = makeCookieRes();

      await controller.logout({ userId: 'u1', walletKey: 'evm:0xabc', sessionId: 'sess-1' }, res as never);

      expect(mockAuthService.logout).toHaveBeenCalledWith('sess-1');
      expect(res.clearCookie).toHaveBeenCalledWith('cb_refresh', expect.any(Object));
    });
  });

  describe('logoutAll', () => {
    it('revokes all sessions and clears the cookie', async () => {
      const mockAuthService = {
        logoutAll: vi.fn().mockResolvedValue(undefined),
      };
      const controller = new AuthController(mockAuthService as never, makeConfig() as never);
      const res = makeCookieRes();

      await controller.logoutAll({ userId: 'user-1', walletKey: 'evm:0xabc', sessionId: 'sess-1' }, res as never);

      expect(mockAuthService.logoutAll).toHaveBeenCalledWith('user-1');
      expect(res.clearCookie).toHaveBeenCalledWith('cb_refresh', expect.any(Object));
    });
  });

  describe('cookie attributes', () => {
    it('sets Secure=true when cookieSecure is true', async () => {
      const mockAuthService = {
        verify: vi
          .fn()
          .mockResolvedValue({ response: { accessToken: 'jwt', expiresIn: 900, user: {} }, refreshToken: 'raw' }),
      };
      const controller = new AuthController(mockAuthService as never, makeConfig({ cookieSecure: true }) as never);
      const res = makeCookieRes();

      await controller.verify({ namespace: 'evm', message: 'msg', signature: 'sig' }, makeReq() as never, res as never);

      expect(res.cookie).toHaveBeenCalledWith('cb_refresh', 'raw', expect.objectContaining({ secure: true }));
    });

    it('sets cookie Domain attribute when COOKIE_DOMAIN is configured', async () => {
      const mockAuthService = {
        verify: vi
          .fn()
          .mockResolvedValue({ response: { accessToken: 'jwt', expiresIn: 900, user: {} }, refreshToken: 'raw' }),
      };
      const controller = new AuthController(
        mockAuthService as never,
        makeConfig({ cookieDomain: 'chainbills.xyz' }) as never
      );
      const res = makeCookieRes();

      await controller.verify({ namespace: 'evm', message: 'msg', signature: 'sig' }, makeReq() as never, res as never);

      expect(res.cookie).toHaveBeenCalledWith(
        'cb_refresh',
        'raw',
        expect.objectContaining({ domain: 'chainbills.xyz' })
      );
    });
  });
});
