import {
  erc20ABI,
  account as evmWallet,
  readContract,
} from '@kolirt/vue-web3-auth';
import { getAssociatedTokenAddressSync as getATA } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useAnchorWallet } from 'solana-wallets-vue';
import { onMounted, ref, watch } from 'vue';
import { useChainStore } from './chain';

export const useWalletStore = defineStore('wallet', () => {
  const anchorWallet = useAnchorWallet();
  const balance = async (
    token: Uint8Array,
    name: string,
  ): Promise<number | null> => {
    if (!whAddress.value) return null;
    try {
      if (chain.current == 'Ethereum') {
        // TODO: Convert based on token decimals
        return Number(
          await readContract({
            address: new UniversalAddress(
              token,
              'hex',
            ).toString() as `0x${string}`,
            abi: erc20ABI,
            functionName: 'balanceOf',
            args: [evmWallet.address],
          }),
        );
      } else {
        return (
          await solanaConnection.getTokenAccountBalance(
            getATA(new PublicKey(token), anchorWallet.value!.publicKey),
          )
        ).value.uiAmount;
      }
    } catch (e) {
      if (`${e}`.includes('could not find account')) return 0;
      toastError(`Couldn't fetch ${name} balance: ${e}`);
      return null;
    }
  };
  const chain = useChainStore();
  // TODO: Update Solana Connection url here too
  const solanaConnection = new Connection('http://localhost:8899', 'finalized');
  // const solanaConnection = new Connection(clusterApiUrl('devnet'), 'finalized');
  const toast = useToast();
  const whAddress = ref<Uint8Array | null>(null);

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  onMounted(() => {
    watch(
      [() => chain.current, () => evmWallet.address, () => anchorWallet.value],
      ([newChain, newEvmAddress, newAnchorWallet]) => {
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
      },
    );
  });

  return { balance, whAddress };
});
