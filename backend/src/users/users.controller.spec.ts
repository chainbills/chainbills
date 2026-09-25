// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Users controller tests
//
// Covers: getMe, updatePreferences, setEmail, verifyEmail, removeEmail —
// ensures the controller correctly delegates to UsersService and returns the
// right shape. HTTP exceptions propagate unchanged.
// ──────────────────────────────────────────────────────────────────────────────

import { BadRequestException } from '@nestjs/common';
import { UsersController } from './users.controller';

const MOCK_USER: import('./users.dto').MeResponseDto = {
  id: 'user-1',
  wallets: [],
  email: null,
  emailVerifiedAt: null,
  preferences: {
    PAYABLE_CREATED: { email: true },
    PAYMENT_RECEIVED: { email: true },
    PAYMENT_RECEIPT: { email: true },
    WITHDRAWAL_COMPLETED: { email: true },
  },
};

function makeService() {
  return {
    getMe: vi.fn().mockResolvedValue(MOCK_USER),
    updatePreferences: vi.fn().mockResolvedValue(MOCK_USER),
    requestEmailVerification: vi.fn().mockResolvedValue(undefined),
    verifyEmail: vi.fn().mockResolvedValue({ ...MOCK_USER, email: 'test@example.com' }),
    removeEmail: vi.fn().mockResolvedValue(MOCK_USER),
  };
}

function makeAuthUser() {
  return { userId: 'user-1', walletKey: 'evm:0xabc', sessionId: 'sess-1' };
}

describe('UsersController', () => {
  it('getMe returns the service result', async () => {
    const svc = makeService();
    const ctrl = new UsersController(svc as any);
    const result = await ctrl.getMe(makeAuthUser());
    expect(result).toBe(MOCK_USER);
    expect(svc.getMe).toHaveBeenCalledWith('user-1');
  });

  it('updatePreferences delegates to service', async () => {
    const svc = makeService();
    const ctrl = new UsersController(svc as any);
    const dto = { PAYMENT_RECEIVED: { email: false } };
    await ctrl.updatePreferences(makeAuthUser(), dto);
    expect(svc.updatePreferences).toHaveBeenCalledWith('user-1', dto);
  });

  it('setEmail calls requestEmailVerification', async () => {
    const svc = makeService();
    const ctrl = new UsersController(svc as any);
    await ctrl.setEmail(makeAuthUser(), { email: 'test@example.com' });
    expect(svc.requestEmailVerification).toHaveBeenCalledWith('user-1', 'test@example.com');
  });

  it('setEmail propagates exceptions from the service', async () => {
    const svc = makeService();
    svc.requestEmailVerification = vi.fn().mockRejectedValue(new BadRequestException('bad email'));
    const ctrl = new UsersController(svc as any);
    await expect(ctrl.setEmail(makeAuthUser(), { email: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verifyEmail delegates to service', async () => {
    const svc = makeService();
    const ctrl = new UsersController(svc as any);
    const result = await ctrl.verifyEmail(makeAuthUser(), { code: '123456' });
    expect(svc.verifyEmail).toHaveBeenCalledWith('user-1', '123456');
    expect(result.email).toBe('test@example.com');
  });

  it('removeEmail delegates to service', async () => {
    const svc = makeService();
    const ctrl = new UsersController(svc as any);
    await ctrl.removeEmail(makeAuthUser());
    expect(svc.removeEmail).toHaveBeenCalledWith('user-1');
  });
});
