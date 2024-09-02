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
import {
  createPublicClient,
  http,
  zeroAddress,
  type ContractFunctionArgs,
  type ContractFunctionName,
} from 'viem';
import { sepolia } from 'viem/chains';
import { abi } from './abi';

export type AbiFunctionName = ContractFunctionName<typeof abi, 'pure' | 'view'>;
export type AbiArgs = ContractFunctionArgs<
  typeof abi,
  'pure' | 'view',
  AbiFunctionName
>;

export const useEvmStore = defineStore('evm', () => {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  const balance = async (token: Token): Promise<number | null> => {
    if (!account.connected) return null;
    try {
      const addr = token.details['Ethereum Sepolia'].address as `0x${string}`;
      const balance =
        addr == CONTRACT_ADDRESS
          ? await publicClient.getBalance({ address: account.address! })
          : await publicClient.readContract({
              address: addr,
              abi: erc20ABI,
              functionName: 'balanceOf',
              args: [account.address],
            });
      return Number(balance);
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
      created: await getUserPayableId((await getCurrentUser())?.payablesCount!),
      txHash: hash,
      chain: 'Ethereum Sepolia',
    });
  };

  const getCurrentUser = async () => {
    if (!account.connected) return null;
    const raw = await readContract('users', [account.address!]);
    if (raw) return User.fromEvm(account.address!, raw);
    return null;
  };

  const fetchPayable = async (id: string) => {
    const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
    const raw = await readContract('payables', [xId]);
    const aTAAs = await readContract('getAllowedTokensAndAmounts', [xId]);
    const balances = await readContract('getBalances', [xId]);
    if (!raw || !aTAAs || !balances) return null;
    // the following was just to reduce the number of code lines
    const [host, chainCount, hostCount, createdAt, paymentsCount] = raw;
    const [withdrawalsCount, , , isClosed] = raw.splice(5);
    return {
      ...{ host, chainCount, hostCount, createdAt, paymentsCount, balances },
      ...{ withdrawalsCount, isClosed, allowedTokensAndAmounts: aTAAs },
    };
  };

  const fetchUserPayment = async (id: string) => {
    const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
    const raw = await readContract('userPayments', [xId]);
    const details = await readContract('getUserPaymentDetails', [xId]);
    if (!raw || !details) return null;
    // the following was just to reduce the number of code lines
    const [payableId, payer, payableChainId, chainCount, payerCount] = raw;
    const [payableCount, timestamp] = raw.splice(5);
    return {
      ...{ payableId, payer, payableChainId, chainCount, payerCount },
      ...{ details, payableCount, timestamp },
    };
  };

  const fetchPayablePayment = async (id: string) => {
    const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
    const raw = await readContract('payablePayments', [xId]);
    const details = await readContract('getPayablePaymentDetails', [xId]);
    if (!raw || !details) return null;
    // the following was just to reduce the number of code lines
    const [payableId, payer, payerChainId, localChainCount, payableCount] = raw;
    const [payerCount, timestamp] = raw.splice(5);
    return {
      ...{ payableId, payer, payerChainId, localChainCount, payableCount },
      ...{ payerCount, timestamp, details },
    };
  };

  const fetchWithdrawal = async (id: string) => {
    const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
    const raw = await readContract('withdrawals', [xId]);
    const details = await readContract('getWithdrawalDetails', [xId]);
    if (!raw || !details) return null;
    const [payableId, host, chainCount, hostCount, payableCount] = raw;
    return {
      ...{ payableId, host, chainCount, hostCount, payableCount },
      ...{ timestamp: raw[5], details },
    };
  };

  const getPayablePaymentId = async (
    payableId: string,
    count: number
  ): Promise<string | null> => {
    if (!payableId.startsWith('0x')) payableId = `0x${payableId}`;
    const id = await readContract('payablePaymentIds', [
      payableId as `0x${string}`,
      count - 1,
    ]);
    if (!id || id === zeroAddress) return null;
    return id;
  };

  const getUserEntityId = async (
    entity: string,
    count: number
  ): Promise<string | null> => {
    if (!account.connected) return null;
    const setNames = `user${entity}Ids` as AbiFunctionName;
    const id = await readContract(setNames, [account.address!, count]);
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
      address: CONTRACT_ADDRESS,
      abi,
      functionName: 'pay',
      args: [payableId, token, BigInt(amount)],
      ...(token == CONTRACT_ADDRESS ? { value: BigInt(amount) } : {}),
    });

    await wait();

    // TODO: Extract the newly created payable ID from the receipt logs in
    // simulate contract call instead of constructing as below
    return new OnChainSuccess({
      created: await getUserPaymentId((await getCurrentUser())?.paymentsCount!),
      txHash: hash,
      chain: 'Ethereum Sepolia',
    });
  };

  const readContract = async (
    functionName: AbiFunctionName,
    args: AbiArgs = []
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
        (await getCurrentUser())?.withdrawalsCount!
      ),
      txHash: hash,
      chain: 'Ethereum Sepolia',
    });
  };

  return {
    balance,
    createPayable,
    fetchPayable,
    fetchPayablePayment,
    fetchUserPayment,
    fetchWithdrawal,
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
