/**
 * Foreign payable sync tests:
 *   recv_payable_update_via_wormhole — EVM → Solana via Wormhole VAA
 *   recv_payable_update_via_cctp    — EVM → Solana via CCTP data message
 */

import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { LiteSVM } from 'litesvm';
import { chainRegistryPDA, consumedVaaPDA, foreignPayablePDA, stats } from './accounts';
import {
  ACTION_CLOSE,
  ACTION_CREATE,
  ACTION_REOPEN,
  ACTION_UPDATE_ATAA,
  buildCctpMessage,
  buildPostedVaaData,
  CCTP_DEVNET,
  cctpDataNoncePDA,
  encodePayablePayload,
  injectPostedVaa,
  WORMHOLE_DEVNET,
} from './helpers/mock-vaa';
import { bootstrapProgram } from './helpers/setup';
import {
  createSvm,
  decode,
  encodeAccount,
  expectFailure,
  expectSuccess,
  fund,
  injectAccount,
  sendIx,
} from './helpers/svm';

// ── Constants ─────────────────────────────────────────────────────────────────

// keccak256("eip155:11155111") — Ethereum Sepolia
const SEPOLIA_CB_CHAIN_ID = Buffer.from('afa9c74bd89ea79b5c1da22f7ea1c29de3a3c70e6f84f769e68c51e5f4c1bb1b', 'hex');
const SEPOLIA_WORMHOLE_CHAIN_ID = 10002;
const SEPOLIA_CIRCLE_DOMAIN = 0;

// Fake EVM Chainbills contract address (32-byte Wormhole-normalized)
const EVM_CONTRACT = new Uint8Array(32).fill(0xaa);

// Fake EVM payable IDs
const PAYABLE_ID_A = Buffer.alloc(32, 0x02);
const PAYABLE_ID_B = Buffer.alloc(32, 0x03);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function injectChainRegistry(
  svm: LiteSVM,
  opts: {
    cbChainId: Buffer;
    hasWormhole?: boolean;
    wormholeChainId?: number;
    hasCctp?: boolean;
    circleDomain?: number;
    registeredContract?: Uint8Array;
  }
): Promise<PublicKey> {
  const {
    cbChainId,
    hasWormhole = false,
    wormholeChainId = 0,
    hasCctp = false,
    circleDomain = 0,
    registeredContract = EVM_CONTRACT,
  } = opts;

  const data = await encodeAccount('ChainRegistry', {
    cb_chain_id: Array.from(cbChainId),
    has_wormhole: hasWormhole,
    wormhole_chain_id: wormholeChainId,
    has_cctp: hasCctp,
    circle_domain: circleDomain,
    registered_contract: Array.from(registeredContract),
  });
  const addr = chainRegistryPDA(cbChainId);
  injectAccount(svm, addr, data);
  return addr;
}

/** Build + inject a PostedVAA carrying a PayablePayload; return { vaaHash, postedVaaAddr }. */
function buildAndInjectVaa(
  svm: LiteSVM,
  payloadBuf: Buffer,
  emitterChain: number,
  emitterAddress: Uint8Array,
  vaaHash?: Buffer
): { vaaHash: Buffer; postedVaaAddr: PublicKey } {
  const hash = vaaHash ?? Buffer.alloc(32, 0x77);
  const vaaData = buildPostedVaaData({ emitterChain, emitterAddress, payload: payloadBuf });
  const addr = injectPostedVaa(svm, hash, vaaData);
  return { vaaHash: hash, postedVaaAddr: addr };
}

// ── recv_payable_update_via_wormhole ─────────────────────────────────────────

