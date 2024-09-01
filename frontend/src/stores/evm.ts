import {
  CONTRACT_ADDRESS,
  OnChainSuccess,
  TokenAndAmount,
  User,
  type Token,
} from '@/schemas';
import {
  account,
  erc20ABI,
  writeContract as rawWriteContract,
  signMessage,
} from '@kolirt/vue-web3-auth';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { createPublicClient, http, zeroAddress } from 'viem';
import { sepolia } from 'viem/chains';
import { abi } from './abi';

export const useEvmStore = defineStore('evm', () => {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  const balance = async (token: Token): Promise<number | null> => {
    if (!account.connected) return null;
    try {
      return Number(
        await publicClient.readContract({
          address: token.details['Ethereum Sepolia'].address as `0x${string}`,
          abi: erc20ABI,
          functionName: 'balanceOf',
          args: [account.address],
        })
      );
    } catch (e) {
      console.error(e);
      toastError(`Couldn't fetch ${token.name} balance: ${e}`);
      return null;
    }
  };

  const createPayable = async (
    tokensAndAmounts: TokenAndAmount[]
  ): Promise<OnChainSuccess | null> => {
    if (!account.connected) {
      toastError('Connect EVM Wallet First!');
      return null;
    }
    const { hash, wait } = await rawWriteContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'createPayable',
      args: [tokensAndAmounts.map((t) => t.toOnChain('Ethereum Sepolia'))],
    });

    await wait();

    // TODO: Extract the newly created payable ID from the receipt logs in
    // simulate contract call instead of constructing as below
    return new OnChainSuccess({
      created: await getUserPayableId((await getCurrentUser())?.payablesCount),
      txHash: hash,
      chain: 'Ethereum Sepolia',
    });
  };

  const getCurrentUser = async () => {
    if (!account.connected) return null;
    const raw = await readContract('users', [account.address]);
    if (raw) return User.fromEvm(account.address, raw);
    return null;
  };

  const getPayablePaymentId = async (
    payableId: string,
    count: number
  ): Promise<string | null> => {
    const id = await readContract('payablePaymentIds', [payableId, count - 1]);
    if (!id || id === zeroAddress) return null;
    return id;
  };

  const getUserEntityId = async (
    entity: string,
    count: number
  ): Promise<string | null> => {
    if (!account.connected) return null;
    const id = await readContract(`user${entity}Ids`, [account.address, count]);
    if (!id || id === zeroAddress) return null;
    return id;
  };

  const getUserPayableId = async (count: number) =>
    getUserEntityId('Payable', count - 1);

  const getUserPaymentId = async (count: number) =>
    getUserEntityId('Payment', count - 1);

  const getUserWithdrawalId = async (count: number) =>
    getUserEntityId('Withdrawal', count - 1);

  const pay = async (
    payableId: string,
    { amount, details }: TokenAndAmount
  ): Promise<OnChainSuccess | null> => {
    if (!account.connected) {
      toastError('Connect EVM Wallet First!');
      return null;
    }

    const token = details['Ethereum Sepolia'].address as `0x${string}`;
    if (token != CONTRACT_ADDRESS) {
      const approval = await rawWriteContract({
        address: token,
        abi: erc20ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, amount],
      });
      if (approval) await approval.wait();
      else return null;
    }

    const { hash, wait } = await rawWriteContract({
      address: token,
      abi: erc20ABI,
      functionName: 'pay',
      args: [payableId, token, BigInt(amount)],
      ...(token == CONTRACT_ADDRESS ? { value: BigInt(amount) } : {}),
    });
    
    await wait();

    // TODO: Extract the newly created payable ID from the receipt logs in
    // simulate contract call instead of constructing as below
    return new OnChainSuccess({
      created: await getUserPaymentId((await getCurrentUser())?.paymentsCount),
      txHash: hash,
      chain: 'Ethereum Sepolia',
    });
  };

  const readContract = async (
    functionName: string,
    args: any[] = []
  ): Promise<any> => {
    try {
      return await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi,
        functionName,
        args,
      });
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
      return null;
    }
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
    { amount, details }: TokenAndAmount
  ): Promise<OnChainSuccess | null> => {
    if (!account.connected) {
      toastError('Connect EVM Wallet First!');
      return null;
    }
    const { hash, wait } = await rawWriteContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'withdraw',
      args: [payableId, details['Ethereum Sepolia'].address, amount],
    });
    await wait();
    // TODO: Extract the newly created payable ID from the receipt logs in
    // simulate contract call instead of constructing as below
    return new OnChainSuccess({
      created: await getUserWithdrawalId(
        (await getCurrentUser())?.withdrawalsCount
      ),
      txHash: hash,
      chain: 'Ethereum Sepolia',
    });
  };

  return {
    balance,
    createPayable,
    getCurrentUser,
    getPayablePaymentId,
    getUserPayableId,
    getUserPaymentId,
    getUserWithdrawalId,
    readContract,
    pay,
    sign,
    withdraw,
  };
});
