<script setup lang="ts">
/**
 * src/views/PayView.vue — `/pay/:id`. The page a payer lands on to pay a
 * payable: a summary of the payable on the left, and the pay widget on the
 * right. The widget adapts to four routes:
 *  - **same chain**: a direct `pay()` call;
 *  - **cross-chain, same network, both EVM**: a `CrossChainRoute` with
 *    fees, gated on the payable having synced to the payer's chain yet
 *    (`evm.fetchForeignPayable`, polled via `usePoller` while it hasn't);
 *  - **network mismatch** (mainnet payer vs. testnet payable or vice
 *    versa): an explanation plus the chains that actually can pay this
 *    payable (`payable.availability`), each with a switch-chain action;
 *  - **unsupported pairing** (Solana on either side): a "coming soon" notice.
 *
 * Submitting drives the `'pay'` or `'pay-cross-chain'` tx-flow
 * (`stores/payment.ts` → `exec`), shown by the globally-mounted
 * `TxFlowDialog`. On success this view redirects to the new payment's
 * receipt, whose cross-chain delivery tracker (`payment.trackArrival`)
 * keeps watching the `'pay-cross-chain'` flow's background `relay` step
 * independently of whether the payer stayed on this page.
 */
import ApprovalGate from '@/components/tx/ApprovalGate.vue';
import CrossChainRoute from '@/components/tx/CrossChainRoute.vue';
import { useTxRetry } from '@/components/tx/retry';
import {
  AddressChip,
  ChainBadge,
  GlassCard,
  PayableAvatar,
  SectionHeader,
  StatusPill,
  TokenAmount,
} from '@/components/ui';
import MakePaymentLoader from '@/components/MakePaymentLoader.vue';
import SignInButton from '@/components/SignInButton.vue';
import IconWallet from '@/icons/IconWallet.vue';
import { usePoller } from '@/composables/usePoller';
import {
  contracts,
  getTokenDetails,
  Payable,
  parseTokenAmount,
  TokenAndAmount,
  tokens,
  type ChainName,
  type Token,
} from '@/schemas';
import { useAnalyticsStore, useAuthStore, useEvmStore, usePayableStore, usePaymentStore } from '@/stores';
import type { PayableAvailability } from '@/stores/payable';
import NotFoundView from '@/views/NotFoundView.vue';
import { useSwitchChain } from '@wagmi/vue';
import Button from 'primevue/button';
import Select from 'primevue/select';
import { arcTestnet, baseSepolia as baseSepoliaViem, megaeth as megaethViem } from 'viem/chains';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

/** How often (ms) the sync poller below rechecks `getForeignPayable`, matching `reference/onchain-data.md` §5.1's suggested cadence — also used for the on-screen recheck countdown. */
const SYNC_POLL_INTERVAL_MS = 6_000;

const analytics = useAnalyticsStore();
const auth = useAuthStore();
const evm = useEvmStore();
const payableStore = usePayableStore();
const paymentStore = usePaymentStore();
const route = useRoute();
const router = useRouter();
const { setRetry } = useTxRetry();
const { switchChain } = useSwitchChain();

const payable = ref<Payable | null>(null);
const isLoading = ref(true);
const isPaying = ref(false);

const userChain = computed(() => auth.currentUser?.chain ?? null);
const isSameChain = computed(
  () => !!userChain.value && !!payable.value && userChain.value.name === payable.value.chain.name
);

/** Which pay route this payer/payable pairing needs. `null` before a wallet is connected — the widget shows a connect CTA instead. */
const routeKind = computed<'same' | 'cross' | 'mismatch' | 'unsupported' | null>(() => {
  if (!payable.value || !userChain.value) return null;
  if (isSameChain.value) return 'same';
  if (!userChain.value.isEvm || !payable.value.chain.isEvm) return 'unsupported';
  if (userChain.value.networkType !== payable.value.chain.networkType) return 'mismatch';
  return 'cross';
});

