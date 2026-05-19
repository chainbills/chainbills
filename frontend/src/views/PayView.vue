<script setup lang="ts">
import MakePaymentLoader from '@/components/MakePaymentLoader.vue';
import SignInButton from '@/components/SignInButton.vue';
import IconSpinner from '@/icons/IconSpinner.vue';
import IconWallet from '@/icons/IconWallet.vue';
import { Payable, TokenAndAmount, tokens, type ChainName, type Token } from '@/schemas';
import { useAnalyticsStore, useAuthStore, useEvmStore, usePayableStore, usePaymentStore } from '@/stores';
import NotFoundView from '@/views/NotFoundView.vue';
import Button from 'primevue/button';
import ProgressBar from 'primevue/progressbar';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const amount = ref<any>('');
const amountError = ref('');
const analytics = useAnalyticsStore();
const auth = useAuthStore();
const evm = useEvmStore();
const balanceError = ref('');
const balances = ref<(number | null)[]>([]);
const isForeignPayableRelayed = ref<boolean | null>(null);
const isRechecking = ref(false);
const toast = useToast();
let foreignPayableRefreshInterval: ReturnType<typeof setInterval> | null = null;
const isSameChain = computed(() => {
  if (!auth.currentUser || !payable.value) return true;
  return auth.currentUser.chain.name === payable.value.chain.name;
});
const availableTokens = computed(() => {
  if (!auth.currentUser || !payable.value) return tokens;
  const userChainName = auth.currentUser.chain.name;
  const payableChainName = payable.value.chain.name;

  return tokens.filter((t) => {
    // Must have details on user's current chain
    if (!t.details[userChainName]) return false;

    // If cross-chain, must be USDC (for now) and also exist on the target chain
    if (!isSameChain.value) {
      return t.name === 'USDC' && !!t.details[payableChainName];
    }

    return true;
  });
});
const configError = ref('');
const isLoading = ref(true);
const isPaying = ref(false);
const payment = usePaymentStore();
const route = useRoute();
const payable = ref<Payable | null>(null);
const payables = usePayableStore();
const aTAAs = computed(() => payable.value?.allowedTokensAndAmounts ?? []);
const compatibleATAAs = computed(() => {
  if (!auth.currentUser || !payable.value) return aTAAs.value;
  if (isSameChain.value) return aTAAs.value;

  // For cross-chain, only USDC is supported for now
  return aTAAs.value.filter((taa) => taa.name === 'USDC' && !!taa.details[auth.currentUser!.chain.name]);
});
const allowsFreePayments = computed(() => aTAAs.value.length == 0);
const router = useRouter();
const selectedConfig = ref<TokenAndAmount | null>(null);
const selectedToken = ref<Token | null>(null);

const selectToken = (token: Token) => {
  analytics.recordEvent('selected_payment_token', { token: token.name });
  if (!payable.value) return;

  // Obtaining a Choice Chain first is good when no wallet is connected
  // and the User is interacting with the dropdown of tokens.
  let choiceChainName = auth.currentUser?.chain.name ?? payable.value.chain.name;
  // If the token the user selected has no details in the choice chain,
  // we default to the first chain that has details for the token.
  if (!token.details[choiceChainName]) {
    choiceChainName = Object.keys(token.details)[0] as ChainName;
  }

  selectedConfig.value = new TokenAndAmount(token, amount.value * 10 ** token.details[choiceChainName]!.decimals);
  updateBalances();
};

const validateAmount = () => {
  if (!payable.value) return;

  const v = amount.value;
  if (Number.isNaN(v) || +v == 0) amountError.value = 'Required';
  else if (v <= 0) amountError.value = 'Should be positive';
  else amountError.value = '';
  if (allowsFreePayments.value && selectedConfig.value) {
    const chain = auth.currentUser?.chain ?? payable.value.chain;
    selectedConfig.value.amount = v * 10 ** (selectedConfig.value.details[chain.name]?.decimals ?? 0);
  }
  validateBalance();
};

