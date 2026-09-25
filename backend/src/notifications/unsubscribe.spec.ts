// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Unsubscribe tests
//
// Covers: buildUnsubscribeUrl, verifyUnsubscribeSig (valid, tampered, missing),
// UnsubscribeController GET/POST (valid signature, tampered -> 400,
// preference correctly set to false).
// ──────────────────────────────────────────────────────────────────────────────

import { BadRequestException } from '@nestjs/common';
import { computeUnsubscribeSig, buildUnsubscribeUrl, verifyUnsubscribeSig } from './unsubscribe.utils';
import { UnsubscribeController } from './unsubscribe.controller';

const SECRET = 'unsubscribe-secret-at-least-32-chars-xxxxx';
const USER_ID = 'user-cuid-123';
const TYPE = 'PAYMENT_RECEIVED';

// ── utilities ─────────────────────────────────────────────────────────────────

describe('computeUnsubscribeSig', () => {
  it('returns a non-empty base64url string', () => {
    const sig = computeUnsubscribeSig(SECRET, USER_ID, TYPE);
    expect(sig).toBeTruthy();
    expect(sig).not.toContain('+');
    expect(sig).not.toContain('/');
    expect(sig).not.toContain('=');
  });

  it('is deterministic for the same inputs', () => {
    const sig1 = computeUnsubscribeSig(SECRET, USER_ID, TYPE);
    const sig2 = computeUnsubscribeSig(SECRET, USER_ID, TYPE);
    expect(sig1).toBe(sig2);
  });

  it('differs when userId changes', () => {
    const sig1 = computeUnsubscribeSig(SECRET, USER_ID, TYPE);
    const sig2 = computeUnsubscribeSig(SECRET, 'other-user', TYPE);
    expect(sig1).not.toBe(sig2);
  });

  it('differs when type changes', () => {
    const sig1 = computeUnsubscribeSig(SECRET, USER_ID, TYPE);
    const sig2 = computeUnsubscribeSig(SECRET, USER_ID, 'PAYABLE_CREATED');
    expect(sig1).not.toBe(sig2);
  });
});

describe('buildUnsubscribeUrl', () => {
  it('includes userId, type and sig query params', () => {
    const url = buildUnsubscribeUrl('https://api.chainbills.xyz', USER_ID, TYPE, SECRET);
    expect(url).toContain('/email/unsubscribe');
    expect(url).toContain(`u=${encodeURIComponent(USER_ID)}`);
    expect(url).toContain(`t=${encodeURIComponent(TYPE)}`);
    expect(url).toContain('s=');
  });

  it('strips trailing slash from publicApiUrl', () => {
    const url = buildUnsubscribeUrl('https://api.chainbills.xyz/', USER_ID, TYPE, SECRET);
    expect(url).not.toContain('//email');
  });
});

describe('verifyUnsubscribeSig', () => {
  it('returns true for a valid signature', () => {
    const sig = computeUnsubscribeSig(SECRET, USER_ID, TYPE);
    expect(verifyUnsubscribeSig(SECRET, USER_ID, TYPE, sig)).toBe(true);
  });

  it('returns false for a tampered signature', () => {
    const sig = computeUnsubscribeSig(SECRET, USER_ID, TYPE);
    const tampered = sig.slice(0, -4) + 'XXXX';
    expect(verifyUnsubscribeSig(SECRET, USER_ID, TYPE, tampered)).toBe(false);
  });

  it('returns false for an empty signature', () => {
    expect(verifyUnsubscribeSig(SECRET, USER_ID, TYPE, '')).toBe(false);
  });

  it('returns false when userId differs', () => {
    const sig = computeUnsubscribeSig(SECRET, USER_ID, TYPE);
    expect(verifyUnsubscribeSig(SECRET, 'other', TYPE, sig)).toBe(false);
  });

  it('returns false and does not throw on sig with different length (length-mismatch branch)', () => {
    // A 1-char sig has different byte-length than the 32-byte HMAC output.
    expect(verifyUnsubscribeSig(SECRET, USER_ID, TYPE, 'x')).toBe(false);
  });
});

// ── UnsubscribeController ─────────────────────────────────────────────────────

function makeControllerConfig(secret = SECRET) {
  return { env: { unsubscribeSecret: secret } };
}

function makePrisma() {
  return {
    notificationPreference: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
}

function makeController(prismaOverrides = {}, secret = SECRET) {
  const prisma = { ...makePrisma(), ...prismaOverrides } as any;
  const config = makeControllerConfig(secret) as any;
  return new UnsubscribeController(prisma, config);
}

describe('UnsubscribeController.getUnsubscribePage', () => {
  it('returns HTML page for a valid signature', () => {
    const sig = computeUnsubscribeSig(SECRET, USER_ID, TYPE);
    const ctrl = makeController();
    const html = ctrl.getUnsubscribePage(USER_ID, TYPE, sig);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain(TYPE);
  });

  it('throws 400 for a tampered signature', () => {
    const ctrl = makeController();
    expect(() => ctrl.getUnsubscribePage(USER_ID, TYPE, 'tampered-sig')).toThrow(BadRequestException);
  });

  it('throws 400 for an unknown type', () => {
    const sig = computeUnsubscribeSig(SECRET, USER_ID, 'FAKE_TYPE');
    const ctrl = makeController();
    expect(() => ctrl.getUnsubscribePage(USER_ID, 'FAKE_TYPE', sig)).toThrow(BadRequestException);
  });

  it('throws 400 for empty params', () => {
    const ctrl = makeController();
    expect(() => ctrl.getUnsubscribePage('', TYPE, 'sig')).toThrow(BadRequestException);
  });
});

describe('UnsubscribeController.processUnsubscribe', () => {
  it('sets the preference to email=false on valid signature', async () => {
    const sig = computeUnsubscribeSig(SECRET, USER_ID, TYPE);
    const prisma = makePrisma();
    const ctrl = makeController(prisma);
    const result = await ctrl.processUnsubscribe(USER_ID, TYPE, sig);
    expect(result.ok).toBe(true);
    expect(prisma.notificationPreference.upsert as any).toHaveBeenCalledOnce();
    const call = (prisma.notificationPreference.upsert as any).mock.calls[0][0];
    expect(call.create.email).toBe(false);
    expect(call.update.email).toBe(false);
    expect(call.create.type).toBe(TYPE);
  });

  it('throws 400 for a tampered signature', async () => {
    const ctrl = makeController();
    await expect(ctrl.processUnsubscribe(USER_ID, TYPE, 'bad-sig')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not leak whether the userId/type exists in the DB', async () => {
    // The error message is always the same generic "invalid unsubscribe link".
    const ctrl = makeController();
    const err1 = await ctrl.processUnsubscribe('nonexistent', TYPE, 'bad').catch((e) => e);
    const err2 = await ctrl.processUnsubscribe(USER_ID, 'FAKE', 'bad').catch((e) => e);
    expect((err1 as BadRequestException).message).toBe((err2 as BadRequestException).message);
  });
});