const aTAAs = computed(() => payable.value?.allowedTokensAndAmounts ?? []);
const allowsFreePayments = computed(() => aTAAs.value.length === 0);

/** Fixed-rule options a cross-chain payer can actually use — only USDC bridges this round, and only when it exists on the payer's chain too. */
const compatibleATAAs = computed(() => {
  if (!payable.value) return [];
  if (isSameChain.value || !userChain.value) return aTAAs.value;
  return aTAAs.value.filter((taa) => taa.name === 'USDC' && !!taa.details[userChain.value!.name]);
});

/** Selectable tokens for an "any amount" payable, narrowed to USDC when paying cross-chain. */
const availableTokens = computed(() => {
  if (!payable.value) return tokens;
  if (!userChain.value) return tokens.filter((t) => !!t.details[payable.value!.chain.name]);
  if (isSameChain.value) return tokens.filter((t) => !!t.details[userChain.value!.name]);
  return tokens.filter(
    (t) => t.name === 'USDC' && !!t.details[userChain.value!.name] && !!t.details[payable.value!.chain.name]
  );
});

const selectedConfig = ref<TokenAndAmount | null>(null);
const selectedToken = ref<Token | null>(null);
const amount = ref('');
const amountError = ref('');
const balanceError = ref('');
const balances = ref<Map<string, bigint | null>>(new Map());

const selectToken = (token: Token) => {
  analytics.recordEvent('selected_payment_token', { token: token.name });
  if (!payable.value) return;
  selectedToken.value = token;
  const chain = userChain.value ?? payable.value.chain;
  selectedConfig.value = TokenAndAmount.parse(token, amount.value || '0', chain);
  updateBalances();
};

const selectConfig = (taa: TokenAndAmount) => {
  analytics.recordEvent('selected_payment_ataa');
  selectedConfig.value = taa;
};

const displayBalance = (token: Token) => balances.value.get(token.name);

const updateBalances = async () => {
  if (!auth.currentUser) {
    balances.value = new Map();
    return;
  }
  const targets = allowsFreePayments.value
    ? selectedToken.value
      ? [selectedToken.value]
      : []
    : compatibleATAAs.value.map((t) => t.token());
  const entries = await Promise.all(
    targets.map(async (t): Promise<[string, bigint | null]> => [t.name, await auth.balance(t)])
  );
  balances.value = new Map(entries);
};

const validateAmount = () => {
  if (!payable.value || !userChain.value || !selectedToken.value) return;
  if (!amount.value) {
    amountError.value = 'Enter an amount.';
    return;
  }
  try {
    const decimals = selectedToken.value.details[userChain.value.name]?.decimals ?? 0;
    const raw = parseTokenAmount(amount.value, decimals);
    amountError.value = raw > 0n ? '' : 'Enter a positive amount.';
    if (!amountError.value)
      selectedConfig.value = TokenAndAmount.parse(selectedToken.value, amount.value, userChain.value);
  } catch {
    amountError.value = 'Enter a valid amount.';
  }
};

const validateBalance = async () => {
  balanceError.value = '';
  if (!auth.currentUser || !selectedConfig.value) return;
  const bal = await auth.balance(selectedConfig.value.token());
  balanceError.value = bal !== null && bal < selectedConfig.value.amount ? 'Insufficient balance for this amount.' : '';
};

// --- Cross-chain availability: is the payable synced to the payer's chain yet? ---
const isForeignPayableSynced = ref<boolean | null>(null);

/** Polls `getForeignPayable` on the payer's chain until the payable has synced there. Started/stopped by the `routeKind === 'cross'` watcher below rather than immediately, since most visits never need it. */
const syncPoller = usePoller(
  async () => {
    if (!payable.value || !userChain.value) return false;
    const foreign = await evm.fetchForeignPayable(payable.value.id, userChain.value.name as ChainName);
    isForeignPayableSynced.value = !!foreign;
    return !!foreign;
  },
  {
    intervalMs: SYNC_POLL_INTERVAL_MS,
    backoffAfterMs: 3 * 60_000,
    maxIntervalMs: 20_000,
    timeoutMs: 10 * 60_000,
    immediate: false,
  }
);

