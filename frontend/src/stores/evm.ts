import {
  basecamptestnet,
  contracts,
  megaethtestnet,
  OnChainSuccess,
  TokenAndAmount,
  User,
  type Chain,
  type ChainName,
  type Token,
} from '@/schemas';
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
  type Chain as ViemChain,
} from 'viem';
import { basecampTestnet, megaethTestnet } from 'viem/chains';

interface WriteContractResponse {
  hash: string;
  receipt: TransactionReceipt;
  result: any;
}

export const useEvmStore = defineStore('evm', () => {
  const account = useAccount();
  const analytics = useAnalyticsStore();
  const toast = useToast();

  /** Call only when a user is signed in */
  const getConfig = () => {
    const chain = account.chain.value!;
    return createConfig({ chains: [chain], transports: { [chain.id]: http() } });
  };

  const getViemChain = (chainName: ChainName): ViemChain => {
    if (chainName == 'basecamptestnet') return basecampTestnet;
    else if (chainName == 'megaethtestnet') return megaethTestnet;
    else throw new Error(`Unsupported EVM Chain: ${chainName}`);
  };

  const getCurrentChain = (): Chain | null => {
    if (!account.chain.value) return null;
    return {
      [basecampTestnet.id]: basecamptestnet,
      [megaethTestnet.id]: megaethtestnet,
    }[account.chain.value.id]!;
  };

  /** Returns UI-Formatted balance (Auto-Accounts for Decimals) */
  const balance = async (token: Token): Promise<number | null> => {
    if (!account.address.value) return null;
    const chain = getCurrentChain();
    if (!chain) return null;
    if (!token.details[chain.name]) return null;
    const { address: addr, decimals } = token.details[chain.name]!;
    const config = getConfig();
    try {
      const balance =
        addr == contracts[chain.name]
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
      const config = getConfig();
      const { result, request } = await simulateContract(config, {
        address,
        abi,
        functionName,
        args,
        account: account.address.value,
        ...(value ? { value: BigInt(value) } : {}),
      });
      const hash = await createWalletClient({
        chain: account.chain.value,
        transport: custom((window as any).ethereum),
      }).writeContract(request);
      const receipt = await waitForTransactionReceipt(config, { hash });
      await new Promise((resolve => setTimeout(resolve, 3000))); // Wait more for confirmations
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
    const chain = getCurrentChain();
    if (!chain) {
      toastError('Connect EVM Wallet First!');
      return null;
    }

    const response = await writeContract({
      address: contracts[chain.name] as `0x${string}`,
      abi,
      functionName: 'createPayable',
      // default false is for autoWithdraw status as false
      args: [tokensAndAmounts.map((t) => t.toOnChain(chain)), false],
    });
    if (!response) return null;
    return new OnChainSuccess({
      created: extractNewId(response.receipt.logs, 'CreatedPayable', 'payableId'),
      txHash: response.hash,
      chain,
    });
  };

  const fetchPayable = async (id: string, chainName: ChainName, ignoreErrors?: boolean) => {
    const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
    const raw = await readContract('getPayable', [xId], chainName, ignoreErrors);
    const aTAAs = await readContract('getAllowedTokensAndAmounts', [xId], chainName, ignoreErrors);
    const balances = await readContract('getBalances', [xId], chainName, ignoreErrors);
    if (!raw || !aTAAs || !balances) return null;
    return { allowedTokensAndAmounts: aTAAs, balances, ...raw };
  };

  const fetchEntity = async (
    entity: 'UserPayment' | 'PayablePayment' | 'Withdrawal',
    id: string,
    chainName?: ChainName,
    ignoreErrors?: boolean
  ) => await readContract(`get${entity}`, [id as `0x${string}`], chainName, ignoreErrors);

  const getCurrentUser = async () => {
    let addr = (account.address.value ?? '').toLowerCase() as `0x${string}`;
    if (!addr) return null;

    const chain = getCurrentChain();
    if (!chain) return null;

    let raw;
    try {
      raw = await readContract('getUser', [addr], chain.name, false, true);
    } catch (e) {
      if (`${e}`.includes('InvalidWalletAddress')) {
        // Is New User, return the default
        return new User(chain, addr, null);
      } else {
        console.error(e);
        toastError(`${e}`);
      }
    }
    if (!raw) return null;
    return new User(chain, addr, raw);
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
    const chain = getCurrentChain();
    if (!chain) {
      toastError('Connect EVM Wallet First!');
      return null;
    }

    if (!details[chain.name]) {
      toastError(`Token not supported on ${chain.displayName} for now`);
      return null;
    }

    const token = details[chain.name]!.address as `0x${string}`;
    // Check if enough allowance
    if (token != contracts[chain.name]) {
      const viemChain = getViemChain(chain.name);
      const config = createConfig({ chains: [viemChain], transports: { [viemChain.id]: http() } });
      const allowance = await rawReadContract(config, {
        address: token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account.address.value!, contracts[chain.name] as `0x${string}`],
      });
      // Request Approval if not enough allowance
      if (!allowance || Number(allowance) < amount) {
        const approval = await writeContract({
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [contracts[chain.name], amount],
        });
        if (!approval) return null;
      }
    }

    const response = await writeContract({
      address: contracts[chain.name] as `0x${string}`,
      abi,
      functionName: 'pay',
      args: [payableId, token, BigInt(amount)],
      ...(token == contracts[chain.name] ? { value: amount } : {}),
    });
    if (!response) return null;
    return new OnChainSuccess({
      created: extractNewId(response.receipt.logs, 'UserPaid', 'paymentId'),
      txHash: response.hash,
      chain,
    });
  };

  const readContract = async (
    functionName: any,
    args: any,
    chainName?: ChainName,
    ignoreErrors = false,
    rethrowError = false
  ): Promise<any> => {
    if (!chainName) chainName = getCurrentChain()?.name;
    if (!chainName) {
      toastError('Specify the EVM Chain to read data from');
      return null;
    }

    const viemChain = getViemChain(chainName);
    const config = createConfig({ chains: [viemChain], transports: { [viemChain.id]: http() } });

    try {
      // @ts-ignore
      return await rawReadContract(config, {
        address: contracts[chainName] as `0x${string}`,
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
      return await signMessage(getConfig(), { message, connector: account.connector.value });
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
    const chain = getCurrentChain();
    if (!chain) {
      toastError('Connect EVM Wallet First!');
      return null;
    }

    if (!details[chain.name]) {
      toastError(`Token not supported on ${chain.displayName} for now`);
      return null;
    }

    const response = await writeContract({
      address: contracts[chain.name] as `0x${string}`,
      abi,
      functionName: 'withdraw',
      args: [payableId, details[chain.name]!.address, amount],
    });
    if (!response) return null;
    return new OnChainSuccess({
      created: extractNewId(response.receipt.logs, 'Withdrew', 'withdrawalId'),
      txHash: response.hash,
      chain,
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
    pay,
    sign,
    withdraw,
  };
});
