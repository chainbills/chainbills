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
