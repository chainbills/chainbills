// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Relay processor tests
//
// Covers error classification: every idempotent error -> DONE, RelayerOnly ->
// FAILED immediately, InsufficientFinality -> retryLater, unknown error -> retryLater.
// Also covers Solana-destination job routing: with relayEnabled Solana dest chain
// the Solana submitter is invoked; without a Solana keypair the job is FAILED.
// ──────────────────────────────────────────────────────────────────────────────

import { RelayJobStatus, RelayJobType } from '@prisma/client';
import { RelayProcessor } from './relay.processor';
import type { PrismaService } from '../prisma/prisma.service';
import type { ChainsService } from '../chains/chains.service';
import type { AppConfigService } from '../config/app-config.service';
import type { EvmChainConfig, SolanaChainConfig } from '../chains/types';

const SRC_CHAIN: EvmChainConfig = {
  slug: 'anvil',
  cbChainId: '0xchainA',
  displayName: 'A',
  caip2: 'eip155:1',
  network: 'testnet',
  isEvm: true,
  isSolana: false,
  diamondAddress: '0xdiamond',
  wormholeChainId: 10002,
  circleDomain: 0,
  pollIntervalMs: 1000,
  minGasBalance: 0n,
  viemChain: {} as any,
};

const DEST_CHAIN: EvmChainConfig = {
  ...SRC_CHAIN,
  slug: 'arcmainnet',
  cbChainId: '0xchainB',
  circleDomain: 26,
};

const SOLANA_DEST_CHAIN: SolanaChainConfig = {
  slug: 'solanadevnet',
  cbChainId: '0xsolanaChain',
  displayName: 'Solana Devnet',
  caip2: 'solana:devnet',
  network: 'testnet',
  isEvm: false,
  isSolana: true,
  wormholeChainId: 1,
  circleDomain: 5,
  pollIntervalMs: 5000,
  minGasBalance: 50_000_000n,
  relayEnabled: true,
  programId: 'DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk',
  usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  wormholeProgramId: '3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5',
  cctpProgramId: 'CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd',
  wormholeShimProgramId: 'EtZMZM22ViKMo4r5y4Anovs3wKQ2owUmDpjygnMMcdEX',
};

/** A fake 64-byte keypair (all zeros) for test use. */
const FAKE_KEYPAIR_BYTES = Array(64).fill(0) as number[];

