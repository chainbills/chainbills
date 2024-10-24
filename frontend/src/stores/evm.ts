import {
  OnChainSuccess,
  SEPOLIA_CONTRACT_ADDRESS,
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

  /** Returns UI-Formatted balance (Accounts for Decimals) */
  const balance = async (token: Token): Promise<number | null> => {
    if (!account.connected) return null;
    if (!token.details['Ethereum Sepolia']) return null;
    const { address: addr, decimals } = token.details['Ethereum Sepolia'];
    try {
      const balance =
        addr == SEPOLIA_CONTRACT_ADDRESS
          ? await publicClient.getBalance({ address: account.address! })
          : await publicClient.readContract({
              address: addr as `0x${string}`,
              abi: erc20ABI,
              functionName: 'balanceOf',
              args: [account.address],
            });
      return Number(balance) / 10 ** decimals;
    } catch (e) {
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
      address: SEPOLIA_CONTRACT_ADDRESS,
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

  const fetchUserPayment = async (id: string, ignoreErrors?: boolean) => {
    const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
    const raw = await readContract('userPayments', [xId], ignoreErrors);
    const details = await readContract(
      'getUserPaymentDetails',
      [xId],
      ignoreErrors
    );
    if (!raw || !details) return null;
    // the following was just to reduce the number of code lines
    const [payableId, payer, payableChainId, chainCount, payerCount] = raw;
    const [payableCount, timestamp] = raw.splice(5);
    return {
      ...{ payableId, payer, payableChainId, chainCount, payerCount },
      ...{ details, payableCount, timestamp },
    };
  };

  const fetchPayablePayment = async (id: string, ignoreErrors?: boolean) => {
    const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
    const raw = await readContract('payablePayments', [xId], ignoreErrors);
    const details = await readContract(
      'getPayablePaymentDetails',
      [xId],
      ignoreErrors
    );
    if (!raw || !details) return null;
    // the following was just to reduce the number of code lines
    const [payableId, payer, payerChainId, localChainCount, payableCount] = raw;
    const [payerCount, timestamp] = raw.splice(5);
    return {
      ...{ payableId, payer, payerChainId, localChainCount, payableCount },
      ...{ payerCount, timestamp, details },
    };
  };

  const fetchWithdrawal = async (id: string, ignoreErrors?: boolean) => {
    const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
    const raw = await readContract('withdrawals', [xId], ignoreErrors);
    const details = await readContract(
      'getWithdrawalDetails',
      [xId],
      ignoreErrors
    );
    if (!raw || !details) return null;
    const [payableId, host, chainCount, hostCount, payableCount] = raw;
    return {
      ...{ payableId, host, chainCount, hostCount, payableCount },
      ...{ timestamp: raw[5], details },
    };
  };

  const getCurrentUser = async () => {
    if (!account.connected) return null;
    const raw = await readContract('users', [account.address!]);
    if (raw) return User.fromEvm(account.address!, raw);
    return null;
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

  const getPayableWithdrawalId = async (
    payableId: string,
    count: number
  ): Promise<string | null> => {
    if (!payableId.startsWith('0x')) payableId = `0x${payableId}`;
    const id = await readContract('payableWithdrawalIds', [
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

    if (!details['Ethereum Sepolia']) {
      toastError('Token not supported on Ethereum Sepolia for now');
      return null;
    }

    const token = details['Ethereum Sepolia'].address as `0x${string}`;
    if (token != SEPOLIA_CONTRACT_ADDRESS) {
      const approval = await rawWriteContract({
        address: token,
        abi: erc20ABI,
        functionName: 'approve',
        args: [SEPOLIA_CONTRACT_ADDRESS, amount],
      });
      if (approval) await approval.wait();
      else return null;
    }

    const { hash, wait } = await rawWriteContract({
      address: SEPOLIA_CONTRACT_ADDRESS,
      abi,
      functionName: 'pay',
      args: [payableId, token, BigInt(amount)],
      ...(token == SEPOLIA_CONTRACT_ADDRESS ? { value: BigInt(amount) } : {}),
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
    args: AbiArgs = [],
    ignoreErrors = false
  ): Promise<any> => {
    try {
      return await publicClient.readContract({
        address: SEPOLIA_CONTRACT_ADDRESS,
        abi,
        functionName,
        args,
      });
    } catch (e) {
      if (!ignoreErrors) {
        console.error(e);
        toastError(`${e}`);
      }
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

  const walletExplorerUrl = (wallet: string) =>
    `https://sepolia.etherscan.io/address/${wallet}`;

  const withdraw = async (
    payableId: string,
    { amount, details }: TokenAndAmount
  ): Promise<OnChainSuccess | null> => {
    if (!account.connected) {
      toastError('Connect EVM Wallet First!');
      return null;
    }
    if (!details['Ethereum Sepolia']) {
      toastError('Token not supported on Ethereum Sepolia for now');
      return null;
    }
    const { hash, wait } = await rawWriteContract({
      address: SEPOLIA_CONTRACT_ADDRESS,
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
    getPayableWithdrawalId,
    getUserPayableId,
    getUserPaymentId,
    getUserWithdrawalId,
    readContract,
    pay,
    sign,
    walletExplorerUrl,
    withdraw,
  };
});
