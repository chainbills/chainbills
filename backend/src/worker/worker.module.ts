// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Worker module
//
// Imported by AppModule only when ROLE is "worker" or "all" (SPEC.md §2.1).
// On application bootstrap:
//   1. Acquires the Postgres advisory lock (SPEC.md §2.2). Loops start only
//      while the lock is held. A second instance with the same DB stays idle.
//   2. Checks RELAYER_ROLE on each enabled EVM chain (SPEC §6.1).
//   3. Starts per-chain indexer loops (one per enabled EVM chain).
//   4. Starts the relay processor loop.
//   5. Starts the outbox processor loop (phase 3b).
//   6. Starts the gas-balance check loop (every 5 min).
//   7. Starts the heartbeat loop (every 15 min).
//
// All loops catch iteration errors and retry next tick; they never crash the
// process (SPEC.md §2.3).
// ──────────────────────────────────────────────────────────────────────────────

import { Module, OnApplicationBootstrap, OnApplicationShutdown, Logger } from '@nestjs/common';
import { readContract } from 'viem/actions';
import { formatEther, type PublicClient } from 'viem';
import { evmAccountFromPrivateKey, createEvmPublicClient } from '../chains/clients';
import { chainbillsAbi } from '../chains/abi/chainbills';
import { ChainsModule } from '../chains/chains.module';
import type { ChainsService } from '../chains/chains.service';
import { AppConfigModule } from '../config/config.module';
import type { AppConfigService } from '../config/app-config.service';
import { PrismaModule } from '../prisma/prisma.module';
import type { PrismaService } from '../prisma/prisma.service';
import { EvmIndexerModule } from '../indexer/evm/evm-indexer.module';
import type { EvmIndexer } from '../indexer/evm/evm.indexer';
import { RelayModule } from '../relay/relay.module';
import type { RelayProcessor } from '../relay/relay.processor';
import type { Client as PgClient } from 'pg';
import { acquireAdvisoryLock, releaseAdvisoryLock } from './advisory-lock';
import { runLoop } from './loop-runner';
import { countByStatus } from '../relay/job.store';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutboxProcessor } from '../notifications/outbox.processor';

const GAS_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000; // 15 min
const RELAY_LOOP_INTERVAL_MS = 1_000; // 1 second between relay iterations
const OUTBOX_LOOP_INTERVAL_MS = 5_000; // 5 seconds between outbox iterations

@Module({
  imports: [PrismaModule, ChainsModule, AppConfigModule, EvmIndexerModule, RelayModule, NotificationsModule],
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
    private readonly relayProcessor: RelayProcessor,
    private readonly outboxProcessor: OutboxProcessor
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Acquire the advisory lock — loops only start after it is held.
    this.lockClient = await acquireAdvisoryLock(this.config.env.databaseUrl);

    // Startup RELAYER_ROLE check.
    await this.checkRelayerRoles();

    const relayerKey = this.config.env.relayerPrivateKey;
    if (!relayerKey) {
      this.logger.error('RELAYER_PRIVATE_KEY is not set — relay loop will not start');
      return;
    }

    const relayerAccount = evmAccountFromPrivateKey(relayerKey as `0x${string}`);

    // Start one indexer loop per enabled EVM chain.
    for (const chain of this.chains.enabled) {
      if (!chain.isEvm) continue;

      const intervalMs = this.config.env.pollIntervalMsOverride ?? chain.pollIntervalMs ?? 12_000;

      const stop = runLoop({
        name: `evm-indexer:${chain.slug}`,
        intervalMs,
        fn: () => this.evmIndexer.tick(chain),
      });
      this.stopFns.push(stop);
    }

    // Relay processor loop (sequential, 1s between iterations).
    const stopRelay = runLoop({
      name: 'relay-processor',
      intervalMs: RELAY_LOOP_INTERVAL_MS,
      fn: () => this.relayProcessor.processOne(relayerAccount).then(() => undefined),
    });
    this.stopFns.push(stopRelay);

    // Outbox processor loop (5s between iterations).
    const stopOutbox = runLoop({
      name: 'outbox-processor',
      intervalMs: OUTBOX_LOOP_INTERVAL_MS,
      fn: () => this.outboxProcessor.tick(),
    });
    this.stopFns.push(stopOutbox);

    // Gas-balance check loop.
    const stopGas = runLoop({
      name: 'gas-balance',
      intervalMs: GAS_CHECK_INTERVAL_MS,
      fn: () => this.gasBalanceCheck(relayerAccount.address),
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
        relayerAddress: relayerAccount.address,
      },
      'worker started'
    );
  }

  async onApplicationShutdown(): Promise<void> {
    this.logger.log('worker shutting down — stopping loops');

    // Stop all loops, waiting for current iterations to finish.
    await Promise.all(this.stopFns.map((stop) => stop()));

    if (this.lockClient) {
      await releaseAdvisoryLock(this.lockClient);
      this.lockClient = null;
    }
  }

  /**
   * Checks RELAYER_ROLE on each enabled EVM chain and warns when the relayer
   * wallet lacks it while relaying is restricted (SPEC §6.1).
   */
  private async checkRelayerRoles(): Promise<void> {
    const relayerKey = this.config.env.relayerPrivateKey;
    if (!relayerKey) return;

    const relayerAccount = evmAccountFromPrivateKey(relayerKey as `0x${string}`);

    for (const chain of this.chains.enabled) {
      if (!chain.isEvm || !chain.diamondAddress) continue;

      try {
        const client = createEvmPublicClient(chain, this.chains.getRpcUrl(chain)) as PublicClient;

        const protocolConfig = await readContract(client, {
          address: chain.diamondAddress,
          abi: chainbillsAbi,
          functionName: 'getProtocolConfig',
        });

        if (!protocolConfig.isRelayerRestricted) continue;

        // Fetch RELAYER_ROLE bytes32 constant.
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

  /** Checks the relayer wallet's ETH balance on each enabled EVM chain and warns if low. */
  private async gasBalanceCheck(relayerAddress: `0x${string}`): Promise<void> {
    for (const chain of this.chains.enabled) {
      if (!chain.isEvm) continue;
      try {
        const client = createEvmPublicClient(chain, this.chains.getRpcUrl(chain)) as PublicClient;
        const balance = await client.getBalance({ address: relayerAddress });

        if (balance < chain.minGasBalance) {
          this.logger.warn(
            { chain: chain.slug, balance: formatEther(balance), relayerAddress },
            'low relayer gas balance — please fund the relayer wallet'
          );
        } else {
          this.logger.debug({ chain: chain.slug, balance: formatEther(balance) }, 'gas balance ok');
        }
      } catch (err) {
        this.logger.error({ chain: chain.slug, err }, 'gas balance check failed');
      }
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
            relayScanBlock: cursor.relayScanBlock.toString(),
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
