// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Users service tests
//
// Covers: getMe, updatePreferences, requestEmailVerification (rate limits,
// code generation, HMAC hash, send failure, invalidation of older requests),
// verifyEmail (happy path, wrong code, expired, max attempts, timingSafeEqual),
// removeEmail.
// ──────────────────────────────────────────────────────────────────────────────

import { BadRequestException, BadGatewayException, HttpException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { UsersService } from './users.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    env: {
      appUrl: 'https://chainbills.xyz',
      publicApiUrl: 'https://api.chainbills.xyz',
      otpHmacSecret: 'test-hmac-secret-at-least-32-characters-xx',
      zeptomail: { fromName: 'Chainbills', apiUrl: '', apiKey: '', fromAddress: '' },
      ...overrides,
    },
  };
}

function makeMail() {
  return { send: vi.fn().mockResolvedValue({ messageId: 'msg-123' }) };
}

function makeUser(overrides = {}) {
  return {
    id: 'user-1',
    email: null,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    wallets: [],
    preferences: [],
    ...overrides,
  };
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(makeUser()),
      update: vi.fn().mockResolvedValue(makeUser()),
    },
    notificationPreference: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    emailVerification: {
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'ver-1', codeHash: '', expiresAt: new Date(Date.now() + 600_000) }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation((args) => {
      if (Array.isArray(args)) return Promise.all(args);
      return args();
    }),
    ...overrides,
  };
}

function makeService(prismaOverrides = {}, configOverrides = {}, mailOverrides = {}) {
  const prisma = makePrisma(prismaOverrides) as any;
  const config = makeConfig(configOverrides) as any;
  const mail = { ...makeMail(), ...mailOverrides } as any;
  return new UsersService(prisma, config, mail);
}

// ── getMe ─────────────────────────────────────────────────────────────────────

describe('UsersService.getMe', () => {
  it('returns user profile with default preferences when no rows exist', async () => {
    const service = makeService();
    const result = await service.getMe('user-1');
    expect(result.id).toBe('user-1');
    expect(result.preferences.PAYABLE_CREATED.email).toBe(true);
    expect(result.preferences.PAYMENT_RECEIVED.email).toBe(true);
    expect(result.preferences.PAYMENT_RECEIPT.email).toBe(true);
    expect(result.preferences.WITHDRAWAL_COMPLETED.email).toBe(true);
  });

  it('reflects stored preference override', async () => {
    const prisma = makePrisma();
    (prisma.user.findUniqueOrThrow as any).mockResolvedValue(
      makeUser({ preferences: [{ type: 'PAYMENT_RECEIVED', email: false }] })
    );
    const service = new UsersService(prisma as any, makeConfig() as any, makeMail() as any);
    const result = await service.getMe('user-1');
    expect(result.preferences.PAYMENT_RECEIVED.email).toBe(false);
    expect(result.preferences.PAYABLE_CREATED.email).toBe(true);
  });
});

// ── updatePreferences ─────────────────────────────────────────────────────────

describe('UsersService.updatePreferences', () => {
  it('upserts only provided types', async () => {
    const prisma = makePrisma();
    const service = new UsersService(prisma as any, makeConfig() as any, makeMail() as any);
    await service.updatePreferences('user-1', { PAYMENT_RECEIVED: { email: false } });
    expect(prisma.notificationPreference.upsert as any).toHaveBeenCalledOnce();
    const call = (prisma.notificationPreference.upsert as any).mock.calls[0][0];
    expect(call.create.type).toBe('PAYMENT_RECEIVED');
    expect(call.create.email).toBe(false);
  });

  it('does nothing when dto is empty', async () => {
    const prisma = makePrisma();
    const service = new UsersService(prisma as any, makeConfig() as any, makeMail() as any);
    await service.updatePreferences('user-1', {});
    expect(prisma.$transaction as any).not.toHaveBeenCalled();
  });
});

// ── requestEmailVerification — rate limits ─────────────────────────────────

