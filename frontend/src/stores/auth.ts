import {
  type Chain,
  arctestnet,
  basesepolia as basesepoliaInApp,
  megaeth as megaethInApp,
  solanadevnet,
  type Token,
  User,
} from '@/schemas';
import { errorMsg, useCacheStore, useEvmStore, useSolanaStore } from '@/stores';
import { useSolanaConnector } from '@/composables/useSolanaConnector';
import { useAccount, useDisconnect } from '@wagmi/vue';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { arcTestnet, baseSepolia as baseSepoliaViem, megaeth as megaethViem } from 'viem/chains';
import { createSiweMessage } from 'viem/siwe';
import { onMounted, ref, watch } from 'vue';
import * as encoding from './encoding';

export const denormalizeBytes = (bytes: Uint8Array, chain: Chain): string => {
  bytes = Uint8Array.from(bytes);
  if (chain.isSolana) return encoding.b58.encode(bytes);
  if (chain.isEvm) {
    return '0x' + encoding.hex.encode(bytes, false).replace(/^0+/, '');
  } else throw `Unknown chain: ${chain}`;
};

export const useAuthStore = defineStore('auth', () => {
  const cache = useCacheStore();
  const currentUser = ref<User | null>(null);
  const evm = useEvmStore();
  const isLoading = ref(true);
  const loadingMessage = ref('');
  const accessToken = ref<string | null>(null);
  const tokenExpiresAt = ref<number | null>(null);
  const solana = useSolanaStore();
  const solanaConnector = useSolanaConnector();
  const toast = useToast();
  const { disconnect: evmDisconnect } = useDisconnect();
  const evmAccount = useAccount();

  const getChainStore: any = (chain?: Chain) =>
    ({
      arctestnet: evm,
      megaeth: evm,
      basesepolia: evm,
      solanadevnet: solana,
    })[(chain ?? currentUser.value!.chain).name];

  /**
   * Fetches and returns the raw on-chain balance (smallest unit, as a
   * `bigint`) of `token` for the current user's connected chain.
   * @param token The token to fetch its balance
   * @returns The raw balance, or `null` if not signed in or the read failed
   */
  const balance = async (token: Token): Promise<bigint | null> => {
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
        arctestnet: evmDisconnect,
        megaeth: evmDisconnect,
        basesepolia: evmDisconnect,
        solanadevnet: solanaConnector.disconnect,
      }[(chain ?? currentUser.value!.chain).name]();
    }
  };

  const getEntityId = async (entity: string, count: number): Promise<string | null> => {
    if (!currentUser.value) return null;

    let id = await cache.retrieve(cacheKey(entity, count)!);
    if (id) return id;

    entity = entity[0].toUpperCase() + entity.slice(1);
    id = await getChainStore()[`getUser${entity}Id`](count);

    entity = entity[0].toLowerCase() + entity.slice(1);
    if (id) await cache.save(cacheKey(entity, count)!, id);

    return id;
  };

  const getPayableId = async (count: number): Promise<string | null> => getEntityId('payable', count);

  const getPaymentId = async (count: number): Promise<string | null> => getEntityId('payment', count);

  const getWithdrawalId = async (count: number): Promise<string | null> => getEntityId('withdrawal', count);

  const refreshUser = async () => {
    if (!currentUser.value) return (currentUser.value = null);
    currentUser.value = await getChainStore()['getCurrentUser']();
  };

  const toastError = (detail: string) => toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const serverUrl = () => import.meta.env.VITE_SERVER_URL || 'https://api.chainbills.xyz';

  const tokenIsValid = () =>
    !!(accessToken.value && tokenExpiresAt.value && tokenExpiresAt.value - Date.now() > 60_000);

  const tryRefresh = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${serverUrl()}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = await res.json();
      accessToken.value = data.accessToken;
      tokenExpiresAt.value = Date.now() + data.expiresIn * 1_000;
      return true;
    } catch {
      return false;
    }
  };

  const buildSiweMessage = (user: User, nonce: string): string =>
    createSiweMessage({
      domain: window.location.host,
      address: user.walletAddress as `0x${string}`,
      statement: 'Sign in to Chainbills',
      uri: window.location.origin,
      version: '1',
      chainId: evmAccount.chain.value!.id,
      nonce,
      issuedAt: new Date(),
    });

  const buildSiwsMessage = (user: User, nonce: string): string =>
    [
      `${window.location.host} wants you to sign in with your Solana account:`,
      user.walletAddress,
      '',
      'Sign in to Chainbills',
      '',
      `URI: ${window.location.origin}`,
      'Version: 1',
      'Chain ID: devnet',
      `Nonce: ${nonce}`,
      `Issued At: ${new Date().toISOString()}`,
    ].join('\n');

  const ensureJwt = async (user: User): Promise<void> => {
    if (tokenIsValid()) return;

    // Try silent token rotation using the httpOnly refresh cookie before
    // asking the wallet to sign again.
    if (await tryRefresh()) return;

    // Full sign-in: get nonce, build EIP-4361 / SIWS message, sign, verify.
    loadingMessage.value = 'Kindly Sign Authentication Message in Wallet';
    try {
      const nonceRes = await fetch(`${serverUrl()}/auth/nonce`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!nonceRes.ok) throw new Error('Failed to get nonce from server');
      const { nonce } = await nonceRes.json();

      const message = user.chain.isEvm ? buildSiweMessage(user, nonce) : buildSiwsMessage(user, nonce);
      const signed = await getChainStore(user.chain)['sign'](message);
      if (!signed) {
        await disconnect(user.chain);
        return;
      }

      const verifyRes = await fetch(`${serverUrl()}/auth/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namespace: user.chain.isEvm ? 'evm' : 'solana',
          message,
          signature: signed,
        }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        const msg = Array.isArray(err.message) ? err.message.join('; ') : err.message;
        throw new Error(msg || 'Authentication failed');
      }
      const data = await verifyRes.json();
      accessToken.value = data.accessToken;
      tokenExpiresAt.value = Date.now() + data.expiresIn * 1_000;
    } catch (e) {
      accessToken.value = null;
      tokenExpiresAt.value = null;
      const detail = `${e}`.toLowerCase().includes('rejected')
        ? 'Please Sign to Continue'
        : `Couldn't authenticate: ${errorMsg(e)}`;
      toastError(detail);
    }
  };

  /**
   * Attempts to silently rotate the access token using the httpOnly refresh
   * cookie. Called by the server store on 401 responses.
   */
  const refreshToken = async (): Promise<boolean> => tryRefresh();

  const clearJwt = () => {
    accessToken.value = null;
    tokenExpiresAt.value = null;
  };

  const callLogout = async (): Promise<void> => {
    if (!accessToken.value) return;
    try {
      await fetch(`${serverUrl()}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken.value}` },
      });
    } catch {
      // Best-effort — refresh cookie will expire on its own if this fails.
    }
  };

  const updateCurrentUser = async ([newSolanaConnected, newEvmAddress]: any[]) => {
    isLoading.value = true;
    loadingMessage.value = 'Authenticating ...';
    let newChain: Chain | null = null;

    if (newEvmAddress) {
      const evmChainId = evmAccount.chain.value?.id;
      if (evmChainId === megaethViem.id) newChain = megaethInApp;
      else if (evmChainId === arcTestnet.id) newChain = arctestnet;
      else if (evmChainId === baseSepoliaViem.id) newChain = basesepoliaInApp;
    }
    if (newSolanaConnected) newChain = solanadevnet;

    if (!newChain) {
      await callLogout();
      currentUser.value = null;
      clearJwt();
      isLoading.value = false;
      loadingMessage.value = '';
      return;
    }

    loadingMessage.value = 'Fetching On-Chain Data ...';
    const newUser = await getChainStore(newChain)['getCurrentUser']();
    if (!newUser) {
      currentUser.value = null;
      clearJwt();
      isLoading.value = false;
      loadingMessage.value = '';
      return;
    }

    await ensureJwt(newUser);
    if (accessToken.value) {
      currentUser.value = newUser;
    } else {
      currentUser.value = null;
      loadingMessage.value = '';
      await disconnect(newUser.chain);
    }

    const disconnectFns = [
      ...(newSolanaConnected ? [] : [solanaConnector.disconnect]),
      ...(newEvmAddress ? [] : [evmDisconnect]),
    ];
    await Promise.all(disconnectFns.map((d) => d()));
    isLoading.value = false;
    loadingMessage.value = '';
  };

  onMounted(() => {
    updateCurrentUser([solanaConnector.isConnectedSolana.value, evmAccount.address.value]);

    watch(
      [() => solanaConnector.isConnectedSolana.value, () => evmAccount.address.value, () => evmAccount.chain.value],
      updateCurrentUser,
      { deep: true }
    );
  });

  return {
    accessToken,
    balance,
    currentUser,
    disconnect,
    isLoading,
    loadingMessage,
    getPayableId,
    getPaymentId,
    getWithdrawalId,
    refreshToken,
    refreshUser,
  };
});
