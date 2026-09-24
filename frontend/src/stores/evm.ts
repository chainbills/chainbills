// stores/evm.ts
//
// The EVM read/write gateway: every on-chain call to an EVM Chainbills
// deployment (MegaETH, Arc Testnet, Sepolia) goes through this store.
//
// Reads never require a connected wallet: `publicClientFor(chainName)`
// hands out one cached viem `PublicClient` per chain (`http()` transport,
// no wallet), and `readGetter` is a thin wrapper around it for the diamond
// contract (`chainbillsAbi`) at `contracts[chainName]`. Every other read
// helper in this file (`fetchPayable`, the bulk getters, the paginated
// id-list wrappers, the chain-probing helpers) is built on top of it.
//
// Writes go through `writeContract`, which needs a connected wallet
// (wagmi). It reports the phases of a single transaction — simulate,
// wallet prompt, hash received, receipt confirmed — onto the `TxStepHandle`s
// a caller passes in (see `stores/tx-flow.ts`), so the UI can render
// step-by-step progress instead of one opaque spinner. A wallet rejection
// cancels the whole flow (via the optional `TxFlowHandle`) with no error
// toast; any other failure fails the active step and still shows the
// existing toast.
//
// Used by: `stores/payable.ts`, `stores/payment.ts`, `stores/withdrawal.ts`,
// `stores/activity.ts`, `stores/stats.ts`, `stores/auth.ts` (all reads and
// writes for EVM chains funnel through here).
import {
  arctestnet,
  chainNamesEvm,
  contracts,
  megaeth as megaethInApp,
  OnChainSuccess,
  sepolia as sepoliaInApp,
  TokenAndAmount,
  User,
  getTxUrl,
  type Chain,
  type ChainName,
  type Token,
} from '@/schemas';
import { chainbillsAbi, erc20Abi, useAnalyticsStore } from '@/stores';
import type { TxFlowHandle, TxStepHandle } from '@/stores/tx-flow';
import {
  createConfig,
  getBalance,
  readContract as rawReadContract,
  writeContract as rawWriteContract,
  signMessage,
  simulateContract,
  waitForTransactionReceipt,
} from '@wagmi/core';
import { useAccount } from '@wagmi/vue';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import {
  createPublicClient,
  http,
  parseEventLogs,
  type Abi,
  type ContractEventArgs,
  type ContractEventName,
  type PublicClient,
  type TransactionReceipt,
  type Chain as ViemChain,
} from 'viem';
import { arcTestnet, megaeth as megaethViem, sepolia as sepoliaViem } from 'viem/chains';

interface WriteContractResponse {
  hash: string;
  receipt: TransactionReceipt;
  result: any;
}

/** The two step handles a write can report its phases onto. `confirm` defaults to `sign` when omitted (a single-step write, e.g. an ERC-20 approval). */
export interface WriteSteps {
  sign?: TxStepHandle;
  confirm?: TxStepHandle;
}

// Circle domain IDs per chain — used to fetch fast-transfer fee from Iris API and to build maxFee for CCTP burns.
const CIRCLE_DOMAINS: Partial<Record<ChainName, number>> = {
  sepolia: 0,
  arctestnet: 26,
};

const CIRCLE_IRIS_API = 'https://iris-api-sandbox.circle.com';