const availability = ref<PayableAvailability[]>([]);
const availableToPayChains = computed(() => availability.value.filter((a) => a.canPay));

const loadAvailability = async () => {
  if (!payable.value) return;
  availability.value = await payableStore.availability(payable.value);
};

watch(
  routeKind,
  (kind) => {
    if (kind === 'cross') {
      isForeignPayableSynced.value = null;
      syncPoller.start();
    } else {
      syncPoller.stop();
    }
  },
  { immediate: true }
);

/** Seconds left until the sync poller's next tick, for the "Rechecking in Ns" line — recomputed every second while the poller is running, so the wait never looks like an indefinite spinner. */
const secondsUntilRecheck = ref<number | null>(null);
let recheckDisplayTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  recheckDisplayTimer = setInterval(() => {
    if (syncPoller.status.value !== 'polling' || !syncPoller.lastCheckedAt.value) {
      secondsUntilRecheck.value = null;
      return;
    }
    const elapsed = Date.now() - syncPoller.lastCheckedAt.value;
    secondsUntilRecheck.value = Math.max(0, Math.ceil((SYNC_POLL_INTERVAL_MS - elapsed) / 1000));
  }, 1000);
});
onUnmounted(() => {
  if (recheckDisplayTimer) clearInterval(recheckDisplayTimer);
});

const switchToChain = (chainName: ChainName) => {
  const viemChain = { megaeth: megaethViem, arctestnet: arcTestnet, basesepolia: baseSepoliaViem }[
    chainName as 'megaeth' | 'arctestnet' | 'basesepolia'
  ];
  if (!viemChain) return;
  switchChain({ chainId: viemChain.id });
  analytics.recordEvent('clicked_switch_chain', { to: chainName, from: 'pay_page' });
};

// --- Cross-chain fee estimate (CCTP max fee + Wormhole message fee), refreshed whenever the amount or route changes. ---
const cctpFeeEstimate = ref<bigint | null>(null);
const wormholeFeeEstimate = ref<bigint | null>(null);

const loadCrossChainFees = async () => {
  if (!payable.value || !userChain.value || routeKind.value !== 'cross') return;
  const amt = selectedConfig.value?.amount ?? 0n;
  const [cctp, wormhole] = await Promise.all([
    evm.estimateCctpFee(userChain.value.name as ChainName, payable.value.chain.name as ChainName, amt),
    evm.fetchWormholeFee(userChain.value.name as ChainName),
  ]);
  cctpFeeEstimate.value = cctp;
  wormholeFeeEstimate.value = wormhole;
};

const cctpFeeAsTokenAndAmount = computed(() => {
  if (!cctpFeeEstimate.value || cctpFeeEstimate.value <= 0n) return undefined;
  const usdc = tokens.find((t) => t.name === 'USDC')!;
  return new TokenAndAmount(usdc, cctpFeeEstimate.value);
});

const wormholeFeeAsTokenAndAmount = computed(() => {
  if (!userChain.value || !wormholeFeeEstimate.value || wormholeFeeEstimate.value <= 0n) return undefined;
  try {
    return new TokenAndAmount(
      getTokenDetails(contracts[userChain.value.name], userChain.value),
      wormholeFeeEstimate.value
    );
  } catch {
    return undefined;
  }
});

/** What the payable is estimated to receive: the paid amount minus the CCTP fee (Circle deducts its fee from the bridged amount) for a cross-chain payment, or the full amount same-chain. */
const payableReceivesEstimate = computed(() => {
  if (!selectedConfig.value) return null;
  if (routeKind.value !== 'cross') return selectedConfig.value;
  const net = selectedConfig.value.amount - (cctpFeeEstimate.value ?? 0n);
  return new TokenAndAmount(selectedConfig.value.token(), net > 0n ? net : 0n);
});

