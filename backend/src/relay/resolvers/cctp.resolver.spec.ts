// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — CCTP resolver tests
//
// Covers: pending -> null, complete with correct dest domain, wrong dest domain,
// non-200 response, network error, mainnet vs sandbox URL selection.
// ──────────────────────────────────────────────────────────────────────────────

import { fetchCctpAttestation } from './cctp.resolver';

const SOURCE_DOMAIN = 0; // Sepolia
const DEST_DOMAIN = 26; // Arc
const TX_HASH = '0xdeadbeef';

describe('fetchCctpAttestation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when no messages are complete', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          messages: [{ status: 'pending', destinationDomain: DEST_DOMAIN }],
        }),
      })
    );
    const result = await fetchCctpAttestation('testnet', SOURCE_DOMAIN, TX_HASH, DEST_DOMAIN);
    expect(result).toBeNull();
  });

  it('returns null when complete but for a different destination domain', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          messages: [
            {
              status: 'complete',
              destinationDomain: 999,
              message: '0xmessage',
              attestation: '0xattestation',
            },
          ],
        }),
      })
    );
    const result = await fetchCctpAttestation('testnet', SOURCE_DOMAIN, TX_HASH, DEST_DOMAIN);
    expect(result).toBeNull();
  });

  it('returns message+attestation when a complete message matches the dest domain', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          messages: [
            { status: 'complete', destinationDomain: 999, message: '0xwrong', attestation: '0xwrong' },
            { status: 'complete', destinationDomain: DEST_DOMAIN, message: '0xmessage', attestation: '0xattestation' },
          ],
        }),
      })
    );
    const result = await fetchCctpAttestation('testnet', SOURCE_DOMAIN, TX_HASH, DEST_DOMAIN);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('0xmessage');
    expect(result!.attestation).toBe('0xattestation');
  });

  it('returns null on non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const result = await fetchCctpAttestation('mainnet', SOURCE_DOMAIN, TX_HASH, DEST_DOMAIN);
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const result = await fetchCctpAttestation('local', SOURCE_DOMAIN, TX_HASH, DEST_DOMAIN);
    expect(result).toBeNull();
  });

  it('uses sandbox URL for testnet and local networks', async () => {
    let capturedUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve({ ok: false, status: 503 });
      })
    );
    await fetchCctpAttestation('testnet', SOURCE_DOMAIN, TX_HASH, DEST_DOMAIN);
    expect(capturedUrl).toContain('iris-api-sandbox.circle.com');
  });

  it('uses production URL for mainnet network', async () => {
    let capturedUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve({ ok: false, status: 503 });
      })
    );
    await fetchCctpAttestation('mainnet', SOURCE_DOMAIN, TX_HASH, DEST_DOMAIN);
    expect(capturedUrl).toContain('iris-api.circle.com');
    expect(capturedUrl).not.toContain('sandbox');
  });
});