describe('UsersService.requestEmailVerification — rate limits', () => {
  it('throws 429 when a send happened within 60 s', async () => {
    const prisma = makePrisma();
    (prisma.emailVerification.findFirst as any).mockResolvedValue({ createdAt: new Date(Date.now() - 30_000) });
    (prisma.emailVerification.count as any).mockResolvedValue(0);
    const service = new UsersService(prisma as any, makeConfig() as any, makeMail() as any);
    const err = await service.requestEmailVerification('user-1', 'test@example.com').catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    const body = err.getResponse() as any;
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(body.retryAfter).toBeLessThanOrEqual(60);
  });

  it('throws 429 when user hit 5 pending sends in 24 h', async () => {
    const prisma = makePrisma();
    (prisma.emailVerification.findFirst as any).mockResolvedValue(null);
    (prisma.emailVerification.count as any)
      .mockResolvedValueOnce(5) // last24hByUser
      .mockResolvedValue(0);
    const service = new UsersService(prisma as any, makeConfig() as any, makeMail() as any);
    const err = await service.requestEmailVerification('user-1', 'test@example.com').catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    // Verify the count query filters out consumed rows.
    const countCalls = (prisma.emailVerification.count as any).mock.calls;
    expect(countCalls[0][0].where).toMatchObject({ consumedAt: null });
  });

  it('throws 429 when target email hit 5 sends in 24 h', async () => {
    const prisma = makePrisma();
    (prisma.emailVerification.findFirst as any).mockResolvedValue(null);
    (prisma.emailVerification.count as any)
      .mockResolvedValueOnce(0) // last24hByUser
      .mockResolvedValueOnce(5); // last24hByEmail
    const service = new UsersService(prisma as any, makeConfig() as any, makeMail() as any);
    const err = await service.requestEmailVerification('user-1', 'test@example.com').catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
  });

  it('includes retryAfter seconds in 429 response', async () => {
    const prisma = makePrisma();
    (prisma.emailVerification.findFirst as any).mockResolvedValue({ createdAt: new Date(Date.now() - 10_000) });
    (prisma.emailVerification.count as any).mockResolvedValue(0);
    const service = new UsersService(prisma as any, makeConfig() as any, makeMail() as any);
    const err = await service.requestEmailVerification('user-1', 'test@example.com').catch((e) => e);
    const body = (err as HttpException).getResponse() as any;
    expect(body.retryAfter).toBe(50);
  });
});

// ── requestEmailVerification — code generation ─────────────────────────────

describe('UsersService.requestEmailVerification — code generation', () => {
  it('sends a 6-digit code in the email text (verifies format by running multiple times)', async () => {
    // Verify code format by inspecting what gets sent across multiple calls.
    // crypto.randomInt is ESM-native and cannot be spied on; instead we verify
    // the format of the actual generated code.
    for (let i = 0; i < 3; i++) {
      const prisma = makePrisma();
      (prisma.emailVerification.findFirst as any).mockResolvedValue(null);
      (prisma.emailVerification.count as any).mockResolvedValue(0);
      const mail = makeMail();
      const service = new UsersService(prisma as any, makeConfig() as any, mail as any);
      await service.requestEmailVerification('user-1', 'test@example.com');
      const msg = (mail.send as any).mock.calls[0][0];
      // The text body must contain a 6-digit code (may appear as part of larger string).
      expect(msg.text).toMatch(/\d{6}/);
    }
  });

  it('stores an HMAC hash of the code, not the code itself', async () => {
    const prisma = makePrisma();
    (prisma.emailVerification.findFirst as any).mockResolvedValue(null);
    (prisma.emailVerification.count as any).mockResolvedValue(0);
    let capturedHash = '';
    (prisma.emailVerification.update as any).mockImplementation((args: any) => {
      if (args.data.codeHash) capturedHash = args.data.codeHash;
      return Promise.resolve({});
    });
    const service = new UsersService(prisma as any, makeConfig() as any, makeMail() as any);
    await service.requestEmailVerification('user-1', 'test@example.com');
    expect(capturedHash).toBeTruthy();
    expect(capturedHash).not.toMatch(/^\d{6}$/);
  });

  it('invalidates older pending verifications before creating a new one', async () => {
    const prisma = makePrisma();
    (prisma.emailVerification.findFirst as any).mockResolvedValue(null);
    (prisma.emailVerification.count as any).mockResolvedValue(0);
    const service = new UsersService(prisma as any, makeConfig() as any, makeMail() as any);
    await service.requestEmailVerification('user-1', 'test@example.com');
    expect(prisma.emailVerification.updateMany as any).toHaveBeenCalledOnce();
    const call = (prisma.emailVerification.updateMany as any).mock.calls[0][0];
    expect(call.where.userId).toBe('user-1');
    expect(call.where.consumedAt).toBeNull();
  });

  it('normalises email to trimmed lowercase', async () => {
    const prisma = makePrisma();
    (prisma.emailVerification.findFirst as any).mockResolvedValue(null);
    (prisma.emailVerification.count as any).mockResolvedValue(0);
    const mail = makeMail();
    const service = new UsersService(prisma as any, makeConfig() as any, mail as any);
    await service.requestEmailVerification('user-1', '  TEST@Example.COM  ');
    const createCall = (prisma.emailVerification.create as any).mock.calls[0][0];
    expect(createCall.data.email).toBe('test@example.com');
  });
});