export const useEvmStore = defineStore('evm', () => {
  const account = useAccount();
  const analytics = useAnalyticsStore();
  const toast = useToast();

  /** One cached viem `PublicClient` per EVM chain, so every read can run without a connected wallet. */
  const publicClients = new Map<ChainName, PublicClient>();

  const getViemChain = (chainName: ChainName): ViemChain => {
    if (chainName == 'megaeth') return megaethViem;
    else if (chainName == 'arctestnet') return arcTestnet;
    else if (chainName == 'sepolia') return sepoliaViem;
    else throw new Error(`Unsupported EVM Chain: ${chainName}`);
  };

  /** Returns the cached read-only `PublicClient` for `chainName`, creating it on first use. */
  const publicClientFor = (chainName: ChainName): PublicClient => {
    let client = publicClients.get(chainName);
    if (!client) {
      client = createPublicClient({ chain: getViemChain(chainName), transport: http() });
      publicClients.set(chainName, client);
    }
    return client;
  };

  /** wagmi config for the *connected* chain, used only by writes/signing (never by reads). */
  const wagmiWriteConfig = () => {
    const chain = account.chain.value!;
    return createConfig({ chains: [chain], transports: { [chain.id]: http() } });
  };

  const getCurrentChain = (): Chain | null => {
    if (!account.chain.value) return null;
    return {
      [arcTestnet.id]: arctestnet,
      [megaethViem.id]: megaethInApp,
      [sepoliaViem.id]: sepoliaInApp,
    }[account.chain.value.id]!;
  };

  const toastError = (detail: string) => toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const logError = (e: any) => {
    if (e && typeof e === 'object' && 'abi' in e) {
      const { abi: _abi, ...rest } = e;
      console.error(rest);
    } else {
      console.error(e);
    }
  };

  /**
   * Reads a diamond view function on `chainName`, without needing a
   * connected wallet. Every single-entity getter (`getPayable`,
   * `getUserPayment`, ...) reverts when the entity does not exist — pass
   * `ignoreErrors: true` when that revert is an expected "not on this
   * chain" outcome (chain probing, bulk fallbacks) rather than a real
   * error worth toasting.
   */
  const readGetter = async (
    chainName: ChainName,
    functionName: string,
    args: any[] = [],
    opts?: { ignoreErrors?: boolean; rethrowError?: boolean }
  ): Promise<any> => {
    try {
      // functionName/args are dynamic across many call sites — cast the whole params object rather than
      // fight viem's per-function overload types; the ABI itself keeps the actual contract calls type-safe.
      return await publicClientFor(chainName).readContract({
        address: contracts[chainName] as `0x${string}`,
        abi: chainbillsAbi,
        functionName,
        args,
      } as any);
    } catch (e) {
      if (opts?.rethrowError) throw e;
      if (!opts?.ignoreErrors) {
        logError(e);
        toastError(`${e}`);
      }
      return null;
    }
  };

  /** Back-compat thin wrapper over `readGetter`, defaulting to the connected chain when none is given. */
  const readContract = async (
    functionName: any,
    args: any,
    chainName?: ChainName,
    ignoreErrors = false,
    rethrowError = false
  ): Promise<any> => {
    chainName ??= getCurrentChain()?.name;
    if (!chainName) {
      toastError('Specify the EVM Chain to read data from');
      return null;
    }
    return readGetter(chainName, functionName, args, { ignoreErrors, rethrowError });
  };

  /** Raw balance (smallest unit) of `token` for the connected wallet on its current chain. Null on error or no wallet/chain. */
  const balance = async (token: Token): Promise<bigint | null> => {
    if (!account.address.value) return null;
    const chain = getCurrentChain();
    if (!chain) return null;
    if (!token.details[chain.name]) return null;
    const { address: addr } = token.details[chain.name]!;
    const config = wagmiWriteConfig();
    try {
      if (addr == contracts[chain.name]) {
        return (await getBalance(config, { address: account.address.value })).value;
      }
      return await rawReadContract(config, {
        address: addr as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address.value],
      });
    } catch (e) {
      toastError(`Couldn't fetch ${token.name} balance: ${e}`);
      return null;
    }
  };

  const extractNewId = (
    logs: any[],
    eventName: ContractEventName<typeof chainbillsAbi>,
    idField: ContractEventArgs<typeof chainbillsAbi>
  ) =>
    (
      parseEventLogs({
        logs,
        abi: chainbillsAbi,
        eventName: [eventName],
      })[0].args as any
    )[idField as any];

  /**
   * Extracts the `PayableUpdateBroadcasted(payableId, nonce, actionType)`
   * event from a write's receipt logs, when one was emitted (every payable
   * write except `updatePayableAutoWithdraw`, which does not broadcast).
   * Used by `payable.trackSync` right after a create/close/reopen/
   * updateTokens write to know which nonce to poll for on other chains.
   */
  const extractBroadcastNonce = (logs: any[]): bigint | null => {
    const events = parseEventLogs({ logs, abi: chainbillsAbi, eventName: ['PayableUpdateBroadcasted'] });
    return events.length ? BigInt((events[0].args as any).nonce) : null;
  };

  /** Reads the Wormhole message fee (in wei) a write must send as `msg.value` on `chainName`. `0n` on a chain with no Wormhole. */
  const fetchWormholeFee = async (chainName: ChainName): Promise<bigint | null> => {
    try {
      const fee = await readGetter(chainName, 'getWormholeMessageFee', [], { rethrowError: true });
      return fee != null ? BigInt(fee as any) : 0n;
    } catch {
      // Contract not set up or Wormhole address misconfigured — treat as 0 fee.
      // The subsequent writeContract will surface the real revert reason.
      return 0n;
    }
  };

  /**
   * Sends one write transaction and reports its phases onto `steps`:
   * 1. `sign` step goes `active` ("Checking the transaction will succeed…")
   *    while the call is simulated, then `waiting` ("Confirm in your
   *    wallet") once the wallet prompt is open, then `done` with the
   *    tx hash the instant it is returned.
   * 2. `confirm` step (defaults to `sign` when not given — a single-step
   *    write like an ERC-20 approval) goes `active` ("Confirming on
   *    {chain}…") while waiting for the receipt, then shows "Finalizing…"
   *    during the fixed 3s settle delay, then `done`.
   *
   * A wallet rejection cancels `flow` (no step failure, no error toast).
   * Any other failure fails the step the error happened in and keeps the
   * existing error toast.
   */
  const writeContract = async (
    {
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
      value?: bigint;
    },
    steps?: WriteSteps,
    flow?: TxFlowHandle
  ): Promise<WriteContractResponse | null> => {
    if (!account.address.value) {
      toastError('Connect EVM Wallet First!');
      return null;
    }

    const chain = getCurrentChain();
    const confirmStep = steps?.confirm ?? steps?.sign;

    try {
      analytics.recordEvent('initiated_evm_transaction');
      steps?.sign?.activate('Checking the transaction will succeed…');
      const config = wagmiWriteConfig();
      const { result, request } = await simulateContract(config, {
        address,
        abi,
        functionName,
        args,
        account: account.address.value,
        ...(value ? { value } : {}),
      });
      request.chainId = config.chains[0].id as any;
      (request as any).connector = account.connector.value;

      steps?.sign?.wait('Confirm in your wallet');
      const hash = await rawWriteContract(config, request);
      const explorerUrl = chain ? getTxUrl(hash, chain) : undefined;
      steps?.sign?.done({ txHash: hash, explorerUrl });

      confirmStep?.activate(chain ? `Confirming on ${chain.displayName}…` : 'Confirming…');
      if (confirmStep && confirmStep !== steps?.sign) confirmStep.progress({ txHash: hash, explorerUrl });
      const receipt = await waitForTransactionReceipt(config, { hash });

      confirmStep?.progress({ description: 'Finalizing…' });
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait more for confirmations
      analytics.recordEvent('completed_evm_transaction');
      confirmStep?.done({ txHash: hash, explorerUrl });
      return { hash, receipt, result };
    } catch (e: any) {
      const raw = `${e}`.toLowerCase();
      if (!raw.includes('user rejected')) {
        const message = raw.includes('failed to fetch')
          ? 'Network Error'
          : (e['details'] ?? e['shortMessage'] ?? e['message'] ?? `${e}`).split('()')[0];
        toastError(message);
        (confirmStep ?? steps?.sign)?.fail(message);
        const errorType = raw.includes('insufficient') ? 'insufficient_funds'
          : raw.includes('revert') ? 'contract_revert'
          : raw.includes('failed to fetch') ? 'network_error'
          : 'unknown';
        analytics.recordEvent('failed_evm_transaction', {
          error_type: errorType,
          chain: chain?.name,
          message: message.slice(0, 200),
        });
        logError(e);
      } else {
        flow?.cancel();
        analytics.recordEvent('rejected_evm_transaction', { chain: chain?.name });
      }
      return null;
    }
  };

  const createPayable = async (
    tokensAndAmounts: TokenAndAmount[],
    isAutoWithdraw: boolean,
    steps?: WriteSteps,
    flow?: TxFlowHandle
  ): Promise<OnChainSuccess | null> => {
    const chain = getCurrentChain();
    if (!chain) {
      toastError('Connect EVM Wallet First!');
      return null;
    }

    const wormholeFee = await fetchWormholeFee(chain.name);
    if (wormholeFee === null) return null;

    const response = await writeContract(
      {
        address: contracts[chain.name] as `0x${string}`,
        abi: chainbillsAbi,
        functionName: 'createPayable',
        args: [tokensAndAmounts.map((t) => t.toOnChain(chain)), isAutoWithdraw],
        value: wormholeFee,
      },
      steps,
      flow
    );
    if (!response) return null;
    return new OnChainSuccess({
      created: extractNewId(response.receipt.logs, 'CreatedPayable', 'payableId'),
      txHash: response.hash,
      chain,
      broadcastNonce: extractBroadcastNonce(response.receipt.logs) ?? undefined,
    });
  };

  /** Closes a payable to new payments. Sends the exact Wormhole fee as `msg.value` (0 on a chain with no Wormhole). */
  const closePayable = async (id: string, steps?: WriteSteps, flow?: TxFlowHandle): Promise<OnChainSuccess | null> => {
    const chain = getCurrentChain();
    if (!chain) {
      toastError('Connect EVM Wallet First!');
      return null;
    }
    const wormholeFee = await fetchWormholeFee(chain.name);
    if (wormholeFee === null) return null;

    const response = await writeContract(
      {
        address: contracts[chain.name] as `0x${string}`,
        abi: chainbillsAbi,
        functionName: 'closePayable',
        args: [id],
        value: wormholeFee,
      },
      steps,
      flow
    );
    if (!response) return null;
    return new OnChainSuccess({
      created: id,
      txHash: response.hash,
      chain,
      broadcastNonce: extractBroadcastNonce(response.receipt.logs) ?? undefined,
    });
  };

  /** Reopens a closed payable. Sends the exact Wormhole fee as `msg.value` (0 on a chain with no Wormhole). */
  const reopenPayable = async (id: string, steps?: WriteSteps, flow?: TxFlowHandle): Promise<OnChainSuccess | null> => {
    const chain = getCurrentChain();
    if (!chain) {
      toastError('Connect EVM Wallet First!');
      return null;
    }
    const wormholeFee = await fetchWormholeFee(chain.name);
    if (wormholeFee === null) return null;

    const response = await writeContract(
      {
        address: contracts[chain.name] as `0x${string}`,
        abi: chainbillsAbi,
        functionName: 'reopenPayable',
        args: [id],
        value: wormholeFee,
      },
      steps,
      flow
    );
    if (!response) return null;
    return new OnChainSuccess({
      created: id,
      txHash: response.hash,
      chain,
      broadcastNonce: extractBroadcastNonce(response.receipt.logs) ?? undefined,
    });
  };

  /** Replaces a payable's whole accepted-tokens list. Sends the exact Wormhole fee as `msg.value` (0 on a chain with no Wormhole). */
  const updatePayableAllowedTokensAndAmounts = async (
    id: string,
    tokensAndAmounts: TokenAndAmount[],
    steps?: WriteSteps,
    flow?: TxFlowHandle
  ): Promise<OnChainSuccess | null> => {
    const chain = getCurrentChain();
    if (!chain) {
      toastError('Connect EVM Wallet First!');
      return null;
    }
    const wormholeFee = await fetchWormholeFee(chain.name);
    if (wormholeFee === null) return null;

    const response = await writeContract(
      {
        address: contracts[chain.name] as `0x${string}`,
        abi: chainbillsAbi,
        functionName: 'updatePayableAllowedTokensAndAmounts',
        args: [id, tokensAndAmounts.map((t) => t.toOnChain(chain))],
        value: wormholeFee,
      },
      steps,
      flow
    );
    if (!response) return null;
    return new OnChainSuccess({
      created: id,
      txHash: response.hash,
      chain,
      broadcastNonce: extractBroadcastNonce(response.receipt.logs) ?? undefined,
    });
  };

  /** Toggles a payable's auto-withdraw setting. `nonpayable` — no Wormhole fee, and the change is never broadcast to other chains. */
  const updatePayableAutoWithdraw = async (
    id: string,
    isAutoWithdraw: boolean,
    steps?: WriteSteps,
    flow?: TxFlowHandle
  ): Promise<OnChainSuccess | null> => {
    const chain = getCurrentChain();
    if (!chain) {
      toastError('Connect EVM Wallet First!');
      return null;
    }
    const response = await writeContract(
      {
        address: contracts[chain.name] as `0x${string}`,
        abi: chainbillsAbi,
        functionName: 'updatePayableAutoWithdraw',
        args: [id, isAutoWithdraw],
      },
      steps,
      flow
    );
    if (!response) return null;
    return new OnChainSuccess({ created: id, txHash: response.hash, chain });
  };

  /** Reads a payable plus its allowed-tokens and balances in one round trip via multicall3, falling back to three parallel reads. */
  const fetchPayable = async (id: string, chainName: ChainName, ignoreErrors?: boolean) => {
    const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
    const client = publicClientFor(chainName);
    const address = contracts[chainName] as `0x${string}`;
    try {
      const [raw, aTAAs, balances] = await client.multicall({
        contracts: [
          { address, abi: chainbillsAbi, functionName: 'getPayable', args: [xId] },
          { address, abi: chainbillsAbi, functionName: 'getAllowedTokensAndAmounts', args: [xId] },
          { address, abi: chainbillsAbi, functionName: 'getBalances', args: [xId] },
        ] as const,
        allowFailure: false,
      });
      return { allowedTokensAndAmounts: aTAAs, balances, ...(raw as any) };
    } catch {
      // No multicall3 on this chain, or the batch itself reverted (e.g. the payable does not exist) — fall back to parallel single reads.
      const [raw, aTAAs, balances] = await Promise.all([
        readGetter(chainName, 'getPayable', [xId], { ignoreErrors }),
        readGetter(chainName, 'getAllowedTokensAndAmounts', [xId], { ignoreErrors }),
        readGetter(chainName, 'getBalances', [xId], { ignoreErrors }),
      ]);
      if (!raw || !aTAAs || !balances) return null;
      return { allowedTokensAndAmounts: aTAAs, balances, ...raw };
    }
  };

  const fetchEntity = async (
    entity: 'UserPayment' | 'PayablePayment' | 'Withdrawal',
    id: string,
    chainName?: ChainName,
    ignoreErrors?: boolean
  ) => await readContract(`get${entity}`, [id as `0x${string}`], chainName, ignoreErrors);

  const fetchForeignPayable = async (id: string, chainName: ChainName) => {
    const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
    return await readGetter(chainName, 'getForeignPayable', [xId], { ignoreErrors: true });
  };

  /**
   * Probes every EVM chain in parallel for an entity id, using the fact
   * that every single-entity `CbGetters` getter reverts when the id does
   * not exist on that chain (`reference/onchain-data.md` §5.3). Returns the
   * first chain (in `chainNamesEvm` order) whose read succeeded, plus that
   * raw on-chain struct — or `null` if the id exists on none of them.
   */
  const probeEntityChain = async (
    getterFn: 'getPayable' | 'getUserPayment' | 'getPayablePayment' | 'getWithdrawal' | 'getActivity',
    id: string
  ): Promise<{ chainName: ChainName; raw: any } | null> => {
    const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
    const results = await Promise.all(
      chainNamesEvm.map(async (chainName) => {
        const raw = await readGetter(chainName, getterFn, [xId], { ignoreErrors: true });
        return raw ? { chainName, raw } : null;
      })
    );
    return results.find((r) => r !== null) ?? null;
  };

  const getCurrentUser = async () => {
    const addr = (account.address.value ?? '') as `0x${string}`;
    if (!addr) return null;

    const chain = getCurrentChain();
    if (!chain) return null;

    let raw;
    try {
      raw = await readGetter(chain.name, 'getUser', [addr], { rethrowError: true });
    } catch (e) {
      if (`${e}`.includes('InvalidWalletAddress')) {
        // Is New User, return the default
        return new User(chain, addr, null);
      } else {
        logError(e);
        toastError(`${e}`);
      }
    }
    if (!raw) return null;
    return new User(chain, addr, raw);
  };

  /** Reads `getUser(address)` on `chainName`, or `null` if the wallet has no activity there — never toasts (that "no activity" case is expected). */
  const fetchUserOnChain = async (address: string, chainName: ChainName) =>
    await readGetter(chainName, 'getUser', [address], { ignoreErrors: true });

  const getUserPayableIdsPaginated = async (
    walletAddress: string,
    offset: number,
    count: number,
    chainName: ChainName
  ): Promise<string[] | null> => readGetter(chainName, 'getUserPayableIds', [walletAddress, offset, count]);

  const getUserPaymentIdsPaginated = async (
    walletAddress: string,
    offset: number,
    count: number,
    chainName: ChainName
  ): Promise<string[] | null> => readGetter(chainName, 'getUserPaymentIds', [walletAddress, offset, count]);

  const getUserWithdrawalIdsPaginated = async (
    walletAddress: string,
    offset: number,
    count: number,
    chainName: ChainName
  ): Promise<string[] | null> => readGetter(chainName, 'getUserWithdrawalIds', [walletAddress, offset, count]);

  const getUserActivityIdsPaginated = async (
    walletAddress: string,
    offset: number,
    count: number,
    chainName: ChainName
  ): Promise<string[] | null> => readGetter(chainName, 'getUserActivityIds', [walletAddress, offset, count]);

  const getPayablePaymentIdsPaginated = async (
    payableId: string,
    offset: number,
    count: number,
    chainName: ChainName
  ): Promise<string[] | null> =>
    readGetter(chainName, 'getPayablePaymentIds', [payableId as `0x${string}`, offset, count]);

  const getPayableWithdrawalIdsPaginated = async (
    payableId: string,
    offset: number,
    count: number,
    chainName: ChainName
  ): Promise<string[] | null> =>
    readGetter(chainName, 'getPayableWithdrawalIds', [payableId as `0x${string}`, offset, count]);

  const getPayableActivityIdsPaginated = async (
    payableId: string,
    offset: number,
    count: number,
    chainName: ChainName
  ): Promise<string[] | null> =>
    readGetter(chainName, 'getPayableActivityIds', [payableId as `0x${string}`, offset, count]);

  /** Payments a payable received *from a specific source chain* (used to locate the destination-side record of a cross-chain payment). */
  const getPayableChainPaymentIdsPaginated = async (
    payableId: string,
    sourceCbChainId: string,
    offset: number,
    count: number,
    chainName: ChainName
  ): Promise<string[] | null> =>
    readGetter(chainName, 'getPayableChainPaymentIds', [payableId, sourceCbChainId, offset, count]);

  const getPayableChainPaymentsCount = async (
    payableId: string,
    sourceCbChainId: string,
    chainName: ChainName
  ): Promise<bigint | null> => readGetter(chainName, 'getPayableChainPaymentCount', [payableId, sourceCbChainId]);

  const getChainActivityIdsPaginated = async (
    offset: number,
    count: number,
    chainName: ChainName
  ): Promise<string[] | null> => readGetter(chainName, 'getChainActivityIds', [offset, count]);

  const getChainPayableIdsPaginated = async (
    offset: number,
    count: number,
    chainName: ChainName
  ): Promise<string[] | null> => readGetter(chainName, 'getChainPayableIds', [offset, count]);

  const getChainUserAddressesPaginated = async (
    offset: number,
    count: number,
    chainName: ChainName
  ): Promise<string[] | null> => readGetter(chainName, 'getChainUserAddresses', [offset, count]);

  const getUserPaymentsBulk = async (ids: string[], chainName: ChainName): Promise<any[] | null> =>
    readGetter(chainName, 'getUserPaymentsBulk', [ids], { ignoreErrors: true });

  const getPayablePaymentsBulk = async (ids: string[], chainName: ChainName): Promise<any[] | null> =>
    readGetter(chainName, 'getPayablePaymentsBulk', [ids], { ignoreErrors: true });

  const getWithdrawalsBulk = async (ids: string[], chainName: ChainName): Promise<any[] | null> =>
    readGetter(chainName, 'getWithdrawalsBulk', [ids], { ignoreErrors: true });

  const getPayablesBulk = async (ids: string[], chainName: ChainName): Promise<any[] | null> =>
    readGetter(chainName, 'getPayablesBulk', [ids], { ignoreErrors: true });

  const getActivitiesBulk = async (ids: string[], chainName: ChainName): Promise<any[] | null> =>
    readGetter(chainName, 'getActivitiesBulk', [ids], { ignoreErrors: true });

  const getUsersBulk = async (wallets: string[], chainName: ChainName): Promise<any[] | null> =>
    readGetter(chainName, 'getUsersBulk', [wallets], { ignoreErrors: true });

  /** `getChainStats()` — chain-wide entity counters, used by `stores/stats.ts`. */
  const getChainStatsOnChain = async (chainName: ChainName): Promise<any | null> =>
    readGetter(chainName, 'getChainStats', []);

  /** `getConfig()` — Wormhole/CCTP wiring and the withdrawal fee, used by `stores/stats.ts`. */
  const fetchChainConfig = async (chainName: ChainName): Promise<any | null> => readGetter(chainName, 'getProtocolConfig', []);

  /** `getTokenDetails(token)` — per-token on-chain volume counters, used by `stores/stats.ts`. Reverts (returns null) for a token this chain has no details for. */
  const getTokenDetailsOnChain = async (tokenAddress: string, chainName: ChainName): Promise<any | null> =>
    readGetter(chainName, 'getTokenDetails', [tokenAddress], { ignoreErrors: true });

  /**
   * Reads `consumedPaymentNonces(sourceCbChainId, payerLeftPadded, payerCount)`
   * on the payable's chain — `true` once the relayer has delivered a
   * cross-chain payment. See `reference/onchain-data.md` §5.1.
   */
  const consumedPaymentNonce = async (
    payableChainName: ChainName,
    sourceCbChainId: string,
    payerLeftPadded: string,
    payerCount: bigint
  ): Promise<boolean> =>
    !!(await readGetter(payableChainName, 'isPaymentNonceConsumed', [sourceCbChainId, payerLeftPadded, payerCount], {
      ignoreErrors: true,
    }));

  /**
   * Reads `getForeignPayableUpdateNonce(payableId)` on a destination chain —
   * compares against the nonce from a `PayableUpdateBroadcasted` event to
   * know whether a payable's sync has landed there yet.
   */
  const payableUpdateNonce = async (destChainName: ChainName, payableId: string): Promise<bigint> =>
    BigInt(
      (await readGetter(destChainName, 'getForeignPayableUpdateNonce', [payableId], { ignoreErrors: true })) ?? 0n
    );

  const pay = async (
    payableId: string,
    { amount, details }: TokenAndAmount,
    steps?: WriteSteps & { approve?: TxStepHandle },
    flow?: TxFlowHandle
  ): Promise<OnChainSuccess | null> => {
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
      const client = publicClientFor(chain.name);
      const allowance = (await client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account.address.value!, contracts[chain.name] as `0x${string}`],
      })) as bigint;
      // Request Approval if not enough allowance
      if (allowance < amount) {
        analytics.recordEvent('approval_initiated', { chain: chain.name });
        const approval = await writeContract(
          { address: token, abi: erc20Abi, functionName: 'approve', args: [contracts[chain.name], amount] },
          { sign: steps?.approve },
          flow
        );
        if (!approval) return null;
        analytics.recordEvent('approval_completed', { chain: chain.name });
      } else {
        steps?.approve?.skip();
      }
    } else {
      steps?.approve?.skip();
    }

    const response = await writeContract(
      {
        address: contracts[chain.name] as `0x${string}`,
        abi: chainbillsAbi,
        functionName: 'pay',
        args: [payableId, token, amount],
        ...(token == contracts[chain.name] ? { value: amount } : {}),
      },
      steps,
      flow
    );
    if (!response) return null;
    return new OnChainSuccess({
      created: extractNewId(response.receipt.logs, 'UserPaid', 'paymentId'),
      txHash: response.hash,
      chain,
    });
  };

  /**
   * Estimates Circle CCTP's fast-transfer max fee (in USDC's smallest unit)
   * for burning `amount` from `sourceChainName` to `destChainName`, with a
   * 20% buffer so the actual attestation never comes back higher than what
   * the payer already approved. Reads the same Iris API `payForeignViaCctp`
   * sends the burn through; `0n` when either chain has no Circle domain
   * configured (`CIRCLE_DOMAINS`) or the API call fails — a payer on such a
   * pairing still gets a same-network cross-chain payment, just with no fee
   * buffer requested.
   */
  const estimateCctpFee = async (
    sourceChainName: ChainName,
    destChainName: ChainName,
    amount: bigint
  ): Promise<bigint> => {
    const srcDomain = CIRCLE_DOMAINS[sourceChainName];
    const dstDomain = CIRCLE_DOMAINS[destChainName];
    if (srcDomain === undefined || dstDomain === undefined) return 0n;
    try {
      const feeRes = await fetch(`${CIRCLE_IRIS_API}/v2/burn/USDC/fees/${srcDomain}/${dstDomain}`);
      if (!feeRes.ok) return 0n;
      const tiers: { finalityThreshold: number; minimumFee: number }[] = await feeRes.json();
      const fastTier = tiers.find((t) => t.finalityThreshold === 1000);
      const bps = fastTier?.minimumFee ?? 0;
      // fee = amount * bps / 10_000, add 20% buffer. Integer math on BigInt.
      return (amount * BigInt(bps) * 120n) / 1_000_000n;
    } catch {
      // Non-fatal: falls back to standard finality with maxFee=0.
      return 0n;
    }
  };

  const payForeignViaCctp = async (
    payableId: string,
    { amount, details }: TokenAndAmount,
    destChain: Chain,
    steps?: WriteSteps & { approve?: TxStepHandle },
    flow?: TxFlowHandle
  ): Promise<OnChainSuccess | null> => {
    const chain = getCurrentChain();
    if (!chain) {
      toastError('Connect EVM Wallet First!');
      return null;
    }

    if (!details[chain.name]) {
      toastError(`Token not supported on ${chain.displayName} for cross-chain payments`);
      return null;
    }

    const token = details[chain.name]!.address as `0x${string}`;

    const wormholeFee = await fetchWormholeFee(chain.name);
    if (wormholeFee === null) return null;

    const client = publicClientFor(chain.name);

    // maxFee is passed to depositForBurn so the payer covers the fee rather than the payable host.
    const maxFee = await estimateCctpFee(chain.name, destChain.name as ChainName, amount);

    const totalRequired = amount + maxFee;

    // Check / request ERC-20 approval for amount + maxFee.
    const allowance = (await client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address.value!, contracts[chain.name] as `0x${string}`],
    })) as bigint;
    if (allowance < totalRequired) {
      analytics.recordEvent('approval_initiated', { chain: chain.name });
      const approval = await writeContract(
        { address: token, abi: erc20Abi, functionName: 'approve', args: [contracts[chain.name], totalRequired] },
        { sign: steps?.approve },
        flow
      );
      if (!approval) return null;
      analytics.recordEvent('approval_completed', { chain: chain.name });
    } else {
      steps?.approve?.skip();
    }

    const response = await writeContract(
      {
        address: contracts[chain.name] as `0x${string}`,
        abi: chainbillsAbi,
        functionName: 'payForeignViaCctp',
        args: [payableId, token, amount, maxFee],
        value: wormholeFee,
      },
      steps,
      flow
    );
    if (!response) return null;
    return new OnChainSuccess({
      created: extractNewId(response.receipt.logs, 'UserPaid', 'paymentId'),
      txHash: response.hash,
      chain,
    });
  };

  const sign = async (message: string): Promise<string | null> => {
    if (!account.address.value) {
      toastError('Connect EVM Wallet First!');
      return null;
    }

    try {
      return await signMessage(wagmiWriteConfig(), { message, connector: account.connector.value });
    } catch (e) {
      const detail = `${e}`.toLocaleLowerCase().includes('rejected')
        ? 'Please Sign to Continue'
        : `Couldn't sign: ${e}`;
      toastError(detail);
      return null;
    }
  };

  const withdraw = async (
    payableId: string,
    { amount, details }: TokenAndAmount,
    steps?: WriteSteps,
    flow?: TxFlowHandle
  ): Promise<OnChainSuccess | null> => {
    const chain = getCurrentChain();
    if (!chain) {
      toastError('Connect EVM Wallet First!');
      return null;
    }

    if (!details[chain.name]) {
      toastError(`Token not supported on ${chain.displayName} for now`);
      return null;
    }

    const response = await writeContract(
      {
        address: contracts[chain.name] as `0x${string}`,
        abi: chainbillsAbi,
        functionName: 'withdraw',
        args: [payableId, details[chain.name]!.address, amount],
      },
      steps,
      flow
    );
    if (!response) return null;
    return new OnChainSuccess({
      created: extractNewId(response.receipt.logs, 'Withdrew', 'withdrawalId'),
      txHash: response.hash,
      chain,
    });
  };

  return {
    balance,
    closePayable,
    consumedPaymentNonce,
    createPayable,
    estimateCctpFee,
    extractBroadcastNonce,
    fetchChainConfig,
    fetchEntity,
    fetchForeignPayable,
    fetchPayable,
    fetchUserOnChain,
    fetchWormholeFee,
    getActivitiesBulk,
    getChainActivityIdsPaginated,
    getChainPayableIdsPaginated,
    getChainUserAddressesPaginated,
    getChainStatsOnChain,
    getCurrentChain,
    getCurrentUser,
    getPayableActivityIdsPaginated,
    getPayableChainPaymentIdsPaginated,
    getPayableChainPaymentsCount,
    getPayablePaymentIdsPaginated,
    getPayablePaymentsBulk,
    getPayableWithdrawalIdsPaginated,
    getPayablesBulk,
    getTokenDetailsOnChain,
    getUserActivityIdsPaginated,
    getUserPayableIdsPaginated,
    getUserPaymentIdsPaginated,
    getUserPaymentsBulk,
    getUsersBulk,
    getUserWithdrawalIdsPaginated,
    getViemChain,
    getWithdrawalsBulk,
    payableUpdateNonce,
    pay,
    payForeignViaCctp,
    probeEntityChain,
    publicClientFor,
    readContract,
    readGetter,
    reopenPayable,
    sign,
    updatePayableAllowedTokensAndAmounts,
    updatePayableAutoWithdraw,
    withdraw,
    writeContract,
  };
});
