import { OnChainSuccess } from '@/schemas/on-chain-success';
import {
  convertTokensForOnChain,
  type TokenAndAmountOffChain,
} from '@/schemas/tokens-and-amounts';
import { account, writeContract } from '@kolirt/vue-web3-auth';
import { PublicKey } from '@solana/web3.js';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import abi from './abi';

export const CONTRACT_ADDRESS = '0x89F1051407799805eac5aE9A40240dbCaaB55b98';

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
    // TODO: Detect call reception in Solana and return entity from there
    return new OnChainSuccess({
      created: hash,
      txHash: hash,
      chain: 'Ethereum',
    });
  };

  const pay = async (
    payableId: string,
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
      args: [
        new PublicKey(payableId).toBytes(),
        convertTokensForOnChain([details])[0],
      ],
    });
    await wait();
    // TODO: Detect call reception in Solana and return entity from there
    return new OnChainSuccess({
      created: hash,
      txHash: hash,
      chain: 'Ethereum',
    });
  };

  const toast = useToast();

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const withdraw = async (
    payableId: string,
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
      args: [
        new PublicKey(payableId).toBytes(),
        convertTokensForOnChain([details])[0],
      ],
    });
    await wait();
    // TODO: Detect call reception in Solana and return entity from there
    return new OnChainSuccess({
      created: hash,
      txHash: hash,
      chain: 'Ethereum',
    });
  };

  return { initializePayable, pay, withdraw };
});
