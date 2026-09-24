// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Relay processor tests
//
// Covers error classification: every idempotent error -> DONE, RelayerOnly ->
// FAILED immediately, InsufficientFinality -> retryLater, unknown error -> retryLater.
// Also covers Solana-destination job types left PENDING.
// ──────────────────────────────────────────────────────────────────────────────

import { RelayJobStatus, RelayJobType } from '@prisma/client';
import { RelayProcessor } from './relay.processor';
import type { PrismaService } from '../prisma/prisma.service';
import type { ChainsService } from '../chains/chains.service';
import type { EvmChainConfig } from '../chains/types';

const SRC_CHAIN: EvmChainConfig = {
  slug: 'chainA',
  cbChainId: '0xchainA',
  displayName: 'A',
  caip2: 'eip155:1',
  network: 'testnet',
  isEvm: true,
  isSolana: false,
  diamondAddress: '0xdiamond',
  deploymentBlock: 0n,
  wormholeChainId: 10002,
  circleDomain: 0,
  pollIntervalMs: 1000,
  minGasBalance: 0n,
  viemChain: {} as any,
};

const DEST_CHAIN: EvmChainConfig = {
  ...SRC_CHAIN,
  slug: 'chainB',
  cbChainId: '0xchainB',
  circleDomain: 26,
};

function makeJob(type = RelayJobType.PAYABLE_UPDATE_VIA_WORMHOLE, overrides: Partial<any> = {}) {
  return {
    id: 'job-1',
    type,
    status: RelayJobStatus.PROCESSING,
    sourceChainId: SRC_CHAIN.cbChainId,
    destChainId: DEST_CHAIN.cbChainId,
    txHash: '0xtx',
    blockNumber: null,
    eventData: { wormholeSequence: '5', nonce: '1' },
    attempts: 1,
    notBefore: new Date(),
    lastError: null,
    vaa: Buffer.from([0x01]).toString('hex'),
    cctpMessage: null,
    cctpAttestation: null,
    createdAt: new Date(),
    lastAttemptAt: null,
    completedAt: null,
    ...overrides,
  };
}

function makePrisma(claimedJob?: ReturnType<typeof makeJob>): PrismaService & { updateCalls: any[] } {
  const updateCalls: any[] = [];
  return {
    relayJob: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(claimedJob),
      update: vi.fn().mockImplementation((args: any) => {
        updateCalls.push(args);
        return Promise.resolve(claimedJob ?? {});
      }),
    },
    $queryRaw: vi.fn().mockResolvedValue(claimedJob ? [claimedJob] : []),
    updateCalls,
  } as unknown as PrismaService & { updateCalls: any[] };
}

function makeChains(): ChainsService {
  return {
    enabled: [SRC_CHAIN, DEST_CHAIN],
    byCbChainId: (id: string) => [SRC_CHAIN, DEST_CHAIN].find((c) => c.cbChainId === id),
    getRpcUrl: () => 'http://localhost',
  } as unknown as ChainsService;
}

// A RelayProcessor that captures what classifyResult was called with.
// We spy on the EVM submitter functions to return controlled error names.
describe('RelayProcessor — error classification', () => {
  let processor: RelayProcessor;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma(makeJob());
    processor = new RelayProcessor(prisma, makeChains());
  });

  const IDEMPOTENT = [
    'StalePayableUpdateNonce',
    'WormholeMessageAlreadyConsumed',
    'CctpBurnNonceAlreadyConsumed',
    'CctpDataNonceAlreadyConsumed',
    'PaymentNonceAlreadyConsumed',
  ];

  for (const errorName of IDEMPOTENT) {
    it(`marks job DONE on idempotent error: ${errorName}`, async () => {
      // We test classifyResult directly via reflection
      // since private methods are needed.

      await (processor as any).classifyResult(makeJob(), errorName);
      const doneCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.DONE);
      expect(doneCall).toBeDefined();
    });
  }

  it('marks job FAILED immediately on RelayerOnly error', async () => {
    await (processor as any).classifyResult(makeJob(), 'RelayerOnly');
    const failedCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.FAILED);
    expect(failedCall).toBeDefined();
  });

  it('calls retryLater on InsufficientFinality', async () => {
    const job = makeJob(RelayJobType.PAYABLE_UPDATE_VIA_WORMHOLE, { attempts: 1 });

    await (processor as any).classifyResult(job, 'InsufficientFinality');
    // retryLater sets status PENDING
    const pendingCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.PENDING);
    expect(pendingCall).toBeDefined();
  });

  it('calls retryLater on unknown error', async () => {
    const job = makeJob(RelayJobType.PAYABLE_UPDATE_VIA_WORMHOLE, { attempts: 1 });

    await (processor as any).classifyResult(job, 'SomeUnknownError');
    const pendingCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.PENDING);
    expect(pendingCall).toBeDefined();
  });

  it('marks job DONE on null (success)', async () => {
    await (processor as any).classifyResult(makeJob(), null);
    const doneCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.DONE);
    expect(doneCall).toBeDefined();
  });
});

