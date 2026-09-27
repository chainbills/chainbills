// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Job store tests
//
// Covers: createJob dedup, retryLater backoff schedule, MAX_RELAY_ATTEMPTS ->
// FAILED, markDone, markFailed, claimJob returns null when no jobs, countByStatus.
// ──────────────────────────────────────────────────────────────────────────────

import { Prisma, RelayJobStatus, RelayJobType } from '@prisma/client';
import { createJob, markDone, markFailed, retryLater, MAX_RELAY_ATTEMPTS } from './job.store';
import type { PrismaService } from '../prisma/prisma.service';

function makeJob(attempts = 0, status: RelayJobStatus = RelayJobStatus.PROCESSING) {
  return {
    id: 'job-1',
    type: RelayJobType.PAYABLE_UPDATE_VIA_WORMHOLE,
    status,
    sourceChainId: '0xsrc',
    destChainId: '0xdest',
    txHash: '0xhash',
    blockNumber: null,
    eventData: {},
    attempts,
    notBefore: new Date(),
    lastError: null,
    vaa: null,
    cctpMessage: null,
    cctpAttestation: null,
    userPaymentId: null,
    createdAt: new Date(),
    lastAttemptAt: null,
    completedAt: null,
  };
}

function makePrisma(overrides: Partial<PrismaService> = {}): PrismaService {
  return {
    relayJob: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  } as unknown as PrismaService;
}

describe('createJob', () => {
  it('returns 1 when a job is created', async () => {
    const prisma = makePrisma();
    const count = await createJob(prisma, {
      type: RelayJobType.PAYABLE_UPDATE_VIA_WORMHOLE,
      sourceChainId: '0xsrc',
      destChainId: '0xdest',
      txHash: '0xhash',
      eventData: {},
    });
    expect(count).toBe(1);
    expect((prisma.relayJob as any).createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });

  it('returns 0 and does not throw when P2002 unique violation occurs', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '6.0.0',
    });
    const prisma = makePrisma({
      relayJob: {
        createMany: vi.fn().mockRejectedValue(err),
      } as any,
    });
    const count = await createJob(prisma, {
      type: RelayJobType.PAYABLE_UPDATE_VIA_WORMHOLE,
      sourceChainId: '0xsrc',
      destChainId: '0xdest',
      txHash: '0xhash',
      eventData: {},
    });
    expect(count).toBe(0);
  });
});

describe('markDone', () => {
  it('sets status to DONE and completedAt', async () => {
    const prisma = makePrisma();
    await markDone(prisma, 'job-1');
    expect((prisma.relayJob as any).update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ status: RelayJobStatus.DONE }),
      })
    );
  });
});

describe('markFailed', () => {
  it('sets status to FAILED with the error message', async () => {
    const prisma = makePrisma();
    await markFailed(prisma, 'job-1', 'too many failures');
    const call = (prisma.relayJob as any).update.mock.calls[0][0];
    expect(call.data.status).toBe(RelayJobStatus.FAILED);
    expect(call.data.lastError).toContain('too many failures');
  });
});

describe('retryLater', () => {
  it('sets status to PENDING with a future notBefore', async () => {
    const prisma = makePrisma();
    const job = makeJob(1);
    const before = Date.now();
    await retryLater(prisma, job, 'transient error');
    const after = Date.now();
    const call = (prisma.relayJob as any).update.mock.calls[0][0];
    expect(call.data.status).toBe(RelayJobStatus.PENDING);
    // notBefore must be in the future
    expect(call.data.notBefore.getTime()).toBeGreaterThan(before);
    expect(call.data.notBefore.getTime()).toBeLessThan(after + 10 * 60 * 1000 + 1000);
  });

  it('uses exponential backoff: 10s * 2^attempts', async () => {
    const prisma = makePrisma();
    const job = makeJob(2); // attempts = 2
    const before = Date.now();
    await retryLater(prisma, job, 'error');
    const call = (prisma.relayJob as any).update.mock.calls[0][0];
    const notBeforeMs = call.data.notBefore.getTime();
    // Expected delay: 10000 * 2^2 = 40000 ms
    expect(notBeforeMs - before).toBeGreaterThanOrEqual(35_000);
    expect(notBeforeMs - before).toBeLessThanOrEqual(45_000);
  });

  it('caps backoff at 60 seconds', async () => {
    const prisma = makePrisma();
    // attempts = 7 -> 10000 * 128 = 1_280_000 > 60_000; should cap at 60_000
    const job = makeJob(7);
    const before = Date.now();
    await retryLater(prisma, job, 'error');
    const call = (prisma.relayJob as any).update.mock.calls[0][0];
    const notBeforeMs = call.data.notBefore.getTime();
    expect(notBeforeMs - before).toBeLessThanOrEqual(60_000 + 100);
  });

  it('marks the job FAILED after MAX_RELAY_ATTEMPTS', async () => {
    const prisma = makePrisma();
    const job = makeJob(MAX_RELAY_ATTEMPTS);
    await retryLater(prisma, job, 'too many');
    const call = (prisma.relayJob as any).update.mock.calls[0][0];
    expect(call.data.status).toBe(RelayJobStatus.FAILED);
  });
});

import { claimJob, countByStatus, patchArtefacts } from './job.store';

describe('claimJob', () => {
  it('returns null when no jobs are ready', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    } as unknown as PrismaService;
    const result = await claimJob(prisma);
    expect(result).toBeNull();
  });

  it('updates the job to PROCESSING when a job is found', async () => {
    const job = makeJob(0, RelayJobStatus.PENDING);
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([job]),
      relayJob: {
        update: vi.fn().mockResolvedValue({}),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...job, status: RelayJobStatus.PROCESSING, attempts: 1 }),
      },
    } as unknown as PrismaService;

    const result = await claimJob(prisma);
    expect(result).not.toBeNull();
    expect((prisma.relayJob as any).update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: RelayJobStatus.PROCESSING }),
      })
    );
  });
});

describe('patchArtefacts', () => {
  it('does nothing when no artefacts provided', async () => {
    const prisma = {
      relayJob: { update: vi.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    await patchArtefacts(prisma, 'job-1', {});
    expect((prisma.relayJob as any).update).not.toHaveBeenCalled();
  });

  it('updates only provided artefacts', async () => {
    const prisma = {
      relayJob: { update: vi.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    await patchArtefacts(prisma, 'job-1', { vaa: 'deadbeef' });
    const call = (prisma.relayJob as any).update.mock.calls[0][0];
    expect(call.data.vaa).toBe('deadbeef');
    expect(call.data.cctpMessage).toBeUndefined();
  });
});

describe('countByStatus', () => {
  it('returns zero counts when no jobs exist', async () => {
    const prisma = {
      relayJob: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;
    const counts = await countByStatus(prisma);
    expect(counts[RelayJobStatus.PENDING]).toBe(0);
    expect(counts[RelayJobStatus.FAILED]).toBe(0);
  });

  it('returns correct counts per status', async () => {
    const prisma = {
      relayJob: {
        groupBy: vi.fn().mockResolvedValue([
          { status: RelayJobStatus.PENDING, _count: { _all: 5 } },
          { status: RelayJobStatus.FAILED, _count: { _all: 2 } },
        ]),
      },
    } as unknown as PrismaService;
    const counts = await countByStatus(prisma);
    expect(counts[RelayJobStatus.PENDING]).toBe(5);
    expect(counts[RelayJobStatus.FAILED]).toBe(2);
    expect(counts[RelayJobStatus.DONE]).toBe(0);
  });
});
