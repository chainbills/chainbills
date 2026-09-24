// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Outbox writer tests
//
// Covers: age cutoff, missing wallet, no verified email, happy path, dedup.
// ──────────────────────────────────────────────────────────────────────────────

import { enqueueOutbox, type PrismaTransactionClient } from './outbox.writer';

const TYPE = 'PAYABLE_CREATED' as const;
const ENTITY_ID = '0xabc';
const WALLET_KEY = 'evm:0x1234';
const PAYLOAD = { payableId: '0xabc', chainId: '0x1' };
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

function makeTx(walletResult: unknown): PrismaTransactionClient {
  return {
    wallet: {
      findUnique: vi.fn().mockResolvedValue(walletResult),
    },
    outbox: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaTransactionClient;
}

describe('enqueueOutbox', () => {
  it('skips when the event is older than maxEventAgeMs', async () => {
    const tx = makeTx({ user: { emailVerifiedAt: new Date() } });
    const oldTimestamp = new Date(Date.now() - MAX_AGE_MS - 1000);
    await enqueueOutbox(tx, TYPE, ENTITY_ID, WALLET_KEY, oldTimestamp, PAYLOAD, MAX_AGE_MS);
    expect((tx.outbox as any).upsert).not.toHaveBeenCalled();
  });

  it('skips when no Wallet row exists for the wallet key', async () => {
    const tx = makeTx(null);
    const now = new Date();
    await enqueueOutbox(tx, TYPE, ENTITY_ID, WALLET_KEY, now, PAYLOAD, MAX_AGE_MS);
    expect((tx.outbox as any).upsert).not.toHaveBeenCalled();
  });

  it('skips when the wallet exists but the user has no verified email', async () => {
    const tx = makeTx({ user: { emailVerifiedAt: null } });
    const now = new Date();
    await enqueueOutbox(tx, TYPE, ENTITY_ID, WALLET_KEY, now, PAYLOAD, MAX_AGE_MS);
    expect((tx.outbox as any).upsert).not.toHaveBeenCalled();
  });

  it('inserts an outbox row when all conditions are met', async () => {
    const tx = makeTx({ user: { emailVerifiedAt: new Date() } });
    const now = new Date();
    await enqueueOutbox(tx, TYPE, ENTITY_ID, WALLET_KEY, now, PAYLOAD, MAX_AGE_MS);
    expect((tx.outbox as any).upsert).toHaveBeenCalledOnce();
    const call = (tx.outbox as any).upsert.mock.calls[0][0];
    expect(call.where.dedupeKey).toBe(`${TYPE}:${ENTITY_ID}:${WALLET_KEY}`);
    expect(call.create.type).toBe(TYPE);
    expect(call.create.walletKey).toBe(WALLET_KEY);
  });

  it('uses upsert with empty update to deduplicate on conflict', async () => {
    const tx = makeTx({ user: { emailVerifiedAt: new Date() } });
    const now = new Date();
    await enqueueOutbox(tx, TYPE, ENTITY_ID, WALLET_KEY, now, PAYLOAD, MAX_AGE_MS);
    const call = (tx.outbox as any).upsert.mock.calls[0][0];
    // update is an empty object so an existing row is not touched.
    expect(call.update).toEqual({});
  });
});