describe('RelayProcessor — Solana destination jobs', () => {
  it('leaves SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE PENDING and resets attempts', async () => {
    const job = makeJob(RelayJobType.SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE);
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains());

    // Call dispatch directly.

    await (processor as any).dispatch(job, {} as any);

    const resetCall = prisma.updateCalls.find(
      (c: any) => c.data?.status === RelayJobStatus.PENDING && c.data?.attempts === 0
    );
    expect(resetCall).toBeDefined();
  });

  it('leaves SOLANA_PAYMENT_VIA_CCTP_WORMHOLE PENDING and resets attempts', async () => {
    const job = makeJob(RelayJobType.SOLANA_PAYMENT_VIA_CCTP_WORMHOLE);
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains());

    await (processor as any).dispatch(job, {} as any);

    const resetCall = prisma.updateCalls.find(
      (c: any) => c.data?.status === RelayJobStatus.PENDING && c.data?.attempts === 0
    );
    expect(resetCall).toBeDefined();
  });
});

// Mock the submitters and resolvers so dispatch methods can be tested in isolation.
vi.mock('./resolvers/wormhole.resolver', () => ({ fetchVaa: vi.fn() }));
vi.mock('./resolvers/cctp.resolver', () => ({ fetchCctpAttestation: vi.fn() }));
vi.mock('./submitters/evm.submitter', () => ({
  submitReceivePayableUpdateViaWormhole: vi.fn(),
  submitReceivePayableUpdateViaCctp: vi.fn(),
  submitReceiveForeignPaymentViaCctp: vi.fn(),
}));
vi.mock('../chains/clients', () => ({
  createEvmPublicClient: vi.fn().mockReturnValue({}),
  createEvmWalletClient: vi.fn().mockReturnValue({}),
  evmAccountFromPrivateKey: vi.fn(),
}));

import { fetchVaa } from './resolvers/wormhole.resolver';
import { fetchCctpAttestation } from './resolvers/cctp.resolver';
import {
  submitReceivePayableUpdateViaWormhole,
  submitReceivePayableUpdateViaCctp,
  submitReceiveForeignPaymentViaCctp,
} from './submitters/evm.submitter';

