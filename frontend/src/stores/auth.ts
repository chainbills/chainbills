import {
  type Chain,
  megaethtestnet,
  solanadevnet,
  type Token,
  User,
} from '@/schemas';
import { useCacheStore, useEvmStore, useSolanaStore } from '@/stores';
import { useAccount, useDisconnect } from '@wagmi/vue';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import {
  useAnchorWallet,
  useWallet as useSolanaWallet,
} from 'solana-wallets-vue';
import { onMounted, ref, watch } from 'vue';
import * as encoding from './encoding';

export const AUTH_MESSAGE = 'Authentication';

export const denormalizeBytes = (bytes: Uint8Array, chain: Chain): string => {
  bytes = Uint8Array.from(bytes);
  if (chain.isSolana) return encoding.b58.encode(bytes);
  if (chain.isEvm) {
    return '0x' + encoding.hex.encode(bytes, false).replace(/^0+/, '');
  } else throw `Unknown chain: ${chain}`;
};

export const useAuthStore = defineStore('auth', () => {
  const anchorWallet = useAnchorWallet();
  const cache = useCacheStore();
  const currentUser = ref<User | null>(null);
  const evm = useEvmStore();
  const isLoading = ref(true);
  const loadingMessage = ref('');
  const signature = ref<string | null>(null);
  const solana = useSolanaStore();
  const solanaWallet = useSolanaWallet();
  const toast = useToast();
  const { disconnect: evmDisconnect } = useDisconnect();
  const evmAccount = useAccount();

  const getChainStore: any = (chain?: Chain) =>
    ({
      megaethtestnet: evm,
      solanadevnet: solana,
    })[(chain ?? currentUser.value!.chain).name];

  /**
   * Fetches and Returns the UI-formatted balance of a token based on the
   * current chain.
   * @param token The token to fetch its balance
   * @returns The UI formatted balance of the token
   */
  const balance = async (token: Token): Promise<number | null> => {
    if (!currentUser.value) return null;
    return await getChainStore()['balance'](token);
  };

  const cacheKey = (entity: string, count: number) => {
    if (!currentUser.value) return null;
    const { chain, walletAddress } = currentUser.value;
    return `${chain.name}::user::${walletAddress}::${entity}::${count}`;
  };

  const disconnect = async (chain?: Chain): Promise<void> => {
    if (chain || currentUser.value) {
      return await {
        megaethtestnet: evmDisconnect,
        solanadevnet: solanaWallet.disconnect,
      }[(chain ?? currentUser.value!.chain).name]();
    }
  };

  const getEntityId = async (
    entity: string,
    count: number
  ): Promise<string | null> => {
    if (!currentUser.value) return null;

    let id = await cache.retrieve(cacheKey(entity, count)!);
    if (id) return id;

    entity = entity[0].toUpperCase() + entity.slice(1);
    id = await getChainStore()[`getUser${entity}Id`](count);

    entity = entity[0].toLowerCase() + entity.slice(1);
    if (id) await cache.save(cacheKey(entity, count)!, id);

    return id;
  };

  const getPayableId = async (count: number): Promise<string | null> =>
    getEntityId('payable', count);

  const getPaymentId = async (count: number): Promise<string | null> =>
    getEntityId('payment', count);

  const getWithdrawalId = async (count: number): Promise<string | null> =>
    getEntityId('withdrawal', count);

  const storageKey = (user: User) =>
    `chainbills::chainId=>${user.chain.name}` +
    `::signature::v2=>${user.walletAddress}`;

  const getSavedSig = (user: User): string | null =>
    localStorage.getItem(storageKey(user));

  const ensureSigned = async (user: User): Promise<void> => {
    let signed = getSavedSig(user);
    if (signed) {
      signature.value = signed;
    } else {
      try {
        signed = await getChainStore(user.chain)['sign'](AUTH_MESSAGE);
        if (signed) localStorage.setItem(storageKey(user), signed);
        else await disconnect(user.chain);
        signature.value = signed ?? null;
      } catch (e) {
        signature.value = null;
        const detail = `${e}`.toLocaleLowerCase().includes('rejected')
          ? 'Please Sign to Continue'
          : `Couldn't sign: ${e}`;
        toastError(detail);
      }
    }
  };

  const refreshUser = async () => {
    if (!currentUser.value) return (currentUser.value = null);
    currentUser.value = await getChainStore()['getCurrentUser']();
  };

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const updateCurrentUser = async ([newAnchorWallet, newEvmAddress]: any[]) => {
    isLoading.value = true;
    loadingMessage.value = 'Authenticating ...';
    let newChain: Chain | null = null;
    if (newEvmAddress) newChain = megaethtestnet;
    else if (newAnchorWallet) newChain = solanadevnet;
    else newChain = null;

    if (!newChain) {
      currentUser.value = null;
      signature.value = null;
      isLoading.value = false;
      loadingMessage.value = '';
      return;
    }

    loadingMessage.value = 'Fetching On-Chain Data ...';
    const newUser = await getChainStore(newChain)['getCurrentUser']();
    if (!newUser) {
      currentUser.value = null;
      signature.value = null;
      isLoading.value = false;
      loadingMessage.value = '';
      return;
    }

    loadingMessage.value = 'Kindly Sign Authentication Message in Wallet';
    await ensureSigned(newUser);
    if (signature.value) {
      currentUser.value = newUser;
    } else {
      currentUser.value = null;
      loadingMessage.value = '';
      await disconnect(newUser.chain);
    }

    const disconnectFns = [
      ...(newAnchorWallet ? [] : [solanaWallet.disconnect]),
      ...(newEvmAddress ? [] : [evmDisconnect]),
    ];
    await Promise.all(disconnectFns.map((d) => d()));
    isLoading.value = false;
    loadingMessage.value = '';
  };

  onMounted(() => {
    updateCurrentUser([anchorWallet.value, evmAccount.address.value]);

    watch(
      [() => anchorWallet.value, () => evmAccount.address.value],
      updateCurrentUser,
      { deep: true }
    );
  });

  return {
    balance,
    currentUser,
    disconnect,
    isLoading,
    loadingMessage,
    getPayableId,
    getPaymentId,
    getWithdrawalId,
    refreshUser,
    signature,
  };
});
