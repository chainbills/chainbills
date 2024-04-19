import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';

export const useServerStore = defineStore('server', () => {
  const toast = useToast();

  const call = async (path: string): Promise<any> => {
    return new Promise(async (resolve, _) => {
      try {
        const result = await (
          await fetch(`${import.meta.env.VITE_SERVER_URL}${path}`)
        ).json();

        if ('success' in result) {
          if (result['success']) {
            resolve(result['data'] ?? true);
          } else {
            toastError(result['message']);
            resolve(false);
          }
        } else {
          toastError("Couldn't understand server response.");
          console.log(result);
          resolve(false);
        }
      } catch (error: any) {
        console.error(error);
        const detail =
          error['message'] == 'Failed to fetch' ? 'Network Error' : `${error}`;
        toastError(detail);
        resolve(false);
      }
    });
  };

  const createdPayable = async (
    payable: Uint8Array,
    email: string,
  ): Promise<boolean> => {
    const decoded = new TextDecoder().decode(payable);
    return await call(`/payable/${decoded}/${email}`);
  };

  const paid = async (payment: Uint8Array, email: string): Promise<boolean> => {
    const decoded = new TextDecoder().decode(payment);
    return await call(`/payment/${decoded}/${email}`);
  };

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const withdrew = async (withdrawal: Uint8Array): Promise<boolean> => {
    const decoded = new TextDecoder().decode(withdrawal);
    return await call(`/withdrawal/${decoded}`);
  };

  return { createdPayable, paid, withdrew };
});
