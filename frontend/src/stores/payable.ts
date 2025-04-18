import {
  type Chain,
  chainNamesToChains,
  Payable,
  TokenAndAmount,
} from '@/schemas';
import {
  useAuthStore,
  useCacheStore,
  useEvmStore,
  useNotificationsStore,
  useServerStore,
  useSolanaStore,
} from '@/stores';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';

export const usePayableStore = defineStore('payable', () => {
  const auth = useAuthStore();
  const cache = useCacheStore();
  const evm = useEvmStore();
  const notifications = useNotificationsStore();
  const server = useServerStore();
  const solana = useSolanaStore();
  const toast = useToast();

  const cacheKey = (
    chainName: string,
    id: string,
    entity: string,
    count: number
  ) => `${chainName}::payable::${id}::${entity}::${count}`;

  const getChainStore: any = () =>
    ({
      megaethtestnet: evm,
      solanadevnet: solana,
    })[auth.currentUser!.chain.name];

  const getEntityId = async (
    payableId: string,
    chain: Chain,
    entity: string,
    count: number
  ): Promise<string | null> => {
    if (!auth.currentUser) return null;

    const key = cacheKey(payableId, chain.name, entity, count);
    let id = await cache.retrieve(key);
    if (id) return id;

    entity = entity[0].toUpperCase() + entity.slice(1);
    id = await getChainStore()[`getPayable${entity}Id`](payableId, count);

    entity = entity[0].toLowerCase() + entity.slice(1);
    if (id) await cache.save(key, id);

    return id;
  };

  const create = async (
    description: string,
    tokensAndAmounts: TokenAndAmount[]
  ): Promise<string | null> => {
    if (!auth.currentUser) return null;

    try {
      const result = await getChainStore()['createPayable'](tokensAndAmounts);
      if (!result) return null;

      console.log(`Created Payable Transaction Details: ${result.explorerUrl}`);
      await server.createPayable(result.created, description);
      await auth.refreshUser();
      toast.add({
        severity: 'success',
        summary: 'Successful Payable Creation',
        detail: 'You have successfully created a Payable.',
        life: 12000,
      });
      notifications.ensure();
      return result.created;
    } catch (e) {
      console.error(e);
      if (!`${e}`.includes('rejected')) toastError(`${e}`);
      return null;
    }
  };

  const get = async (
    id: string,
    ignoreErrors?: boolean
  ): Promise<Payable | null> => {
    const dbData = await server.getPayable(id, ignoreErrors);
    if (!dbData) return null;

    try {
      const chain = chainNamesToChains[dbData.chainName];
      if (!chain) throw `Unhandled Payable Chain: ${dbData.chainName}`;

      let raw: any;
      if (chain.isEvm) raw = await evm.fetchPayable(id, ignoreErrors);
      else if (chain.isSolana)
        raw = await solana.tryFetchEntity('payable', id, ignoreErrors);
      else throw 'Unhandled Chain Type';
      if (raw) return new Payable(id, chain, dbData.description, raw);            
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
    }
    return null;
  };

  const getIdsForCurrentUser = async (
    page: number,
    count: number
  ): Promise<string[] | null> => {
    if (!auth.currentUser) return null;
    const { payablesCount: totalCount } = auth.currentUser;
    if (totalCount === 0) return [];

    let start = (page + 1) * count;
    const target = page * count + 1;
    if (start > totalCount) start = target + (totalCount % count) - 1;
    try {
      const ids = [];
      for (let i = start; i >= target; i--) {
        const id = await auth.getPayableId(i);
        if (id) ids.push(id);
        else return null;
      }
      return ids;
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
      return null;
    }
  };

  const getPaymentId = async (
    payableId: string,
    chain: Chain,
    count: number
  ): Promise<string | null> => getEntityId(payableId, chain, 'payment', count);

  const getWithdrawalId = async (
    payableId: string,
    chain: Chain,
    count: number
  ): Promise<string | null> =>
    getEntityId(payableId, chain, 'withdrawal', count);

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  return {
    create,
    get,
    getIdsForCurrentUser,
    getPaymentId,
    getWithdrawalId,
  };
});
