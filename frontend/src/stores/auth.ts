import { type Token, User } from '@/schemas';
import {
  useCacheStore,
  useCosmwasmStore,
  useEvmStore,
  useSolanaStore,
} from '@/stores';
import type { Cluster } from '@solana/web3.js';
import { useAccount, useDisconnect } from '@wagmi/vue';
import { toChainId } from '@wormhole-foundation/sdk';
import { encoding } from '@wormhole-foundation/sdk-base';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import {
  useAnchorWallet,
  useWallet as useSolanaWallet,
} from 'solana-wallets-vue';
import { onMounted, ref, watch } from 'vue';

export const AUTH_MESSAGE = 'Authentication';
export const SOLANA_CLUSTER: Cluster = 'devnet';
export const WH_CHAIN_ID_SOLANA = toChainId('Solana');
export const WH_CHAIN_ID_ETH_SEPOLIA = toChainId('Sepolia');
export const WH_CHAIN_ID_BURNT_XION = 50;

export const chains: Chain[] = ['Solana', 'Ethereum Sepolia', 'Burnt Xion'];
export type Chain = 'Solana' | 'Ethereum Sepolia' | 'Burnt Xion';

export const denormalizeBytes = (bytes: Uint8Array, chain: Chain): string => {
  bytes = Uint8Array.from(bytes);
  if (chain == 'Solana') return encoding.b58.encode(bytes);
  if (chain == 'Ethereum Sepolia') {
    return '0x' + encoding.hex.encode(bytes, false).replace(/^0+/, '');
  }
  if (chain == 'Burnt Xion') {
    return encoding.bech32.encode('xion', encoding.bech32.toWords(bytes));
  } else throw `Unknown chain: ${chain}`;
};

export const getChain = (id: number): Chain => {
  if (id == WH_CHAIN_ID_SOLANA) return 'Solana';
  if (id == WH_CHAIN_ID_ETH_SEPOLIA) return 'Ethereum Sepolia';
  if (id == WH_CHAIN_ID_BURNT_XION) return 'Burnt Xion';
  throw `Unknown chainId: ${id}`;
};

export const getChainId = (chain: Chain): number => {
  if (chain == 'Solana') return WH_CHAIN_ID_SOLANA;
  if (chain == 'Ethereum Sepolia') return WH_CHAIN_ID_ETH_SEPOLIA;
  if (chain == 'Burnt Xion') return WH_CHAIN_ID_BURNT_XION;
  throw `Unknown chain: ${chain}`;
};

export const useAuthStore = defineStore('auth', () => {
  const anchorWallet = useAnchorWallet();
  const cache = useCacheStore();
  const cosmwasm = useCosmwasmStore();
  const currentUser = ref<User | null>(null);
  const evm = useEvmStore();
  const isLoading = ref(true);
  const signature = ref<string | null>(null);
  const solana = useSolanaStore();
  const solanaWallet = useSolanaWallet();
  const toast = useToast();
  const { disconnect: evmDisconnect } = useDisconnect();
  const evmAccount = useAccount();

  const getChainStore: any = (chain?: Chain) =>
    ({
      'Burnt Xion': cosmwasm,
      'Ethereum Sepolia': evm,
      Solana: solana,
    })[chain ?? currentUser.value!.chain];

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
    return `${chain}::user::${walletAddress}::${entity}::${count}`;
  };

  const disconnect = async (chain?: Chain): Promise<void> => {
    if (chain || currentUser.value) {
      return await {
        'Burnt Xion': cosmwasm.logout,
        'Ethereum Sepolia': evmDisconnect,
        Solana: solanaWallet.disconnect,
      }[chain ?? currentUser.value!.chain]();
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

  const getExplorerUrl = (walletAddress: string, chain: Chain): string => {
    return getChainStore(chain)['walletExplorerUrl'](walletAddress);
  };

  const getPayableId = async (count: number): Promise<string | null> =>
    getEntityId('payable', count);

  const getPaymentId = async (count: number): Promise<string | null> =>
    getEntityId('payment', count);

  const getWithdrawalId = async (count: number): Promise<string | null> =>
    getEntityId('withdrawal', count);

  const lsKey = (user: User) =>
    `chainbills::chainId=>${getChainId(user.chain)}` +
    `::signature=>${user.walletAddress}`;

  const getSavedSig = (user: User) => localStorage.getItem(lsKey(user));
  const ensureSigned = async (user: User): Promise<void> => {
    if (getSavedSig(user)) {
      signature.value = getSavedSig(user);
    } else {
      if (user.chain == 'Burnt Xion') {
        // TODO: Implement signing for Burnt Xion
        signature.value = null;
        return;
      }

      try {
        const signed = await getChainStore(user.chain)['sign'](AUTH_MESSAGE);
        if (signed) localStorage.setItem(lsKey(user), signed);
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

  const updateCurrentUser = async ([
    newCosmWasmAddr,
    newAnchorWallet,
    newEvmAddress,
  ]: any[]) => {
    isLoading.value = true;
    let newChain: Chain | null = null;
    if (newCosmWasmAddr) newChain = 'Burnt Xion';
    else if (newEvmAddress) newChain = 'Ethereum Sepolia';
    else if (newAnchorWallet) newChain = 'Solana';
    else newChain = null;

    if (!newChain) {
      currentUser.value = null;
      signature.value = null;
      isLoading.value = false;
      return;
    }

    const newUser = await getChainStore(newChain)['getCurrentUser']();
    if (!newUser) {
      currentUser.value = null;
      signature.value = null;
      isLoading.value = false;
      return;
    }

    await ensureSigned(newUser);
    // TODO: Remove signing exemption for Burnt Xion
    if (signature.value || newChain == 'Burnt Xion') {
      currentUser.value = newUser;
    } else {
      currentUser.value = null;
      await disconnect(newUser.chain);
    }

    const disconnectFns = [
      ...(newCosmWasmAddr ? [] : [cosmwasm.logout]),
      ...(newAnchorWallet ? [] : [solanaWallet.disconnect]),
      ...(newEvmAddress ? [] : [evmDisconnect]),
    ];
    await Promise.all(disconnectFns.map((d) => d()));
    isLoading.value = false;
  };

  onMounted(() => {
    updateCurrentUser([
      cosmwasm.address,
      anchorWallet.value,
      evmAccount.address.value,
    ]);

    watch(
      [
        () => cosmwasm.address,
        () => anchorWallet.value,
        () => evmAccount.address.value,
      ],
      updateCurrentUser,
      { deep: true }
    );
  });

  return {
    balance,
    currentUser,
    disconnect,
    isLoading,
    getExplorerUrl,
    getPayableId,
    getPaymentId,
    getWithdrawalId,
    refreshUser,
    signature,
  };
});
