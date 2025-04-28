import { contracts, megaethtestnet, OnChainSuccess, TokenAndAmount, User, type Token } from '@/schemas';
import { abi, erc20Abi, useAnalyticsStore } from '@/stores';
import {
  createConfig,
  getBalance,
  readContract as rawReadContract,
  signMessage,
  simulateContract,
  waitForTransactionReceipt,
} from '@wagmi/core';
import { useAccount } from '@wagmi/vue';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import {
  createWalletClient,
  custom,
  http,
  parseEventLogs,
  zeroAddress,
  type Abi,
  type ContractEventArgs,
  type ContractEventName,
  type TransactionReceipt,
} from 'viem';
import { megaethTestnet } from 'viem/chains';

interface WriteContractResponse {
  hash: string;
  receipt: TransactionReceipt;
  result: any;
}

export const useEvmStore = defineStore('evm', () => {
  const account = useAccount();
  const analytics = useAnalyticsStore();
  const config = createConfig({
    chains: [megaethTestnet],
    transports: {
      [megaethTestnet.id]: http(),
    },
  });
  const toast = useToast();

  /** Returns UI-Formatted balance (Accounts for Decimals) */
  const balance = async (token: Token): Promise<number | null> => {
    if (!account.address.value) return null;
    if (!token.details.megaethtestnet) return null;
    const { address: addr, decimals } = token.details.megaethtestnet;
    try {
      const balance =
        addr == contracts.megaethtestnet
          ? (await getBalance(config, { address: account.address.value })).value
          : await rawReadContract(config, {
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
      analytics.recordEvent('initiated_evm_transaction');
      const { result, request } = await simulateContract(config, {
        address,
        abi,
        functionName,
        args,
        account: account.address.value,
        ...(value ? { value: BigInt(value) } : {}),
      });
      const hash = await createWalletClient({
        chain: megaethTestnet,
        transport: custom((window as any).ethereum),
      }).writeContract(request);
      const receipt = await waitForTransactionReceipt(config, { hash });
      analytics.recordEvent('completed_evm_transaction');
      return { hash, receipt, result };
    } catch (e: any) {
      if (!`${e}`.toLowerCase().includes('user rejected')) {
        toastError(
          `${e}`.toLowerCase().includes('failed to fetch') ? 'Network Error' : (e['details'] ?? `${e}`).split('()')[0] // Message just before the EVM Revert error
        );
        analytics.recordEvent('failed_evm_transaction');
        console.error(e);
      } else {
        analytics.recordEvent('rejected_evm_transaction');
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

  const createPayable = async (tokensAndAmounts: TokenAndAmount[]): Promise<OnChainSuccess | null> => {
    const response = await writeContract({
      address: contracts.megaethtestnet as `0x${string}`,
      abi,
      functionName: 'createPayable',
      // default false is for autoWithdraw status as false
      args: [tokensAndAmounts.map((t) => t.toOnChain(megaethtestnet)), false],
    });
    if (!response) return null;
    return new OnChainSuccess({
      created: extractNewId(response.receipt.logs, 'CreatedPayable', 'payableId'),
      txHash: response.hash,
      chain: megaethtestnet,
    });
  };

  const fetchPayable = async (id: string, ignoreErrors?: boolean) => {
    const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
    const raw = await readContract('getPayable', [xId], ignoreErrors);
    const aTAAs = await readContract('getAllowedTokensAndAmounts', [xId], ignoreErrors);
    const balances = await readContract('getBalances', [xId], ignoreErrors);
    if (!raw || !aTAAs || !balances) return null;
    return { allowedTokensAndAmounts: aTAAs, balances, ...raw };
  };

  const fetchEntity = async (
    entity: 'UserPayment' | 'PayablePayment' | 'Withdrawal',
    id: string,
    ignoreErrors?: boolean
  ) => await readContract(`get${entity}`, [id as `0x${string}`], ignoreErrors);

  const getCurrentUser = async () => {
    let addr = (account.address.value ?? '').toLowerCase() as `0x${string}`;
    if (!addr) return null;
    let raw;
    try {
      raw = await readContract('getUser', [addr], false, true);
    } catch (e) {
      if (`${e}`.includes('InvalidWalletAddress')) {
        // Is New User, return the default
        return new User(megaethtestnet, addr, null);
      } else {
        console.error(e);
        toastError(`${e}`);
      }
    }
    if (!raw) return null;
    return new User(megaethtestnet, addr, raw);
  };

  const getPayablePaymentId = async (payableId: string, count: number): Promise<string | null> => {
    if (!payableId.startsWith('0x')) payableId = `0x${payableId}`;
    const id = await readContract('payablePaymentIds', [payableId as `0x${string}`, count - 1]);
    if (!id || id === zeroAddress) return null;
    return id;
  };

  const getPayableWithdrawalId = async (payableId: string, count: number): Promise<string | null> => {
    if (!payableId.startsWith('0x')) payableId = `0x${payableId}`;
    const id = await readContract('payableWithdrawalIds', [payableId as `0x${string}`, count - 1]);
    if (!id || id === zeroAddress) return null;
    return id;
  };

  const getUserEntityId = async (entity: string, count: number): Promise<string | null> => {
    if (!account.address.value) return null;
    const setNames = `user${entity}Ids`;
    const id = await readContract(setNames, [account.address.value, count]);
    if (!id || id === zeroAddress) return null;
    return id;
  };

  const getUserPayableId = async (count: number) => getUserEntityId('Payable', count - 1);

  const getUserPaymentId = async (count: number) => getUserEntityId('Payment', count - 1);

  const getUserWithdrawalId = async (count: number) => getUserEntityId('Withdrawal', count - 1);

  const pay = async (payableId: string, { amount, details }: TokenAndAmount): Promise<OnChainSuccess | null> => {
    if (!details.megaethtestnet) {
      toastError('Token not supported on EVM for now');
      return null;
    }

    const token = details.megaethtestnet.address as `0x${string}`;
    // Check if enough allowance
    if (token != contracts.megaethtestnet) {
      const allowance = await rawReadContract(config, {
        address: token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account.address.value!, contracts.megaethtestnet as `0x${string}`],
      });
      // Request Approval if not enough allowance
      if (!allowance || Number(allowance) < amount) {
        const approval = await writeContract({
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [contracts.megaethtestnet, amount],
        });
        if (!approval) return null;
      }
    }

    const response = await writeContract({
      address: contracts.megaethtestnet as `0x${string}`,
      abi,
      functionName: 'pay',
      args: [payableId, token, BigInt(amount)],
      ...(token == contracts.megaethtestnet ? { value: amount } : {}),
    });
    if (!response) return null;
    return new OnChainSuccess({
      created: extractNewId(response.receipt.logs, 'UserPaid', 'paymentId'),
      txHash: response.hash,
      chain: megaethtestnet,
    });
  };

  const readContract = async (
    functionName: any,
    args: any,
    ignoreErrors = false,
    rethrowError = false
  ): Promise<any> => {
    try {
      // @ts-ignore
      return await rawReadContract(config, {
        address: contracts.megaethtestnet as `0x${string}`,
        abi,
        functionName,
        args,
      });
    } catch (e) {
      if (rethrowError) throw e;
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

    try {
      return await signMessage(config, { message });
    } catch (e) {
      const detail = `${e}`.toLocaleLowerCase().includes('rejected')
        ? 'Please Sign to Continue'
        : `Couldn't sign: ${e}`;
      toastError(detail);
      return null;
    }
  };

  const toastError = (detail: string) => toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const withdraw = async (payableId: string, { amount, details }: TokenAndAmount): Promise<OnChainSuccess | null> => {
    if (!details.megaethtestnet) {
      toastError('Token not supported on EVM for now');
      return null;
    }
    const response = await writeContract({
      address: contracts.megaethtestnet as `0x${string}`,
      abi,
      functionName: 'withdraw',
      args: [payableId, details.megaethtestnet.address, amount],
    });
    if (!response) return null;
    return new OnChainSuccess({
      created: extractNewId(response.receipt.logs, 'Withdrew', 'withdrawalId'),
      txHash: response.hash,
      chain: megaethtestnet,
    });
  };

  return {
    balance,
    createPayable,
    fetchPayable,
    fetchEntity,
    getCurrentUser,
    getPayablePaymentId,
    getPayableWithdrawalId,
    getUserPayableId,
    getUserPaymentId,
    getUserWithdrawalId,
    readContract,
    pay,
    sign,
    withdraw,
  };
});