describe('recv_payable_update_via_wormhole', () => {
  let svm: LiteSVM;
  let owner: Keypair;
  let relayer: Keypair;
  let chainRegAddr: PublicKey;

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);

    const { keypair } = fund(svm);
    relayer = keypair;

    chainRegAddr = await injectChainRegistry(svm, {
      cbChainId: SEPOLIA_CB_CHAIN_ID,
      hasWormhole: true,
      wormholeChainId: SEPOLIA_WORMHOLE_CHAIN_ID,
    });
  });

  async function callRecvWormhole(payableId: Buffer, vaaHash: Buffer, program?: any) {
    const prog = program ?? require('./helpers/svm').createProgram(relayer);
    const ix = await prog.methods
      .recvPayableUpdateViaWormhole(Array.from(vaaHash))
      .accounts({
        relayer: relayer.publicKey,
        wormholeProgram: WORMHOLE_DEVNET,
        postedVaa: postedVaaPDAFor(vaaHash),
        chainRegistry: chainRegAddr,
        foreignPayable: foreignPayablePDA(payableId),
        consumedVaa: consumedVaaPDA(vaaHash),
        stats,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    return sendIx(svm, ix, relayer);
  }

  function postedVaaPDAFor(vaaHash: Buffer): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from('PostedVAA'), vaaHash], WORMHOLE_DEVNET)[0];
  }

  it('CREATE: creates ForeignPayable and increments stats', async () => {
    const payload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [],
    });
    const vaaHash = Buffer.alloc(32, 0x10);
    buildAndInjectVaa(svm, payload, SEPOLIA_WORMHOLE_CHAIN_ID, EVM_CONTRACT, vaaHash);

    const result = await callRecvWormhole(PAYABLE_ID_A, vaaHash);
    expectSuccess(result);

    const fp = decode<any>(svm, 'ForeignPayable', foreignPayablePDA(PAYABLE_ID_A));
    expect(Array.from(fp.payable_id)).toEqual(Array.from(PAYABLE_ID_A));
    expect(Array.from(fp.cb_chain_id)).toEqual(Array.from(SEPOLIA_CB_CHAIN_ID));
    expect(fp.is_closed).toBe(false);
    expect(fp.payable_update_nonce.toNumber()).toBe(1);
    expect(fp.payments_count.toNumber()).toBe(0);

    const s = decode<any>(svm, 'Stats', stats);
    expect(s.consumed_wormhole_messages.toNumber()).toBe(1);
    expect(s.total_foreign_payables.toNumber()).toBe(1);
  });

  it('CREATE with ATAA: stores allowed_tokens_and_amounts', async () => {
    const token = new Uint8Array(32).fill(0x55);
    const payload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [{ token, amount: 1_000_000n }],
    });
    const vaaHash = Buffer.alloc(32, 0x11);
    buildAndInjectVaa(svm, payload, SEPOLIA_WORMHOLE_CHAIN_ID, EVM_CONTRACT, vaaHash);

    expectSuccess(await callRecvWormhole(PAYABLE_ID_A, vaaHash));

    const fp = decode<any>(svm, 'ForeignPayable', foreignPayablePDA(PAYABLE_ID_A));
    expect(fp.allowed_tokens_and_amounts.length).toBe(1);
    expect(Array.from(fp.allowed_tokens_and_amounts[0].token)).toEqual(Array.from(token));
    expect(fp.allowed_tokens_and_amounts[0].amount.toNumber()).toBe(1_000_000);
  });

  it('CLOSE: sets is_closed=true on existing ForeignPayable', async () => {
    // First CREATE
    const createPayload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [],
    });
    buildAndInjectVaa(svm, createPayload, SEPOLIA_WORMHOLE_CHAIN_ID, EVM_CONTRACT, Buffer.alloc(32, 0x20));
    expectSuccess(await callRecvWormhole(PAYABLE_ID_A, Buffer.alloc(32, 0x20)));

    // Then CLOSE
    const closePayload = encodePayablePayload({
      actionType: ACTION_CLOSE,
      payableId: PAYABLE_ID_A,
      nonce: 2n,
      isClosed: true,
    });
    buildAndInjectVaa(svm, closePayload, SEPOLIA_WORMHOLE_CHAIN_ID, EVM_CONTRACT, Buffer.alloc(32, 0x21));
    expectSuccess(await callRecvWormhole(PAYABLE_ID_A, Buffer.alloc(32, 0x21)));

    const fp = decode<any>(svm, 'ForeignPayable', foreignPayablePDA(PAYABLE_ID_A));
    expect(fp.is_closed).toBe(true);
    expect(fp.payable_update_nonce.toNumber()).toBe(2);
  });

  it('REOPEN: sets is_closed=false after CLOSE', async () => {
    for (const [action, nonce, hash] of [
      [ACTION_CREATE, 1n, Buffer.alloc(32, 0x30)],
      [ACTION_CLOSE, 2n, Buffer.alloc(32, 0x31)],
      [ACTION_REOPEN, 3n, Buffer.alloc(32, 0x32)],
    ] as [number, bigint, Buffer][]) {
      const isClosed = action === ACTION_CLOSE;
      const payload =
        action === ACTION_CREATE
          ? encodePayablePayload({ actionType: action, payableId: PAYABLE_ID_A, nonce, ataa: [] })
          : encodePayablePayload({ actionType: action, payableId: PAYABLE_ID_A, nonce, isClosed });
      buildAndInjectVaa(svm, payload, SEPOLIA_WORMHOLE_CHAIN_ID, EVM_CONTRACT, hash);
      expectSuccess(await callRecvWormhole(PAYABLE_ID_A, hash));
    }

    const fp = decode<any>(svm, 'ForeignPayable', foreignPayablePDA(PAYABLE_ID_A));
    expect(fp.is_closed).toBe(false);
    expect(fp.payable_update_nonce.toNumber()).toBe(3);
  });

  it('UPDATE_ATAA: replaces allowed_tokens_and_amounts', async () => {
    const t1 = new Uint8Array(32).fill(0x01);
    const t2 = new Uint8Array(32).fill(0x02);

    // CREATE with 1 token
    const createPayload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [{ token: t1, amount: 500_000n }],
    });
    buildAndInjectVaa(svm, createPayload, SEPOLIA_WORMHOLE_CHAIN_ID, EVM_CONTRACT, Buffer.alloc(32, 0x40));
    expectSuccess(await callRecvWormhole(PAYABLE_ID_A, Buffer.alloc(32, 0x40)));

    // UPDATE_ATAA with 2 tokens
    const updatePayload = encodePayablePayload({
      actionType: ACTION_UPDATE_ATAA,
      payableId: PAYABLE_ID_A,
      nonce: 2n,
      ataa: [
        { token: t1, amount: 1_000_000n },
        { token: t2, amount: 2_000_000n },
      ],
    });
    buildAndInjectVaa(svm, updatePayload, SEPOLIA_WORMHOLE_CHAIN_ID, EVM_CONTRACT, Buffer.alloc(32, 0x41));
    expectSuccess(await callRecvWormhole(PAYABLE_ID_A, Buffer.alloc(32, 0x41)));

    const fp = decode<any>(svm, 'ForeignPayable', foreignPayablePDA(PAYABLE_ID_A));
    expect(fp.allowed_tokens_and_amounts.length).toBe(2);
    expect(fp.payable_update_nonce.toNumber()).toBe(2);
  });

  it('rejects stale nonce (same nonce twice)', async () => {
    const payload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [],
    });
    buildAndInjectVaa(svm, payload, SEPOLIA_WORMHOLE_CHAIN_ID, EVM_CONTRACT, Buffer.alloc(32, 0x50));
    expectSuccess(await callRecvWormhole(PAYABLE_ID_A, Buffer.alloc(32, 0x50)));

    // Second CREATE with same nonce — stale
    const payload2 = encodePayablePayload({
      actionType: ACTION_UPDATE_ATAA,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [],
    });
    buildAndInjectVaa(svm, payload2, SEPOLIA_WORMHOLE_CHAIN_ID, EVM_CONTRACT, Buffer.alloc(32, 0x51));
    expectFailure(await callRecvWormhole(PAYABLE_ID_A, Buffer.alloc(32, 0x51)));
  });

  it('rejects duplicate consumed_vaa (same vaa_hash twice)', async () => {
    const payload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [],
    });
    const vaaHash = Buffer.alloc(32, 0x60);
    buildAndInjectVaa(svm, payload, SEPOLIA_WORMHOLE_CHAIN_ID, EVM_CONTRACT, vaaHash);
    expectSuccess(await callRecvWormhole(PAYABLE_ID_A, vaaHash));

    // Same vaa_hash, different payable → init of consumed_vaa fails
    const payload2 = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_B,
      nonce: 1n,
      ataa: [],
    });
    buildAndInjectVaa(svm, payload2, SEPOLIA_WORMHOLE_CHAIN_ID, EVM_CONTRACT, vaaHash);
    expectFailure(await callRecvWormhole(PAYABLE_ID_B, vaaHash));
  });

  it('rejects invalid wormhole program key', async () => {
    const payload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [],
    });
    const vaaHash = Buffer.alloc(32, 0x70);
    buildAndInjectVaa(svm, payload, SEPOLIA_WORMHOLE_CHAIN_ID, EVM_CONTRACT, vaaHash);

    const fakeWormhole = Keypair.generate().publicKey;
    const prog = require('./helpers/svm').createProgram(relayer);
    const ix = await prog.methods
      .recvPayableUpdateViaWormhole(Array.from(vaaHash))
      .accounts({
        relayer: relayer.publicKey,
        wormholeProgram: fakeWormhole,
        postedVaa: postedVaaPDAFor(vaaHash),
        chainRegistry: chainRegAddr,
        foreignPayable: foreignPayablePDA(PAYABLE_ID_A),
        consumedVaa: consumedVaaPDA(vaaHash),
        stats,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    expectFailure(sendIx(svm, ix, relayer));
  });

  it('rejects mismatched emitter_chain in VAA vs ChainRegistry', async () => {
    const payload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [],
    });
    const vaaHash = Buffer.alloc(32, 0x80);
    // VAA has wrong emitter_chain (1 = Solana, not Sepolia 10002)
    const vaaData = buildPostedVaaData({
      emitterChain: 1,
      emitterAddress: EVM_CONTRACT,
      payload,
    });
    injectPostedVaa(svm, vaaHash, vaaData);
    expectFailure(await callRecvWormhole(PAYABLE_ID_A, vaaHash));
  });

  it('independent payables get separate ForeignPayable PDAs', async () => {
    for (const [id, hash, nonce] of [
      [PAYABLE_ID_A, Buffer.alloc(32, 0x90), 1n],
      [PAYABLE_ID_B, Buffer.alloc(32, 0x91), 1n],
    ] as [Buffer, Buffer, bigint][]) {
      const payload = encodePayablePayload({ actionType: ACTION_CREATE, payableId: id, nonce, ataa: [] });
      buildAndInjectVaa(svm, payload, SEPOLIA_WORMHOLE_CHAIN_ID, EVM_CONTRACT, hash);
      expectSuccess(await callRecvWormhole(id, hash));
    }

    const s = decode<any>(svm, 'Stats', stats);
    expect(s.total_foreign_payables.toNumber()).toBe(2);
    expect(s.consumed_wormhole_messages.toNumber()).toBe(2);
  });
});

