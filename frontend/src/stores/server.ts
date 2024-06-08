import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from './auth';
import { SOLANA_CLUSTER, WH_CHAIN_ID_SOLANA, useChainStore } from './chain';
import { useWalletStore } from './wallet';

export const useServerStore = defineStore('server', () => {
  const auth = useAuthStore();
  const chain = useChainStore();
  const toast = useToast();
  const wallet = useWalletStore();

  const call = async (path: string): Promise<any> => {
    return new Promise(async (resolve, _) => {
      const headers = { Accept: 'application/json' };
      if (chain.currentId && wallet.address && auth.signature) {
        headers['chain-id'] = chain.currentId;
        headers['wallet-address'] = wallet.address;
        headers['signature'] = auth.signature;
        if (chain.currentId == WH_CHAIN_ID_SOLANA) {
          headers['solana-cluster'] = SOLANA_CLUSTER;
        }
      }

      try {
        const result = await (
          await fetch(`${import.meta.env.VITE_SERVER_URL}${path}`, { headers })
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
    payable: string,
    email: string,
  ): Promise<boolean> => {
    return await call(`/payable/${payable}/${email}`);
  };

  const paid = async (payment: string, email: string): Promise<boolean> => {
    return await call(`/payment/${payment}/${email}`);
  };

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const withdrew = async (withdrawal: string): Promise<boolean> => {
    return await call(`/withdrawal/${withdrawal}`);
  };

  return { createdPayable, paid, withdrew };
});
