// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Advisory lock e2e test
//
// Verifies that a second process trying to acquire the advisory lock while the
// first holds it does not succeed (pg_try_advisory_lock returns false).
//
// Requires a real Postgres: TEST_DATABASE_URL env var must be set.
// Run with: pnpm test:e2e (which calls vitest run --config vitest.e2e.config.ts)
// ──────────────────────────────────────────────────────────────────────────────

import { Client } from 'pg';
import { CHAINBILLS_WORKER_LOCK } from '../src/worker/advisory-lock';

// eslint-disable-next-line no-restricted-syntax
const TEST_DB_URL = process.env['TEST_DATABASE_URL'];

const describeIf = TEST_DB_URL ? describe : describe.skip;

describeIf('Advisory lock (requires Postgres via TEST_DATABASE_URL)', () => {
  let clientA: Client;
  let clientB: Client;

  beforeAll(async () => {
    clientA = new Client({ connectionString: TEST_DB_URL });
    clientB = new Client({ connectionString: TEST_DB_URL });
    await clientA.connect();
    await clientB.connect();
  });

  afterAll(async () => {
    await clientA.query('SELECT pg_advisory_unlock($1::bigint)', [CHAINBILLS_WORKER_LOCK.toString()]);
    await clientA.end();
    await clientB.end();
  });

  it('first client acquires the lock', async () => {
    const res = await clientA.query('SELECT pg_try_advisory_lock($1::bigint) AS locked', [
      CHAINBILLS_WORKER_LOCK.toString(),
    ]);
    expect(res.rows[0].locked).toBe(true);
  });

  it('second client cannot acquire the same lock', async () => {
    const res = await clientB.query('SELECT pg_try_advisory_lock($1::bigint) AS locked', [
      CHAINBILLS_WORKER_LOCK.toString(),
    ]);
    expect(res.rows[0].locked).toBe(false);
  });

  it('after first client releases, second client can acquire', async () => {
    await clientA.query('SELECT pg_advisory_unlock($1::bigint)', [CHAINBILLS_WORKER_LOCK.toString()]);
    const res = await clientB.query('SELECT pg_try_advisory_lock($1::bigint) AS locked', [
      CHAINBILLS_WORKER_LOCK.toString(),
    ]);
    expect(res.rows[0].locked).toBe(true);
    // Clean up: release from B
    await clientB.query('SELECT pg_advisory_unlock($1::bigint)', [CHAINBILLS_WORKER_LOCK.toString()]);
  });
});