// ── recv_payable_update_via_cctp ─────────────────────────────────────────────

describe('recv_payable_update_via_cctp', () => {
  let svm: LiteSVM;
  let owner: Keypair;
  let relayer: Keypair;
  let chainRegAddr: PublicKey;

  const SRC_DOMAIN = SEPOLIA_CIRCLE_DOMAIN;

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);

    const { keypair } = fund(svm);
    relayer = keypair;

    chainRegAddr = await injectChainRegistry(svm, {
      cbChainId: SEPOLIA_CB_CHAIN_ID,
      hasCctp: true,
      circleDomain: SRC_DOMAIN,
    });
  });

  async function callRecvCctp(payableId: Buffer, nonce: Buffer, message: Buffer) {
    const prog = require('./helpers/svm').createProgram(relayer);
    const ix = await prog.methods
      .recvPayableUpdateViaCctp(
        SRC_DOMAIN,
        Array.from(nonce),
        message,
        Buffer.alloc(0) // attestation ignored in handler
      )
      .accounts({
        relayer: relayer.publicKey,
        cctpProgram: CCTP_DEVNET,
        chainRegistry: chainRegAddr,
        foreignPayable: foreignPayablePDA(payableId),
        cctpDataNonce: cctpDataNoncePDA(SRC_DOMAIN, nonce),
        stats,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    return sendIx(svm, ix, relayer);
  }

  it('CREATE: creates ForeignPayable and increments stats', async () => {
    const payload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [],
    });
    const nonce = Buffer.alloc(32, 0x01);
    const message = buildCctpMessage({
      srcDomain: SRC_DOMAIN,
      nonce,
      sender: Buffer.from(EVM_CONTRACT),
      payload,
    });

    expectSuccess(await callRecvCctp(PAYABLE_ID_A, nonce, message));

    const fp = decode<any>(svm, 'ForeignPayable', foreignPayablePDA(PAYABLE_ID_A));
    expect(Array.from(fp.payable_id)).toEqual(Array.from(PAYABLE_ID_A));
    expect(Array.from(fp.cb_chain_id)).toEqual(Array.from(SEPOLIA_CB_CHAIN_ID));
    expect(fp.is_closed).toBe(false);
    expect(fp.payable_update_nonce.toNumber()).toBe(1);

    const s = decode<any>(svm, 'Stats', stats);
    expect(s.received_cctp_update_messages.toNumber()).toBe(1);
    expect(s.total_foreign_payables.toNumber()).toBe(1);
  });

  it('CREATE with ATAA: stores allowed_tokens_and_amounts', async () => {
    const token = new Uint8Array(32).fill(0xbb);
    const payload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [{ token, amount: 5_000_000n }],
    });
    const nonce = Buffer.alloc(32, 0x02);
    const message = buildCctpMessage({
      srcDomain: SRC_DOMAIN,
      nonce,
      sender: Buffer.from(EVM_CONTRACT),
      payload,
    });

    expectSuccess(await callRecvCctp(PAYABLE_ID_A, nonce, message));

    const fp = decode<any>(svm, 'ForeignPayable', foreignPayablePDA(PAYABLE_ID_A));
    expect(fp.allowed_tokens_and_amounts.length).toBe(1);
    expect(fp.allowed_tokens_and_amounts[0].amount.toNumber()).toBe(5_000_000);
  });

  it('CLOSE: sets is_closed=true on existing ForeignPayable', async () => {
    // CREATE
    const createPayload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [],
    });
    const n1 = Buffer.alloc(32, 0x10);
    expectSuccess(
      await callRecvCctp(
        PAYABLE_ID_A,
        n1,
        buildCctpMessage({
          srcDomain: SRC_DOMAIN,
          nonce: n1,
          sender: Buffer.from(EVM_CONTRACT),
          payload: createPayload,
        })
      )
    );

    // CLOSE
    const closePayload = encodePayablePayload({
      actionType: ACTION_CLOSE,
      payableId: PAYABLE_ID_A,
      nonce: 2n,
      isClosed: true,
    });
    const n2 = Buffer.alloc(32, 0x11);
    expectSuccess(
      await callRecvCctp(
        PAYABLE_ID_A,
        n2,
        buildCctpMessage({ srcDomain: SRC_DOMAIN, nonce: n2, sender: Buffer.from(EVM_CONTRACT), payload: closePayload })
      )
    );

    const fp = decode<any>(svm, 'ForeignPayable', foreignPayablePDA(PAYABLE_ID_A));
    expect(fp.is_closed).toBe(true);
  });

  it('rejects stale nonce', async () => {
    const n1 = Buffer.alloc(32, 0x20);
    const createPayload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [],
    });
    expectSuccess(
      await callRecvCctp(
        PAYABLE_ID_A,
        n1,
        buildCctpMessage({
          srcDomain: SRC_DOMAIN,
          nonce: n1,
          sender: Buffer.from(EVM_CONTRACT),
          payload: createPayload,
        })
      )
    );

    // Stale nonce=1 again
    const n2 = Buffer.alloc(32, 0x21);
    const stalePayload = encodePayablePayload({
      actionType: ACTION_UPDATE_ATAA,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [],
    });
    expectFailure(
      await callRecvCctp(
        PAYABLE_ID_A,
        n2,
        buildCctpMessage({ srcDomain: SRC_DOMAIN, nonce: n2, sender: Buffer.from(EVM_CONTRACT), payload: stalePayload })
      )
    );
  });

  it('rejects duplicate cctp_data_nonce (same nonce twice)', async () => {
    const nonce = Buffer.alloc(32, 0x30);
    const payload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [],
    });
    const message = buildCctpMessage({ srcDomain: SRC_DOMAIN, nonce, sender: Buffer.from(EVM_CONTRACT), payload });

    expectSuccess(await callRecvCctp(PAYABLE_ID_A, nonce, message));

    // Same nonce for a different payable → cctp_data_nonce init fails
    const payload2 = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_B,
      nonce: 1n,
      ataa: [],
    });
    const message2 = buildCctpMessage({
      srcDomain: SRC_DOMAIN,
      nonce,
      sender: Buffer.from(EVM_CONTRACT),
      payload: payload2,
    });
    expectFailure(await callRecvCctp(PAYABLE_ID_B, nonce, message2));
  });

  it('rejects invalid cctp_program key', async () => {
    const nonce = Buffer.alloc(32, 0x40);
    const payload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [],
    });
    const message = buildCctpMessage({ srcDomain: SRC_DOMAIN, nonce, sender: Buffer.from(EVM_CONTRACT), payload });

    const fakeCctp = Keypair.generate().publicKey;
    const prog = require('./helpers/svm').createProgram(relayer);
    const ix = await prog.methods
      .recvPayableUpdateViaCctp(SRC_DOMAIN, Array.from(nonce), message, Buffer.alloc(0))
      .accounts({
        relayer: relayer.publicKey,
        cctpProgram: fakeCctp,
        chainRegistry: chainRegAddr,
        foreignPayable: foreignPayablePDA(PAYABLE_ID_A),
        cctpDataNonce: cctpDataNoncePDA(SRC_DOMAIN, nonce),
        stats,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    expectFailure(sendIx(svm, ix, relayer));
  });

  it('rejects wrong src_domain in message', async () => {
    const nonce = Buffer.alloc(32, 0x50);
    const payload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [],
    });
    // message has wrong src_domain (999 != SRC_DOMAIN 0)
    const message = buildCctpMessage({ srcDomain: 999, nonce, sender: Buffer.from(EVM_CONTRACT), payload });

    expectFailure(await callRecvCctp(PAYABLE_ID_A, nonce, message));
  });

  it('rejects wrong sender (not registered_contract)', async () => {
    const nonce = Buffer.alloc(32, 0x60);
    const payload = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId: PAYABLE_ID_A,
      nonce: 1n,
      ataa: [],
    });
    const wrongSender = Buffer.alloc(32, 0xff);
    const message = buildCctpMessage({ srcDomain: SRC_DOMAIN, nonce, sender: wrongSender, payload });

    expectFailure(await callRecvCctp(PAYABLE_ID_A, nonce, message));
  });
});
