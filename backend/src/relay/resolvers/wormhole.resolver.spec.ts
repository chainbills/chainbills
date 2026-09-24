// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Wormhole resolver tests
//
// Covers: 404 returns null, successful fetch, non-200 returns null, network error.
// ──────────────────────────────────────────────────────────────────────────────

import { fetchVaa } from './wormhole.resolver';

const CHAIN_ID = 10002;
const DIAMOND = '0x1234567890abcdef1234567890abcdef12345678';
const SEQ = 42n;

function makeVaaBase64(): string {
  // A minimal 4-byte "VAA" (just for testing; not a real VAA)
  return Buffer.from([0x01, 0x02, 0x03, 0x04]).toString('base64');
}

describe('fetchVaa', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null on 404 (VAA not yet available)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 404, ok: false }));
    const result = await fetchVaa('testnet', CHAIN_ID, DIAMOND, SEQ);
    expect(result).toBeNull();
  });

  it('returns null on non-200 non-404 status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 503, ok: false }));
    const result = await fetchVaa('mainnet', CHAIN_ID, DIAMOND, SEQ);
    expect(result).toBeNull();
  });

  it('returns the VAA bytes on success', async () => {
    const b64 = makeVaaBase64();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { vaa: b64 } }),
      })
    );
    const result = await fetchVaa('testnet', CHAIN_ID, DIAMOND, SEQ);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result!.length).toBe(4);
    expect(result![0]).toBe(0x01);
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const result = await fetchVaa('local', CHAIN_ID, DIAMOND, SEQ);
    expect(result).toBeNull();
  });

  it('uses testnet API for testnet and local networks', async () => {
    let capturedUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve({ status: 404, ok: false });
      })
    );
    await fetchVaa('testnet', CHAIN_ID, DIAMOND, SEQ);
    expect(capturedUrl).toContain('testnet.wormholescan.io');
  });

  it('uses mainnet API for mainnet network', async () => {
    let capturedUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve({ status: 404, ok: false });
      })
    );
    await fetchVaa('mainnet', CHAIN_ID, DIAMOND, SEQ);
    expect(capturedUrl).not.toContain('testnet');
    expect(capturedUrl).toContain('wormholescan.io');
  });

  it('pads the diamond address to 32 bytes in the URL', async () => {
    let capturedUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve({ status: 404, ok: false });
      })
    );
    await fetchVaa('testnet', CHAIN_ID, DIAMOND, SEQ);
    // '1234567890abcdef1234567890abcdef12345678' = 40 chars; padded to 64.
    expect(capturedUrl).toContain('00000000000000000000000012345678');
  });
});
