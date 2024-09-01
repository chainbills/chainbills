import {
  Payable,
  PayablePayment,
  TokenAndAmount,
  UserPayment,
  type Payment,
} from '@/schemas';
import {
  useChainStore,
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
  const chain = useChainStore();
  const evm = useEvmStore();
  const payableStore = usePayableStore();
  const server = useServerStore();
  const solana = useSolanaStore();
  const toast = useToast();
  const user = useUserStore();
  const wallet = useWalletStore();

  const exec = async (
    email: string,
    payableId: string,
    details: TokenAndAmount
  ): Promise<string | null> => {
    if (!wallet.connected || !chain.current) return null;

    try {
      const method = chain.current == 'Solana' ? solana.pay : evm.pay;
      const result = await method(payableId, details);
      if (!result) return null;
      await user.refresh();

      console.log(`Made Payment Transaction Details: ${result.explorerUrl()}`);
      await server.userPaid(result.created, email);

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

  const get = async (id: string, chain?: Chain): Promise<Payment | null> => {
    // A simple trick to guess the chain based on the ID's format
    // (if not provided)
    if (!chain) {
      chain = 'Solana';
      try {
        new PublicKey(id);
      } catch (_) {
        if (encoding.hex.valid(id)) chain = 'Ethereum Sepolia';
        // If it's not a valid Solana public key or Ethereum Sepolia address,
        // then it's not a valid ID.
        else return null;
      }
    }

    let payment: Payment | null = null;

    // First try to fetch the payment as if it was a user payment.
    try {
      const raw =
        chain == 'Solana'
          ? await solana.fetchEntity('userPayment', id)
          : await evm.readContract('userPayments', [id]);
      if (raw) payment = new UserPayment(id, chain, raw);
    } catch (_) {}

    // If the payment is not a user payment, try to fetch it as a payable payment.
    if (!payment) {
      try {
        const raw =
          chain == 'Solana'
            ? await solana.fetchEntity('payablePayment', id)
            : await evm.readContract('payablePayments', [id]);
        if (raw) payment = new PayablePayment(id, chain, raw);
      } catch (_) {}
    }

    return payment;
  };

  const getForPayable = async (
    id: string,
    chain: Chain
  ): Promise<PayablePayment | null> => {
    try {
      const raw =
        chain == 'Solana'
          ? await solana.fetchEntity('payablePayment', id)
          : await evm.readContract('payablePayments', [id]);
      if (raw) return new PayablePayment(id, chain, raw);
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
    try {
      const raw =
        chain == 'Solana'
          ? await solana.fetchEntity('userPayment', id)
          : await evm.readContract('userPayments', [id]);
      if (raw) return new UserPayment(id, chain, raw);
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
