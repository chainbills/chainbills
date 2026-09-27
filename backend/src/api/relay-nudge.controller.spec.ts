// RelayNudgeController unit tests.
// Covers tx validation, hint extraction from receipt logs (with the diamond-address
// filter), hint upsert logic, and the immediate `RelayJob` queuing path.

import { BadRequestException } from '@nestjs/common';
import { keccak256, toBytes } from 'viem';
import { RelayNudgeController } from './relay-nudge.controller';
import type { PrismaService } from '../prisma/prisma.service';
import type { ChainsService } from '../chains/chains.service';
import type { EvmChainConfig } from '../chains/types';

vi.mock('../chains/clients', () => ({
  createEvmPublicClient: vi.fn(),
}));

import { createEvmPublicClient } from '../chains/clients';

const TOPIC_PAYABLE_UPDATE = keccak256(toBytes('SentPayableUpdateViaCctp(bytes32,bytes32,uint64)'));
const TOPIC_FOREIGN_PAYMENT = keccak256(
  toBytes('SentForeignPaymentViaCctp(bytes32,bytes32,bytes32,uint64,uint256,uint256,uint32)')
);

const SOURCE_CHAIN: EvmChainConfig = {
  slug: 'basesepolia',
  cbChainId: '0xbasesepolia',
  displayName: 'Base Sepolia',
  caip2: 'eip155:84532',
  network: 'testnet',
  isEvm: true,
  isSolana: false,
  diamondAddress: '0xdiamondAddress00000000000000000000000000',
  wormholeChainId: 10004,
  circleDomain: 6,
  pollIntervalMs: 2000,
  minGasBalance: 0n,
  viemChain: {} as never,
};

const DEST_CHAIN_ID = `0x${'c'.repeat(64)}` as `0x${string}`;

// Enabled dest chain (Arc-testnet-like): same network as source, CCTP configured, so
// queueJob's eligibility gate lets a job through in the happy-path tests.
const DEST_CHAIN: EvmChainConfig = {
  slug: 'arctestnet',
  cbChainId: DEST_CHAIN_ID,
  displayName: 'Arc Testnet',
  caip2: 'eip155:5042002',
  network: 'testnet',
  isEvm: true,
  isSolana: false,
  diamondAddress: '0xdiamondAddress11111111111111111111111111',
  wormholeChainId: undefined,
  circleDomain: 26,
  pollIntervalMs: 2000,
  minGasBalance: 0n,
  viemChain: {} as never,
};

const TX_HASH = `0x${'a'.repeat(64)}` as `0x${string}`;
const PAYABLE_ID = `0x${'b'.repeat(64)}` as `0x${string}`;
const USER_PAYMENT_ID = `0x${'d'.repeat(64)}` as `0x${string}`;

/** uint64 nonce 5 encoded as a 32-byte ABI word (padded to 64 hex chars). */
const NONCE_5_DATA = '0x' + '0'.repeat(58) + '000005';

function makeChains(chains: EvmChainConfig[] = []): ChainsService {
  return {
    enabled: chains,
    getRpcUrl: vi.fn().mockReturnValue('http://localhost:8545'),
  } as unknown as ChainsService;
}

