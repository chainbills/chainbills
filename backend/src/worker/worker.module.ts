// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Worker module
//
// Imported by AppModule only when ROLE is "worker" or "all".
// On application bootstrap:
//   1. Acquires the Postgres advisory lock. Loops start only while the lock
//      is held. A second instance with the same DB stays idle.
//   2. Checks RELAYER_ROLE on each enabled EVM chain.
//   3. Starts per-chain indexer loops (one per enabled EVM chain).
//   4. Starts the relay processor loop.
//   5. Starts the outbox processor loop.
//   6. Starts the gas-balance check loop (every 5 min).
//   7. Starts the heartbeat loop (every 15 min).
//
// All loops catch iteration errors and retry next tick; they never crash the
// process.
// ──────────────────────────────────────────────────────────────────────────────

import { Module, OnApplicationBootstrap, OnApplicationShutdown, Logger } from '@nestjs/common';
import { readContract } from 'viem/actions';
import { formatEther, type PublicClient } from 'viem';
import { evmAccountFromPrivateKey, createEvmPublicClient } from '../chains/clients';
import { chainbillsAbi } from '../chains/abi/chainbills';
import { ChainsModule } from '../chains/chains.module';
import { ChainsService } from '../chains/chains.service';
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { EvmIndexerModule } from '../indexer/evm/evm-indexer.module';
import { EvmIndexer } from '../indexer/evm/evm.indexer';
import { SolanaIndexerModule } from '../indexer/solana/solana-indexer.module';
import { SolanaIndexer } from '../indexer/solana/solana.indexer';
import { RelayModule } from '../relay/relay.module';
import { RelayProcessor } from '../relay/relay.processor';
import type { Client as PgClient } from 'pg';
import { acquireAdvisoryLock, releaseAdvisoryLock } from './advisory-lock';
import { runLoop } from './loop-runner';
import { countByStatus } from '../relay/job.store';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutboxProcessor } from '../notifications/outbox.processor';

const GAS_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000; // 15 min

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Backoff schedule for the relay loop.
 * Stays at 1 s while jobs keep arriving; slows to 30 s when the queue is
 * empty for an extended stretch. Max 30 s so a freshly-indexed job is never
 * delayed more than 30 s past when the indexer detects it.
 */
function relayBackoffMs(emptyStreak: number): number {
  if (emptyStreak === 0) return 1_000;
  if (emptyStreak < 5) return 5_000;
  if (emptyStreak < 20) return 15_000;
  return 30_000;
}

/**
 * Backoff schedule for the outbox loop.
 * Emails are not latency-critical; back off to 60 s when the outbox is idle.
 */
function outboxBackoffMs(emptyStreak: number): number {
  if (emptyStreak < 3) return 5_000;
  if (emptyStreak < 10) return 30_000;
  return 60_000;
}

/**
 * Backoff schedule for a per-chain indexer loop.
 * Base interval is the chain's configured `pollIntervalMs` (500 ms - 5 s
 * depending on chain). Idle chains slow to at most 30 s. Any activity —
 * counter advance or nudge — resets to the base interval on the next tick.
 */
function indexerBackoffMs(baseIntervalMs: number, emptyStreak: number): number {
  if (emptyStreak === 0) return baseIntervalMs;
  if (emptyStreak < 3) return baseIntervalMs * 2;
  if (emptyStreak < 10) return Math.min(baseIntervalMs * 6, 15_000);
  return 30_000;
}

/**
 * Acquires the Postgres advisory lock, starts per-chain indexer loops, the relay processor,
 * the outbox processor, gas checks, and the heartbeat — active only when ROLE is "worker" or "all".
 */