function makeJob(type: RelayJobType = RelayJobType.PAYABLE_UPDATE_VIA_WORMHOLE, overrides: Partial<any> = {}) {
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

function makeChains(extraChains: (EvmChainConfig | SolanaChainConfig)[] = []): ChainsService {
  const all = [SRC_CHAIN, DEST_CHAIN, ...extraChains];
  return {
    enabled: all,
    byCbChainId: (id: string) => all.find((c) => c.cbChainId === id),
    getRpcUrl: () => 'http://localhost',
  } as unknown as ChainsService;
}

function makeConfig(keypairBytes: number[] | null = FAKE_KEYPAIR_BYTES): AppConfigService {
  return {
    // Pass null to simulate no keypair configured (undefined triggers the default).
    env: { solanaRelayerKeypair: keypairBytes ?? undefined },
  } as unknown as AppConfigService;
}

// A RelayProcessor that captures what classifyResult was called with.
// We spy on the EVM submitter functions to return controlled error names.
describe('RelayProcessor — error classification', () => {
  let processor: RelayProcessor;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma(makeJob());
    processor = new RelayProcessor(prisma, makeChains(), makeConfig());
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
  it('marks SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE FAILED when no SOLANA_RELAYER_KEYPAIR configured', async () => {
    const job = makeJob(RelayJobType.SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE, {
      destChainId: SOLANA_DEST_CHAIN.cbChainId,
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains([SOLANA_DEST_CHAIN]), makeConfig(null));

    await (processor as any).dispatch(job, {} as any);

    const failedCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.FAILED);
    expect(failedCall).toBeDefined();
    expect(failedCall.data.lastError).toMatch(/SOLANA_RELAYER_KEYPAIR/);
  });

  it('marks SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE FAILED when dest chain is not an enabled Solana chain', async () => {
    // destChainId points to a chain not in the enabled list
    const job = makeJob(RelayJobType.SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE, {
      destChainId: '0xunknownSolana',
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains(), makeConfig());

    await (processor as any).dispatch(job, {} as any);

    const failedCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.FAILED);
    expect(failedCall).toBeDefined();
  });

  it('marks SOLANA_PAYMENT_VIA_CCTP_WORMHOLE FAILED when no SOLANA_RELAYER_KEYPAIR configured', async () => {
    const job = makeJob(RelayJobType.SOLANA_PAYMENT_VIA_CCTP_WORMHOLE, {
      destChainId: SOLANA_DEST_CHAIN.cbChainId,
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains([SOLANA_DEST_CHAIN]), makeConfig(null));

    await (processor as any).dispatch(job, {} as any);

    const failedCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.FAILED);
    expect(failedCall).toBeDefined();
    expect(failedCall.data.lastError).toMatch(/SOLANA_RELAYER_KEYPAIR/);
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
vi.mock('./submitters/solana.submitter', () => ({
  submitPayableUpdateToSolana: vi.fn(),
  submitPaymentToSolana: vi.fn(),
  SOLANA_NOT_IMPLEMENTED: 'SolanaSubmitterNotImplemented',
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
import {
  submitPayableUpdateToSolana,
  submitPaymentToSolana as submitPaymentToSolanaFn,
} from './submitters/solana.submitter';

describe('RelayProcessor — Solana routing with mocked Solana submitter', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('routes SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE to Solana submitter when keypair is set and dest is Solana', async () => {
    const vaaHex = Buffer.from([0x01, 0x02, 0x03]).toString('hex');
    const job = makeJob(RelayJobType.SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE, {
      destChainId: SOLANA_DEST_CHAIN.cbChainId,
      vaa: vaaHex,
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains([SOLANA_DEST_CHAIN]), makeConfig());

    // Solana submitter returns null on success.
    vi.mocked(submitPayableUpdateToSolana).mockResolvedValue(null);

    await (processor as any).dispatch(job, {} as any);

    expect(submitPayableUpdateToSolana).toHaveBeenCalledOnce();
    // null -> DONE
    const doneCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.DONE);
    expect(doneCall).toBeDefined();
  });

  it('routes SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE to Solana submitter and retries on SolanaSubmitterNotImplemented', async () => {
    const vaaHex = Buffer.from([0x01, 0x02, 0x03]).toString('hex');
    const job = makeJob(RelayJobType.SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE, {
      destChainId: SOLANA_DEST_CHAIN.cbChainId,
      vaa: vaaHex,
      attempts: 1,
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains([SOLANA_DEST_CHAIN]), makeConfig());

    vi.mocked(submitPayableUpdateToSolana).mockResolvedValue('SolanaSubmitterNotImplemented');

    await (processor as any).dispatch(job, {} as any);

    expect(submitPayableUpdateToSolana).toHaveBeenCalledOnce();
    // SolanaSubmitterNotImplemented is retryable -> PENDING
    const pendingCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.PENDING);
    expect(pendingCall).toBeDefined();
  });

  it('SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE: fetches VAA when not cached, retries if unavailable', async () => {
    const job = makeJob(RelayJobType.SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE, {
      destChainId: SOLANA_DEST_CHAIN.cbChainId,
      sourceChainId: SRC_CHAIN.cbChainId,
      vaa: null,
      eventData: { sequence: '7' },
      attempts: 1,
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains([SOLANA_DEST_CHAIN]), makeConfig());

    vi.mocked(fetchVaa).mockResolvedValue(null); // not available yet

    await (processor as any).dispatch(job, {} as any);

    expect(fetchVaa).toHaveBeenCalledOnce();
    const pendingCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.PENDING);
    expect(pendingCall).toBeDefined();
  });

  it('SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE: retries when source chain has no wormholeChainId', async () => {
    const srcNoWormhole = { ...SRC_CHAIN, wormholeChainId: undefined };
    const chains = {
      enabled: [srcNoWormhole, SOLANA_DEST_CHAIN],
      byCbChainId: (id: string) => [srcNoWormhole, SOLANA_DEST_CHAIN].find((c) => c.cbChainId === id),
      getRpcUrl: () => 'http://localhost',
    } as unknown as import('../chains/chains.service').ChainsService;

    const job = makeJob(RelayJobType.SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE, {
      destChainId: SOLANA_DEST_CHAIN.cbChainId,
      sourceChainId: SRC_CHAIN.cbChainId,
      vaa: null,
      eventData: { sequence: '7' },
      attempts: 1,
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, chains, makeConfig());

    await (processor as any).dispatch(job, {} as any);

    const pendingCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.PENDING);
    expect(pendingCall).toBeDefined();
  });

  it('SOLANA_PAYMENT_VIA_CCTP_WORMHOLE: uses cached artefacts and marks DONE on success', async () => {
    const vaaHex = Buffer.from([0x01]).toString('hex');
    const job = makeJob(RelayJobType.SOLANA_PAYMENT_VIA_CCTP_WORMHOLE, {
      destChainId: SOLANA_DEST_CHAIN.cbChainId,
      vaa: vaaHex,
      cctpMessage: '0xmsg',
      cctpAttestation: '0xatt',
      attempts: 1,
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains([SOLANA_DEST_CHAIN]), makeConfig());

    vi.mocked(submitPaymentToSolanaFn).mockResolvedValue(null);

    await (processor as any).dispatch(job, {} as any);

    expect(submitPaymentToSolanaFn).toHaveBeenCalledOnce();
    const doneCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.DONE);
    expect(doneCall).toBeDefined();
  });

  it('SOLANA_PAYMENT_VIA_CCTP_WORMHOLE: retries when source chain has no wormholeChainId', async () => {
    const srcNoWormhole = { ...SRC_CHAIN, wormholeChainId: undefined };
    const chains = {
      enabled: [srcNoWormhole, SOLANA_DEST_CHAIN],
      byCbChainId: (id: string) => [srcNoWormhole, SOLANA_DEST_CHAIN].find((c) => c.cbChainId === id),
      getRpcUrl: () => 'http://localhost',
    } as unknown as import('../chains/chains.service').ChainsService;

    const job = makeJob(RelayJobType.SOLANA_PAYMENT_VIA_CCTP_WORMHOLE, {
      destChainId: SOLANA_DEST_CHAIN.cbChainId,
      sourceChainId: SRC_CHAIN.cbChainId,
      vaa: null,
      cctpMessage: null,
      cctpAttestation: null,
      eventData: { sequence: '7' },
      attempts: 1,
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, chains, makeConfig());

    await (processor as any).dispatch(job, {} as any);

    const pendingCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.PENDING);
    expect(pendingCall).toBeDefined();
  });

  it('SOLANA_PAYMENT_VIA_CCTP_WORMHOLE: retries when VAA not yet available', async () => {
    const job = makeJob(RelayJobType.SOLANA_PAYMENT_VIA_CCTP_WORMHOLE, {
      destChainId: SOLANA_DEST_CHAIN.cbChainId,
      sourceChainId: SRC_CHAIN.cbChainId,
      vaa: null,
      cctpMessage: null,
      cctpAttestation: null,
      eventData: { sequence: '7' },
      attempts: 1,
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains([SOLANA_DEST_CHAIN]), makeConfig());

    vi.mocked(fetchVaa).mockResolvedValue(null);

    await (processor as any).dispatch(job, {} as any);

    const pendingCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.PENDING);
    expect(pendingCall).toBeDefined();
  });

  it('SOLANA_PAYMENT_VIA_CCTP_WORMHOLE: marks FAILED when CCTP circle domain missing', async () => {
    const srcNoCctp = { ...SRC_CHAIN, circleDomain: undefined };
    const chains = {
      enabled: [srcNoCctp, SOLANA_DEST_CHAIN],
      byCbChainId: (id: string) => [srcNoCctp, SOLANA_DEST_CHAIN].find((c) => c.cbChainId === id),
      getRpcUrl: () => 'http://localhost',
    } as unknown as import('../chains/chains.service').ChainsService;

    const job = makeJob(RelayJobType.SOLANA_PAYMENT_VIA_CCTP_WORMHOLE, {
      destChainId: SOLANA_DEST_CHAIN.cbChainId,
      sourceChainId: SRC_CHAIN.cbChainId,
      vaa: null,
      cctpMessage: null,
      cctpAttestation: null,
      eventData: { sequence: '7' },
      attempts: 1,
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, chains, makeConfig());

    vi.mocked(fetchVaa).mockResolvedValue(Buffer.from([0x01, 0x02]));

    await (processor as any).dispatch(job, {} as any);

    const failedCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.FAILED);
    expect(failedCall).toBeDefined();
  });

  it('SOLANA_PAYMENT_VIA_CCTP_WORMHOLE: retries when CCTP attestation not yet available', async () => {
    const job = makeJob(RelayJobType.SOLANA_PAYMENT_VIA_CCTP_WORMHOLE, {
      destChainId: SOLANA_DEST_CHAIN.cbChainId,
      sourceChainId: SRC_CHAIN.cbChainId,
      vaa: null,
      cctpMessage: null,
      cctpAttestation: null,
      eventData: { sequence: '7' },
      attempts: 1,
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains([SOLANA_DEST_CHAIN]), makeConfig());

    vi.mocked(fetchVaa).mockResolvedValue(Buffer.from([0x01, 0x02]));
    vi.mocked(fetchCctpAttestation).mockResolvedValue(null);

    await (processor as any).dispatch(job, {} as any);

    const pendingCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.PENDING);
    expect(pendingCall).toBeDefined();
  });

  it('SOLANA_PAYMENT_VIA_CCTP_WORMHOLE: fetches VAA and CCTP then submits', async () => {
    const job = makeJob(RelayJobType.SOLANA_PAYMENT_VIA_CCTP_WORMHOLE, {
      destChainId: SOLANA_DEST_CHAIN.cbChainId,
      sourceChainId: SRC_CHAIN.cbChainId,
      vaa: null,
      cctpMessage: null,
      cctpAttestation: null,
      eventData: { sequence: '7' },
      attempts: 1,
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains([SOLANA_DEST_CHAIN]), makeConfig());

    vi.mocked(fetchVaa).mockResolvedValue(Buffer.from([0x01, 0x02]));
    vi.mocked(fetchCctpAttestation).mockResolvedValue({ message: '0xmsg', attestation: '0xatt' });
    vi.mocked(submitPaymentToSolanaFn).mockResolvedValue(null);

    await (processor as any).dispatch(job, {} as any);

    expect(submitPaymentToSolanaFn).toHaveBeenCalledOnce();
    const doneCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.DONE);
    expect(doneCall).toBeDefined();
  });

  it('SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE: fetches VAA then submits', async () => {
    const job = makeJob(RelayJobType.SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE, {
      destChainId: SOLANA_DEST_CHAIN.cbChainId,
      sourceChainId: SRC_CHAIN.cbChainId,
      vaa: null,
      eventData: { sequence: '7' },
      attempts: 1,
    });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains([SOLANA_DEST_CHAIN]), makeConfig());

    vi.mocked(fetchVaa).mockResolvedValue(Buffer.from([0x01, 0x02]));
    vi.mocked(submitPayableUpdateToSolana).mockResolvedValue(null);

    await (processor as any).dispatch(job, {} as any);

    expect(submitPayableUpdateToSolana).toHaveBeenCalledOnce();
    const doneCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.DONE);
    expect(doneCall).toBeDefined();
  });
});

describe('RelayProcessor — dispatch with mocked submitters', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('handleWormholeUpdate: uses cached VAA and marks DONE on success', async () => {
    const vaaHex = Buffer.from([0x01, 0x02, 0x03]).toString('hex');
    const job = makeJob(RelayJobType.PAYABLE_UPDATE_VIA_WORMHOLE, { vaa: vaaHex });
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains(), makeConfig());

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
    const processor = new RelayProcessor(prisma, makeChains(), makeConfig());

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
    const processor = new RelayProcessor(prisma, makeChains(), makeConfig());

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
    const processor = new RelayProcessor(prisma, makeChains(), makeConfig());

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
    const processor = new RelayProcessor(prisma, makeChains(), makeConfig());

    vi.mocked(submitReceiveForeignPaymentViaCctp).mockResolvedValue(null);

    await (processor as any).handleCctpPayment(job, SRC_CHAIN, DEST_CHAIN, {}, {});

    expect(submitReceiveForeignPaymentViaCctp).toHaveBeenCalledWith(DEST_CHAIN, {}, {}, '0xburnmsg', '0xatt');
    const doneCall = prisma.updateCalls.find((c: any) => c.data?.status === RelayJobStatus.DONE);
    expect(doneCall).toBeDefined();
  });

  it('dispatch: marks ADMIN_SYNC FAILED immediately', async () => {
    const job = makeJob(RelayJobType.ADMIN_SYNC);
    const prisma = makePrisma(job);
    const processor = new RelayProcessor(prisma, makeChains(), makeConfig());

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

    const processor = new RelayProcessor(prisma, makeChains(), makeConfig());
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

    const processor = new RelayProcessor(prisma, makeChains(), makeConfig());
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
    const processor = new RelayProcessor(prisma, makeChains(), makeConfig());

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
    const processor = new RelayProcessor(prisma, makeChains(), makeConfig());

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
    const processor = new RelayProcessor(prisma, makeChains(), makeConfig());

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
    const processor = new RelayProcessor(prisma, makeChains(), makeConfig());

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
    const processor = new RelayProcessor(prisma, makeChains(), makeConfig());

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

    const processor = new RelayProcessor(prisma, makeChains(), makeConfig());
    const result = await processor.processOne({} as any);
    // Should still return true (a job was claimed).
    expect(result).toBe(true);
    // The error should have triggered retryLater -> PENDING.
    const pendingCall = (prisma as any).updateCalls.find((c: any) => c.data?.status === RelayJobStatus.PENDING);
    expect(pendingCall).toBeDefined();
  });
});
