import {
  chainNames,
  chainNamesEvm,
  chainNamesToChains,
  Payable,
  PayablePayment,
  TokenAndAmount,
  UserPayment,
  type Chain,
  type ChainName,
  type Payment,
} from '@/schemas';
import {
  useAnalyticsStore,
  useAuthStore,
  useCacheStore,
  useEvmStore,
  usePayableStore,
  useServerStore,
  useSolanaStore,
} from '@/stores';
import { PublicKey } from '@solana/web3.js';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import * as encoding from './encoding';

export const usePaymentStore = defineStore('payment', () => {
  const analytics = useAnalyticsStore();
  const auth = useAuthStore();
  const cache = useCacheStore();
  const evm = useEvmStore();
  const payableStore = usePayableStore();
  const server = useServerStore();
  const solana = useSolanaStore();
  const toast = useToast();

  const cacheKey = (chainName: ChainName, type: string, id: string) => `${chainName}::payment::${type}::${id}`;

  /**
   * Execute a payment. Automatically routes to:
   * - `evm.pay()` when user and payable are on the same EVM chain
   * - `evm.payForeignWithCircle()` when user and payable are on different EVM chains
   * - `solana.pay()` when user is on Solana
   *
   * @param payableId  The target payable's ID
   * @param details    The token and amount to pay
   * @param payableChain  The chain the payable lives on (needed for cross-chain routing)
   */
  const exec = async (payableId: string, details: TokenAndAmount, payableChain: Chain): Promise<string | null> => {
    if (!auth.currentUser) return null;

    const userChain = auth.currentUser.chain;
    const isSameChain = userChain.name === payableChain.name;

    let result;
    if (userChain.isSolana) {
      result = await solana['pay'](payableId, details);
    } else if (userChain.isEvm && isSameChain) {
      result = await evm.pay(payableId, details);
    } else if (userChain.isEvm && !isSameChain) {
      result = await evm.payForeignWithCircle(payableId, details);
    } else {
      toastError('Unsupported chain combination for payment');
      return null;
    }

    if (!result) return null;
    await auth.refreshUser();

    console.log(`Made Payment Transaction Details: ${result.explorerUrl}`);
    await server.userPaid(result.created);

    // TODO: Move this payablePaid call to the relayer or a different process
    // For cross-chain payments, the payable record is created on the destination
    // chain by the relayer — not immediately available here.
    if (isSameChain) {
      const payable = await payableStore.get(payableId);
      if (payable) {
        const payablePaymentId = await payableStore.getPaymentId(payableId, payable.chain, payable.paymentsCount);
        if (payablePaymentId) await server.payablePaid(payablePaymentId);
      }
    }

    toast.add({
      severity: 'success',
      summary: 'Successfully Paid',
      detail: isSameChain
        ? 'You have successfully made a Payment.'
        : 'Cross-chain payment initiated! Funds will arrive on the destination chain after relaying.',
      life: 12000,
    });
    analytics.recordEvent('made_payment', {
      user_payment_id: result.created,
      chain: result.chain.name,
      is_cross_chain: !isSameChain,
    });
    return result.created;
  };

  /** Called by in the onMounted of the ReceiptView page where the chain is not known */
  const get = async (id: string): Promise<Payment | null> => {
    // Check if the payment is already in the cache and return if so.
    // Looping through known chain names as the chain is not known (straight from browser URL)
    for (const chainName of chainNames) {
      for (const type of ['user', 'payable']) {
        let payment = await cache.retrieve(cacheKey(chainName, type, id));
        if (payment) {
          // Necessary to restore callable methods on retrieved instance
          const targetClass = type == 'user' ? UserPayment : PayablePayment;
          payment = Object.setPrototypeOf(payment, targetClass.prototype);
          return payment;
        }
      }
    }

    // Determine the kind of chain to use to fetch the payment
    let isEvm = false;
    let isSolana = false;
    try {
      new PublicKey(id);
      isSolana = true;
    } catch (_) {
      if (encoding.hex.valid(id)) isEvm = true;
      // If it's not a valid Solana public key or it is not a hex string,
      // then it's not a valid ID.
      else return null;
    }
    const _chainNames = [...(isEvm ? chainNamesEvm : []), ...(isSolana ? ['solanadevnet'] : [])] as ChainName[];

    // Fetch the Payment directly from the chain
    for (const chainName of _chainNames) {
      for (const type of ['user', 'payable']) {
        let raw: any;
        if (isEvm) {
          const fetchKey = type[0].toUpperCase() + type.substring(1) + 'Payment';
          raw = await evm.fetchEntity(fetchKey as any, id, chainName, true /* ignoring errors */);
        }
        if (isSolana) raw = await solana.tryFetchEntity(`${type}Payment` as any, id, true /* ignoring errors */);
        if (raw) {
          const targetClass = type == 'user' ? UserPayment : PayablePayment;
          const payment = new targetClass(id, chainNamesToChains[chainName], raw);
          // Saving to Cache for retrieval at any other future time
          await cache.save(cacheKey(chainName, type, id), payment);
          return payment;
        }
      }
    }

    // If nothing was found from cache nor could not fetch from network, then return null
    return null;
  };

  const getForPayable = async (id: string, chain: Chain): Promise<PayablePayment | null> => {
    let payment = await cache.retrieve(cacheKey(chain.name, 'payable', id));
    if (payment) {
      // Necessary to restore callable methods on retrieved instance
      payment = Object.setPrototypeOf(payment, PayablePayment.prototype);
      return payment;
    }

    try {
      let raw: any;
      if (chain.isEvm) raw = await evm.fetchEntity('PayablePayment', id, chain.name);
      else if (chain.isSolana) raw = await solana.fetchEntity('payablePayment', id);
      else throw `Unknown chain: ${chain}`;
      if (raw) {
        payment = new PayablePayment(id, chain, raw);
        // Saving to Cache for retrieval at any other future time
        await cache.save(cacheKey(chain.name, 'payable', id), payment);
        return payment;
      }
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
    }
    return null;
  };

  const getForUser = async (id: string, chain: Chain): Promise<UserPayment | null> => {
    let payment = await cache.retrieve(cacheKey(chain.name, 'user', id));
    if (payment) {
      // Necessary to restore callable methods on retrieved instance
      payment = Object.setPrototypeOf(payment, UserPayment.prototype);
      return payment;
    }

    try {
      let raw: any;
      if (chain.isEvm) raw = await evm.fetchEntity('UserPayment', id, chain.name);
      else if (chain.isSolana) raw = await solana.fetchEntity('userPayment', id);
      else throw `Unknown chain: ${chain.name}`;
      if (raw) {
        payment = new UserPayment(id, chain, raw);
        // Saving to Cache for retrieval at any other future time
        await cache.save(cacheKey(chain.name, 'user', id), payment);
        return payment;
      }
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
    }
    return null;
  };

  const getManyForCurrentUser = async (page: number, count: number): Promise<UserPayment[] | null> => {
    if (!auth.currentUser) return null;
    const { paymentsCount: totalCount } = auth.currentUser;
    if (totalCount === 0) return [];

    let start = (page + 1) * count;
    const target = page * count + 1;
    if (start > totalCount) start = target + (totalCount % count) - 1;
    try {
      const chain = auth.currentUser.chain;
      if (chain.isEvm) {
        const offset = page * count;
        const ids: string[] | null = await evm.getUserPaymentIdsPaginated(
          auth.currentUser.walletAddress,
          offset,
          count,
          chain.name
        );
        if (!ids || ids.length === 0) return [];

        const payments: UserPayment[] = [];
        const missingIds: string[] = [];

        // 1. Try to load from cache first
        for (const id of ids) {
          let payment = await cache.retrieve(cacheKey(chain.name, 'user', id));
          if (payment) {
            payment = Object.setPrototypeOf(payment, UserPayment.prototype);
            payments.push(payment);
          } else {
            missingIds.push(id);
            payments.push(null as any); // placeholder
          }
        }

        // 2. Bulk fetch missing IDs
        if (missingIds.length > 0) {
          const rawPayments = await evm.getUserPaymentsBulk(missingIds, chain.name);
          if (rawPayments) {
            let missingIndex = 0;
            for (let i = 0; i < payments.length; i++) {
              if (payments[i] === null) {
                const raw = rawPayments[missingIndex];
                const payment = new UserPayment(ids[i], chain, raw);
                await cache.save(cacheKey(chain.name, 'user', ids[i]), payment);
                payments[i] = payment;
                missingIndex++;
              }
            }
          } else return null;
        }
        return payments;
      }

      const payments: UserPayment[] = [];
      for (let i = start; i >= target; i--) {
        const id = await auth.getPaymentId(i);
        if (id) {
          const payment = await getForUser(id, { ...auth.currentUser.chain });
          if (payment) payments.push(payment);
          else return null;
        } else return null;
      }
      return payments;
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
      return null;
    }
  };

  const getManyForPayable = async (payable: Payable, page: number, count: number): Promise<PayablePayment[] | null> => {
    const { paymentsCount: totalCount, chain } = payable;
    if (count === 0) return [];

    let start = (page + 1) * count;
    const target = page * count + 1;
    if (start > totalCount) start = target + (totalCount % count) - 1;
    try {
      if (chain.isEvm) {
        const offset = page * count;
        const xId = (!payable.id.startsWith('0x') ? `0x${payable.id}` : payable.id) as `0x${string}`;
        const ids: string[] | null = await evm.getPayablePaymentIdsPaginated(xId, offset, count, chain.name);
        if (!ids || ids.length === 0) return [];

        const payments: PayablePayment[] = [];
        const missingIds: string[] = [];

        for (const id of ids) {
          let payment = await cache.retrieve(cacheKey(chain.name, 'payable', id));
          if (payment) {
            payment = Object.setPrototypeOf(payment, PayablePayment.prototype);
            payments.push(payment);
          } else {
            missingIds.push(id);
            payments.push(null as any);
          }
        }

        if (missingIds.length > 0) {
          const rawPayments = await evm.getPayablePaymentsBulk(missingIds, chain.name);
          if (rawPayments) {
            let missingIndex = 0;
            for (let i = 0; i < payments.length; i++) {
              if (payments[i] === null) {
                const raw = rawPayments[missingIndex];
                const payment = new PayablePayment(ids[i], chain, raw);
                await cache.save(cacheKey(chain.name, 'payable', ids[i]), payment);
                payments[i] = payment;
                missingIndex++;
              }
            }
          } else return null;
        }
        return payments;
      }

      const payments: PayablePayment[] = [];
      for (let i = start; i >= target; i--) {
        const id = await payableStore.getPaymentId(payable.id, chain, i);
        if (id) {
          const payment = await getForPayable(id, { ...chain });
          if (payment) payments.push(payment);
          else return null;
        } else return null;
      }
      return payments;
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
      return null;
    }
  };

  const toastError = (detail: string) => toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  return {
    exec,
    get,
    getForPayable,
    getForUser,
    getManyForCurrentUser,
    getManyForPayable,
  };
});
