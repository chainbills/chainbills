import { useAuthStore } from '@/stores';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';

export const useServerStore = defineStore('server', () => {
  const auth = useAuthStore();
  const toast = useToast();

  const serverUrl = () => import.meta.env.VITE_SERVER_URL || 'https://api.chainbills.xyz';

  const toastError = (detail: string) => toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const handleResponse = async (res: Response, ignoreErrors?: boolean): Promise<any> => {
    if (res.status === 204) return true;
    if (res.ok) {
      try {
        return await res.json();
      } catch {
        return true;
      }
    }
    if (!ignoreErrors) {
      try {
        const err = await res.json();
        const msg = Array.isArray(err.message) ? err.message.join('; ') : err.message || `Error ${res.status}`;
        toastError(msg);
      } catch {
        toastError(`Error ${res.status}`);
      }
    }
    return false;
  };

  const buildHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (auth.accessToken) headers['Authorization'] = `Bearer ${auth.accessToken}`;
    return headers;
  };

  const call = async (
    method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    ignoreErrors?: boolean
  ): Promise<any> => {
    try {
      const res = await fetch(`${serverUrl()}${path}`, {
        method,
        headers: buildHeaders(),
        credentials: 'include',
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      if (res.status === 401) {
        const refreshed = await auth.refreshToken();
        if (refreshed) {
          const retryRes = await fetch(`${serverUrl()}${path}`, {
            method,
            headers: buildHeaders(),
            credentials: 'include',
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          });
          return handleResponse(retryRes, ignoreErrors);
        }
      }

      return handleResponse(res, ignoreErrors);
    } catch (error: any) {
      if (!ignoreErrors) {
        console.error(error);
        const detail = error?.message === 'Failed to fetch' ? 'Network Error' : `${error}`;
        toastError(detail);
      }
      return false;
    }
  };

  /**
   * Saves or updates a payable's description. The caller must be authenticated
   * as the payable's host. Passes `chain` when known so the backend's on-chain
   * host check (used when the payable is not yet indexed) narrows to that one
   * chain instead of iterating every enabled EVM chain. Returns true on success.
   */
  const saveDescription = async (payableId: string, description: string, chain?: string): Promise<boolean> => {
    const query = chain ? `?chain=${encodeURIComponent(chain)}` : '';
    return call('PUT', `/payables/${payableId}/description${query}`, { description });
  };

  /**
   * Fetches a payable's indexed record from the backend. Returns the full
   * payable object (including description), or null/false when not found.
   * Errors are suppressed when ignoreErrors is true.
   */
  const getPayable = async (payableId: string, ignoreErrors?: boolean): Promise<{ description: string } | null> =>
    call('GET', `/payables/${payableId}`, undefined, ignoreErrors);

  /**
   * Fire-and-forget hint to the relay processor: "this tx just confirmed on
   * chain X and might contain CCTP-emission events". The backend re-fetches
   * the receipt and topic-verifies every log before recording anything, so a
   * bad hint is harmless. Never awaited by callers, never toasts on failure.
   *
   * The scope is exactly the chains that can emit `SentPayableUpdateViaCctp` or
   * `SentForeignPaymentViaCctp` — Circle CCTP chains (Arc + Base networks).
   * Callers on non-CCTP chains skip the call.
   */
  const nudgeRelay = (chainSlug: string, txHash: string): void => {
    void call('POST', '/relay/nudge', { chainSlug, txHash }, true);
  };

  /**
   * Fetches relay status for a cross-chain UserPayment from the backend.
   * Returns null if the backend has not indexed the payment yet (404) or on
   * network error. Callers should treat null as "not yet known" and retry.
   * For same-chain payments the backend returns relayStatus: null.
   *
   * Also returns the source-chain (`userPaymentTxHash`) and destination-chain
   * (`payablePaymentTxHash`) transaction hashes, when the indexer has recorded
   * them. Either can be null when not yet known (e.g. the source hash comes
   * from a frontend nudge and only exists for cross-chain relays; the
   * destination hash is set by the relay processor at submit time).
   */
  const getPaymentRelayStatus = async (
    userPaymentId: string
  ): Promise<{
    relayStatus: {
      status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
      attempts: number;
      lastError: string | null;
    } | null;
    payablePaymentId: string | null;
    userPaymentTxHash: string | null;
    payablePaymentTxHash: string | null;
  } | null> => {
    const data = await call('GET', `/payments/user/${userPaymentId}`, undefined, true);
    if (!data) return null;
    return {
      relayStatus: data.relayStatus ?? null,
      payablePaymentId: data.payablePayment?.id ?? null,
      userPaymentTxHash: data.txHash ?? null,
      payablePaymentTxHash: data.payablePayment?.txHash ?? null,
    };
  };

  /**
   * Fetches a PayablePayment's own tx hash (destination-chain settlement tx)
   * plus, when it exists, the paired UserPayment's tx hash (source-chain
   * origin tx). Both may be null when the backend hasn't hashed the
   * corresponding entity yet — receipt UI hides the row.
   */
  const getPayablePaymentTxHashes = async (
    payablePaymentId: string
  ): Promise<{
    payablePaymentTxHash: string | null;
    userPaymentTxHash: string | null;
  } | null> => {
    const data = await call('GET', `/payments/payable/${payablePaymentId}`, undefined, true);
    if (!data) return null;
    return {
      payablePaymentTxHash: data.txHash ?? null,
      userPaymentTxHash: data.userPayment?.txHash ?? null,
    };
  };

  return {
    call,
    getPayable,
    getPaymentRelayStatus,
    getPayablePaymentTxHashes,
    nudgeRelay,
    saveDescription,
  };
});
