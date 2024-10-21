import type { Token } from '@/schemas/tokens-and-amounts';
import {
  disconnect as evmDisconnect,
  account as evmWallet,
} from '@kolirt/vue-web3-auth';
import { encoding } from '@wormhole-foundation/sdk-base';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import {
  useAnchorWallet,
  useWallet as useSolanaWallet,
} from 'solana-wallets-vue';
import { computed, ref, watch } from 'vue';
import { useChainStore, type Chain } from './chain';
import { useCosmwasmStore } from './cosmwasm';
import { useEvmStore } from './evm';
import { useSolanaStore } from './solana';

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

export const useWalletStore = defineStore('wallet', () => {
  const anchorWallet = useAnchorWallet();
  const chain = useChainStore();
  const cosmwasm = useCosmwasmStore();
  const evm = useEvmStore();
  const solana = useSolanaStore();
  const solanaWallet = useSolanaWallet();
  const toast = useToast();
  const address = ref<string | null>(null);
  const connected = computed(() => !!address.value);

  const areSame = (a: Uint8Array, b: Uint8Array) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  };

  const getChainStore: any = (chain_?: Chain) =>
    ({
      'Burnt Xion': cosmwasm,
      'Ethereum Sepolia': evm,
      Solana: solana,
    })[chain_ ?? chain.current!];

  /**
   * Fetches and Returns the UI-formatted balance of a token based on the
   * current chain.
   * @param token The token to fetch its balance
   * @returns The UI formatted balance of the token
   */
  const balance = async (token: Token): Promise<number | null> => {
    if (!connected.value) return null;
    return await getChainStore()['balance'](token);
  };

  const disconnect = async (): Promise<void> => {
    if (!connected.value) return;
    return await {
      'Burnt Xion': cosmwasm.logout,
      'Ethereum Sepolia': evmDisconnect,
      Solana: solanaWallet.disconnect,
    }[chain.current!]();
  };

  const explorerUrl = (
    walletAddress?: string,
    chain_?: Chain
  ): string | null => {
    if (!(walletAddress ?? address.value)) return null;
    if (!(chain_ ?? chain.current)) return null;
    return getChainStore(chain_)['walletExplorerUrl'](
      walletAddress ?? address.value
    );
  };

  const sign = async (message: string): Promise<string | null> => {
    if (!connected.value) return null;
    try {
      return await getChainStore()['sign'](message);
    } catch (e) {
      const detail = `${e}`.toLocaleLowerCase().includes('rejected')
        ? 'Please Sign to Continue'
        : `Couldn't sign: ${e}`;
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail,
        life: 12000,
      });
      return null;
    }
  };

  const update = ([
    newChain,
    newEvmAddress,
    newAnchorWallet,
    newCosmWasmAddr,
  ]: any[]) => {
    if (newChain == 'Burnt Xion' && newCosmWasmAddr) {
      address.value = newCosmWasmAddr;
    } else if (newChain == 'Ethereum Sepolia' && newEvmAddress) {
      address.value = newEvmAddress;
    } else if (newChain == 'Solana' && newAnchorWallet) {
      address.value = newAnchorWallet.publicKey.toBase58();
    } else {
      address.value = null;
    }
  };

  watch(
    [
      () => chain.current,
      () => evmWallet.address,
      () => anchorWallet.value,
      () => cosmwasm.address,
    ],
    update,
    { deep: true }
  );

  setTimeout(
    () =>
      update([
        chain.current,
        evmWallet.address,
        anchorWallet.value,
        cosmwasm.address,
      ]),
    1000
  );

  return {
    address,
    areSame,
    balance,
    connected,
    disconnect,
    explorerUrl,
    sign,
  };
});
