// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Advisory lock unit tests
//
// Covers the lock key constant, the release path, and the acquire path
// (with a mocked pg Client).
// ──────────────────────────────────────────────────────────────────────────────

const { MockClient } = vi.hoisted(() => ({ MockClient: vi.fn() }));

vi.mock('pg', () => ({
  default: { Client: MockClient },
  Client: MockClient,
}));

import { CHAINBILLS_WORKER_LOCK, acquireAdvisoryLock, releaseAdvisoryLock } from './advisory-lock';

describe('CHAINBILLS_WORKER_LOCK', () => {
  it('is a positive non-zero bigint', () => {
    expect(typeof CHAINBILLS_WORKER_LOCK).toBe('bigint');
    expect(CHAINBILLS_WORKER_LOCK).toBeGreaterThan(0n);
  });

  it('fits within a signed int64', () => {
    const MAX_INT64 = 9_223_372_036_854_775_807n;
    expect(CHAINBILLS_WORKER_LOCK).toBeLessThanOrEqual(MAX_INT64);
  });
});

describe('acquireAdvisoryLock', () => {
  it('returns the client when pg_try_advisory_lock succeeds on the first try', async () => {
    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ rows: [{ locked: true }] }),
      end: vi.fn().mockResolvedValue(undefined),
    };
    MockClient.mockImplementation(function (this: any) {
      this.connect = mockClient.connect;
      this.query = mockClient.query;
      this.end = mockClient.end;
    });

    const result = await acquireAdvisoryLock('postgres://localhost/test');
    expect(mockClient.connect).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('retries when the lock is held by another process, then acquires', async () => {
    let callCount = 0;
    const mockConnect = vi.fn().mockResolvedValue(undefined);
    const mockEnd = vi.fn().mockResolvedValue(undefined);
    const mockQuery = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return { rows: [{ locked: false }] };
      return { rows: [{ locked: true }] };
    });

    MockClient.mockImplementation(function (this: any) {
      this.connect = mockConnect;
      this.query = mockQuery;
      this.end = mockEnd;
    });

    // Make setTimeout instant so the test does not wait 30s.
    const origSetTimeout = global.setTimeout;
    vi.stubGlobal('setTimeout', (fn: () => void) => {
      fn();
      return 0 as any;
    });

    const result = await acquireAdvisoryLock('postgres://localhost/test');
    expect(result).toBeDefined();
    expect(callCount).toBeGreaterThanOrEqual(2);

    vi.stubGlobal('setTimeout', origSetTimeout);
  });
});

describe('releaseAdvisoryLock', () => {
  it('calls pg_advisory_unlock and ends the connection', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({}),
      end: vi.fn().mockResolvedValue(undefined),
    };

    await releaseAdvisoryLock(mockClient as any);

    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_unlock'), expect.any(Array));
    expect(mockClient.end).toHaveBeenCalled();
  });

  it('does not throw when the query fails', async () => {
    const mockClient = {
      query: vi.fn().mockRejectedValue(new Error('connection lost')),
      end: vi.fn().mockResolvedValue(undefined),
    };

    await expect(releaseAdvisoryLock(mockClient as any)).resolves.toBeUndefined();
  });
});
