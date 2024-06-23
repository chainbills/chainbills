import { OnChainSuccess } from '@/schemas/on-chain-success';
import { TokenAndAmount, type Token } from '@/schemas/tokens-and-amounts';
import {
  account,
  erc20ABI,
  readContract,
  signMessage,
  writeContract,
} from '@kolirt/vue-web3-auth';
import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { abi } from './abi';
import { useServerStore } from './server';

export const CONTRACT_ADDRESS = '0xb52CB1AD5D67C5CD25180f8cdB48D22243291884';

export const useEvmStore = defineStore('evm', () => {
  const server = useServerStore();

  const balance = async (token: Token): Promise<number | null> => {
    if (!account.connected) return null;
    try {
      return Number(
        await readContract({
          address: token.details['Ethereum Sepolia'].address as `0x${string}`,
          abi: erc20ABI,
          functionName: 'balanceOf',
          args: [account.address],
        }),
      );
    } catch (e) {
      console.error(e);
      toastError(`Couldn't fetch ${token.name} balance: ${e}`);
      return null;
    }
  };

  const initializePayable = async (
    description: string,
    tokensAndAmounts: TokenAndAmount[],
    allowsFreePayments: boolean,
  ): Promise<OnChainSuccess | null> => {
    if (!account.connected) {
      toastError('Connect EVM Wallet First!');
      return null;
    }

    const { hash, wait } = await writeContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'initializePayable',
      args: [
        description,
        allowsFreePayments,
        tokensAndAmounts.map((t) => t.toOnChain()),
      ],
    });

    await wait();
    if (!(await server.relay(hash, 'initializePayable'))) return null;

    return new OnChainSuccess({
      created: hash,
      txHash: hash,
      chain: 'Ethereum Sepolia',
    });
  };

  const pay = async (
    payableId: string,
    { amount, details }: TokenAndAmount,
  ): Promise<OnChainSuccess | null> => {
    if (!account.connected) {
      toastError('Connect EVM Wallet First!');
      return null;
    }

    const approval = await writeContract({
      address: details['Ethereum Sepolia'].address as `0x${string}`,
      abi: erc20ABI,
      functionName: 'approve',
      args: [CONTRACT_ADDRESS, amount],
    });
    if (approval) await approval.wait();
    else return null;

    const { hash, wait } = await writeContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'pay',
      args: [
        new PublicKey(payableId).toBytes(),
        new PublicKey(details.Solana.address).toBytes(),
        new BN(amount),
      ],
    });

    await wait();
    if (!(await server.relay(hash, 'pay'))) return null;

    return new OnChainSuccess({
      created: hash,
      txHash: hash,
      chain: 'Ethereum Sepolia',
    });
  };

  const sign = async (message: string): Promise<string | null> => {
    if (!account.connected) {
      toastError('Connect EVM Wallet First!');
      return null;
    }
    return await signMessage(message);
  };

  const toast = useToast();

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const withdraw = async (
    payableId: string,
    { amount, details }: TokenAndAmount,
  ): Promise<OnChainSuccess | null> => {
    if (!account.connected) {
      toastError('Connect EVM Wallet First!');
      return null;
    }

    const { hash, wait } = await writeContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'withdraw',
      args: [
        new PublicKey(payableId).toBytes(),
        new PublicKey(details.Solana.address).toBytes(),
        new BN(amount),
      ],
    });

    await wait();
    if (!(await server.relay(hash, 'withdraw'))) return null;

    return new OnChainSuccess({
      created: hash,
      txHash: hash,
      chain: 'Ethereum Sepolia',
    });
  };

  return { balance, initializePayable, pay, sign, withdraw };
});
