/** Extracts a short, user-readable message from any thrown value. */
export const errorMsg = (e: unknown): string => {
  if (typeof e === 'string') return e.split('\n')[0].substring(0, 120);
  if (e && typeof e === 'object') {
    const err = e as any;
    if (String(err).toLowerCase().includes('failed to fetch')) return 'Network error';
    const raw = String(err.details ?? err.shortMessage ?? err.message ?? e);
    return raw.split('\n')[0].split('()')[0].substring(0, 120).trim();
  }
  return String(e).substring(0, 120);
};

/**
 * True when the thrown value looks like a transport-level RPC failure
 * (rate limit, HTTP 429/5xx, network drop, timeout). These are noisy and
 * outside the user's control, so callers use this to skip toasting them
 * while still logging to the console.
 */
export const isRpcError = (e: unknown): boolean => {
  const seen = new Set<unknown>();
  let cur: any = e;
  while (cur && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur);
    const name = String(cur.name ?? '');
    if (
      name === 'HttpRequestError' ||
      name === 'RpcRequestError' ||
      name === 'TimeoutError' ||
      name === 'WebSocketRequestError'
    ) {
      return true;
    }
    const short = String(cur.shortMessage ?? '');
    const details = String(cur.details ?? '');
    const message = String(cur.message ?? '');
    const status = cur.status;
    if (typeof status === 'number' && (status === 429 || status >= 500)) return true;
    const blob = `${short} ${details} ${message}`.toLowerCase();
    if (
      blob.includes('rpc request failed') ||
      blob.includes('rate limit') ||
      blob.includes('over rate') ||
      blob.includes('too many requests') ||
      blob.includes('failed to fetch') ||
      blob.includes('network error') ||
      blob.includes('fetch failed') ||
      blob.includes('econnreset') ||
      blob.includes('etimedout')
    ) {
      return true;
    }
    cur = cur.cause;
  }
  return false;
};