@Module({
  imports: [
    PrismaModule,
    ChainsModule,
    AppConfigModule,
    EvmIndexerModule,
    SolanaIndexerModule,
    RelayModule,
    NotificationsModule,
  ],
  providers: [OutboxProcessor],
})
export class WorkerModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WorkerModule.name);

  private lockClient: PgClient | null = null;
  private readonly stopFns: Array<() => Promise<void>> = [];

  constructor(
    private readonly chains: ChainsService,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly evmIndexer: EvmIndexer,
    private readonly solanaIndexer: SolanaIndexer,
    private readonly relayProcessor: RelayProcessor,
    private readonly outboxProcessor: OutboxProcessor
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Acquire the advisory lock — loops only start after it is held.
    this.lockClient = await acquireAdvisoryLock(this.config.env.databaseUrl);

    // Startup RELAYER_ROLE check.
    await this.checkRelayerRoles();

    const testnetsKey = this.config.env.evmTestnetsRelayerPrivateKey;
    const mainnetsKey = this.config.env.evmMainnetsRelayerPrivateKey;

    if (!testnetsKey && !mainnetsKey) {
      this.logger.error('neither EVM_TESTNETS_RELAYER_PRIVATE_KEY nor EVM_MAINNETS_RELAYER_PRIVATE_KEY is set — relay loop will not start');
      return;
    }

    const testnetsAccount = testnetsKey ? evmAccountFromPrivateKey(testnetsKey) : undefined;
    const mainnetsAccount = mainnetsKey ? evmAccountFromPrivateKey(mainnetsKey) : undefined;

    // Start one indexer loop per enabled EVM chain — adaptive backoff on
    // idle. `tick()` returns { didWork } so we back off when there was no
    // on-chain movement and snap back to the base interval on activity.
    for (const chain of this.chains.enabled) {
      if (!chain.isEvm) continue;

      const baseIntervalMs = this.config.env.pollIntervalMsOverride ?? chain.pollIntervalMs ?? 12_000;
      const indexerLog = new Logger(`Loop:evm-indexer:${chain.slug}`);
      let running = true;
      let emptyStreak = 0;
      const done = (async () => {
        while (running) {
          try {
            const { didWork } = await this.evmIndexer.tick(chain);
            emptyStreak = didWork ? 0 : emptyStreak + 1;
          } catch (err) {
            indexerLog.error({ err }, 'indexer iteration error — will retry');
            emptyStreak++;
          }
          if (!running) break;
          await sleep(indexerBackoffMs(baseIntervalMs, emptyStreak));
        }
      })();
      this.stopFns.push(async () => {
        running = false;
        await done;
      });
    }

    // Start one indexer loop per enabled Solana chain.
    for (const chain of this.chains.enabled) {
      if (!chain.isSolana) continue;

      const intervalMs = this.config.env.pollIntervalMsOverride ?? chain.pollIntervalMs ?? 5_000;

      const stop = runLoop({
        name: `solana-indexer:${chain.slug}`,
        intervalMs,
        fn: () => this.solanaIndexer.tick(chain),
      });
      this.stopFns.push(stop);
    }

    // Relay processor loop — adaptive backoff: 1 s while jobs are flowing,
    // up to 30 s when the queue has been empty for a while.
    const relayLog = new Logger('Loop:relay-processor');
    let relayRunning = true;
    let relayEmptyStreak = 0;
    const relayDone = (async () => {
      while (relayRunning) {
        try {
          const found = await this.relayProcessor.processOne(testnetsAccount, mainnetsAccount);
          relayEmptyStreak = found ? 0 : relayEmptyStreak + 1;
        } catch (err) {
          relayLog.error({ err }, 'relay iteration error — will retry');
          relayEmptyStreak++;
        }
        if (!relayRunning) break;
        await sleep(relayBackoffMs(relayEmptyStreak));
      }
    })();
    this.stopFns.push(async () => { relayRunning = false; await relayDone; });

    // Outbox processor loop — adaptive backoff: 5 s while emails are queued,
    // up to 60 s when the outbox has been empty for a while.
    const outboxLog = new Logger('Loop:outbox-processor');
    let outboxRunning = true;
    let outboxEmptyStreak = 0;
    const outboxDone = (async () => {
      while (outboxRunning) {
        try {
          const found = await this.outboxProcessor.tick();
          outboxEmptyStreak = found ? 0 : outboxEmptyStreak + 1;
        } catch (err) {
          outboxLog.error({ err }, 'outbox iteration error — will retry');
          outboxEmptyStreak++;
        }
        if (!outboxRunning) break;
        await sleep(outboxBackoffMs(outboxEmptyStreak));
      }
    })();
    this.stopFns.push(async () => { outboxRunning = false; await outboxDone; });

    // Gas-balance check loop.
    const stopGas = runLoop({
      name: 'gas-balance',
      intervalMs: GAS_CHECK_INTERVAL_MS,
      fn: () => this.gasBalanceCheck(testnetsAccount?.address, mainnetsAccount?.address),
    });
    this.stopFns.push(stopGas);

    // Heartbeat loop.
    const stopHeartbeat = runLoop({
      name: 'heartbeat',
      intervalMs: HEARTBEAT_INTERVAL_MS,
      fn: () => this.heartbeat(),
    });
    this.stopFns.push(stopHeartbeat);

    this.logger.log(
      {
        enabledChains: this.chains.enabled.map((c) => c.slug),
        testnetsRelayerAddress: testnetsAccount?.address,
        mainnetsRelayerAddress: mainnetsAccount?.address,
      },
      'worker started'
    );
  }

  async onApplicationShutdown(): Promise<void> {
    this.logger.log('worker shutting down — stopping loops');

    // Stop all loops, waiting for current iterations to finish.
    await Promise.all(this.stopFns.map((stop) => stop()));

    // Flush any pending indexer batches so activities collected in memory but
    // not yet written aren't lost. Best-effort — a chain whose flush fails is
    // still safe because the on-chain cursor never advanced.
    try {
      await this.evmIndexer.flushAll();
    } catch (err) {
      this.logger.error({ err }, 'indexer flushAll on shutdown failed — activities will be re-fetched on next boot');
    }

    if (this.lockClient) {
      await releaseAdvisoryLock(this.lockClient);
      this.lockClient = null;
    }
  }

  /**
   * Checks RELAYER_ROLE on each enabled EVM chain and warns when the relayer
   * wallet lacks it while relaying is restricted.
   *
   * Selects the testnets key for testnet/local chains and the mainnets key for
   * mainnet chains. Skips chains whose key tier is not configured.
   */
  private async checkRelayerRoles(): Promise<void> {
    const testnetsKey = this.config.env.evmTestnetsRelayerPrivateKey;
    const mainnetsKey = this.config.env.evmMainnetsRelayerPrivateKey;
    if (!testnetsKey && !mainnetsKey) return;

    for (const chain of this.chains.enabled) {
      if (!chain.isEvm || !chain.diamondAddress) continue;

      const key = chain.network === 'mainnet' ? mainnetsKey : testnetsKey;
      if (!key) continue;

      const relayerAccount = evmAccountFromPrivateKey(key);

      try {
        const client = createEvmPublicClient(chain, this.chains.getRpcUrl(chain)) as PublicClient;

        const protocolConfig = await readContract(client, {
          address: chain.diamondAddress,
          abi: chainbillsAbi,
          functionName: 'getProtocolConfig',
        });

        if (!protocolConfig.isRelayerRestricted) continue;

        const relayerRole = await readContract(client, {
          address: chain.diamondAddress,
          abi: chainbillsAbi,
          functionName: 'RELAYER_ROLE',
        });

        const hasRole = await readContract(client, {
          address: chain.diamondAddress,
          abi: chainbillsAbi,
          functionName: 'hasRole',
          args: [relayerRole as `0x${string}`, relayerAccount.address],
        });

        if (!hasRole) {
          this.logger.warn(
            { chain: chain.slug, relayerAddress: relayerAccount.address },
            'relaying is restricted on this chain but the relayer wallet lacks RELAYER_ROLE — relay submissions will fail'
          );
        } else {
          this.logger.log({ chain: chain.slug }, 'relayer has RELAYER_ROLE');
        }
      } catch (err) {
        this.logger.error({ chain: chain.slug, err }, 'RELAYER_ROLE check failed');
      }
    }
  }

  /**
   * Checks relayer wallet native balances on each enabled chain.
   * Selects the testnets address for testnet/local chains and the mainnets
   * address for mainnet chains. Skips chains whose key tier is not configured.
   */
  private async gasBalanceCheck(
    testnetsAddress: `0x${string}` | undefined,
    mainnetsAddress: `0x${string}` | undefined,
  ): Promise<void> {
    for (const chain of this.chains.enabled) {
      if (chain.isEvm) {
        const relayerAddress = chain.network === 'mainnet' ? mainnetsAddress : testnetsAddress;
        if (!relayerAddress) continue;

        try {
          const client = createEvmPublicClient(chain, this.chains.getRpcUrl(chain)) as PublicClient;
          const balance = await client.getBalance({ address: relayerAddress });

          if (balance < chain.minGasBalance) {
            this.logger.warn(
              { chain: chain.slug, balance: formatEther(balance), relayerAddress },
              'low relayer gas balance — please fund the relayer wallet'
            );
          } else {
            this.logger.log({ chain: chain.slug, balance: formatEther(balance), relayerAddress }, 'gas balance ok');
          }
        } catch (err) {
          this.logger.error({ chain: chain.slug, err }, 'gas balance check failed');
        }
      } else if (chain.isSolana) {
        await this.solanaGasBalanceCheck(chain);
      }
    }
  }

  /** Checks the Solana relayer wallet's SOL balance and warns if below minGasBalance. */
  private async solanaGasBalanceCheck(chain: import('../chains/types').SolanaChainConfig): Promise<void> {
    const keypairBytes = this.config.env.solanaRelayerKeypair;
    if (!keypairBytes) return;

    try {
      const { Connection, Keypair } = await import('@solana/web3.js');
      const relayerKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairBytes));
      const rpcUrl = this.chains.getRpcUrl(chain);
      const connection = new Connection(rpcUrl, 'confirmed');
      const balanceLamports = await connection.getBalance(relayerKeypair.publicKey);
      const balanceBigInt = BigInt(balanceLamports);

      if (balanceBigInt < chain.minGasBalance) {
        this.logger.warn(
          {
            chain: chain.slug,
            balanceLamports,
            minGasBalance: chain.minGasBalance.toString(),
            relayerAddress: relayerKeypair.publicKey.toBase58(),
          },
          'low Solana relayer SOL balance — please fund the relayer wallet'
        );
      } else {
        this.logger.log(
          { chain: chain.slug, balanceLamports, relayerAddress: relayerKeypair.publicKey.toBase58() },
          'Solana gas balance ok'
        );
      }
    } catch (err) {
      this.logger.error({ chain: chain.slug, err }, 'Solana gas balance check failed');
    }
  }

  /** Logs chain cursors, relay job counts, and on-chain stats as a liveness signal. */
  private async heartbeat(): Promise<void> {
    const cursors = await this.prisma.chainCursor.findMany();
    const jobCounts = await countByStatus(this.prisma);

    for (const cursor of cursors) {
      const chain = this.chains.byCbChainId(cursor.chainId);
      if (!chain || !chain.isEvm) continue;

      try {
        const client = createEvmPublicClient(chain, this.chains.getRpcUrl(chain)) as PublicClient;
        const stats = await readContract(client, {
          address: chain.diamondAddress!,
          abi: chainbillsAbi,
          functionName: 'getChainStats',
        });

        this.logger.log(
          {
            chain: chain.slug,
            activitiesIndexed: cursor.activitiesIndexed.toString(),
            onChainActivities: stats.activitiesCount.toString(),
            lastTickAt: cursor.lastTickAt,
          },
          'heartbeat cursor'
        );
      } catch (err) {
        this.logger.error({ chain: chain?.slug, err }, 'heartbeat chain stats fetch failed');
      }
    }

    this.logger.log({ jobs: jobCounts }, 'heartbeat relay job counts');
  }
}
