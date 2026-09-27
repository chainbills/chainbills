// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — CCTP resolver tests
//
// Covers: pending -> null, complete with correct dest domain, wrong dest domain,
// non-200 response, network error, mainnet vs sandbox URL selection. Fixtures
// mirror Iris v2's actual shape — `destinationDomain` is nested under
// `decodedMessage` as a string, not top-level as a number.
// ──────────────────────────────────────────────────────────────────────────────

import { fetchCctpAttestation } from './cctp.resolver';

const SOURCE_DOMAIN = 0; // Sepolia
const DEST_DOMAIN = 26; // Arc
const TX_HASH = '0xdeadbeef';

/** Builds one entry of `body.messages` in the Iris v2 shape. */
function irisMessage(opts: {
  status: string;
  destinationDomain: number | string;
  message?: string;
  attestation?: string;
}) {
  return {
    status: opts.status,
    message: opts.message,
    attestation: opts.attestation,
    decodedMessage: { destinationDomain: String(opts.destinationDomain) },
  };
}

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
          messages: [irisMessage({ status: 'pending', destinationDomain: DEST_DOMAIN })],
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
            irisMessage({
              status: 'complete',
              destinationDomain: 999,
              message: '0xmessage',
              attestation: '0xattestation',
            }),
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
            irisMessage({ status: 'complete', destinationDomain: 999, message: '0xwrong', attestation: '0xwrong' }),
            irisMessage({
              status: 'complete',
              destinationDomain: DEST_DOMAIN,
              message: '0xmessage',
              attestation: '0xattestation',
            }),
          ],
        }),
      })
    );
    const result = await fetchCctpAttestation('testnet', SOURCE_DOMAIN, TX_HASH, DEST_DOMAIN);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('0xmessage');
    expect(result!.attestation).toBe('0xattestation');
  });

  it('tolerates a numeric destinationDomain (defensive against a future Iris shape change)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          messages: [
            {
              status: 'complete',
              message: '0xmessage',
              attestation: '0xattestation',
              // Numeric variant, not the string form Iris currently returns.
              decodedMessage: { destinationDomain: DEST_DOMAIN },
            },
          ],
        }),
      })
    );
    const result = await fetchCctpAttestation('testnet', SOURCE_DOMAIN, TX_HASH, DEST_DOMAIN);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('0xmessage');
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