const primaryLabel = computed(() => {
  if (!selectedConfig.value || !userChain.value) return 'Pay';
  const label = selectedConfig.value.display(userChain.value);
  return routeKind.value === 'cross' ? `Pay ${label} via CCTP` : `Pay ${label}`;
});

/** Whether the token about to be paid needs an ERC-20 approval (every token except the chain's own native token). */
const needsApproval = computed(() => {
  if (!selectedConfig.value || !userChain.value) return false;
  return selectedConfig.value.details[userChain.value.name]?.address !== contracts[userChain.value.name];
});

const canPay = computed(() => {
  if (!payable.value || !auth.currentUser || payable.value.isClosed) return false;
  if (!selectedConfig.value || !selectedConfig.value.amount) return false;
  if (amountError.value || balanceError.value) return false;
  if (routeKind.value === 'mismatch' || routeKind.value === 'unsupported') return false;
  if (routeKind.value === 'cross' && isForeignPayableSynced.value !== true) return false;
  return true;
});

const pay = async () => {
  analytics.recordEvent('clicked_pay', {
    route_kind: routeKind.value,
    token: selectedConfig.value?.name,
    chain: userChain.value?.name,
  });
  if (!payable.value || !auth.currentUser || !selectedConfig.value) return;

  validateAmount();
  await validateBalance();
  if (!canPay.value) return;

  setRetry(() => pay());
  isPaying.value = true;
  const id = await paymentStore.exec(payable.value.id, selectedConfig.value, payable.value.chain);
  isPaying.value = false;
  if (id) router.push(`/receipt/${id}`);
};

watch([() => amount.value], validateAmount);
watch([selectedConfig, () => auth.currentUser], async () => {
  await validateBalance();
  await loadCrossChainFees();
});

watch(needsApproval, (required) => {
  if (required && selectedConfig.value && userChain.value) {
    analytics.recordEvent('approval_required', {
      token: selectedConfig.value.name,
      chain: userChain.value.name,
    });
  }
});

let payPageTracked = false;
watch(routeKind, (kind) => {
  if (kind && !payPageTracked) {
    payPageTracked = true;
    analytics.recordEvent('loaded_pay_page', {
      payable_id: payable.value?.id,
      route_kind: kind,
    });
  }
});

watch(balanceError, (err) => {
  if (err && selectedConfig.value && userChain.value) {
    analytics.recordEvent('shown_insufficient_balance', {
      token: selectedConfig.value.name,
      chain: userChain.value.name,
    });
  }
});

watch(
  () => auth.currentUser,
  () => {
    // Reset the form whenever the connected wallet/chain changes — a selection from a previous chain can be invalid on the new one.
    selectedConfig.value = null;
    selectedToken.value = null;
    amount.value = '';
    amountError.value = '';
    balanceError.value = '';
    updateBalances();

    if (!allowsFreePayments.value && compatibleATAAs.value.length === 1)
      selectedConfig.value = compatibleATAAs.value[0];
    else if (allowsFreePayments.value && availableTokens.value.length === 1) selectToken(availableTokens.value[0]);
  }
);

onMounted(async () => {
  payable.value = await payableStore.get(route.params.id as string);
  isLoading.value = false;
  if (!payable.value) return;

  await Promise.all([updateBalances(), loadAvailability()]);

  if (!allowsFreePayments.value && compatibleATAAs.value.length === 1) selectedConfig.value = compatibleATAAs.value[0];
  else if (allowsFreePayments.value && availableTokens.value.length === 1) selectToken(availableTokens.value[0]);
});
</script>