describe('RelayProcessor — dispatch with mocked submitters', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('handleWormholeUpdate: uses cached VAA and marks DONE on success', async () => {
    const vaaHex = Buffer.from([0x01, 0x02, 0x03]).toString('hex');
    const job = makeJob(RelayJobType.PAYABLE_UPDATE_VIA_WORMHOLE, { vaa: vaaHex });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains());

    vi.mocked(submitReceivePayableUpdateViaWormhole).mockResolvedValue(null);

    await (processor as any).handleWormholeUpdate(job, SRC_CHAIN, DEST_CHAIN, {}, {});

    expect(submitReceivePayableUpdateViaWormhole).toHaveBeenCalled();
    const doneCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.DONE);
    expect(doneCall).toBeDefined();
  });

  it('handleWormholeUpdate: retries when VAA not yet available', async () => {
    const jobWithWormhole = makeJob(RelayJobType.PAYABLE_UPDATE_VIA_WORMHOLE, {
      vaa: null,
      eventData: { wormholeSequence: '42' },
    });
    const src = { ...SRC_CHAIN, wormholeChainId: 10002, diamondAddress: '0xdiamond' };
    const prisma = makePrisma(jobWithWormhole);
    const processor = new RelayProcessor(prisma, makeChains());

    vi.mocked(fetchVaa).mockResolvedValue(null);

    await (processor as any).handleWormholeUpdate(jobWithWormhole, src, DEST_CHAIN, {}, {});

    // Should retryLater (set PENDING)
    const pendingCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.PENDING);
    expect(pendingCall).toBeDefined();
  });

  it('handleCctpUpdate: uses cached attestation and marks DONE on success', async () => {
    const job = makeJob(RelayJobType.PAYABLE_UPDATE_VIA_CCTP, {
      cctpMessage: '0xmsg',
      cctpAttestation: '0xatt',
      eventData: { originalTxHash: '0xtx' },
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains());

    vi.mocked(submitReceivePayableUpdateViaCctp).mockResolvedValue(null);

    await (processor as any).handleCctpUpdate(job, SRC_CHAIN, DEST_CHAIN, {}, {});

    expect(submitReceivePayableUpdateViaCctp).toHaveBeenCalledWith(DEST_CHAIN, {}, {}, '0xmsg', '0xatt');
    const doneCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.DONE);
    expect(doneCall).toBeDefined();
  });

  it('handleCctpUpdate: retries when attestation not yet available', async () => {
    const src = { ...SRC_CHAIN, circleDomain: 0 };
    const dest = { ...DEST_CHAIN, circleDomain: 26 };
    const job = makeJob(RelayJobType.PAYABLE_UPDATE_VIA_CCTP, {
      cctpMessage: null,
      cctpAttestation: null,
      eventData: { originalTxHash: '0xtx' },
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains());

    vi.mocked(fetchCctpAttestation).mockResolvedValue(null);

    await (processor as any).handleCctpUpdate(job, src, dest, {}, {});

    const pendingCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.PENDING);
    expect(pendingCall).toBeDefined();
  });

  it('handleCctpPayment: uses cached attestation and marks DONE on success', async () => {
    const job = makeJob(RelayJobType.PAYMENT_VIA_CCTP, {
      cctpMessage: '0xburnmsg',
      cctpAttestation: '0xatt',
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains());

    vi.mocked(submitReceiveForeignPaymentViaCctp).mockResolvedValue(null);

    await (processor as any).handleCctpPayment(job, SRC_CHAIN, DEST_CHAIN, {}, {});

    expect(submitReceiveForeignPaymentViaCctp).toHaveBeenCalledWith(DEST_CHAIN, {}, {}, '0xburnmsg', '0xatt');
    const doneCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.DONE);
    expect(doneCall).toBeDefined();
  });

  it('dispatch: marks ADMIN_SYNC FAILED immediately', async () => {
    const job = makeJob(RelayJobType.ADMIN_SYNC);
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains());

    await (processor as any).dispatch(job, {} as any);

    const failedCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.FAILED);
    expect(failedCall).toBeDefined();
  });

  it('processOne: returns false when no jobs are claimed', async () => {
    const prisma = {
      relayJob: { findUniqueOrThrow: vi.fn(), update: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([]),
      updateCalls: [],
    } as unknown as PrismaService & { updateCalls: any[] };

    const processor = new RelayProcessor(prisma, makeChains());
    const result = await processor.processOne({} as any);
    expect(result).toBe(false);
  });

  it('processOne: returns true when a job is claimed and processed', async () => {
    // Use an ADMIN_SYNC job which is immediately failed without calling submitters.
    const job = makeJob(RelayJobType.ADMIN_SYNC, { attempts: 0 });
    const prisma = {
      relayJob: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...job, status: RelayJobStatus.PROCESSING, attempts: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
      $queryRaw: vi.fn().mockResolvedValue([job]),
      updateCalls: [] as any[],
    } as unknown as PrismaService & { updateCalls: any[] };
    (prisma.relayJob as any).update.mockImplementation((args: any) => {
      (prisma as any).updateCalls.push(args);
      return Promise.resolve({});
    });

    const processor = new RelayProcessor(prisma, makeChains());
    const result = await processor.processOne({} as any);
    expect(result).toBe(true);
  });

  it('handleWormholeUpdate: marks FAILED when source chain has no wormholeChainId', async () => {
    const src = { ...SRC_CHAIN, wormholeChainId: undefined };
    const job = makeJob(RelayJobType.PAYABLE_UPDATE_VIA_WORMHOLE, {
      vaa: null,
      eventData: { wormholeSequence: '42' },
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains());

    await (processor as any).handleWormholeUpdate(job, src, DEST_CHAIN, {}, {});

    const failedCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.FAILED);
    expect(failedCall).toBeDefined();
  });

  it('handleCctpUpdate: marks FAILED when source chain has no Circle domain', async () => {
    const src = { ...SRC_CHAIN, circleDomain: undefined };
    const job = makeJob(RelayJobType.PAYABLE_UPDATE_VIA_CCTP, {
      cctpMessage: null,
      cctpAttestation: null,
      eventData: { originalTxHash: '0xtx' },
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains());

    await (processor as any).handleCctpUpdate(job, src, DEST_CHAIN, {}, {});

    const failedCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.FAILED);
    expect(failedCall).toBeDefined();
  });

  it('handleCctpPayment: marks FAILED when source chain has no Circle domain', async () => {
    const src = { ...SRC_CHAIN, circleDomain: undefined };
    const job = makeJob(RelayJobType.PAYMENT_VIA_CCTP, {
      cctpMessage: null,
      cctpAttestation: null,
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains());

    await (processor as any).handleCctpPayment(job, src, DEST_CHAIN, {}, {});

    const failedCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.FAILED);
    expect(failedCall).toBeDefined();
  });

  it('handleCctpPayment: retries when attestation not yet available', async () => {
    const src = { ...SRC_CHAIN, circleDomain: 0 };
    const dest = { ...DEST_CHAIN, circleDomain: 26 };
    const job = makeJob(RelayJobType.PAYMENT_VIA_CCTP, {
      cctpMessage: null,
      cctpAttestation: null,
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains());

    vi.mocked(fetchCctpAttestation).mockResolvedValue(null);

    await (processor as any).handleCctpPayment(job, src, dest, {}, {});

    const pendingCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.PENDING);
    expect(pendingCall).toBeDefined();
  });

  it('dispatch: marks FAILED when a chain is not found in the enabled list', async () => {
    const job = makeJob(RelayJobType.PAYABLE_UPDATE_VIA_WORMHOLE, {
      sourceChainId: '0xunknown',
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains());

    await (processor as any).dispatch(job, {} as any);

    const failedCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.FAILED);
    expect(failedCall).toBeDefined();
  });

  it('processOne: catches dispatch exceptions and retries', async () => {
    const job = makeJob(RelayJobType.PAYABLE_UPDATE_VIA_WORMHOLE, { vaa: Buffer.from([0x01]).toString('hex') });
    const prisma = {
      relayJob: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...job, status: RelayJobStatus.PROCESSING, attempts: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
      $queryRaw: vi.fn().mockResolvedValue([job]),
      updateCalls: [] as any[],
    } as unknown as PrismaService & { updateCalls: any[] };
    (prisma.relayJob as any).update.mockImplementation((args: any) => {
      (prisma as any).updateCalls.push(args);
      return Promise.resolve({});
    });

    // Make the submitter throw an unhandled error.
    vi.mocked(submitReceivePayableUpdateViaWormhole).mockRejectedValue(new Error('network down'));

    const processor = new RelayProcessor(prisma, makeChains());
    const result = await processor.processOne({} as any);
    // Should still return true (a job was claimed).
    expect(result).toBe(true);
    // The error should have triggered retryLater -> PENDING.
    const pendingCall = (prisma as any).updateCalls.find((c: any) => c.data?.status === RelayJobStatus.PENDING);
    expect(pendingCall).toBeDefined();
  });
});
