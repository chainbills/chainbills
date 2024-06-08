import type { Token } from '@/schemas/tokens-and-amounts';
import { account as evmWallet } from '@kolirt/vue-web3-auth';
import { encoding } from '@wormhole-foundation/sdk-base';
import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { defineStore } from 'pinia';
import { useAnchorWallet } from 'solana-wallets-vue';
import { computed, ref, watch } from 'vue';
import { useChainStore, type Chain } from './chain';
import { useEvmStore } from './evm';
import { useSolanaStore } from './solana';

export const useWalletStore = defineStore('wallet', () => {
  const anchorWallet = useAnchorWallet();
  const chain = useChainStore();
  const current = ref<UniversalAddress | null>(null);
  const evm = useEvmStore();
  const solana = useSolanaStore();

  const address = computed(() => current.value?.toString() ?? null);
  const connected = computed(() => !!current.value);
  const whAddress = computed(() => current.value?.address ?? null);

  const areSame = (a: Uint8Array, b: Uint8Array) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  };

  const balance = async (token: Token): Promise<number | null> => {
    if (!!current.value) return null;
    return chain.current == 'Ethereum'
      ? await evm.balance(token)
      : await solana.balance(token);
  };

  const canonical = (bytes: Uint8Array, chain: Chain) => {
    if (chain == 'Solana') return encoding.b58.encode(Uint8Array.from(bytes));
    return encoding.hex.encode(Uint8Array.from(bytes));
  };

  const update = ([newChain, newEvmAddress, newAnchorWallet]: any[]) => {
    if (newChain == 'Ethereum' && newEvmAddress) {
      current.value = new UniversalAddress(newEvmAddress, 'hex');
    } else if (newChain == 'Solana' && newAnchorWallet) {
      current.value = new UniversalAddress(
        newAnchorWallet.publicKey.toBase58(),
        'base58',
      );
    } else {
      current.value = null;
    }
  };

  watch(
    [() => chain.current, () => evmWallet.address, () => anchorWallet.value],
    update,
    { deep: true },
  );

  setTimeout(
    () => update([chain.current, evmWallet.address, anchorWallet.value]),
    1000,
  );

  return { address, areSame, balance, canonical, connected, whAddress };
});
