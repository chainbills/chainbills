// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Public API service
//
// Business logic for all public read endpoints (SPEC.md §12.2). All methods
// are read-only Prisma queries; no mutations happen here except for the
// description upsert which is host-authenticated.
//
// Invariants:
//   - EVM addresses in responses are checksummed via viem getAddress.
//   - Solana addresses are returned as stored (base58, case-preserved).
//   - Amounts are shaped as { token, symbol, decimals, amount, formatted }.
//   - Chain fields are shaped as { chainId, slug, displayName }.
//   - GET /stats result is cached in-process for 30 s; second call within that
//     window reuses the previous result without hitting Postgres.
//   - Description writes strip HTML tags before persisting.
//   - On-chain host verification (isPayableHost / Solana PDA) is called only
//     when the payable is not yet in the database.
// ──────────────────────────────────────────────────────────────────────────────

import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { getAddress } from 'viem';
import { readContract } from 'viem/actions';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChainsService } from '../chains/chains.service';
import { createEvmPublicClient } from '../chains/clients';
import { chainbillsAbi } from '../chains/abi/chainbills';
import type { EvmChainConfig } from '../chains/types';
import { CHAIN_BY_CB_CHAIN_ID, CHAIN_BY_SLUG, CHAINS } from '../chains/registry';
import { resolveTokenFromRegistry, TOKENS } from '../chains/tokens';
import { formatAmount } from '../common/amount/format-amount';
import { encodeCursor, decodeCursor, type CursorPage } from '../common/pagination/cursor';
import { findByPaymentId } from '../relay/job.store';

/** Strip all HTML tags from a string. */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/** Shape of an amount field in API responses (SPEC.md §12.1). */
export interface AmountDto {
  token: string;
  symbol: string;
  decimals: number;
  amount: string;
  formatted: string;
}

/** Shape of a chain field in API responses (SPEC.md §12.1). */
export interface ChainDto {
  chainId: string;
  slug: string;
  displayName: string;
}

/** Relay status shape returned alongside a UserPayment. */
export interface RelayStatusDto {
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  attempts: number;
  lastError: string | null;
}

/** Stats bucket for one chain+token combination. */
export interface StatsBucketDto {
  chainId: string;
  chainSlug: string;
  token: string;
  symbol: string;
  decimals: number;
  paymentsCount: string;
  paidVolume: string;
  paidVolumeFormatted: string;
  receivedVolume: string;
  receivedVolumeFormatted: string;
  withdrawnVolume: string;
  withdrawnVolumeFormatted: string;
}

/** In-process stats cache entry. */
interface StatsCache {
  data: StatsBucketDto[];
  computedAt: number;
}

const STATS_CACHE_TTL_MS = 30_000;

/**
 * Builds the API chain shape from a cbChainId stored in the database.
 * Returns null when the chain is not found in the registry (should not
 * happen in practice but handled gracefully).
 */
function chainDtoFromChainId(chainId: string): ChainDto | null {
  const chain = CHAIN_BY_CB_CHAIN_ID.get(chainId);
  if (!chain) return null;
  return { chainId: chain.cbChainId, slug: chain.slug, displayName: chain.displayName };
}

/**
 * Formats a raw integer amount (from Decimal stored as string) into an
 * AmountDto. Falls back to symbol='UNKNOWN' / decimals=0 when the token
 * is not in the registry for that chain.
 */
function buildAmountDto(rawAmount: string, tokenAddress: string, chainId: string): AmountDto {
  const chain = CHAIN_BY_CB_CHAIN_ID.get(chainId);
  const resolved = chain ? resolveTokenFromRegistry(tokenAddress, chain.slug) : undefined;
  const symbol = resolved?.symbol ?? 'UNKNOWN';
  const decimals = resolved?.decimals ?? 0;
  return {
    token: tokenAddress,
    symbol,
    decimals,
    amount: rawAmount,
    formatted: formatAmount(rawAmount, decimals),
  };
}

/** Determines whether a stored address is EVM (starts with 0x). */
function isEvmAddress(address: string): boolean {
  return address.startsWith('0x');
}

