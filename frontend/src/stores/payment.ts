// stores/payment.ts
//
// Payment execution and lookup. `exec()` is the single entry point every
// pay button calls: it routes to the right on-chain call (same-chain,
// cross-chain EVM via CCTP, or Solana) and drives the matching tx-flow
// (`'pay'` or `'pay-cross-chain'`, see README §5). `get`/`getForUser`/
// `getForPayable` resolve a payment id without needing to know its chain
// up front, probing every EVM chain in parallel (never sequentially — an
// id gives no clue which chain it lives on). `trackArrival` is the
// standalone poller the receipt page uses to detect when a cross-chain
// payment has been relayed to the payable's chain.
//
// Used by: `views/PayView.vue`, `views/ReceiptView.vue`,
// `views/UserActivityView.vue`, `views/PayableDetailView.vue`,
// `stores/activity.ts`.
import { usePoller, type UsePollerHandle } from '@/composables/usePoller';
import {
  chainNames,
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
  errorMsg,
  useAnalyticsStore,
  useAuthStore,
  useCacheStore,
  useEvmStore,
  usePayableStore,
  useSolanaStore,
  useTxFlowStore,
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
  const solana = useSolanaStore();
  const txFlow = useTxFlowStore();
  const toast = useToast();

  const cacheKey = (chainName: ChainName, type: string, id: string) => `${chainName}::payment::${type}::${id}`;

  const toastError = (detail: string) => toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  /**
   * Executes a payment, choosing the on-chain path automatically:
   * - same chain → `evm.pay()`, tx-flow `'pay'` (`balance` → `allowance` →
   *   `approve` → `sign` → `confirm`; `allowance`/`approve` are skipped for
   *   the native token or when the existing allowance is already enough).
   * - cross-chain EVM → `evm.payForeignViaCctp()`, tx-flow `'pay-cross-chain'`
   *   (`available` → `fee` → `balance` → `allowance` → `approve` → `sign` →
   *   `confirm` → `relay` (background) → `received`).
   * - Solana → `solana.pay()`/`solana.payForeignViaCctp()` (no tx-flow wiring this round).
   *
   * @param payableId    The target payable's id.
   * @param details      The token and amount to pay.
   * @param payableChain The chain the payable lives on (needed for cross-chain routing).
   */
  const exec = async (payableId: string, details: TokenAndAmount, payableChain: Chain): Promise<string | null> => {
    if (!auth.currentUser) return null;

    const userChain = auth.currentUser.chain;
    const isSameChain = userChain.name === payableChain.name;

    if (userChain.isSolana) {
      const result = isSameChain
        ? await solana.pay(payableId, details)
        : await solana.payForeignViaCctp(payableId, details, payableChain);
      return await finishExec(result, isSameChain);
    }

    if (!userChain.isEvm) {
      toastError('Unsupported chain combination for payment');
      return null;
    }

    if (isSameChain) {
      const flow = txFlow.start('pay', `Pay ${details.display(userChain)}`, [
        { key: 'balance', title: 'Check balance', description: 'Checking your balance…' },
        { key: 'allowance', title: 'Check allowance', description: 'Checking token allowance…' },
        { key: 'approve', title: `Approve ${details.name}`, description: 'Waiting for approval…' },
        { key: 'sign', title: 'Sign transaction', description: 'Waiting to sign…' },
        { key: 'confirm', title: 'Confirm on-chain', description: 'Waiting for confirmation…' },
      ]);
      flow.step('balance').activate();
      flow.step('balance').done();
      flow.step('allowance').activate();
      flow.step('allowance').done();
      const result = await evm.pay(
        payableId,
        details,
        { approve: flow.step('approve'), sign: flow.step('sign'), confirm: flow.step('confirm') },
        flow
      );
      if (!result) return null; // flow is already 'failed' or 'cancelled' — evm.writeContract recorded which.
      flow.finish({ paymentId: result.created });
      return await finishExec(result, true);
    }

    const flow = txFlow.start(
      'pay-cross-chain',
      `Pay ${details.display(userChain)} to ${payableChain.displayName}`,
      [
        { key: 'available', title: 'Check availability', description: 'Checking the payable is synced to your chain…' },
        { key: 'fee', title: 'Estimate fees', description: 'Estimating bridge fees…' },
        { key: 'balance', title: 'Check balance', description: 'Checking your balance…' },
        { key: 'allowance', title: 'Check allowance', description: 'Checking token allowance…' },
        { key: 'approve', title: `Approve ${details.name}`, description: 'Waiting for approval…' },
        { key: 'sign', title: 'Sign transaction', description: 'Waiting to sign (this burns your USDC via CCTP)…' },
        { key: 'confirm', title: 'Confirm on-chain', description: 'Waiting for confirmation…' },
        {
          key: 'relay',
          title: 'Relay to destination',
          description: `Waiting for the relayer to deliver your payment on ${payableChain.displayName}…`,
          hints: ['Circle is attesting the burn…', 'The relayer is submitting your payment…'],
        },
        { key: 'received', title: 'Locate receipt', description: 'Finding your payment on the destination chain…' },
      ],
      { canRunInBackground: true }
    );

    flow.step('available').activate();
    const foreign = await evm.fetchForeignPayable(payableId, userChain.name);
    if (!foreign) {
      flow.step('available').fail('This payable has not synced to your chain yet.');
      return null;
    }
    flow.step('available').done();

    flow.step('fee').activate();
    flow.step('fee').done(); // The actual fee estimate happens inside evm.payForeignViaCctp — surfaced here only as a step.
    flow.step('balance').activate();
    flow.step('balance').done();
    flow.step('allowance').activate();
    flow.step('allowance').done();

    const result = await evm.payForeignViaCctp(
      payableId,
      details,
      payableChain,
      { approve: flow.step('approve'), sign: flow.step('sign'), confirm: flow.step('confirm') },
      flow
    );
    if (!result) return null; // flow is already 'failed' or 'cancelled' — evm.writeContract recorded which.

    await auth.refreshUser();
    toast.add({
      severity: 'success',
      summary: 'Successfully Paid',
      detail: 'Cross-chain payment initiated! Funds will arrive on the destination chain after relaying.',
      data: { url: result.explorerUrl },
      life: 12000,
    });
    analytics.recordEvent('made_payment', {
      user_payment_id: result.created,
      chain: result.chain.name,
      is_cross_chain: true,
    });

    flow.moveToBackground();
    trackArrivalForFlow(flow, result.created, userChain).catch(() => {});

    return result.created;
  };

  const finishExec = async (
    result: { created: string; explorerUrl: string; chain: Chain } | null,
    isSameChain: boolean
  ): Promise<string | null> => {
    if (!result) return null;
    await auth.refreshUser();
    toast.add({
      severity: 'success',
      summary: 'Successfully Paid',
      detail: isSameChain
        ? 'You have successfully made a Payment.'
        : 'Cross-chain payment initiated! Funds will arrive on the destination chain after relaying.',
      data: { url: result.explorerUrl },
      life: 12000,
    });
    analytics.recordEvent('made_payment', {
      user_payment_id: result.created,
      chain: result.chain.name,
      is_cross_chain: !isSameChain,
    });
    return result.created;
  };

  /**
   * Background half of a cross-chain payment: waits for arrival via
   * `trackArrival`, then updates the flow's `relay`/`received` steps.
   */
  const trackArrivalForFlow = async (
    flow: ReturnType<typeof txFlow.start>,
    userPaymentId: string,
    userChain: Chain
  ) => {
    const userPayment = await getForUser(userPaymentId, userChain);
    if (!userPayment) return;
    flow.step('relay').activate();
    const { arrived, payablePayment } = await trackArrival(userPayment);
    if (!arrived) {
      flow
        .step('relay')
        .progress({ description: 'Still relaying — this can take a while and will finish in the background.' });
      flow.finish({ userPaymentId });
      return;
    }
    flow.step('relay').done();
    flow.step('received').activate();
    if (payablePayment) flow.step('received').done();
    else flow.step('received').fail('Payment arrived but its receipt could not be located.');
    flow.finish({ userPaymentId, payablePaymentId: payablePayment?.id });
  };

  /**
   * Polls the payable's home chain until the payer's nonce is marked
   * consumed (`consumedPaymentNonces`), which means the relayer delivered
   * the payment, then locates the resulting `PayablePayment` there.
   * Standalone — the receipt page calls this directly for any cross-chain
   * `UserPayment`, independently of whether a `'pay-cross-chain'` flow is
   * still running for it.
   */
  const trackArrival = async (
    userPayment: UserPayment
  ): Promise<{ arrived: boolean; payablePayment?: PayablePayment; poller?: UsePollerHandle }> => {
    if (!userPayment.isCrossChain) return { arrived: true };

    const payableChain = userPayment.payableChain;
    const payerLeftPadded = `0x${userPayment.payer.replace(/^0x/, '').padStart(64, '0')}`;

    let payablePayment: PayablePayment | undefined;
    const poller = usePoller(
      async () => {
        const consumed = await evm.consumedPaymentNonce(
          payableChain.name,
          userPayment.chain.cbChainId,
          payerLeftPadded,
          BigInt(userPayment.payerCount)
        );
        if (!consumed) return false;
        payablePayment = (await locatePayablePayment(userPayment)) ?? undefined;
        return true;
      },
      { intervalMs: 6_000, backoffAfterMs: 3 * 60_000, maxIntervalMs: 20_000, timeoutMs: 10 * 60_000, immediate: false }
    );

    await poller.start();
    // usePoller's tick() is async but start() does not await it — wait for the terminal status here instead.
    while (poller.status.value === 'polling') {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return { arrived: poller.status.value === 'succeeded', payablePayment, poller };
  };

  /** Finds the destination-chain `PayablePayment` matching a cross-chain `UserPayment`, once it has arrived. */
  const locatePayablePayment = async (userPayment: UserPayment): Promise<PayablePayment | null> => {
    const payableChain = userPayment.payableChain;
    const total = await evm.getPayableChainPaymentsCount(
      userPayment.payableId,
      userPayment.chain.cbChainId,
      payableChain.name
    );
    if (!total || total === 0n) return null;

    // Newest first: page backwards from the end, a handful of ids at a time, until the match is found or the list is exhausted.
    const pageSize = 10n;
    for (let offset = total > pageSize ? total - pageSize : 0n; ; offset = offset > pageSize ? offset - pageSize : 0n) {
      const limit = total - offset;
      const ids = await evm.getPayableChainPaymentIdsPaginated(
        userPayment.payableId,
        userPayment.chain.cbChainId,
        Number(offset),
        Number(limit),
        payableChain.name
      );
      if (ids && ids.length) {
        const raw = await evm.getPayablePaymentsBulk(ids, payableChain.name);
        if (raw) {
          const idx = raw.findIndex((p: any) => p.payerPaymentId === userPayment.id);
          if (idx !== -1) {
            const payment = new PayablePayment(ids[idx], payableChain, raw[idx]);
            await cache.save(cacheKey(payableChain.name, 'payable', payment.id), payment);
            return payment;
          }
        }
      }
      if (offset === 0n) return null;
    }
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

    // Probe every candidate chain in parallel — never sequentially — since an id alone never says which chain it is on.
    if (isEvm) {
      const [userHit, payableHit] = await Promise.all([
        evm.probeEntityChain('getUserPayment', id),
        evm.probeEntityChain('getPayablePayment', id),
      ]);
      const hit = userHit ?? payableHit;
      if (hit) {
        const targetClass = userHit ? UserPayment : PayablePayment;
        const chain = chainNamesToChains[hit.chainName];
        const payment = new targetClass(id, chain, hit.raw);
        await cache.save(cacheKey(hit.chainName, userHit ? 'user' : 'payable', id), payment);
        return payment;
      }
      return null;
    }

    if (isSolana) {
      for (const type of ['user', 'payable']) {
        const raw = await solana.tryFetchEntity(`${type}Payment` as any, id, true);
        if (raw) {
          const targetClass = type == 'user' ? UserPayment : PayablePayment;
          const payment = new targetClass(id, chainNamesToChains.solanadevnet, raw);
          await cache.save(cacheKey('solanadevnet', type, id), payment);
          return payment;
        }
      }
    }
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
      toastError(errorMsg(e));
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
      toastError(errorMsg(e));
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
      const chain = chainNamesToChains[auth.currentUser.chain.name];
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
          const payment = await getForUser(id, chainNamesToChains[auth.currentUser.chain.name]);
          if (payment) payments.push(payment);
          else return null;
        } else return null;
      }
      return payments;
    } catch (e) {
      console.error(e);
      toastError(errorMsg(e));
      return null;
    }
  };

  const getManyForPayable = async (payable: Payable, page: number, count: number): Promise<PayablePayment[] | null> => {
    const totalCount = payable.paymentsCount;
    const chain = chainNamesToChains[payable.chain.name];
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
          const payment = await getForPayable(id, chainNamesToChains[chain.name]);
          if (payment) payments.push(payment);
          else return null;
        } else return null;
      }
      return payments;
    } catch (e) {
      console.error(e);
      toastError(errorMsg(e));
      return null;
    }
  };

  return {
    exec,
    get,
    getForPayable,
    getForUser,
    getManyForCurrentUser,
    getManyForPayable,
    trackArrival,
  };
});
