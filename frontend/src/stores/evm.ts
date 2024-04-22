import { OnChainSuccess } from '@/schemas/on-chain-success';
import {
  convertTokensForOnChain,
  type TokenAndAmountOffChain,
} from '@/schemas/tokens-and-amounts';
import { account, writeContract } from '@kolirt/vue-web3-auth';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import abi from './abi.json';

export const CONTRACT_ADDRESS = '0x7DEF11c120c17fBcd63d916Eefb14F9Fc395f7eA';

export const useEvmStore = defineStore('evm', () => {
  const initializePayable = async (
    description: string,
    tokensAndAmounts: TokenAndAmountOffChain[],
    allowsFreePayments: boolean,
  ): Promise<OnChainSuccess | null> => {
    if (!account.connected) {
      toastError('Connect Ethereum Wallet First!');
      return null;
    }

    const { hash, wait } = await writeContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'initiailizePayable',
      args: [
        description,
        allowsFreePayments,
        convertTokensForOnChain(tokensAndAmounts),
      ],
    });
    await wait();
    // TODO: Detect call reception in Solana before returning
    return new OnChainSuccess({
      created: new Uint8Array(),
      txHash: hash,
      chain: 'Ethereum',
    });
  };

  const pay = async (
    payableId: Uint8Array,
    details: TokenAndAmountOffChain,
  ): Promise<OnChainSuccess | null> => {
    if (!account.connected) {
      toastError('Connect Ethereum Wallet First!');
      return null;
    }

    const { hash, wait } = await writeContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'pay',
      args: [payableId, convertTokensForOnChain([details])[0]],
    });
    await wait();
    // TODO: Detect call reception in Solana before returning
    return new OnChainSuccess({
      created: new Uint8Array(),
      txHash: hash,
      chain: 'Ethereum',
    });
  };

  const toast = useToast();

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const withdraw = async (
    payableId: Uint8Array,
    details: TokenAndAmountOffChain,
  ): Promise<OnChainSuccess | null> => {
    if (!account.connected) {
      toastError('Connect Ethereum Wallet First!');
      return null;
    }

    const { hash, wait } = await writeContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'withdraw',
      args: [payableId, convertTokensForOnChain([details])[0]],
    });
    await wait();
    // TODO: Detect call reception in Solana before returning
    return new OnChainSuccess({
      created: new Uint8Array(),
      txHash: hash,
      chain: 'Ethereum',
    });
  };

  return { initializePayable, pay, withdraw };
});
