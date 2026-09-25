// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Postgres advisory lock
//
// Takes `pg_try_advisory_lock(CHAINBILLS_WORKER_LOCK)` on a dedicated
// connection. A second worker process that tries to acquire the lock fails
// immediately (non-blocking), stays idle, and retries every 30 s.
//
// The lock is session-scoped: it is automatically released when the connection
// is closed. The dedicated connection is never returned to the pool, so only
// one process per Postgres instance ever holds the lock.
//
// CHAINBILLS_WORKER_LOCK = keccak256("chainbills.worker") truncated to int64.
// Chosen constant so it never collides with application table OIDs.
// ──────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import { Client } from 'pg';

const logger = new Logger('AdvisoryLock');

/** Advisory lock key: a stable int64 derived from the service name. */
// keccak256("chainbills.worker") lower 8 bytes, cast to bigint, within int64 range.
export const CHAINBILLS_WORKER_LOCK = 7_461_981_372_534_109_293n;

/**
 * How long to wait between retry attempts when the lock is held by another
 * process. 3s is short enough that a hot-reload / rolling-deploy overlap heals
 * in a couple ticks, and light enough on Postgres that real HA contention (two
 * standby replicas polling) is still trivial load.
 */
const RETRY_INTERVAL_MS = 3_000;

/**
 * TCP keepalive on the dedicated lock connection so Postgres notices a hard
 * process death (SIGKILL, crash, host loss) within ~10s and releases the
 * session-scoped lock, instead of holding it for the default TCP idle timeout
 * of hours. The standby can then acquire it on its next tick.
 */
const KEEPALIVE_INITIAL_DELAY_MS = 10_000;

/**
 * Attempts to acquire `pg_try_advisory_lock` on a dedicated PG connection.
 * Resolves the connection once the lock is held. The caller should call
 * `releaseLock()` on shutdown.
 *
 * @param databaseUrl  Postgres connection string.
 * @returns            The pg `Client` holding the lock (never released until shutdown).
 */
export async function acquireAdvisoryLock(databaseUrl: string): Promise<Client> {
  while (true) {
    const client = new Client({
      connectionString: databaseUrl,
      keepAlive: true,
      keepAliveInitialDelayMillis: KEEPALIVE_INITIAL_DELAY_MS,
    });
    try {
      await client.connect();
      const res = await client.query('SELECT pg_try_advisory_lock($1::bigint) AS locked', [
        CHAINBILLS_WORKER_LOCK.toString(),
      ]);

      if (res.rows[0]?.locked === true) {
        logger.log('acquired advisory lock — this instance is the active worker');
        return client;
      }

      // Another process holds the lock — stay idle and retry.
      logger.warn('advisory lock held by another worker — this instance will stay idle and retry in 30s');
      await client.end();
    } catch (err) {
      logger.error({ err }, 'error acquiring advisory lock — will retry in 30s');
      try {
        await client.end();
      } catch {
        // Ignore cleanup errors.
      }
    }

    await new Promise<void>((r) => setTimeout(r, RETRY_INTERVAL_MS));
  }
}

/**
 * Releases the advisory lock and closes the dedicated connection.
 * Called on graceful shutdown.
 */
export async function releaseAdvisoryLock(lockClient: Client): Promise<void> {
  try {
    await lockClient.query('SELECT pg_advisory_unlock($1::bigint)', [CHAINBILLS_WORKER_LOCK.toString()]);
    await lockClient.end();
    logger.log('advisory lock released');
  } catch (err) {
    logger.error({ err }, 'error releasing advisory lock');
  }
}