const updateBalances = async () => {
  if (!auth.currentUser) {
    balances.value = [];
  } else {
    if (allowsFreePayments.value) {
      balances.value = [selectedToken.value ? await auth.balance(selectedToken.value) : null];
    } else {
      balances.value = await Promise.all(compatibleATAAs.value.map(async (taa) => await auth.balance(taa.token())));
    }
  }
};

const validateBalance = async () => {
  balanceError.value == '';
  if (!auth.currentUser) return;
  if (selectedConfig.value) {
    const amt = selectedConfig.value.format(auth.currentUser.chain);
    const bal = await auth.balance(selectedConfig.value.token());
    balanceError.value = bal && bal < amt ? 'Insufficient Funds' : '';
  }
};

const validateConfig = () => {
  if (!selectedConfig.value) {
    if (allowsFreePayments.value) configError.value = 'Please select a token';
    else if (aTAAs.value.length > 1) {
      configError.value = 'Please make a choice';
    } else configError.value = '';
  } else {
    // Check if selected token is compatible with cross-chain if applicable
    if (!isSameChain.value) {
      if (selectedConfig.value.name !== 'USDC') {
        configError.value = 'Only USDC is supported for cross-chain payments';
      } else if (!selectedConfig.value.details[payable.value!.chain.name]) {
        configError.value = `USDC is not supported on ${payable.value!.chain.displayName}`;
      } else configError.value = '';
    } else configError.value = '';
  }
};

const pay = async () => {
  analytics.recordEvent('clicked_pay');
  if (!payable.value || !auth.currentUser) return;

  validateAmount();
  await validateBalance();
  validateConfig();
  if ((allowsFreePayments.value && amountError.value) || balanceError.value || configError.value) {
    return;
  }

  isPaying.value = true;
  const id = await payment.exec(payable.value.id, selectedConfig.value!, payable.value.chain);

  if (id) router.push(`/receipt/${id}`);
  else isPaying.value = false;
};

const checkForeignPayableRelayed = async () => {
  if (!auth.currentUser || !payable.value) return;
  if (isSameChain.value || !auth.currentUser.chain.isEvm || !payable.value.chain.isEvm) return;
  isRechecking.value = true;
  isForeignPayableRelayed.value = null;
  const result = await evm.fetchForeignPayable(payable.value.id, auth.currentUser.chain.name as ChainName);
  isForeignPayableRelayed.value = !!result;
  isRechecking.value = false;

  // If still false after manual check, show info toast
  if (isForeignPayableRelayed.value === false) {
    toast.add({
      severity: 'info',
      summary: 'Still Processing',
      detail: 'Relay still in progress. Please wait a moment.',
      life: 4000,
    });
  }

  if (isForeignPayableRelayed && foreignPayableRefreshInterval) {
    // Stop the 15s refresher
    clearInterval(foreignPayableRefreshInterval)
  }
};

