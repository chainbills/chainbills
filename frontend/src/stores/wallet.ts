import type { Token } from '@/schemas/tokens-and-amounts';
import { account as evmWallet } from '@kolirt/vue-web3-auth';
import { encoding } from '@wormhole-foundation/sdk-base';
import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { defineStore } from 'pinia';
import { useAnchorWallet } from 'solana-wallets-vue';
import { ref, watch } from 'vue';
import { useChainStore, type Chain } from './chain';
import { useEvmStore } from './evm';
import { useSolanaStore } from './solana';

export const useWalletStore = defineStore('wallet', () => {
  const anchorWallet = useAnchorWallet();
  const chain = useChainStore();
  const evm = useEvmStore();
  const solana = useSolanaStore();
  const whAddress = ref<Uint8Array | null>(null);

  const areSame = (a: Uint8Array, b: Uint8Array) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  };

  const balance = async (token: Token): Promise<number | null> => {
    if (!whAddress.value) return null;
    return chain.current == 'Ethereum'
      ? await evm.balance(token)
      : await solana.balance(token);
  };

  const original = (bytes: Uint8Array, chain: Chain) => {
    if (chain == 'Solana') return encoding.b58.encode(Uint8Array.from(bytes));
    return encoding.hex.encode(Uint8Array.from(bytes))
  };

  const setWhAddress = ([newChain, newEvmAddress, newAnchorWallet]: any[]) => {
    if (newChain == 'Ethereum' && newEvmAddress) {
      whAddress.value = new UniversalAddress(newEvmAddress, 'hex').address;
    } else if (newChain == 'Solana' && newAnchorWallet) {
      whAddress.value = new UniversalAddress(
        newAnchorWallet.publicKey.toBase58(),
        'base58',
      ).address;
    } else {
      whAddress.value = null;
    }
  };

  watch(
    [() => chain.current, () => evmWallet.address, () => anchorWallet.value],
    setWhAddress,
    { deep: true },
  );

  setTimeout(
    () => setWhAddress([chain.current, evmWallet.address, anchorWallet.value]),
    1000,
  );

  return { areSame, balance, original, whAddress };
});