<template>
  <MakePaymentLoader v-if="isLoading" />
  <NotFoundView v-else-if="!payable" />

  <section v-else class="pt-6 pb-20 max-w-screen-xl mx-auto">
    <SectionHeader eyebrow="Pay" :title="`Pay this payable`" />

    <div class="grid lg:grid-cols-[0.9fr,1.1fr] gap-6 items-start">
      <!-- Left: payable summary -->
      <GlassCard>
        <div class="flex items-center gap-3 mb-4">
          <PayableAvatar :id="payable.id" />
          <div class="min-w-0">
            <AddressChip :value="payable.id" kind="id" />
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 mb-4">
          <ChainBadge :chain="payable.chain" />
          <StatusPill :tone="payable.isClosed ? 'danger' : 'success'" :label="payable.isClosed ? 'Closed' : 'Open'" />
        </div>

        <p v-if="payable.description" class="text-sm text-fg whitespace-pre-wrap break-words mb-4">
          {{ payable.description }}
        </p>

        <div class="mb-4">
          <p class="text-xs uppercase tracking-wider text-muted mb-1.5">Accepts</p>
          <p v-if="aTAAs.length === 0" class="text-sm text-fg">Any supported token, any amount</p>
          <div v-else class="flex flex-wrap gap-2">
            <span
              v-for="(taa, i) in aTAAs"
              :key="i"
              class="rounded-full border border-glass-border bg-bg/30 px-2.5 py-1"
            >
              <TokenAmount :amount="taa" :chain="payable.chain" size="sm" />
            </span>
          </div>
        </div>

        <div class="flex items-center justify-between text-xs text-muted pt-3 border-t border-fg/5">
          <span class="inline-flex items-center gap-1.5"
            >Host <AddressChip :value="payable.host" :chain="payable.chain" kind="address"
          /></span>
          <router-link :to="`/payable/${payable.id}`" class="text-accent hover:underline">View payable</router-link>
        </div>
      </GlassCard>

      <!-- Right: the pay widget -->
      <GlassCard variant="refract" class="relative">
        <div
          v-if="!auth.currentUser"
          class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-bg/70 backdrop-blur-sm text-center px-6"
        >
          <p class="text-sm text-muted max-w-xs">Connect your wallet to pay this payable.</p>
          <SignInButton @click="analytics.recordEvent('clicked_signin', { from: 'payment_page' })" />
        </div>

        <div v-if="payable.isClosed" class="text-center py-10 px-4">
          <StatusPill tone="danger" label="Closed" class="mb-3" />
          <p class="text-sm text-muted max-w-xs mx-auto">This payable is closed and is no longer accepting payments.</p>
        </div>

        <form
          v-else
          :class="['flex flex-col gap-6', !auth.currentUser && 'opacity-40 pointer-events-none select-none']"
          @submit.prevent="pay"
        >
          <!-- Rules picker -->
          <div>
            <span class="text-sm font-medium text-fg">
              {{ allowsFreePayments ? 'Amount' : compatibleATAAs.length === 1 ? 'Pay' : 'Choose an option' }}
            </span>

            <div v-if="allowsFreePayments" class="mt-2 flex items-center gap-2">
              <input
                v-model="amount"
                type="number"
                min="0"
                step="any"
                aria-label="Amount"
                class="w-full rounded-xl border border-glass-border bg-glass-tint px-3 py-2 text-sm text-fg outline-none focus:border-accent"
              />
              <Select
                :model-value="selectedToken"
                :options="availableTokens"
                optionLabel="name"
                placeholder="Token"
                class="w-32 shrink-0"
                aria-label="Token"
                @update:model-value="selectToken"
              />
            </div>
            <p
              v-if="allowsFreePayments && selectedToken && displayBalance(selectedToken) != null"
              class="mt-1 text-xs text-muted inline-flex items-center gap-1"
            >
              <IconWallet class="w-3 h-3" />
              {{ userChain && new TokenAndAmount(selectedToken, displayBalance(selectedToken)!).display(userChain) }}
              available
            </p>
            <p v-if="amountError" class="mt-1 text-xs text-danger">{{ amountError }}</p>

            <template v-if="!allowsFreePayments">
              <div v-if="compatibleATAAs.length === 1" class="mt-2">
                <p class="font-display text-display-md text-fg">
                  {{ compatibleATAAs[0].display(userChain ?? payable.chain) }}
                </p>
              </div>
              <div v-else class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="(taa, i) in compatibleATAAs"
                  :key="i"
                  type="button"
                  :class="[
                    'rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                    selectedConfig?.name === taa.name && selectedConfig?.amount === taa.amount
                      ? 'border-accent bg-accent/10'
                      : 'border-glass-border bg-glass-tint hover:bg-fg/5',
                  ]"
                  @click="selectConfig(taa)"
                >
                  <TokenAmount :amount="taa" :chain="userChain ?? payable.chain" />
                </button>
              </div>
              <p v-if="!isSameChain && compatibleATAAs.length === 0" class="mt-2 text-xs text-danger">
                This payable only accepts tokens that don't support cross-chain payment from your connected chain.
              </p>
            </template>
          </div>

          <!-- Route panel -->
          <div v-if="routeKind === 'same'" class="rounded-xl bg-fg/[0.03] px-3.5 py-3 text-sm text-fg">
            Direct payment on <span class="font-medium">{{ payable.chain.displayName }}</span
            >.
          </div>

          <div v-else-if="routeKind === 'cross'" class="rounded-xl bg-fg/[0.03] px-3.5 py-3.5">
            <template v-if="isForeignPayableSynced">
              <CrossChainRoute
                :source-chain="userChain!"
                :dest-chain="payable.chain"
                :cctp-fee="cctpFeeAsTokenAndAmount"
                :wormhole-fee="wormholeFeeAsTokenAndAmount"
                tracked
              />
            </template>
            <template v-else>
              <div class="flex items-center gap-3">
                <ChainBadge :chain="payable.chain" size="sm" />

                <!-- Sync rail: the same rail-sweep motion as CrossChainRoute so the
                     "we are broadcasting this payable across chains" idea reads
                     visually. Three staggered packets travel from source to dest
                     to convey continuous activity while polling. Frozen under
                     prefers-reduced-motion. -->
                <div
                  class="relative flex-1 h-px bg-gradient-to-r from-transparent via-fg/20 to-transparent"
                  aria-hidden="true"
                >
                  <span
                    class="sync-packet sync-packet-1 absolute top-1/2 -mt-1 w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_2px_rgb(var(--accent-rgb)/0.5)] motion-reduce:left-1/2 motion-reduce:animate-none"
                  ></span>
                  <span
                    class="sync-packet sync-packet-2 absolute top-1/2 -mt-1 w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_2px_rgb(var(--accent-rgb)/0.5)] motion-reduce:hidden"
                  ></span>
                  <span
                    class="sync-packet sync-packet-3 absolute top-1/2 -mt-1 w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_2px_rgb(var(--accent-rgb)/0.5)] motion-reduce:hidden"
                  ></span>
                </div>

                <ChainBadge :chain="userChain!" size="sm" />
              </div>

              <p class="mt-3 text-sm text-fg">
                <span
                  class="mr-2 inline-block w-1.5 h-1.5 rounded-full bg-accent align-middle sync-status-dot motion-reduce:animate-none"
                  aria-hidden="true"
                ></span>
                Preparing this payable on {{ userChain!.displayName }}...
              </p>
              <p class="mt-1 text-xs text-muted">
                This usually takes about a minute. We'll open the pay form as soon as it's ready.
                <span v-if="secondsUntilRecheck !== null"> Checking again in {{ secondsUntilRecheck }}s.</span>
              </p>
            </template>
          </div>

          <div v-else-if="routeKind === 'mismatch'" class="rounded-xl bg-fg/[0.03] px-3.5 py-3.5">
            <p class="text-sm text-fg mb-1">
              This payable is on {{ payable.chain.displayName }} ({{ payable.chain.networkType }}), but you're connected
              to {{ userChain!.displayName }} ({{ userChain!.networkType }}). Mainnet and testnet chains can't pay each
              other.
            </p>
            <p class="text-xs text-muted mb-3">Switch to one of these chains to pay:</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="a in availableToPayChains"
                :key="a.chain.name"
                type="button"
                class="rounded-full border border-glass-border bg-glass-tint px-2.5 py-1 hover:bg-fg/5"
                @click="switchToChain(a.chain.name)"
              >
                <ChainBadge :chain="a.chain" size="sm" />
              </button>
            </div>
          </div>

          <div v-else-if="routeKind === 'unsupported'" class="rounded-xl bg-fg/[0.03] px-3.5 py-3.5">
            <p class="text-sm text-fg mb-2">Cross-chain payments to/from Solana are coming soon.</p>
            <p class="text-xs text-muted mb-3">
              For now, pay from <span class="font-medium">{{ payable.chain.displayName }}</span> directly.
            </p>
            <button
              type="button"
              class="rounded-full border border-glass-border bg-glass-tint px-2.5 py-1 hover:bg-fg/5"
              @click="switchToChain(payable.chain.name)"
            >
              <ChainBadge :chain="payable.chain" size="sm" />
            </button>
          </div>

          <!-- Approval explainer, before the summary/submit — see components/tx/README.md for why this lives on the page rather than inside the flow dialog. -->
          <ApprovalGate
            v-if="
              needsApproval &&
              selectedConfig &&
              userChain &&
              (routeKind === 'same' || (routeKind === 'cross' && isForeignPayableSynced))
            "
            :amount="selectedConfig"
            :chain="userChain"
            :spender="contracts[userChain.name]"
            :cross-chain="routeKind === 'cross'"
          />

          <!-- Summary -->
          <dl v-if="selectedConfig && userChain" class="divide-y divide-fg/5">
            <div class="flex items-center justify-between py-2 text-sm">
              <dt class="text-muted">You pay</dt>
              <dd class="tabular-nums text-fg font-medium">{{ selectedConfig.display(userChain) }}</dd>
            </div>
            <div
              v-if="routeKind === 'cross' && cctpFeeAsTokenAndAmount"
              class="flex items-center justify-between py-2 text-sm"
            >
              <dt class="text-muted">Bridge fee (max)</dt>
              <dd class="tabular-nums text-fg">− {{ cctpFeeAsTokenAndAmount.display(userChain) }}</dd>
            </div>
            <div v-if="payableReceivesEstimate" class="flex items-center justify-between py-2 text-sm">
              <dt class="text-muted">Payable receives{{ routeKind === 'cross' ? ' (est.)' : '' }}</dt>
              <dd class="tabular-nums text-fg">{{ payableReceivesEstimate.display(userChain) }}</dd>
            </div>
            <div v-if="routeKind === 'cross'" class="flex items-center justify-between py-2 text-sm">
              <dt class="text-muted">Estimated arrival</dt>
              <dd class="text-fg">usually 1–3 min</dd>
            </div>
          </dl>

          <div class="flex items-center justify-end gap-3">
            <p v-if="balanceError" class="text-xs text-danger mr-auto">{{ balanceError }}</p>
            <Button type="submit" :disabled="!canPay || isPaying" class="px-6">
              {{ isPaying ? 'Paying…' : primaryLabel }}
            </Button>
          </div>
        </form>
      </GlassCard>
    </div>
  </section>
</template>

<style scoped>
@keyframes sync-packet-travel {
  0% {
    left: 0%;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    left: 100%;
    opacity: 0;
  }
}

.sync-packet {
  animation: sync-packet-travel 2.8s var(--ease-out-expo) infinite;
}
.sync-packet-2 {
  animation-delay: 0.9s;
}
.sync-packet-3 {
  animation-delay: 1.8s;
}

@keyframes sync-status-dot {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

.sync-status-dot {
  animation: sync-status-dot 1.4s ease-in-out infinite;
}
</style>
