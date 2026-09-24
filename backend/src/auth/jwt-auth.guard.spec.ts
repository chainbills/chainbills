// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — JwtAuthGuard unit tests
// ──────────────────────────────────────────────────────────────────────────────

import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(authHeader?: string, isPublic?: boolean) {
  const mockRequest = {
    headers: {
      authorization: authHeader,
    },
    user: undefined as unknown,
  };

  const mockReflector = {
    getAllAndOverride: vi.fn().mockReturnValue(isPublic ?? false),
  };

  const context = {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
  };

  return { mockRequest, mockReflector, context };
}

function makeGuard(jwtPayload?: unknown, sessionValid = true) {
  const mockJwtService = {
    verify: vi.fn().mockReturnValue(jwtPayload ?? { sub: 'user-1', wlt: 'evm:0xabc', sid: 'sess-1' }),
  };

  const mockAuthService = {
    validateSession: vi.fn().mockResolvedValue(sessionValid),
  };

  const guard = new JwtAuthGuard(
    { getAllAndOverride: vi.fn().mockReturnValue(false) } as never,
    mockJwtService as never,
    mockAuthService as never
  );

  return { guard, mockJwtService, mockAuthService };
}

describe('JwtAuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows @Public() routes through without checking the token', async () => {
    const { mockReflector, context } = makeContext(undefined, true);
    const { mockJwtService, mockAuthService } = makeGuard();

    const guard = new JwtAuthGuard(mockReflector as never, mockJwtService as never, mockAuthService as never);
    const result = await guard.canActivate(context as never);

    expect(result).toBe(true);
    expect(mockJwtService.verify).not.toHaveBeenCalled();
  });

  it('throws when Authorization header is missing', async () => {
    const { mockReflector, context } = makeContext(undefined, false);

    // Override reflector to return false (not public)
    const g = new JwtAuthGuard(
      mockReflector as never,
      { verify: vi.fn() } as never,
      { validateSession: vi.fn() } as never
    );
    await expect(g.canActivate(context as never)).rejects.toThrow(UnauthorizedException);
    await expect(g.canActivate(context as never)).rejects.toThrow('missing access token');
  });

  it('throws when Authorization header does not start with Bearer', async () => {
    const { mockReflector, context } = makeContext('Basic abc123', false);

    const g = new JwtAuthGuard(
      mockReflector as never,
      { verify: vi.fn() } as never,
      { validateSession: vi.fn() } as never
    );
    await expect(g.canActivate(context as never)).rejects.toThrow(UnauthorizedException);
  });

  it('throws when JWT verification fails', async () => {
    const { mockReflector, context } = makeContext('Bearer invalid-token', false);
    const mockJwtService = {
      verify: vi.fn().mockImplementation(() => {
        throw new Error('bad token');
      }),
    };
    const mockAuthService = { validateSession: vi.fn() };

    const guard = new JwtAuthGuard(mockReflector as never, mockJwtService as never, mockAuthService as never);
    await expect(guard.canActivate(context as never)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context as never)).rejects.toThrow('invalid or expired');
  });

  it('throws when session is revoked', async () => {
    const { mockReflector, context } = makeContext('Bearer valid-token', false);
    const mockJwtService = { verify: vi.fn().mockReturnValue({ sub: 'u1', wlt: 'evm:0xabc', sid: 'sess-1' }) };
    const mockAuthService = { validateSession: vi.fn().mockResolvedValue(false) };

    const guard = new JwtAuthGuard(mockReflector as never, mockJwtService as never, mockAuthService as never);
    await expect(guard.canActivate(context as never)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context as never)).rejects.toThrow('revoked');
  });

  it('attaches user to request and returns true on success', async () => {
    const { mockReflector, context, mockRequest } = makeContext('Bearer valid-token', false);
    const mockJwtService = { verify: vi.fn().mockReturnValue({ sub: 'user-1', wlt: 'evm:0xabc', sid: 'sess-1' }) };
    const mockAuthService = { validateSession: vi.fn().mockResolvedValue(true) };

    const guard = new JwtAuthGuard(mockReflector as never, mockJwtService as never, mockAuthService as never);
    const result = await guard.canActivate(context as never);

    expect(result).toBe(true);
    expect(mockRequest.user).toEqual({ userId: 'user-1', walletKey: 'evm:0xabc', sessionId: 'sess-1' });
  });
});
