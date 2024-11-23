import {
  getChainId,
  useAuthStore,
  useCosmwasmStore,
  type Chain,
} from '@/stores';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';

export const useServerStore = defineStore('server', () => {
  const auth = useAuthStore();
  const cosmwasm = useCosmwasmStore();
  const toast = useToast();

  const call = async (
    path: string,
    body?: any,
    ignoreErrors?: boolean
  ): Promise<any> => {
    return new Promise(async (resolve, _) => {
      // TODO: Change wh-network to Mainnet when needed
      const headers: any = { 'wh-network': 'Testnet' };
      if (auth.currentUser) {
        headers['chain-id'] = getChainId(auth.currentUser.chain);
        headers['wallet-address'] = auth.currentUser.walletAddress;
      }
      if (auth.signature) headers['signature'] = auth.signature;
      if (auth.currentUser?.chain == 'Burnt Xion' && cosmwasm.client) {
        headers['xion-grantee'] = cosmwasm.client.granteeAddress;
        const granteeData = await cosmwasm.client.getGranteeAccountData();
        if (granteeData) {
          const pubkey = Buffer.from(granteeData.pubkey).toString('base64');
          headers['xion-pubkey'] = pubkey;
        }
      }

      try {
        const result = await (
          await fetch(`${import.meta.env.VITE_SERVER_URL}${path}`, {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              ...headers,
            },
            ...(body
              ? {
                  method: 'POST',
                  body: JSON.stringify(body),
                }
              : { method: 'GET' }),
          })
        ).json();

        if ('success' in result) {
          if (result['success']) {
            resolve(result['data'] ?? true);
          } else {
            if (!ignoreErrors) toastError(result['message']);
            resolve(false);
          }
        } else {
          if (!ignoreErrors) {
            toastError("Couldn't understand server response.");
            console.log(result);
          }
          resolve(false);
        }
      } catch (error: any) {
        if (!ignoreErrors) {
          console.error(error);
          const detail =
            error['message'] == 'Failed to fetch'
              ? 'Network Error'
              : `${error}`;
          toastError(detail);
        }
        resolve(false);
      }
    });
  };

  const createPayable = async (
    payableId: string,
    description: string
  ): Promise<boolean> => {
    return await call('/payable', { payableId, description });
  };

  const getPayable = async (
    payableId: string,
    ignoreErrors?: boolean
  ): Promise<{ chain: Chain; description: string } | null> => {
    return await call(`/payable/${payableId}`, null, ignoreErrors);
  };

  const payablePaid = async (paymentId: string): Promise<boolean> => {
    return await call(`/payment/payable/${paymentId}`);
  };

  const saveNotificationToken = async (fcmToken: string): Promise<boolean> => {
    return await call('/notifications', { fcmToken });
  };

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const userPaid = async (paymentId: string): Promise<boolean> => {
    return await call(`/payment/user/${paymentId}`);
  };

  const volumes = async (): Promise<any> => {
    return await call('/volumes');
  };

  const withdrew = async (withdrawalId: string): Promise<boolean> => {
    return await call(`/withdrawal/${withdrawalId}`);
  };

  return {
    createPayable,
    getPayable,
    payablePaid,
    saveNotificationToken,
    userPaid,
    volumes,
    withdrew,
  };
});