onMounted(async () => {
  payable.value = await payables.get(route.params.id as string);
  isLoading.value = false;

  await Promise.all([updateBalances(), checkForeignPayableRelayed()]);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForeignPayableRelayed();
  });

  // Auto-refresh foreign payable status every 15s while visible
  foreignPayableRefreshInterval = setInterval(() => {
    if (!document.hidden && isForeignPayableRelayed.value === false) {
      checkForeignPayableRelayed();
    }
  }, 15000);

  watch(() => amount.value, validateAmount);
  watch(
    () => selectedConfig.value,
    async () => {
      validateConfig();
      await updateBalances();
      await validateBalance();
    }
  );
  watch(
    () => auth.currentUser,
    async (_) => {
      // Reset the form when the user changes to avoid cross-chain token issues
      selectedConfig.value = null;
      selectedToken.value = null;
      configError.value = '';
      balanceError.value = '';
      updateBalances();
      await checkForeignPayableRelayed();

      if (!allowsFreePayments.value && aTAAs.value.length == 1) {
        selectedConfig.value = aTAAs.value[0];
      } else if (allowsFreePayments.value && availableTokens.value.length == 1) {
        selectToken(availableTokens.value[0]);
      }
    }
  );

  // Watch for relay completion
  watch(
    () => isForeignPayableRelayed.value,
    (newVal, oldVal) => {
      if (oldVal === false && newVal === true) {
        toast.add({
          severity: 'success',
          summary: 'Relayed!',
          detail: 'Payable has now been relayed. You can pay now.',
          life: 5000,
        });
      }
    }
  );

  if (!allowsFreePayments.value && aTAAs.value.length == 1) {
    selectedConfig.value = aTAAs.value[0];
  } else if (allowsFreePayments.value && availableTokens.value.length == 1) {
    selectToken(availableTokens.value[0]);
  }

  if (allowsFreePayments.value) {
    setTimeout(() => {
      (document.querySelector('input.amount[type=number]') as HTMLInputElement).addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
      });
    });
  }
});

onUnmounted(() => {
  if (foreignPayableRefreshInterval) clearInterval(foreignPayableRefreshInterval);
});
</script>

