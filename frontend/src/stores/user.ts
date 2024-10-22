import { User } from '@/schemas/user';
import {
  useCacheStore,
  useChainStore,
  useCosmwasmStore,
  useEvmStore,
  useSolanaStore,
  useWalletStore,
} from '@/stores';
import { defineStore } from 'pinia';
import { onMounted, ref, watch } from 'vue';

export const useUserStore = defineStore('user', () => {
  const cache = useCacheStore();
  const chain = useChainStore();
  const cosmwasm = useCosmwasmStore();
  const current = ref<User | null>(null);
  const evm = useEvmStore();
  const solana = useSolanaStore();
  const wallet = useWalletStore();

  const cacheKey = (entity: string, count: number) =>
    `${chain.current}::user::${wallet.address}::${entity}::${count}`;

  const getChainStore: any = () =>
    ({
      'Burnt Xion': cosmwasm,
      'Ethereum Sepolia': evm,
      Solana: solana,
    })[chain.current!];

  const getEntityId = async (
    entity: string,
    count: number
  ): Promise<string | null> => {
    if (!wallet.address || !chain.current) return null;

    let id = await cache.retrieve(cacheKey(entity, count));
    if (id) return id;

    entity = entity[0].toUpperCase() + entity.slice(1);
    id = await getChainStore()[`getUser${entity}Id`](count);

    entity = entity[0].toLowerCase() + entity.slice(1);
    if (id) await cache.save(cacheKey(entity, count), id);

    return id;
  };

  const getPayableId = async (count: number): Promise<string | null> =>
    getEntityId('payable', count);

  const getPaymentId = async (count: number): Promise<string | null> =>
    getEntityId('payment', count);

  const getWithdrawalId = async (count: number): Promise<string | null> =>
    getEntityId('withdrawal', count);

  const refresh = async () => {
    if (!wallet.address || !chain.current) return (current.value = null);
    current.value = await getChainStore()['getCurrentUser']();
  };

  onMounted(() => {
    watch(
      () => wallet.address,
      async (addr) => {
        if (!addr || !chain.current) return (current.value = null);
        current.value = await getChainStore()['getCurrentUser']();
      }
    );
  });

  return { current, getPayableId, getPaymentId, getWithdrawalId, refresh };
});