@Injectable()
export class PublicApiService {
  private readonly logger = new Logger(PublicApiService.name);
  private statsCache: StatsCache | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chains: ChainsService
  ) {}

  // ─── /chains ──────────────────────────────────────────────────────────────

  /** Returns all registry chains with their protocol flags and token list. */
  getChains() {
    return CHAINS.map((chain) => {
      // Collect tokens for this chain from the static registry.
      const chainTokens = TOKENS.flatMap((t) => {
        const detail = t.details[chain.slug];
        if (!detail || !detail.address) return [];
        return [{ address: detail.address, symbol: detail.symbol, decimals: detail.decimals }];
      });

      return {
        chainId: chain.cbChainId,
        slug: chain.slug,
        displayName: chain.displayName,
        network: chain.network,
        protocols: {
          wormhole: chain.wormholeChainId !== undefined,
          cctp: chain.circleDomain !== undefined,
        },
        tokens: chainTokens,
      };
    });
  }

  // ─── /payables/:id ────────────────────────────────────────────────────────

  /** Returns a single payable with all its child data and lifetime totals. */
  async getPayable(id: string) {
    const payable = await this.prisma.payable.findUnique({
      where: { id },
      include: {
        allowedTokens: true,
        balances: true,
        payments: {
          select: { token: true, amount: true, chainId: true },
        },
      },
    });
    if (!payable) throw new NotFoundException(`payable ${id} not found`);

    const description = await this.prisma.payableDescription.findUnique({
      where: { payableId: id },
    });

    // Compute lifetime received per token from PayablePayment rows.
    const lifetimeMap = new Map<string, bigint>();
    for (const p of payable.payments) {
      const prev = lifetimeMap.get(p.token) ?? 0n;
      lifetimeMap.set(p.token, prev + BigInt(p.amount.toString()));
    }
    const lifetimeReceived = [...lifetimeMap.entries()].map(([token, total]) =>
      buildAmountDto(total.toString(), token, payable.chainId)
    );

    const chain = chainDtoFromChainId(payable.chainId);
    const hostAddr = isEvmAddress(payable.host) ? getAddress(payable.host) : payable.host;

    return {
      id: payable.id,
      chain,
      host: hostAddr,
      hostWalletKey: payable.hostWalletKey,
      chainCount: payable.chainCount.toString(),
      hostCount: payable.hostCount.toString(),
      paymentsCount: payable.paymentsCount.toString(),
      withdrawalsCount: payable.withdrawalsCount.toString(),
      isClosed: payable.isClosed,
      isAutoWithdraw: payable.isAutoWithdraw,
      createdAt: payable.createdAt.toISOString(),
      description: description?.description ?? null,
      allowedTokens: payable.allowedTokens.map((t) => buildAmountDto(t.amount.toString(), t.token, payable.chainId)),
      balances: payable.balances.map((b) => buildAmountDto(b.amount.toString(), b.token, payable.chainId)),
      lifetimeReceived,
    };
  }

  // ─── /payables (list) ─────────────────────────────────────────────────────

  /** Lists payables with optional host/chain filter, newest-first. */
  async listPayables(opts: {
    host?: string;
    chain?: string;
    limit: number;
    cursor?: string;
  }): Promise<CursorPage<unknown>> {
    type CursorValue = { createdAt: string; id: string };

    const where: Prisma.PayableWhereInput = {};

    if (opts.host) {
      // host can be a raw address (EVM or Solana) or a wallet key ("evm:0x…" / "solana:…")
      if (opts.host.includes(':')) {
        where.hostWalletKey = opts.host;
      } else {
        where.host = opts.host.toLowerCase();
      }
    }

    if (opts.chain) {
      // chain can be a cbChainId (starts with 0x) or a slug
      const chainEntry = opts.chain.startsWith('0x')
        ? CHAIN_BY_CB_CHAIN_ID.get(opts.chain)
        : CHAIN_BY_SLUG.get(opts.chain as import('../chains/types').ChainSlug);
      if (chainEntry) {
        where.chainId = chainEntry.cbChainId;
      }
    }

    if (opts.cursor) {
      const decoded = decodeCursor<CursorValue>(opts.cursor);
      where.OR = [
        { createdAt: { lt: new Date(decoded.createdAt) } },
        { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
      ];
    }

    const rows = await this.prisma.payable.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
    });

    const hasMore = rows.length > opts.limit;
    const items = hasMore ? rows.slice(0, opts.limit) : rows;
    const nextCursor =
      hasMore && items.length > 0
        ? encodeCursor({ createdAt: items[items.length - 1].createdAt.toISOString(), id: items[items.length - 1].id })
        : null;

    return {
      items: items.map((p) => ({
        id: p.id,
        chain: chainDtoFromChainId(p.chainId),
        host: isEvmAddress(p.host) ? getAddress(p.host) : p.host,
        isClosed: p.isClosed,
        isAutoWithdraw: p.isAutoWithdraw,
        paymentsCount: p.paymentsCount.toString(),
        withdrawalsCount: p.withdrawalsCount.toString(),
        createdAt: p.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  // ─── PUT /payables/:id/description ────────────────────────────────────────

  /**
   * Sets or updates a payable's description. The caller must be the host.
   * If the payable is not in the database, ownership is verified on-chain.
   */
  async setDescription(
    payableId: string,
    walletKey: string,
    rawDescription: string,
    chainHint?: string
  ): Promise<void> {
    const description = stripHtml(rawDescription).trim();
    if (description.length < 3 || description.length > 3000) {
      throw new NotFoundException('description must be 3–3000 characters after HTML is stripped');
    }

    const payable = await this.prisma.payable.findUnique({ where: { id: payableId } });

    if (payable) {
      // Payable is indexed — check the host wallet key directly.
      if (payable.hostWalletKey !== walletKey) {
        throw new ForbiddenException('caller is not the host of this payable');
      }
    } else {
      // Payable not indexed yet — verify ownership on-chain.
      await this.verifyHostOnChain(payableId, walletKey, chainHint);
    }

    await this.prisma.payableDescription.upsert({
      where: { payableId },
      create: { payableId, description, updatedByKey: walletKey },
      update: { description, updatedByKey: walletKey },
    });
  }

  /**
   * Calls `isPayableHost(payableId, address)` on the diamond for EVM wallets,
   * or reads the Solana payable account's host field. Throws 404 when the
   * payable does not exist on-chain, 403 when it exists but the caller is not
   * the host.
   */
  private async verifyHostOnChain(payableId: string, walletKey: string, chainHint?: string): Promise<void> {
    const parts = walletKey.split(':');
    const ns = parts[0];
    const address = parts.slice(1).join(':');

    if (ns === 'evm') {
      await this.verifyEvmHost(payableId, address, chainHint);
    } else if (ns === 'solana') {
      await this.verifySolanaHost(payableId, address);
    } else {
      throw new ForbiddenException('unsupported wallet namespace');
    }
  }

  private async verifyEvmHost(payableId: string, address: string, chainHint?: string): Promise<void> {
    // Determine which chain to check. Use chainHint if provided; otherwise try all enabled EVM chains.
    const evmChains = this.chains.enabled.filter((c): c is EvmChainConfig => c.isEvm);
    const candidates = chainHint
      ? evmChains.filter((c) => c.cbChainId === chainHint || c.slug === chainHint)
      : evmChains;

    if (candidates.length === 0) {
      throw new NotFoundException(`payable ${payableId} not found`);
    }

    for (const chain of candidates) {
      if (!chain.diamondAddress) continue;
      try {
        const client = createEvmPublicClient(chain, this.chains.getRpcUrl(chain));
        const isHost = await readContract(client, {
          address: chain.diamondAddress,
          abi: chainbillsAbi,
          functionName: 'isPayableHost',
          args: [payableId as `0x${string}`, address as `0x${string}`],
        });
        if (isHost) return;
        // isHost = false means the payable exists but caller is not the host.
        throw new ForbiddenException('caller is not the host of this payable');
      } catch (err) {
        if (err instanceof ForbiddenException) throw err;
        // RPC/contract error — likely the payable does not exist on this chain; try next.
        this.logger.warn({ payableId, chain: chain.slug, err }, 'isPayableHost call failed');
      }
    }

    throw new NotFoundException(`payable ${payableId} not found on any enabled chain`);
  }

  private async verifySolanaHost(payableId: string, callerAddress: string): Promise<void> {
    const solanaChains = this.chains.enabled.filter((c) => c.isSolana);
    if (solanaChains.length === 0) {
      throw new NotFoundException(`payable ${payableId} not found`);
    }

    // Lazy import to avoid circular dependency at module load time.
    const { createSolanaConnection } = await import('../chains/clients');
    const { getPDA, makeCoder } = await import('../indexer/solana/solana.client');

    for (const chain of solanaChains) {
      if (!chain.isSolana) continue;
      try {
        const connection = createSolanaConnection(this.chains.getRpcUrl(chain));
        const coder = makeCoder();

        // Derive the payable PDA: seeds = ["payable", payableId bytes (32 bytes)]
        const payableIdBytes = Buffer.from(payableId.replace('0x', ''), 'hex');
        const pda = getPDA([Buffer.from('payable'), payableIdBytes], chain.programId);
        const accountInfo = await connection.getAccountInfo(pda);
        if (!accountInfo) {
          // Not on this chain — try next.
          continue;
        }

        const decoded = coder.decode('payable', accountInfo.data) as { host?: { toBase58?: () => string } } | null;
        if (!decoded || !decoded.host) {
          throw new ForbiddenException('caller is not the host of this payable');
        }
        const hostAddress =
          typeof decoded.host.toBase58 === 'function' ? decoded.host.toBase58() : String(decoded.host);
        if (hostAddress === callerAddress) return;
        throw new ForbiddenException('caller is not the host of this payable');
      } catch (err) {
        if (err instanceof ForbiddenException) throw err;
        this.logger.warn({ payableId, err }, 'Solana payable host check failed');
      }
    }

    throw new NotFoundException(`payable ${payableId} not found on any enabled Solana chain`);
  }

  // ─── /payables/:id/payments ───────────────────────────────────────────────

  /** Lists PayablePayments for a payable, newest-first. */
  async listPayablePayments(payableId: string, opts: { limit: number; cursor?: string }): Promise<CursorPage<unknown>> {
    type CursorValue = { timestamp: string; id: string };

    const payableExists = await this.prisma.payable.findUnique({ where: { id: payableId }, select: { id: true } });
    if (!payableExists) throw new NotFoundException(`payable ${payableId} not found`);

    const where: Prisma.PayablePaymentWhereInput = { payableId };
    if (opts.cursor) {
      const decoded = decodeCursor<CursorValue>(opts.cursor);
      where.OR = [
        { timestamp: { lt: new Date(decoded.timestamp) } },
        { timestamp: new Date(decoded.timestamp), id: { lt: decoded.id } },
      ];
    }

    const rows = await this.prisma.payablePayment.findMany({
      where,
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
    });

    const hasMore = rows.length > opts.limit;
    const items = hasMore ? rows.slice(0, opts.limit) : rows;
    const nextCursor =
      hasMore && items.length > 0
        ? encodeCursor({ timestamp: items[items.length - 1].timestamp.toISOString(), id: items[items.length - 1].id })
        : null;

    return {
      items: items.map((p) => this.formatPayablePayment(p)),
      nextCursor,
    };
  }

  // ─── /payables/:id/withdrawals ────────────────────────────────────────────

  /** Lists Withdrawals for a payable, newest-first. */
  async listPayableWithdrawals(
    payableId: string,
    opts: { limit: number; cursor?: string }
  ): Promise<CursorPage<unknown>> {
    type CursorValue = { timestamp: string; id: string };

    const payableExists = await this.prisma.payable.findUnique({ where: { id: payableId }, select: { id: true } });
    if (!payableExists) throw new NotFoundException(`payable ${payableId} not found`);

    const where: Prisma.WithdrawalWhereInput = { payableId };
    if (opts.cursor) {
      const decoded = decodeCursor<CursorValue>(opts.cursor);
      where.OR = [
        { timestamp: { lt: new Date(decoded.timestamp) } },
        { timestamp: new Date(decoded.timestamp), id: { lt: decoded.id } },
      ];
    }

    const rows = await this.prisma.withdrawal.findMany({
      where,
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
    });

    const hasMore = rows.length > opts.limit;
    const items = hasMore ? rows.slice(0, opts.limit) : rows;
    const nextCursor =
      hasMore && items.length > 0
        ? encodeCursor({ timestamp: items[items.length - 1].timestamp.toISOString(), id: items[items.length - 1].id })
        : null;

    return {
      items: items.map((w) => this.formatWithdrawal(w)),
      nextCursor,
    };
  }

  // ─── /payments/user/:id ───────────────────────────────────────────────────

  /** Returns a single UserPayment, its relay status, and matching PayablePayment if indexed. */
  async getUserPayment(id: string) {
    const payment = await this.prisma.userPayment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException(`user payment ${id} not found`);

    // Look for the matching PayablePayment by payerPaymentId.
    const payablePayment = await this.prisma.payablePayment.findFirst({
      where: { payerPaymentId: id },
    });

    // Determine relay status. Same-chain means payer and payable are on the same chain.
    const isSameChain = payment.chainId === payment.payableChainId;
    let relayStatus: RelayStatusDto | null = null;

    if (!isSameChain) {
      const job = await findByPaymentId(this.prisma, id);
      if (job) {
        relayStatus = {
          status: job.status as RelayStatusDto['status'],
          attempts: job.attempts,
          lastError: job.lastError ?? null,
        };
      }
    }

    return {
      ...this.formatUserPayment(payment),
      relayStatus,
      payablePayment: payablePayment ? this.formatPayablePayment(payablePayment) : null,
    };
  }

  // ─── /payments/payable/:id ────────────────────────────────────────────────

  /** Returns a single PayablePayment and its matching UserPayment if indexed. */
  async getPayablePayment(id: string) {
    const payment = await this.prisma.payablePayment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException(`payable payment ${id} not found`);

    const userPayment = await this.prisma.userPayment.findUnique({
      where: { id: payment.payerPaymentId },
    });

    return {
      ...this.formatPayablePayment(payment),
      userPayment: userPayment ? this.formatUserPayment(userPayment) : null,
    };
  }

  // ─── /users/:walletKey/payments ───────────────────────────────────────────

  /** Lists UserPayments by a wallet, newest-first. */
  async listUserPayments(walletKey: string, opts: { limit: number; cursor?: string }): Promise<CursorPage<unknown>> {
    type CursorValue = { timestamp: string; id: string };

    const where: Prisma.UserPaymentWhereInput = { payerWalletKey: walletKey };
    if (opts.cursor) {
      const decoded = decodeCursor<CursorValue>(opts.cursor);
      where.OR = [
        { timestamp: { lt: new Date(decoded.timestamp) } },
        { timestamp: new Date(decoded.timestamp), id: { lt: decoded.id } },
      ];
    }

    const rows = await this.prisma.userPayment.findMany({
      where,
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
    });

    const hasMore = rows.length > opts.limit;
    const items = hasMore ? rows.slice(0, opts.limit) : rows;
    const nextCursor =
      hasMore && items.length > 0
        ? encodeCursor({ timestamp: items[items.length - 1].timestamp.toISOString(), id: items[items.length - 1].id })
        : null;

    return {
      items: items.map((p) => this.formatUserPayment(p)),
      nextCursor,
    };
  }

  // ─── /users/:walletKey/payables ───────────────────────────────────────────

  /** Lists payables hosted by a wallet, newest-first. */
  async listUserPayables(walletKey: string, opts: { limit: number; cursor?: string }): Promise<CursorPage<unknown>> {
    type CursorValue = { createdAt: string; id: string };

    const where: Prisma.PayableWhereInput = { hostWalletKey: walletKey };
    if (opts.cursor) {
      const decoded = decodeCursor<CursorValue>(opts.cursor);
      where.OR = [
        { createdAt: { lt: new Date(decoded.createdAt) } },
        { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
      ];
    }

    const rows = await this.prisma.payable.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
    });

    const hasMore = rows.length > opts.limit;
    const items = hasMore ? rows.slice(0, opts.limit) : rows;
    const nextCursor =
      hasMore && items.length > 0
        ? encodeCursor({ createdAt: items[items.length - 1].createdAt.toISOString(), id: items[items.length - 1].id })
        : null;

    return {
      items: items.map((p) => ({
        id: p.id,
        chain: chainDtoFromChainId(p.chainId),
        host: isEvmAddress(p.host) ? getAddress(p.host) : p.host,
        isClosed: p.isClosed,
        isAutoWithdraw: p.isAutoWithdraw,
        paymentsCount: p.paymentsCount.toString(),
        withdrawalsCount: p.withdrawalsCount.toString(),
        createdAt: p.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  // ─── /users/:walletKey/activity ───────────────────────────────────────────

  /**
   * Returns a mixed activity feed for a wallet: payments sent, payments
   * received on payables they host, withdrawals, and payables created —
   * all chains, sorted newest-first.
   */
  async listUserActivity(walletKey: string, opts: { limit: number; cursor?: string }): Promise<CursorPage<unknown>> {
    type CursorValue = { timestamp: string; id: string };

    let cursorFilter: { timestamp: Date; id: string } | null = null;
    if (opts.cursor) {
      const decoded = decodeCursor<CursorValue>(opts.cursor);
      cursorFilter = { timestamp: new Date(decoded.timestamp), id: decoded.id };
    }

    // Fetch candidates from each source. Over-fetch by limit+1 so we can
    // detect whether there is a next page after merging.
    const fetchLimit = opts.limit + 1;

    const [sentPayments, receivedPayments, withdrawals, payables] = await Promise.all([
      // Payments sent by this wallet.
      this.prisma.userPayment.findMany({
        where: {
          payerWalletKey: walletKey,
          ...(cursorFilter
            ? {
                OR: [
                  { timestamp: { lt: cursorFilter.timestamp } },
                  { timestamp: cursorFilter.timestamp, id: { lt: cursorFilter.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        take: fetchLimit,
        select: {
          id: true,
          timestamp: true,
          chainId: true,
          payableId: true,
          token: true,
          amount: true,
          requestedAmount: true,
        },
      }),
      // Payments received on payables hosted by this wallet.
      this.prisma.payablePayment.findMany({
        where: {
          payable: { hostWalletKey: walletKey },
          ...(cursorFilter
            ? {
                OR: [
                  { timestamp: { lt: cursorFilter.timestamp } },
                  { timestamp: cursorFilter.timestamp, id: { lt: cursorFilter.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        take: fetchLimit,
        select: { id: true, timestamp: true, chainId: true, payableId: true, token: true, amount: true },
      }),
      // Withdrawals by this wallet.
      this.prisma.withdrawal.findMany({
        where: {
          hostWalletKey: walletKey,
          ...(cursorFilter
            ? {
                OR: [
                  { timestamp: { lt: cursorFilter.timestamp } },
                  { timestamp: cursorFilter.timestamp, id: { lt: cursorFilter.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        take: fetchLimit,
        select: { id: true, timestamp: true, chainId: true, payableId: true, token: true, amount: true, fee: true },
      }),
      // Payables created by this wallet.
      this.prisma.payable.findMany({
        where: {
          hostWalletKey: walletKey,
          ...(cursorFilter
            ? {
                OR: [
                  { createdAt: { lt: cursorFilter.timestamp } },
                  { createdAt: cursorFilter.timestamp, id: { lt: cursorFilter.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: fetchLimit,
        select: { id: true, createdAt: true, chainId: true },
      }),
    ]);

    // Merge all sources into a unified event list.
    type ActivityItem = {
      type: string;
      id: string;
      entityId: string;
      timestamp: Date;
      chain: ChainDto | null;
    };

    const events: ActivityItem[] = [
      ...sentPayments.map((p) => ({
        type: 'USER_PAID',
        id: `USER_PAID:${p.id}`,
        entityId: p.id,
        timestamp: p.timestamp,
        chain: chainDtoFromChainId(p.chainId),
      })),
      ...receivedPayments.map((p) => ({
        type: 'PAYABLE_RECEIVED',
        id: `PAYABLE_RECEIVED:${p.id}`,
        entityId: p.id,
        timestamp: p.timestamp,
        chain: chainDtoFromChainId(p.chainId),
      })),
      ...withdrawals.map((w) => ({
        type: 'WITHDREW',
        id: `WITHDREW:${w.id}`,
        entityId: w.id,
        timestamp: w.timestamp,
        chain: chainDtoFromChainId(w.chainId),
      })),
      ...payables.map((p) => ({
        type: 'CREATED_PAYABLE',
        id: `CREATED_PAYABLE:${p.id}`,
        entityId: p.id,
        timestamp: p.createdAt,
        chain: chainDtoFromChainId(p.chainId),
      })),
    ];

    // Sort newest-first, then by synthetic id for stable ordering when timestamps collide.
    events.sort((a, b) => {
      const timeDiff = b.timestamp.getTime() - a.timestamp.getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.id < a.id ? -1 : 1;
    });

    const sliced = events.slice(0, fetchLimit);
    const hasMore = sliced.length > opts.limit;
    const items = hasMore ? sliced.slice(0, opts.limit) : sliced;
    const nextCursor =
      hasMore && items.length > 0
        ? encodeCursor({ timestamp: items[items.length - 1].timestamp.toISOString(), id: items[items.length - 1].id })
        : null;

    return {
      items: items.map(({ id: _syntheticId, ...rest }) => rest),
      nextCursor,
    };
  }

  // ─── /withdrawals/:id ─────────────────────────────────────────────────────

  /** Returns a single withdrawal. */
  async getWithdrawal(id: string) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundException(`withdrawal ${id} not found`);
    return this.formatWithdrawal(w);
  }

  // ─── /stats ───────────────────────────────────────────────────────────────

  /**
   * Returns per-chain + per-token aggregate stats. The result is cached
   * in-process for STATS_CACHE_TTL_MS (30 s) to avoid hammering Postgres.
   */
  async getStats(): Promise<StatsBucketDto[]> {
    const now = Date.now();
    if (this.statsCache && now - this.statsCache.computedAt < STATS_CACHE_TTL_MS) {
      return this.statsCache.data;
    }

    const data = await this.computeStats();
    this.statsCache = { data, computedAt: now };
    return data;
  }

  private async computeStats(): Promise<StatsBucketDto[]> {
    // User payments: sum of amounts grouped by (chainId, token) — paidVolume.
    const [userPaymentGroups, payablePaymentGroups, withdrawalGroups] = await Promise.all([
      this.prisma.userPayment.groupBy({
        by: ['chainId', 'token'],
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.payablePayment.groupBy({
        by: ['chainId', 'token'],
        _sum: { amount: true },
      }),
      this.prisma.withdrawal.groupBy({
        by: ['chainId', 'token'],
        _sum: { amount: true },
      }),
    ]);

    // Collect all unique (chainId, token) pairs.
    const keySet = new Set<string>();
    for (const r of [...userPaymentGroups, ...payablePaymentGroups, ...withdrawalGroups]) {
      keySet.add(`${r.chainId}||${r.token}`);
    }

    const buckets: StatsBucketDto[] = [];

    for (const key of keySet) {
      const [chainId, token] = key.split('||');
      const chain = CHAIN_BY_CB_CHAIN_ID.get(chainId);
      const resolved = chain ? resolveTokenFromRegistry(token, chain.slug) : undefined;
      const symbol = resolved?.symbol ?? 'UNKNOWN';
      const decimals = resolved?.decimals ?? 0;

      const upGroup = userPaymentGroups.find((r) => r.chainId === chainId && r.token === token);
      const ppGroup = payablePaymentGroups.find((r) => r.chainId === chainId && r.token === token);
      const wGroup = withdrawalGroups.find((r) => r.chainId === chainId && r.token === token);

      const paidVolume = upGroup?._sum.amount?.toString() ?? '0';
      const receivedVolume = ppGroup?._sum.amount?.toString() ?? '0';
      const withdrawnVolume = wGroup?._sum.amount?.toString() ?? '0';
      const paymentsCount = upGroup?._count.id.toString() ?? '0';

      buckets.push({
        chainId,
        chainSlug: chain?.slug ?? chainId,
        token,
        symbol,
        decimals,
        paymentsCount,
        paidVolume,
        paidVolumeFormatted: formatAmount(paidVolume, decimals),
        receivedVolume,
        receivedVolumeFormatted: formatAmount(receivedVolume, decimals),
        withdrawnVolume,
        withdrawnVolumeFormatted: formatAmount(withdrawnVolume, decimals),
      });
    }

    return buckets;
  }

  // ─── Private formatters ───────────────────────────────────────────────────

  private formatUserPayment(p: {
    id: string;
    chainId: string;
    payer: string;
    payerWalletKey: string;
    payerCount: bigint;
    chainCount: bigint;
    payableId: string;
    payableChainId: string;
    token: string;
    requestedAmount: { toString(): string };
    amount: { toString(): string };
    timestamp: Date;
  }) {
    const payer = isEvmAddress(p.payer) ? getAddress(p.payer) : p.payer;
    return {
      id: p.id,
      chain: chainDtoFromChainId(p.chainId),
      payer,
      payerWalletKey: p.payerWalletKey,
      payerCount: p.payerCount.toString(),
      chainCount: p.chainCount.toString(),
      payableId: p.payableId,
      payableChain: chainDtoFromChainId(p.payableChainId),
      requestedAmount: buildAmountDto(p.requestedAmount.toString(), p.token, p.chainId),
      amount: buildAmountDto(p.amount.toString(), p.token, p.chainId),
      timestamp: p.timestamp.toISOString(),
    };
  }

  private formatPayablePayment(p: {
    id: string;
    chainId: string;
    payableId: string;
    payer: string;
    payerChainId: string;
    payerWalletKey: string;
    payerPaymentId: string;
    chainCount: bigint;
    localChainCount: bigint;
    payableCount: bigint;
    token: string;
    requestedAmount: { toString(): string };
    amount: { toString(): string };
    timestamp: Date;
  }) {
    const payer = isEvmAddress(p.payer) ? getAddress(p.payer) : p.payer;
    return {
      id: p.id,
      chain: chainDtoFromChainId(p.chainId),
      payableId: p.payableId,
      payer,
      payerChain: chainDtoFromChainId(p.payerChainId),
      payerWalletKey: p.payerWalletKey,
      payerPaymentId: p.payerPaymentId,
      chainCount: p.chainCount.toString(),
      localChainCount: p.localChainCount.toString(),
      payableCount: p.payableCount.toString(),
      requestedAmount: buildAmountDto(p.requestedAmount.toString(), p.token, p.chainId),
      amount: buildAmountDto(p.amount.toString(), p.token, p.chainId),
      timestamp: p.timestamp.toISOString(),
    };
  }

  private formatWithdrawal(w: {
    id: string;
    chainId: string;
    payableId: string;
    host: string;
    hostWalletKey: string;
    chainCount: bigint;
    hostCount: bigint;
    payableCount: bigint;
    token: string;
    amount: { toString(): string };
    fee: { toString(): string };
    timestamp: Date;
  }) {
    const host = isEvmAddress(w.host) ? getAddress(w.host) : w.host;
    const amountRaw = w.amount.toString();
    const feeRaw = w.fee.toString();

    // netAmount = amount - fee (both raw integers; subtraction is safe since we
    // only need string output — convert via BigInt).
    const netAmount = (BigInt(amountRaw) - BigInt(feeRaw)).toString();

    return {
      id: w.id,
      chain: chainDtoFromChainId(w.chainId),
      payableId: w.payableId,
      host,
      hostWalletKey: w.hostWalletKey,
      chainCount: w.chainCount.toString(),
      hostCount: w.hostCount.toString(),
      payableCount: w.payableCount.toString(),
      amount: buildAmountDto(amountRaw, w.token, w.chainId),
      fee: buildAmountDto(feeRaw, w.token, w.chainId),
      netAmount: buildAmountDto(netAmount, w.token, w.chainId),
      timestamp: w.timestamp.toISOString(),
    };
  }

  /** Exposes the stats cache for testing. */
  getStatsCacheAge(): number | null {
    return this.statsCache ? Date.now() - this.statsCache.computedAt : null;
  }

  /** Clears the stats cache (test helper). */
  clearStatsCache(): void {
    this.statsCache = null;
  }
}