<template>
  <MakePaymentLoader v-if="isLoading" />

  <NotFoundView v-else-if="!payable" />

  <section class="max-md:max-w-md md:max-w-screen-md mx-auto md:pt-8 pb-20" v-else>
    <div class="md:flex gap-12">
      <div class="grow">
        <h2 class="text-3xl mb-4 font-bold">Make Payment</h2>

        <p class="mb-8 leading-tight">
          <span>Payable ID:</span><br />
          <span class="text-xs break-all text-gray-500">{{ payable.id }}</span>
        </p>

        <div class="max-w-lg">
          <h3 class="font-medium mb-2">Description</h3>
          <div class="mb-8 sm:flex items-end">
            <textarea
              readonly
              description
              v-model="payable.description"
              class="outline-none w-full px-3 py-2 bg-primary bg-opacity-10 dark:bg-opacity-5 rounded-md shadow-inner mb-2 sm:mb-0 sm:mr-4 min-h-20 max-h-40"
            ></textarea>
          </div>
        </div>
      </div>

      <div class="grow basis-1/2 md:max-w-md md:mt-12">
        <div class="text-center pt-8" v-if="isPaying">
          <p class="mb-12">Paying ...</p>
          <IconSpinner height="144" width="144" class="mb-12 mx-auto" />
        </div>

        <div
          v-else-if="!isSameChain && !allowsFreePayments && compatibleATAAs.length === 0"
          class="mt-8 mb-24 text-center max-w-lg mx-auto text-gray-700 dark:text-gray-400"
        >
          <p class="mb-4">
            This payable only accepts tokens that are not compatible with cross-chain payments from your current
            network. Please switch to <strong>{{ payable.chain.displayName }}</strong> to pay.
          </p>
          <SignInButton />
        </div>

        <form class="max-w-sm mx-auto" @submit.prevent="pay" v-else>
          <div class="mb-8 leading-tight" v-if="allowsFreePayments">
            <p class="mb-2">Amount</p>
            <div class="flex mb-4">
              <div class="w-36 flex flex-col mr-4">
                <input
                  class="amount pt-2.5 pb-1 border-b-2 mb-1 focus:outline-none focus:border-primary bg-transparent"
                  v-model="amount"
                  required
                  :min="0"
                  :step="10 ** -(1 * 18)"
                  type="number"
                  aria-label="Amount"
                />
                <small class="text-xs block text-red-500">{{ amountError }}</small>
              </div>
              <div class="flex flex-col">
                <Select
                  :options="availableTokens"
                  optionLabel="name"
                  v-model="selectedToken"
                  @change="(e) => selectToken(e.value)"
                  placeholder="Select a Token"
                  class="mb-1"
                  ariaLabel="Select a Token"
                />
                <p v-if="selectedToken && balances.length == 1 && balances[0]">
                  <IconWallet class="w-3 h-3 inline-block mt-px mr-1 stroke-current" />
                  <span class="text-[10px] text-gray-500">
                    {{ Math.trunc(balances[0] * 10 ** 5) / 10 ** 5 }}&nbsp;{{ selectedToken.name }}
                  </span>
                </p>
                <small class="text-xs block text-red-500">{{ configError }}</small>
              </div>
            </div>
          </div>

          <div class="pb-4" v-else>
            <p class="mb-1">
              {{ aTAAs.length == 1 ? 'Pay' : 'Select an Option' }}
            </p>

            <div class="w-fit flex flex-col" v-if="aTAAs.length == 1">
              <p class="font-bold text-3xl">
                <!-- TODO: Review whether to use the payable's chain for 
           formatting tokenAndAmount display especially when swaps start -->
                {{ aTAAs[0].display(payable.chain) }}
              </p>
              <p v-if="balances.length == 1 && balances[0]">
                <IconWallet class="w-3 h-3 inline-block mt-px mr-1 stroke-current" />
                <span class="text-[10px] text-gray-500">
                  {{ Math.trunc(balances[0] * 10 ** 5) / 10 ** 5 }}&nbsp;{{ aTAAs[0].name }}
                </span>
              </p>
            </div>

            <div class="flex gap-4 flex-wrap mb-3 pt-2" v-else>
              <div class="w-fit flex flex-col gap-1" v-for="(taa, i) of compatibleATAAs">
                <Button
                  :class="
                    'text-current border-none shadow-md dark:shadow-[#ffffff0a]  px-3 py-2 text-xl ' +
                    (selectedConfig?.name == taa.name && selectedConfig?.amount == taa.amount
                      ? 'bg-primary bg-opacity-30'
                      : 'bg-transparent')
                  "
                  @click="
                    selectedConfig = taa;
                    analytics.recordEvent('selected_payment_ataa');
                  "
                >
                  <!-- TODO: Review whether to use the payable's chain for 
           formatting tokenAndAmount display especially when swaps start -->
                  {{ taa.display(payable.chain) }}
                </Button>
                <p v-if="balances.length == compatibleATAAs.length && balances[i]">
                  <IconWallet class="w-3 h-3 inline-block mt-px mr-1 stroke-current" />
                  <span class="text-[10px] text-gray-500">
                    {{ Math.trunc(balances[i]! * 10 ** 5) / 10 ** 5 }}&nbsp;{{ taa.name }}</span
                  >
                </p>
              </div>
            </div>
            <small class="text-xs block text-red-500">{{ configError }}</small>
          </div>

          <template v-if="auth.currentUser">
            <p
              v-if="
                (allowsFreePayments || (!allowsFreePayments && aTAAs.length != 1)) &&
                selectedConfig &&
                selectedConfig.amount
              "
              class="mb-4"
            >
              You are paying
              <span class="font-bold text-2xl">{{ selectedConfig.display(auth.currentUser.chain) }}</span>
            </p>

            <!-- Same-chain payment: show Pay Now button normally -->
            <template v-if="isSameChain">
              <p class="mt-8 mb-24 text-right">
                <Button type="submit" class="text-xl px-6 py-2"> Pay Now </Button>
                <small class="text-xs block text-red-500 mt-1.5">{{ balanceError }}</small>
              </p>
            </template>

            <!-- Cross-chain EVM payment: same network type (both testnet or both mainnet) -->
            <template
              v-else-if="
                !isSameChain &&
                auth.currentUser.chain.isEvm &&
                payable.chain.isEvm &&
                auth.currentUser.chain.networkType === payable.chain.networkType
              "
            >
              <!-- Foreign payable not yet relayed to user's chain -->
              <div v-if="!isForeignPayableRelayed" class="mt-8 mb-24">
                <div class="max-w-lg mx-auto">
                  <!-- PrimeVue indeterminate progress bar -->
                  <ProgressBar mode="indeterminate" class="mb-4" :style="{ height: '4px' }" />

                  <p class="text-center text-gray-700 dark:text-gray-400 mb-4">
                    <span v-if="!isRechecking"> Relayer is bridging this payable across chains. Please wait ... </span>
                    <span v-else> Rechecking for relaying completion ... </span>
                  </p>

                  <p class="text-center">
                    <Button @click="checkForeignPayableRelayed" :disabled="isRechecking" class="text-sm px-4 py-1">
                      {{ isRechecking ? 'Checking...' : 'Refresh' }}
                    </Button>
                  </p>
                  <div v-if="isRechecking" class="mt-4 flex justify-center">
                    <IconSpinner class="w-4 h-4 animate-spin text-primary" />
                  </div>
                </div>
              </div>

              <!-- Foreign payable is available — show pay button -->
              <template v-else>
                <div
                  class="mt-6 mb-4 rounded-lg bg-primary bg-opacity-10 dark:bg-opacity-5 border border-primary border-opacity-30 px-4 py-3 text-sm"
                >
                  <p class="font-semibold mb-1">⚡ Cross-Chain Payment</p>
                  <p class="text-gray-600 dark:text-gray-400 leading-snug">
                    This payable is on <strong>{{ payable.chain.displayName }}</strong
                    >. Your payment will be bridged via <strong>Circle CCTP</strong> and will arrive after a relayer
                    confirms it on the destination chain.
                  </p>
                </div>
                <p class="mt-4 mb-24 text-right">
                  <Button type="submit" class="text-xl px-6 py-2"> Pay via CCTP </Button>
                  <small class="text-xs block text-red-500 mt-1.5">{{ balanceError }}</small>
                </p>
              </template>
            </template>

            <!-- Mainnet / Testnet mismatch: hard block with info message -->
            <template
              v-else-if="
                auth.currentUser.chain.isEvm &&
                payable.chain.isEvm &&
                auth.currentUser.chain.networkType !== payable.chain.networkType
              "
            >
              <div class="mt-8 mb-24 text-center max-w-lg mx-auto text-gray-700 dark:text-gray-400">
                <p class="mb-4">
                  This payable is on <strong>{{ payable.chain.displayName }}</strong> ({{ payable.chain.networkType }}),
                  but you're connected to
                  <strong>{{ auth.currentUser.chain.displayName }}</strong>
                  ({{ auth.currentUser.chain.networkType }}). Mainnet and testnet networks are not compatible — please
                  switch to a <strong>{{ payable.chain.networkType }}</strong> network to continue.
                </p>
                <SignInButton />
              </div>
            </template>

            <!-- Cross-chain involving Solana: not yet supported -->
            <template v-else>
              <div class="mt-8 mb-24 text-center max-w-lg mx-auto text-gray-700 dark:text-gray-400">
                <p>
                  Cross-Chain Payments are on the way. As for now, as this Payable was created on
                  {{ payable.chain.displayName }}, you can only pay while connected on {{ payable.chain.displayName }}.
                  Please Switch Chain to continue.
                </p>
                <SignInButton class="mt-4" />
              </div>
            </template>
          </template>
        </form>
      </div>
    </div>

    <template v-if="!auth.currentUser">
      <p class="mt-12 mb-6 text-center text-xl">Please connect your Wallet to continue</p>
      <p class="mx-auto w-fit max-md:mb-12">
        <SignInButton @click="analytics.recordEvent('clicked_signin', { from: 'payment_page' })" />
      </p>
    </template>
  </section>
</template>

<style scoped>
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
}

input[type='number'] {
  -mox-appearance: textfield;
  appearance: textfield;
}
</style>
