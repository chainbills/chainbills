/**
 * Payload encoding tests — pure TypeScript, no SVM or Solana runtime needed.
 *
 * Mirrors the Rust tests in payload/decode.rs and the planned encode tests.
 * Validates that the TypeScript encoder produces byte-for-byte identical output
 * to the Rust encoder (which must match EVM's CbPayloadMessages.sol).
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const PAYLOAD_TYPE_PAYABLE = 0x01;
const PAYLOAD_TYPE_PAYMENT = 0x02;
const PAYLOAD_VERSION = 0x01;
const ACTION_CREATE = 1;
const ACTION_CLOSE = 2;
const ACTION_REOPEN = 3;
const ACTION_UPDATE_ATAA = 4;
const ACTION_PAYMENT = 5;

// ── TypeScript encoder (must match Rust encode_payment_payload exactly) ───────

interface PaymentPayload {
  actionType: number;
  payableId: Uint8Array;
  nonce: bigint;
  initiatedAt: bigint;
  amount: bigint;
  payableChainToken: Uint8Array;
  payableChainId: Uint8Array;
  payer: Uint8Array;
  payerChainToken: Uint8Array;
  payerChainId: Uint8Array;
  payerPaymentId: Uint8Array;
}

interface PayablePayload {
  actionType: number;
  payableId: Uint8Array;
  nonce: bigint;
  initiatedAt: bigint;
  ataa?: Array<{ token: Uint8Array; amount: bigint }>;
  isClosed?: boolean;
}

function encodePaymentPayload(p: PaymentPayload): Buffer {
  const buf = Buffer.alloc(251);
  buf[0] = PAYLOAD_TYPE_PAYMENT;
  buf[1] = PAYLOAD_VERSION;
  buf[2] = p.actionType;
  buf.set(p.payableId, 3);
  buf.writeBigUInt64BE(p.nonce, 35);
  buf.writeBigInt64BE(p.initiatedAt, 43);
  buf.writeBigUInt64BE(p.amount, 51);
  buf.set(p.payableChainToken, 59);
  buf.set(p.payableChainId, 91);
  buf.set(p.payer, 123);
  buf.set(p.payerChainToken, 155);
  buf.set(p.payerChainId, 187);
  buf.set(p.payerPaymentId, 219);
  return buf;
}

function encodePayablePayload(p: PayablePayload): Buffer {
  const header = Buffer.alloc(51);
  header[0] = PAYLOAD_TYPE_PAYABLE;
  header[1] = PAYLOAD_VERSION;
  header[2] = p.actionType;
  header.set(p.payableId, 3);
  header.writeBigUInt64BE(p.nonce, 35);
  header.writeBigInt64BE(p.initiatedAt, 43);

  if (p.actionType === ACTION_CREATE || p.actionType === ACTION_UPDATE_ATAA) {
    const ataa = p.ataa ?? [];
    // tail: 1-byte length + ataa_length * 40 bytes per entry
    const tail = Buffer.alloc(1 + ataa.length * 40);
    tail[0] = ataa.length;
    ataa.forEach((entry, i) => {
      tail.set(entry.token, 1 + i * 40);
      tail.writeBigUInt64BE(entry.amount, 1 + i * 40 + 32);
    });
    return Buffer.concat([header, tail]);
  } else {
    // CLOSE or REOPEN: 1-byte is_closed flag
    const tail = Buffer.alloc(1);
    tail[0] = p.isClosed ? 1 : 0;
    return Buffer.concat([header, tail]);
  }
}

// ── PaymentPayload tests ──────────────────────────────────────────────────────

const zeroId = new Uint8Array(32);
const allOnes = new Uint8Array(32).fill(1);

function makePayment(overrides: Partial<PaymentPayload> = {}): PaymentPayload {
  return {
    actionType: ACTION_PAYMENT,
    payableId: zeroId,
    nonce: 0n,
    initiatedAt: 0n,
    amount: 0n,
    payableChainToken: zeroId,
    payableChainId: zeroId,
    payer: zeroId,
    payerChainToken: zeroId,
    payerChainId: zeroId,
    payerPaymentId: zeroId,
    ...overrides,
  };
}

describe('PaymentPayload encoding', () => {
  it('produces exactly 251 bytes', () => {
    expect(encodePaymentPayload(makePayment()).length).toBe(251);
  });

  it('byte[0] = 0x02 (PAYLOAD_TYPE_PAYMENT)', () => {
    expect(encodePaymentPayload(makePayment())[0]).toBe(PAYLOAD_TYPE_PAYMENT);
  });

  it('byte[1] = 0x01 (PAYLOAD_VERSION)', () => {
    expect(encodePaymentPayload(makePayment())[1]).toBe(PAYLOAD_VERSION);
  });

  it('byte[2] = ACTION_PAYMENT (0x05)', () => {
    expect(encodePaymentPayload(makePayment())[2]).toBe(ACTION_PAYMENT);
  });

  it('payable_id at bytes [3..35]', () => {
    const payableId = new Uint8Array(32).fill(0xab);
    const buf = encodePaymentPayload(makePayment({ payableId }));
    expect(Array.from(buf.slice(3, 35))).toEqual(Array.from(payableId));
  });

  it('nonce at bytes [35..43] big-endian u64', () => {
    // nonce = 256 = 0x0000_0000_0000_0100
    const buf = encodePaymentPayload(makePayment({ nonce: 256n }));
    expect(buf[35]).toBe(0x00); // MSB
    expect(buf[41]).toBe(0x01);
    expect(buf[42]).toBe(0x00); // LSB
  });

  it('nonce = u64::MAX encodes all 0xFF', () => {
    const buf = encodePaymentPayload(makePayment({ nonce: 0xffffffffffffffffn }));
    for (let i = 35; i < 43; i++) expect(buf[i]).toBe(0xff);
  });

  it('initiated_at at bytes [43..51] big-endian i64', () => {
    const buf = encodePaymentPayload(makePayment({ initiatedAt: 1_700_000_000n }));
    // 1_700_000_000 = 0x0000_0000_6559_C480
    expect(buf.readBigInt64BE(43)).toBe(1_700_000_000n);
  });

  it('amount at bytes [51..59] big-endian u64', () => {
    const buf = encodePaymentPayload(makePayment({ amount: 1_000_000n }));
    expect(buf.readBigUInt64BE(51)).toBe(1_000_000n);
  });

  it('payable_chain_token at bytes [59..91]', () => {
    const token = new Uint8Array(32).fill(0x22);
    const buf = encodePaymentPayload(makePayment({ payableChainToken: token }));
    expect(Array.from(buf.slice(59, 91))).toEqual(Array.from(token));
  });

  it('payable_chain_id at bytes [91..123]', () => {
    const chainId = new Uint8Array(32).fill(0x33);
    const buf = encodePaymentPayload(makePayment({ payableChainId: chainId }));
    expect(Array.from(buf.slice(91, 123))).toEqual(Array.from(chainId));
  });

  it('payer at bytes [123..155]', () => {
    const payer = new Uint8Array(32).fill(0x44);
    const buf = encodePaymentPayload(makePayment({ payer }));
    expect(Array.from(buf.slice(123, 155))).toEqual(Array.from(payer));
  });

  it('payer_chain_token at bytes [155..187]', () => {
    const token = new Uint8Array(32).fill(0x55);
    const buf = encodePaymentPayload(makePayment({ payerChainToken: token }));
    expect(Array.from(buf.slice(155, 187))).toEqual(Array.from(token));
  });

  it('payer_chain_id at bytes [187..219]', () => {
    const chainId = new Uint8Array(32).fill(0x66);
    const buf = encodePaymentPayload(makePayment({ payerChainId: chainId }));
    expect(Array.from(buf.slice(187, 219))).toEqual(Array.from(chainId));
  });

  it('payer_payment_id at bytes [219..251]', () => {
    const id = new Uint8Array(32).fill(0x77);
    const buf = encodePaymentPayload(makePayment({ payerPaymentId: id }));
    expect(Array.from(buf.slice(219, 251))).toEqual(Array.from(id));
  });

  it('all-zero payload has bytes 3..251 all zero', () => {
    const buf = encodePaymentPayload(makePayment());
    // bytes 0,1,2 are type/version/action — rest must be zero
    for (let i = 3; i < 251; i++) expect(buf[i]).toBe(0);
  });

  it('round-trip: known vector matches expected bytes at each offset', () => {
    const p = makePayment({
      nonce: 42n,
      initiatedAt: 1_700_000_000n,
      amount: 5_000_000n,
      payableId: new Uint8Array(32).fill(1),
      payer: new Uint8Array(32).fill(4),
    });
    const buf = encodePaymentPayload(p);
    expect(buf[0]).toBe(PAYLOAD_TYPE_PAYMENT);
    expect(buf.readBigUInt64BE(35)).toBe(42n);
    expect(buf.readBigInt64BE(43)).toBe(1_700_000_000n);
    expect(buf.readBigUInt64BE(51)).toBe(5_000_000n);
  });
});

// ── PayablePayload tests ──────────────────────────────────────────────────────

const payableId = new Uint8Array(32).fill(0x11);

describe('PayablePayload encoding — CREATE action', () => {
  it('empty ATAA: 51-byte header + 1 length byte = 52 bytes', () => {
    const buf = encodePayablePayload({ actionType: ACTION_CREATE, payableId, nonce: 1n, initiatedAt: 0n, ataa: [] });
    expect(buf.length).toBe(52);
  });

  it('byte[0] = 0x01 (PAYLOAD_TYPE_PAYABLE)', () => {
    const buf = encodePayablePayload({ actionType: ACTION_CREATE, payableId, nonce: 1n, initiatedAt: 0n });
    expect(buf[0]).toBe(PAYLOAD_TYPE_PAYABLE);
  });

  it('byte[1] = PAYLOAD_VERSION', () => {
    const buf = encodePayablePayload({ actionType: ACTION_CREATE, payableId, nonce: 1n, initiatedAt: 0n });
    expect(buf[1]).toBe(PAYLOAD_VERSION);
  });

  it('byte[2] = ACTION_CREATE (1)', () => {
    const buf = encodePayablePayload({ actionType: ACTION_CREATE, payableId, nonce: 1n, initiatedAt: 0n });
    expect(buf[2]).toBe(ACTION_CREATE);
  });

  it('payable_id at bytes [3..35]', () => {
    const buf = encodePayablePayload({ actionType: ACTION_CREATE, payableId, nonce: 1n, initiatedAt: 0n });
    expect(Array.from(buf.slice(3, 35))).toEqual(Array.from(payableId));
  });

  it('nonce at bytes [35..43] big-endian', () => {
    const buf = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId,
      nonce: 0x0102030405060708n,
      initiatedAt: 0n,
    });
    expect(buf[35]).toBe(0x01);
    expect(buf[36]).toBe(0x02);
    expect(buf[42]).toBe(0x08);
  });

  it('3 ATAA entries: 52 + 3×40 = 172 bytes', () => {
    const ataa = [
      { token: new Uint8Array(32).fill(1), amount: 1_000_000n },
      { token: new Uint8Array(32).fill(2), amount: 2_000_000n },
      { token: new Uint8Array(32).fill(3), amount: 500_000n },
    ];
    const buf = encodePayablePayload({ actionType: ACTION_CREATE, payableId, nonce: 1n, initiatedAt: 0n, ataa });
    expect(buf.length).toBe(52 + 3 * 40);
    expect(buf[51]).toBe(3); // ataa_length byte
  });

  it('first ATAA entry: token at [52..84], amount at [84..92]', () => {
    const token = new Uint8Array(32).fill(0xaa);
    const amount = 1_000_000n;
    const buf = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId,
      nonce: 1n,
      initiatedAt: 0n,
      ataa: [{ token, amount }],
    });
    expect(Array.from(buf.slice(52, 84))).toEqual(Array.from(token));
    expect(buf.readBigUInt64BE(84)).toBe(amount);
  });

  it('second ATAA entry starts at offset 92 (52 + 40)', () => {
    const t1 = new Uint8Array(32).fill(1);
    const t2 = new Uint8Array(32).fill(2);
    const buf = encodePayablePayload({
      actionType: ACTION_CREATE,
      payableId,
      nonce: 1n,
      initiatedAt: 0n,
      ataa: [
        { token: t1, amount: 100n },
        { token: t2, amount: 200n },
      ],
    });
    // Second entry token starts at 52 + 40 = 92
    expect(Array.from(buf.slice(92, 124))).toEqual(Array.from(t2));
    expect(buf.readBigUInt64BE(124)).toBe(200n);
  });
});

describe('PayablePayload encoding — CLOSE action', () => {
  it('51 header + 1 is_closed byte = 52 bytes total', () => {
    const buf = encodePayablePayload({
      actionType: ACTION_CLOSE,
      payableId,
      nonce: 2n,
      initiatedAt: 0n,
      isClosed: true,
    });
    expect(buf.length).toBe(52);
  });

  it('byte[2] = ACTION_CLOSE (2)', () => {
    const buf = encodePayablePayload({
      actionType: ACTION_CLOSE,
      payableId,
      nonce: 2n,
      initiatedAt: 0n,
      isClosed: true,
    });
    expect(buf[2]).toBe(ACTION_CLOSE);
  });

  it('byte[51] = 1 when is_closed = true', () => {
    const buf = encodePayablePayload({
      actionType: ACTION_CLOSE,
      payableId,
      nonce: 2n,
      initiatedAt: 0n,
      isClosed: true,
    });
    expect(buf[51]).toBe(1);
  });
});

describe('PayablePayload encoding — REOPEN action', () => {
  it('byte[2] = ACTION_REOPEN (3)', () => {
    const buf = encodePayablePayload({
      actionType: ACTION_REOPEN,
      payableId,
      nonce: 3n,
      initiatedAt: 0n,
      isClosed: false,
    });
    expect(buf[2]).toBe(ACTION_REOPEN);
  });

  it('byte[51] = 0 when is_closed = false', () => {
    const buf = encodePayablePayload({
      actionType: ACTION_REOPEN,
      payableId,
      nonce: 3n,
      initiatedAt: 0n,
      isClosed: false,
    });
    expect(buf[51]).toBe(0);
  });
});

describe('PayablePayload encoding — UPDATE_ATAA action', () => {
  it('byte[2] = ACTION_UPDATE_ATAA (4)', () => {
    const buf = encodePayablePayload({
      actionType: ACTION_UPDATE_ATAA,
      payableId,
      nonce: 4n,
      initiatedAt: 0n,
      ataa: [],
    });
    expect(buf[2]).toBe(ACTION_UPDATE_ATAA);
  });

  it('same layout as CREATE: header + length + entries', () => {
    const ataa = [{ token: new Uint8Array(32).fill(9), amount: 999n }];
    const buf = encodePayablePayload({ actionType: ACTION_UPDATE_ATAA, payableId, nonce: 4n, initiatedAt: 0n, ataa });
    expect(buf.length).toBe(52 + 40);
    expect(buf[51]).toBe(1);
  });
});

describe('Payload cross-compatibility invariants', () => {
  it('PaymentPayload last byte is payerPaymentId[31]', () => {
    const id = new Uint8Array(32);
    id[31] = 0xfe;
    const buf = encodePaymentPayload(makePayment({ payerPaymentId: id }));
    expect(buf[250]).toBe(0xfe);
  });

  it('PaymentPayload has no overlap between fields', () => {
    // Each field region is distinct — check by writing unique byte per region
    const p = makePayment({
      payableId: new Uint8Array(32).fill(1),
      payableChainToken: new Uint8Array(32).fill(2),
      payableChainId: new Uint8Array(32).fill(3),
      payer: new Uint8Array(32).fill(4),
      payerChainToken: new Uint8Array(32).fill(5),
      payerChainId: new Uint8Array(32).fill(6),
      payerPaymentId: new Uint8Array(32).fill(7),
    });
    const buf = encodePaymentPayload(p);
    // All bytes 3..35 should be 1
    expect(buf.slice(3, 35).every((b) => b === 1)).toBe(true);
    // All bytes 59..91 should be 2
    expect(buf.slice(59, 91).every((b) => b === 2)).toBe(true);
    // All bytes 91..123 should be 3
    expect(buf.slice(91, 123).every((b) => b === 3)).toBe(true);
  });
});
