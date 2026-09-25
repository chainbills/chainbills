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

  const call = async (method: 'GET' | 'PUT', path: string, body?: unknown, ignoreErrors?: boolean): Promise<any> => {
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
   * as the payable's host. Returns true on success.
   */
  const saveDescription = async (payableId: string, description: string): Promise<boolean> =>
    call('PUT', `/payables/${payableId}/description`, { description });

  /**
   * Fetches a payable's indexed record from the backend. Returns the full
   * payable object (including description), or null/false when not found.
   * Errors are suppressed when ignoreErrors is true.
   */
  const getPayable = async (payableId: string, ignoreErrors?: boolean): Promise<{ description: string } | null> =>
    call('GET', `/payables/${payableId}`, undefined, ignoreErrors);

  return {
    getPayable,
    saveDescription,
  };
});