function makePrisma() {
  return {
    relayTxHint: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    relayJob: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaService;
}

function makeSuccessReceipt(
  logs: Array<{ topics: string[]; data?: string; address?: string }> = [],
  to: string | null = SOURCE_CHAIN.diamondAddress
) {
  return {
    status: 'success' as const,
    to,
    // Default every log's address to the diamond and give a benign nonce=5 data word so
    // both extractHints (topics-only) and the job queuer (needs nonce from data) work.
    logs: logs.map((l) => ({
      address: SOURCE_CHAIN.diamondAddress,
      data: NONCE_5_DATA,
      ...l,
    })),
  };
}

function makePublicClient(receipt: object | null, shouldThrow = false) {
  const getTransactionReceipt = shouldThrow
    ? vi.fn().mockRejectedValue(new Error('not found'))
    : vi.fn().mockResolvedValue(receipt);
  return { getTransactionReceipt };
}

describe('RelayNudgeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('chain validation', () => {
    it('throws BadRequestException for unknown chain slug', async () => {
      const chains = makeChains();
      const prisma = makePrisma();
      const controller = new RelayNudgeController(prisma, chains);

      await expect(controller.nudge({ chainSlug: 'unknownchain', txHash: TX_HASH })).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws BadRequestException for non-EVM chain', async () => {
      const solanaChain = {
        slug: 'solanadevnet',
        cbChainId: '0xsolana',
        isEvm: false,
        isSolana: true,
      };
      const chains = {
        enabled: [solanaChain],
        getRpcUrl: vi.fn(),
      } as unknown as ChainsService;
      const prisma = makePrisma();
      const controller = new RelayNudgeController(prisma, chains);

      await expect(controller.nudge({ chainSlug: 'solanadevnet', txHash: TX_HASH })).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('tx receipt validation', () => {
    it('throws BadRequestException when getTransactionReceipt throws', async () => {
      const chains = makeChains([SOURCE_CHAIN]);
      const prisma = makePrisma();
      vi.mocked(createEvmPublicClient).mockReturnValue(makePublicClient(null, true) as never);
      const controller = new RelayNudgeController(prisma, chains);

      await expect(controller.nudge({ chainSlug: 'basesepolia', txHash: TX_HASH })).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws BadRequestException when tx reverted', async () => {
      const chains = makeChains([SOURCE_CHAIN]);
      const prisma = makePrisma();
      vi.mocked(createEvmPublicClient).mockReturnValue(
        makePublicClient({ status: 'reverted', to: SOURCE_CHAIN.diamondAddress, logs: [] }) as never
      );
      const controller = new RelayNudgeController(prisma, chains);

      await expect(controller.nudge({ chainSlug: 'basesepolia', txHash: TX_HASH })).rejects.toThrow(
        BadRequestException
      );
    });

    it('accepts smart-wallet / multicall wrapper txs (top-level `to` is not the diamond) as long as the diamond emitted the CCTP log', async () => {
      const chains = makeChains([SOURCE_CHAIN, DEST_CHAIN]);
      const prisma = makePrisma();
      vi.mocked(createEvmPublicClient).mockReturnValue(
        makePublicClient(
          makeSuccessReceipt(
            [{ topics: [TOPIC_PAYABLE_UPDATE, PAYABLE_ID, DEST_CHAIN_ID] }],
            '0xsmartwalletwrapper00000000000000000000000'
          )
        ) as never
      );
      const controller = new RelayNudgeController(prisma, chains);

      const result = await controller.nudge({ chainSlug: 'basesepolia', txHash: TX_HASH });

      expect(result).toEqual({ hintsRecorded: 1, jobsQueued: 1 });
    });

    it('ignores CCTP-topic logs emitted by contracts other than the diamond', async () => {
      const chains = makeChains([SOURCE_CHAIN, DEST_CHAIN]);
      const prisma = makePrisma();
      vi.mocked(createEvmPublicClient).mockReturnValue(
        makePublicClient(
          makeSuccessReceipt([
            { topics: [TOPIC_PAYABLE_UPDATE, PAYABLE_ID, DEST_CHAIN_ID], address: '0xhostilecontract00000000000000000000000000' },
          ])
        ) as never
      );
      const controller = new RelayNudgeController(prisma, chains);

      const result = await controller.nudge({ chainSlug: 'basesepolia', txHash: TX_HASH });

      expect(result).toEqual({ hintsRecorded: 0, jobsQueued: 0 });
      expect((prisma.relayTxHint as never as { create: ReturnType<typeof vi.fn> }).create).not.toHaveBeenCalled();
      expect((prisma.relayJob as never as { createMany: ReturnType<typeof vi.fn> }).createMany).not.toHaveBeenCalled();
    });
  });

  describe('hint extraction from logs', () => {
    it('returns zero-counts when no matching logs', async () => {
      const chains = makeChains([SOURCE_CHAIN, DEST_CHAIN]);
      const prisma = makePrisma();
      vi.mocked(createEvmPublicClient).mockReturnValue(
        makePublicClient(makeSuccessReceipt([{ topics: ['0xunknowntopic'] }])) as never
      );
      const controller = new RelayNudgeController(prisma, chains);

      const result = await controller.nudge({ chainSlug: 'basesepolia', txHash: TX_HASH });

      expect(result).toEqual({ hintsRecorded: 0, jobsQueued: 0 });
      expect((prisma.relayTxHint as never as { create: ReturnType<typeof vi.fn> }).create).not.toHaveBeenCalled();
      expect((prisma.relayJob as never as { createMany: ReturnType<typeof vi.fn> }).createMany).not.toHaveBeenCalled();
    });

    it('records hint for SentPayableUpdateViaCctp log', async () => {
      const chains = makeChains([SOURCE_CHAIN, DEST_CHAIN]);
      const prisma = makePrisma();
      vi.mocked(createEvmPublicClient).mockReturnValue(
        makePublicClient(
          makeSuccessReceipt([{ topics: [TOPIC_PAYABLE_UPDATE, PAYABLE_ID, DEST_CHAIN_ID] }])
        ) as never
      );
      const controller = new RelayNudgeController(prisma, chains);

      const result = await controller.nudge({ chainSlug: 'basesepolia', txHash: TX_HASH });

      expect(result).toEqual({ hintsRecorded: 1, jobsQueued: 1 });
      expect((prisma.relayTxHint as never as { create: ReturnType<typeof vi.fn> }).create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            chainId: SOURCE_CHAIN.cbChainId,
            destChainId: DEST_CHAIN_ID,
            payableId: PAYABLE_ID,
            userPaymentId: null,
            txHash: TX_HASH,
          }),
        })
      );
    });

    it('records hint for SentForeignPaymentViaCctp log', async () => {
      const chains = makeChains([SOURCE_CHAIN, DEST_CHAIN]);
      const prisma = makePrisma();
      vi.mocked(createEvmPublicClient).mockReturnValue(
        makePublicClient(
          makeSuccessReceipt([{ topics: [TOPIC_FOREIGN_PAYMENT, PAYABLE_ID, DEST_CHAIN_ID, USER_PAYMENT_ID] }])
        ) as never
      );
      const controller = new RelayNudgeController(prisma, chains);

      const result = await controller.nudge({ chainSlug: 'basesepolia', txHash: TX_HASH });

      expect(result).toEqual({ hintsRecorded: 1, jobsQueued: 1 });
      expect((prisma.relayTxHint as never as { create: ReturnType<typeof vi.fn> }).create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            chainId: SOURCE_CHAIN.cbChainId,
            destChainId: DEST_CHAIN_ID,
            payableId: null,
            userPaymentId: USER_PAYMENT_ID,
            txHash: TX_HASH,
          }),
        })
      );
    });

    it('records multiple hints when receipt has multiple matching logs', async () => {
      const chains = makeChains([SOURCE_CHAIN, DEST_CHAIN]);
      const prisma = makePrisma();
      vi.mocked(createEvmPublicClient).mockReturnValue(
        makePublicClient(
          makeSuccessReceipt([
            { topics: [TOPIC_PAYABLE_UPDATE, PAYABLE_ID, DEST_CHAIN_ID] },
            { topics: [TOPIC_FOREIGN_PAYMENT, PAYABLE_ID, DEST_CHAIN_ID, USER_PAYMENT_ID] },
          ])
        ) as never
      );
      const controller = new RelayNudgeController(prisma, chains);

      const result = await controller.nudge({ chainSlug: 'basesepolia', txHash: TX_HASH });

      expect(result).toEqual({ hintsRecorded: 2, jobsQueued: 2 });
    });
  });

  describe('hint upsert logic', () => {
    it('updates existing hint when one already exists for the same key', async () => {
      const chains = makeChains([SOURCE_CHAIN, DEST_CHAIN]);
      const prisma = makePrisma();
      (prisma.relayTxHint.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'existing-id' });
      vi.mocked(createEvmPublicClient).mockReturnValue(
        makePublicClient(
          makeSuccessReceipt([{ topics: [TOPIC_PAYABLE_UPDATE, PAYABLE_ID, DEST_CHAIN_ID] }])
        ) as never
      );
      const controller = new RelayNudgeController(prisma, chains);

      const result = await controller.nudge({ chainSlug: 'basesepolia', txHash: TX_HASH });

      expect(result).toEqual({ hintsRecorded: 1, jobsQueued: 1 });
      expect((prisma.relayTxHint as never as { update: ReturnType<typeof vi.fn> }).update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-id' },
          data: expect.objectContaining({ txHash: TX_HASH }),
        })
      );
      expect((prisma.relayTxHint as never as { create: ReturnType<typeof vi.fn> }).create).not.toHaveBeenCalled();
    });

    it('warns and continues when hint upsert throws, recorded count stays 0 but job still queues', async () => {
      const chains = makeChains([SOURCE_CHAIN, DEST_CHAIN]);
      const prisma = makePrisma();
      (prisma.relayTxHint.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));
      vi.mocked(createEvmPublicClient).mockReturnValue(
        makePublicClient(
          makeSuccessReceipt([{ topics: [TOPIC_PAYABLE_UPDATE, PAYABLE_ID, DEST_CHAIN_ID] }])
        ) as never
      );
      const controller = new RelayNudgeController(prisma, chains);

      const result = await controller.nudge({ chainSlug: 'basesepolia', txHash: TX_HASH });

      // Hint failed to persist, but the job path is independent so it still queues.
      expect(result).toEqual({ hintsRecorded: 0, jobsQueued: 1 });
    });
  });

  describe('immediate RelayJob queuing', () => {
    it('queues a PAYABLE_UPDATE_VIA_CCTP job with a log-derivable synthetic key', async () => {
      const chains = makeChains([SOURCE_CHAIN, DEST_CHAIN]);
      const prisma = makePrisma();
      vi.mocked(createEvmPublicClient).mockReturnValue(
        makePublicClient(
          makeSuccessReceipt([{ topics: [TOPIC_PAYABLE_UPDATE, PAYABLE_ID, DEST_CHAIN_ID] }])
        ) as never
      );
      const controller = new RelayNudgeController(prisma, chains);

      const result = await controller.nudge({ chainSlug: 'basesepolia', txHash: TX_HASH });

      expect(result.jobsQueued).toBe(1);
      const createMany = (prisma.relayJob as never as { createMany: ReturnType<typeof vi.fn> }).createMany;
      expect(createMany).toHaveBeenCalledTimes(1);
      const jobData = createMany.mock.calls[0][0].data[0];
      expect(jobData.type).toBe('PAYABLE_UPDATE_VIA_CCTP');
      expect(jobData.sourceChainId).toBe(SOURCE_CHAIN.cbChainId);
      expect(jobData.destChainId).toBe(DEST_CHAIN_ID);
      // Synthetic key format is `cctp-msg-${sourceCbChainId}-${payableId}-${nonce}`; nonce=5 per NONCE_5_DATA.
      expect(jobData.txHash).toBe(`cctp-msg-${SOURCE_CHAIN.cbChainId}-${PAYABLE_ID}-5`);
      expect(jobData.eventData.payableId).toBe(PAYABLE_ID);
      expect(jobData.eventData.chainbillsNonce).toBe('5');
      expect(jobData.eventData.queuedByNudge).toBe(true);
    });

    it('queues a PAYMENT_VIA_CCTP job with a log-derivable synthetic key', async () => {
      const chains = makeChains([SOURCE_CHAIN, DEST_CHAIN]);
      const prisma = makePrisma();
      vi.mocked(createEvmPublicClient).mockReturnValue(
        makePublicClient(
          makeSuccessReceipt([{ topics: [TOPIC_FOREIGN_PAYMENT, PAYABLE_ID, DEST_CHAIN_ID, USER_PAYMENT_ID] }])
        ) as never
      );
      const controller = new RelayNudgeController(prisma, chains);

      const result = await controller.nudge({ chainSlug: 'basesepolia', txHash: TX_HASH });

      expect(result.jobsQueued).toBe(1);
      const createMany = (prisma.relayJob as never as { createMany: ReturnType<typeof vi.fn> }).createMany;
      const jobData = createMany.mock.calls[0][0].data[0];
      expect(jobData.type).toBe('PAYMENT_VIA_CCTP');
      expect(jobData.txHash).toBe(`cctp-pay-${SOURCE_CHAIN.cbChainId}-${USER_PAYMENT_ID}`);
      expect(jobData.userPaymentId).toBe(USER_PAYMENT_ID);
    });

    it('does not queue a job when the destination chain is not enabled on this instance', async () => {
      const chains = makeChains([SOURCE_CHAIN]); // DEST_CHAIN absent
      const prisma = makePrisma();
      vi.mocked(createEvmPublicClient).mockReturnValue(
        makePublicClient(
          makeSuccessReceipt([{ topics: [TOPIC_PAYABLE_UPDATE, PAYABLE_ID, DEST_CHAIN_ID] }])
        ) as never
      );
      const controller = new RelayNudgeController(prisma, chains);

      const result = await controller.nudge({ chainSlug: 'basesepolia', txHash: TX_HASH });

      expect(result).toEqual({ hintsRecorded: 1, jobsQueued: 0 });
      expect((prisma.relayJob as never as { createMany: ReturnType<typeof vi.fn> }).createMany).not.toHaveBeenCalled();
    });

    it('does not queue a job when destination is on a different network (mainnet vs testnet)', async () => {
      const mainnetDest: EvmChainConfig = { ...DEST_CHAIN, network: 'mainnet', slug: 'arcmainnet' };
      const chains = makeChains([SOURCE_CHAIN, mainnetDest]);
      const prisma = makePrisma();
      vi.mocked(createEvmPublicClient).mockReturnValue(
        makePublicClient(
          makeSuccessReceipt([{ topics: [TOPIC_PAYABLE_UPDATE, PAYABLE_ID, DEST_CHAIN_ID] }])
        ) as never
      );
      const controller = new RelayNudgeController(prisma, chains);

      const result = await controller.nudge({ chainSlug: 'basesepolia', txHash: TX_HASH });

      expect(result).toEqual({ hintsRecorded: 1, jobsQueued: 0 });
    });

    it('reports jobsQueued=0 when the job already exists (skipDuplicates path)', async () => {
      const chains = makeChains([SOURCE_CHAIN, DEST_CHAIN]);
      const prisma = makePrisma();
      (prisma.relayJob as never as { createMany: ReturnType<typeof vi.fn> }).createMany.mockResolvedValue({ count: 0 });
      vi.mocked(createEvmPublicClient).mockReturnValue(
        makePublicClient(
          makeSuccessReceipt([{ topics: [TOPIC_PAYABLE_UPDATE, PAYABLE_ID, DEST_CHAIN_ID] }])
        ) as never
      );
      const controller = new RelayNudgeController(prisma, chains);

      const result = await controller.nudge({ chainSlug: 'basesepolia', txHash: TX_HASH });

      expect(result).toEqual({ hintsRecorded: 1, jobsQueued: 0 });
    });
  });
});
