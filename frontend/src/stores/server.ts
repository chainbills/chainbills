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

  const call = async (path: string, body: any): Promise<any> => {
    return new Promise(async (resolve, _) => {
      if (chain.currentId && wallet.address && auth.signature) {
        body.chainId = chain.currentId;
        body.walletAddress = wallet.address;
        body.signature = auth.signature;
        if (chain.currentId == WH_CHAIN_ID_SOLANA) {
          body.solanaCluster = SOLANA_CLUSTER;
        }
      }

      try {
        const result = await (
          await fetch(`${import.meta.env.VITE_SERVER_URL}${path}`, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          })
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
    payableId: string,
    email: string,
  ): Promise<boolean> => {
    return await call('/payable', { payableId, email });
  };

  const paid = async (paymentId: string, email: string): Promise<boolean> => {
    return await call('/payment', { paymentId, email });
  };

  const relay = async (
    txHash: string,
    functionName: string,
  ): Promise<boolean> => {
    return await call('/relay', { txHash, functionName });
  };

  const saveNotificationToken = async (fcmToken: string): Promise<boolean> => {
    return await call('/notifications', { fcmToken });
  };

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const withdrew = async (withdrawalId: string): Promise<boolean> => {
    return await call('/withdrawal', { withdrawalId });
  };

  return { createdPayable, paid, relay, saveNotificationToken, withdrew };
});