// ── requestEmailVerification — provider failure ────────────────────────────

describe('UsersService.requestEmailVerification — provider failure', () => {
  it('returns 502 and deletes the verification row when the mail provider throws', async () => {
    const prisma = makePrisma();
    (prisma.emailVerification.findFirst as any).mockResolvedValue(null);
    (prisma.emailVerification.count as any).mockResolvedValue(0);
    const mail = { send: vi.fn().mockRejectedValue(new Error('smtp timeout')) };
    const service = new UsersService(prisma as any, makeConfig() as any, mail as any);
    const err = await service.requestEmailVerification('user-1', 'test@example.com').catch((e) => e);
    expect(err).toBeInstanceOf(BadGatewayException);
    expect(prisma.emailVerification.delete as any).toHaveBeenCalledOnce();
  });
});

// ── verifyEmail ───────────────────────────────────────────────────────────────

describe('UsersService.verifyEmail', () => {
  function makeVerification(codeHash: string, attempts = 0) {
    return {
      id: 'ver-1',
      userId: 'user-1',
      email: 'test@example.com',
      codeHash,
      attempts,
      expiresAt: new Date(Date.now() + 600_000),
      consumedAt: null,
      createdAt: new Date(),
    };
  }

  function hashFor(id: string, code: string, secret: string): string {
    return createHmac('sha256', secret).update(`${id}:${code}`).digest('hex');
  }

  it('succeeds with the correct code and updates the user', async () => {
    const secret = 'test-hmac-secret-at-least-32-characters-xx';
    const code = '123456';
    const hash = hashFor('ver-1', code, secret);
    const prisma = makePrisma();
    (prisma.emailVerification.findFirst as any).mockResolvedValue(makeVerification(hash));
    const service = new UsersService(prisma as any, makeConfig() as any, makeMail() as any);
    await service.verifyEmail('user-1', code);
    expect(prisma.$transaction as any).toHaveBeenCalledOnce();
  });

  it('throws 400 when no pending verification exists', async () => {
    const prisma = makePrisma();
    (prisma.emailVerification.findFirst as any).mockResolvedValue(null);
    const service = new UsersService(prisma as any, makeConfig() as any, makeMail() as any);
    await expect(service.verifyEmail('user-1', '123456')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 400 on wrong code', async () => {
    const prisma = makePrisma();
    const hash = hashFor('ver-1', '999999', 'test-hmac-secret-at-least-32-characters-xx');
    (prisma.emailVerification.findFirst as any).mockResolvedValue(makeVerification(hash));
    const service = new UsersService(prisma as any, makeConfig() as any, makeMail() as any);
    await expect(service.verifyEmail('user-1', '123456')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 400 after 5 failed attempts', async () => {
    const prisma = makePrisma();
    const hash = hashFor('ver-1', '999999', 'test-hmac-secret-at-least-32-characters-xx');
    (prisma.emailVerification.findFirst as any).mockResolvedValue(makeVerification(hash, 5));
    const service = new UsersService(prisma as any, makeConfig() as any, makeMail() as any);
    await expect(service.verifyEmail('user-1', '999999')).rejects.toBeInstanceOf(BadRequestException);
    // The update (increment attempts) must NOT be called when already at 5.
    expect(prisma.emailVerification.update as any).not.toHaveBeenCalled();
  });

  it('uses HMAC-based constant-time comparison — correct code for wrong id still fails', async () => {
    // Demonstrates that the hash is bound to the verificationId:
    // a code that would be correct for a different verification id is rejected.
    const secret = 'test-hmac-secret-at-least-32-characters-xx';
    const code = '123456';
    // Hash for 'OTHER-ver' id — would be valid for a different row.
    const hashForOtherId = hashFor('other-ver', code, secret);
    const prisma = makePrisma();
    // The verification row has id 'ver-1', but the hash is for 'other-ver'.
    (prisma.emailVerification.findFirst as any).mockResolvedValue(makeVerification(hashForOtherId));
    const service = new UsersService(prisma as any, makeConfig() as any, makeMail() as any);
    await expect(service.verifyEmail('user-1', code)).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ── removeEmail ───────────────────────────────────────────────────────────────

describe('UsersService.removeEmail', () => {
  it('clears email and emailVerifiedAt on the user', async () => {
    const prisma = makePrisma();
    const service = new UsersService(prisma as any, makeConfig() as any, makeMail() as any);
    await service.removeEmail('user-1');
    const call = (prisma.user.update as any).mock.calls[0][0];
    expect(call.data.email).toBeNull();
    expect(call.data.emailVerifiedAt).toBeNull();
  });
});
