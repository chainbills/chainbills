import {
  Payable,
  PayablePayment,
  TokenAndAmount,
  UserPayment,
  type Payment,
} from '@/schemas';
import {
  useCacheStore,
  useChainStore,
  useCosmwasmStore,
  useEvmStore,
  usePayableStore,
  useServerStore,
  useSolanaStore,
  useUserStore,
  useWalletStore,
  type Chain,
} from '@/stores';
import { PublicKey } from '@solana/web3.js';
import { encoding } from '@wormhole-foundation/sdk';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';

export const usePaymentStore = defineStore('payment', () => {
  const cache = useCacheStore();
  const chain = useChainStore();
  const cosmwasm = useCosmwasmStore();
  const evm = useEvmStore();
  const payableStore = usePayableStore();
  const server = useServerStore();
  const solana = useSolanaStore();
  const toast = useToast();
  const user = useUserStore();
  const wallet = useWalletStore();

  const cacheKey = (chain: string, type: string, id: string) =>
    `${chain}::payment::${type}::${id}`;

  const exec = async (
    payableId: string,
    details: TokenAndAmount
  ): Promise<string | null> => {
    if (!wallet.connected || !chain.current) return null;

    try {
      const result = await {
        'Burnt Xion': cosmwasm,
        'Ethereum Sepolia': evm,
        Solana: solana,
      }[chain.current]['pay'](payableId, details);
      if (!result) return null;
      await user.refresh();

      console.log(`Made Payment Transaction Details: ${result.explorerUrl()}`);
      await server.userPaid(result.created);

      // TODO: Move this payablePaid call to the relayer or a different process
      const payable = await payableStore.get(payableId);
      if (payable) {
        const payablePaymentId = await payableStore.getPaymentId(
          payableId,
          payable.chain,
          payable.paymentsCount
        );
        if (payablePaymentId) {
          await server.payablePaid(payablePaymentId);
        }
      }

      toast.add({
        severity: 'success',
        summary: 'Successfully Paid',
        detail: 'You have successfully made a Payment.',
        life: 12000,
      });
      return result.created;
    } catch (e) {
      console.error(e);
      if (!`${e}`.includes('rejected')) toastError(`${e}`);
      return null;
    }
  };

  const get = async (
    id: string,
    chain?: Chain,
    ignoreErrors?: boolean
  ): Promise<Payment | null> => {
    // A simple trick to guess the chain based on the ID's format
    // (if not provided)
    if (!chain) {
      chain = 'Solana';
      try {
        new PublicKey(id);
      } catch (_) {
        if (encoding.hex.valid(id)) {
          if (id.startsWith('0x')) chain = 'Ethereum Sepolia';
          else chain = 'Burnt Xion';
        }
        // If it's not a valid Solana public key or it is not a hex string,
        // then it's not a valid ID.
        else return null;
      }
    }

    // Check if the payment is already in the cache and return if so.
    let payment = await cache.retrieve(cacheKey(chain, 'user', id));
    if (payment) {
      // Necessary to restore callable methods on retrieved instance
      payment = Object.setPrototypeOf(payment, UserPayment.prototype);
      payment.details = Object.setPrototypeOf(
        payment.details,
        TokenAndAmount.prototype
      );
      return payment;
    }
    payment = await cache.retrieve(cacheKey(chain, 'payable', id));
    if (payment) {
      // Necessary to restore callable methods on retrieved instance
      payment = Object.setPrototypeOf(payment, PayablePayment.prototype);
      payment.details = Object.setPrototypeOf(
        payment.details,
        TokenAndAmount.prototype
      );
      return payment;
    }

    // Otherwise, first try to fetch the payment as if it was a user payment.
    try {
      let raw: any;
      if (chain == 'Solana') raw = await solana.fetchEntity('userPayment', id);
      else if (chain == 'Ethereum Sepolia')
        raw = await evm.fetchUserPayment(id, ignoreErrors);
      else if (chain == 'Burnt Xion')
        raw = await cosmwasm.fetchEntity('user_payment', id, ignoreErrors);
      else throw `Unknown chain: ${chain}`;
      if (raw) {
        payment = new UserPayment(id, chain, raw);
        await cache.save(cacheKey(chain, 'user', id), payment);
      }
    } catch (_) {}

    // If the payment is not a user payment, try to fetch it as a payable payment.
    if (!payment) {
      try {
        let raw: any;
        if (chain == 'Solana')
          raw = await solana.fetchEntity('payablePayment', id);
        else if (chain == 'Ethereum Sepolia')
          raw = await evm.fetchPayablePayment(id, ignoreErrors);
        else if (chain == 'Burnt Xion')
          raw = await cosmwasm.fetchEntity('payable_payment', id, ignoreErrors);
        else throw `Unknown chain: ${chain}`;
        if (raw) {
          payment = new PayablePayment(id, chain, raw);
          await cache.save(cacheKey(chain, 'payable', id), payment);
        }
      } catch (_) {}
    }

    return payment;
  };

  const getForPayable = async (
    id: string,
    chain: Chain
  ): Promise<PayablePayment | null> => {
    let payment = await cache.retrieve(cacheKey(chain, 'payable', id));
    if (payment) {
      // Necessary to restore callable methods on retrieved instance
      payment = Object.setPrototypeOf(payment, PayablePayment.prototype);
      payment.details = Object.setPrototypeOf(
        payment.details,
        TokenAndAmount.prototype
      );
      return payment;
    }

    try {
      let raw: any;
      if (chain == 'Solana')
        raw = await solana.fetchEntity('payablePayment', id);
      else if (chain == 'Ethereum Sepolia')
        raw = await evm.fetchPayablePayment(id);
      else if (chain == 'Burnt Xion')
        raw = await cosmwasm.fetchEntity('payable_payment', id);
      else throw `Unknown chain: ${chain}`;
      if (raw) {
        payment = new PayablePayment(id, chain, raw);
        await cache.save(cacheKey(chain, 'payable', id), payment);
        return payment;
      }
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
    }
    return null;
  };

  const getForUser = async (
    id: string,
    chain: Chain
  ): Promise<UserPayment | null> => {
    let payment = await cache.retrieve(cacheKey(chain, 'user', id));
    if (payment) {
      // Necessary to restore callable methods on retrieved instance
      payment = Object.setPrototypeOf(payment, UserPayment.prototype);
      payment.details = Object.setPrototypeOf(
        payment.details,
        TokenAndAmount.prototype
      );
      return payment;
    }

    try {
      let raw: any;
      if (chain == 'Solana') raw = await solana.fetchEntity('userPayment', id);
      else if (chain == 'Ethereum Sepolia')
        raw = await evm.fetchUserPayment(id);
      else if (chain == 'Burnt Xion')
        raw = await cosmwasm.fetchEntity('user_payment', id);
      else throw `Unknown chain: ${chain}`;
      if (raw) {
        payment = new UserPayment(id, chain, raw);
        await cache.save(cacheKey(chain, 'user', id), payment);
        return payment;
      }
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
    }
    return null;
  };

  const getManyForPayable = async (
    payable: Payable
  ): Promise<PayablePayment[] | null> => {
    const { paymentsCount: count, chain } = payable;
    if (count === 0) return [];

    try {
      const payments: PayablePayment[] = [];
      // TODO: Implement pagination instead of this set maximum of 25
      let fetched = 0;
      for (let i = count; i >= 1; i--) {
        if (fetched >= 25) break;
        const id = await payableStore.getPaymentId(payable.id, chain, i);
        if (id) {
          const payment = await getForPayable(id, chain);
          if (payment) payments.push(payment);
          else return null;
        } else return null;
        fetched++;
      }
      return payments;
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
      return null;
    }
  };

  const mines = async (): Promise<UserPayment[] | null> => {
    if (!user.current) return null;
    const { paymentsCount: count } = user.current;
    if (count === 0) return [];

    try {
      const payments: UserPayment[] = [];
      // TODO: Implement pagination instead of this set maximum of 25
      let fetched = 0;
      for (let i = count; i >= 1; i--) {
        if (fetched >= 25) break;
        const id = await user.getPaymentId(i);
        if (id) {
          const payment = await getForUser(id, user.current.chain);
          if (payment) payments.push(payment);
          else return null;
        } else return null;
        fetched++;
      }
      return payments;
    } catch (e) {
      console.error(e);
      toastError(`${e}`);
      return null;
    }
  };

  const toastError = (detail: string) =>
    toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  return { exec, get, getForPayable, getForUser, getManyForPayable, mines };
});
