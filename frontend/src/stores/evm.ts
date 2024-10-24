import {
  OnChainSuccess,
  SEPOLIA_CONTRACT_ADDRESS,
  TokenAndAmount,
  User,
  type Token,
} from '@/schemas';
import { abi, erc20Abi } from '@/stores';
import { useAccount, useSignMessage } from '@wagmi/vue';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEventLogs,
  zeroAddress,
  type Abi,
  type ContractEventArgs,
  type ContractEventName,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type TransactionReceipt,
} from 'viem';
import { sepolia } from 'viem/chains';
import { ref } from 'vue';

export type AbiFunctionName = ContractFunctionName<typeof abi, 'pure' | 'view'>;
export type AbiArgs = ContractFunctionArgs<
  typeof abi,
  'pure' | 'view',
  AbiFunctionName
>;

interface WriteContractResponse {
  hash: string;
  receipt: TransactionReceipt;
  result: any;
}

export const useEvmStore = defineStore('evm', () => {
  const account = useAccount();
  const pendingSignature = ref<Promise<void> | null>(null);
  const pendingSigResolve = ref<(() => void) | null>(null);
  const latestSignature = ref<string | null>(null);
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });
  const { signMessage } = useSignMessage({
    mutation: {
      onSettled: () => {
        if (pendingSigResolve.value) {
          pendingSigResolve.value();
          pendingSigResolve.value = null;
        }
      },
      onSuccess: (signature) => {
        latestSignature.value = signature;
      },
      onError: (e) => {
        const detail = `${e}`.toLocaleLowerCase().includes('rejected')
          ? 'Please Sign to Continue'
          : `Couldn't sign: ${e}`;
        toastError(detail);
        latestSignature.value = null;
      },
    },
  });
  const toast = useToast();

  /** Returns UI-Formatted balance (Accounts for Decimals) */
  const balance = async (token: Token): Promise<number | null> => {
    if (!account.address.value) return null;
    if (!token.details['Ethereum Sepolia']) return null;
    const { address: addr, decimals } = token.details['Ethereum Sepolia'];
    try {
      const balance =
        addr == SEPOLIA_CONTRACT_ADDRESS
          ? await publicClient.getBalance({ address: account.address.value })
          : await publicClient.readContract({
              address: addr as `0x${string}`,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [account.address.value],
            });
      return Number(balance) / 10 ** decimals;
    } catch (e) {
      toastError(`Couldn't fetch ${token.name} balance: ${e}`);
      return null;
    }
  };

  const writeContract = async ({
    address,
    abi,
    functionName,
    args,
    value,
  }: {
    address: `0x${string}`;
    abi: Abi;
    functionName: any;
    args: any;
    value?: number;
  }): Promise<WriteContractResponse | null> => {
    if (!account.address.value) {
      toastError('Connect EVM Wallet First!');
      return null;
    }

    try {
      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom((window as any).ethereum),
      });
      const [account] = await walletClient.getAddresses();
      const { result, request } = await publicClient.simulateContract({
        address,
        abi,
        functionName,
        args,
        account,
        ...(value ? { value: BigInt(value) } : {}),
      });
      const hash = await walletClient.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return { hash, receipt, result };
    } catch (e: any) {
      if (!`${e}`.toLowerCase().includes('user rejected')) {
        toastError(
          `${e}`.toLowerCase().includes('failed to fetch')
            ? 'Network Error'
            : (e['message'] ?? e['details'] ?? e['shortMessage'] ?? `${e}`)
        );
      }
      return null;
    }
  };

  const extractNewId = (
    logs: any[],
    eventName: ContractEventName<typeof abi>,
    idField: ContractEventArgs<typeof abi>
  ) =>
    (
      parseEventLogs({
        logs,
        abi,
        eventName: [eventName],
      })[0].args as any
    )[idField as any];

  const createPayable = async (
    tokensAndAmounts: TokenAndAmount[]
  ): Promise<OnChainSuccess | null> => {
    const response = await writeContract({
      address: SEPOLIA_CONTRACT_ADDRESS,
      abi,
      functionName: 'createPayable',
      args: [tokensAndAmounts.map((t) => t.toOnChain('Ethereum Sepolia'))],
    });
    if (!response) return null;
    return new OnChainSuccess({
      created: extractNewId(
        response.receipt.logs,
        'CreatedPayable',
        'payableId'
      ),
      txHash: response.hash,
      chain: 'Ethereum Sepolia',
    });
  };

  const fetchPayable = async (id: string, ignoreErrors?: boolean) => {
    const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
    const raw = await readContract('payables', [xId], ignoreErrors);
    const aTAAs = await readContract(
      'getAllowedTokensAndAmounts',
      [xId],
      ignoreErrors
    );
    const balances = await readContract('getBalances', [xId], ignoreErrors);
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
    const addr = account.address.value;
    if (!addr) return null;
    const raw = await readContract('users', [addr]);
    if (!raw) return null;
    return User.fromEvm(addr.toLowerCase(), walletExplorerUrl(addr), raw);
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
    if (!account.address.value) return null;
    const setNames = `user${entity}Ids` as AbiFunctionName;
    const id = await readContract(setNames, [account.address.value, count]);
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
    if (!details['Ethereum Sepolia']) {
      toastError('Token not supported on Ethereum Sepolia for now');
      return null;
    }

    const token = details['Ethereum Sepolia'].address as `0x${string}`;
    // Check if enough allowance
    if (token != SEPOLIA_CONTRACT_ADDRESS) {
      const allowance = await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account.address.value!, SEPOLIA_CONTRACT_ADDRESS],
      });
      // Request Approval if not enough allowance
      if (!allowance || Number(allowance) < amount) {
        const approval = await writeContract({
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [SEPOLIA_CONTRACT_ADDRESS, amount],
        });
        if (!approval) return null;
      }
    }

    const response = await writeContract({
      address: SEPOLIA_CONTRACT_ADDRESS,
      abi,
      functionName: 'pay',
      args: [payableId, token, BigInt(amount)],
      ...(token == SEPOLIA_CONTRACT_ADDRESS ? { value: amount } : {}),
    });
    if (!response) return null;
    return new OnChainSuccess({
      created: extractNewId(response.receipt.logs, 'UserPaid', 'paymentId'),
      txHash: response.hash,
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
    if (!account.address.value) {
      toastError('Connect EVM Wallet First!');
      return null;
    }
    if (!pendingSignature.value) {
      pendingSignature.value = new Promise((resolve) => {
        signMessage({ message });
        pendingSigResolve.value = resolve;
      });
    }
    await pendingSignature.value;
    return latestSignature.value;
  };

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const walletExplorerUrl = (wallet: string) =>
    `https://sepolia.etherscan.io/address/${wallet}`;

  const withdraw = async (
    payableId: string,
    { amount, details }: TokenAndAmount
  ): Promise<OnChainSuccess | null> => {
    if (!details['Ethereum Sepolia']) {
      toastError('Token not supported on Ethereum Sepolia for now');
      return null;
    }
    const response = await writeContract({
      address: SEPOLIA_CONTRACT_ADDRESS,
      abi,
      functionName: 'withdraw',
      args: [payableId, details['Ethereum Sepolia'].address, amount],
    });
    if (!response) return null;
    return new OnChainSuccess({
      created: extractNewId(response.receipt.logs, 'Withdrew', 'withdrawalId'),
      txHash: response.hash,
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
