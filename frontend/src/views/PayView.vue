<script setup lang="ts">
import SignInButton from '@/components/SignInButton.vue';
import IconSpinner from '@/icons/IconSpinner.vue';
import { Payable, TokenAndAmount, tokens, type Token } from '@/schemas';
import { useAuthStore, usePaymentStore, type Chain } from '@/stores';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const amount = ref<any>('');
const amountError = ref('');
const auth = useAuthStore();
const balanceError = ref('');
const availableTokens = computed(() =>
  tokens.filter((t) => !auth.currentUser || !!t.details[auth.currentUser.chain])
);
const configError = ref('');
const isPaying = ref(false);
const payment = usePaymentStore();
const route = useRoute();
const payable = route.meta.details as Payable;
const { allowedTokensAndAmounts } = payable;
const allowsFreePayments = allowedTokensAndAmounts.length == 0;
const router = useRouter();
const selectedConfig = ref<TokenAndAmount | null>(null);
const selectedToken = ref<Token | null>(null);

const selectToken = (token: Token) => {
  // Obtaining a Choice Chain first is good when no wallet is connected
  // and the User is interacting with the dropdown of tokens.
  let choiceChain = auth.currentUser?.chain ?? payable.chain;
  // If the token the user selected has no details in the choice chain,
  // we default to the first chain that has details for the token.
  if (!token.details[choiceChain]) {
    choiceChain = Object.keys(token.details)[0] as Chain;
  }

  selectedConfig.value = new TokenAndAmount(
    token,
    amount.value * 10 ** token.details[choiceChain]!.decimals
  );
};

const validateAmount = () => {
  const v = amount.value;
  if (Number.isNaN(v) || +v == 0) amountError.value = 'Required';
  else if (v <= 0) amountError.value = 'Should be positive';
  else amountError.value = '';
  if (allowsFreePayments && selectedConfig.value) {
    selectedConfig.value.amount =
      v *
      10 **
        (selectedConfig.value.details[auth.currentUser?.chain ?? payable.chain]
          ?.decimals ?? 0);
  }
  validateBalance();
};

const validateBalance = async () => {
  if (!auth.currentUser) return;

  balanceError.value == '';
  if (!auth.currentUser.chain) return;
  if (selectedConfig.value) {
    const { name } = selectedConfig.value;
    const amt = selectedConfig.value.format(auth.currentUser.chain);
    const bal = await auth.balance(selectedConfig.value.token());
    if (bal === null) balanceError.value = '';
    else if (amt && bal < amt) {
      balanceError.value = `Insufficient Funds. You have ${bal === 0 ? 'no' : bal} ${name}.`;
    } else balanceError.value = '';
  }
};

const validateConfig = () => {
  if (!selectedConfig.value) {
    configError.value = allowsFreePayments
      ? 'Please select a token'
      : 'Please make a choice';
  } else configError.value = '';
};

const pay = async () => {
  validateAmount();
  await validateBalance();
  validateConfig();
  if (
    (allowsFreePayments && amountError.value) ||
    balanceError.value ||
    configError.value
  ) {
    return;
  }

  isPaying.value = true;
  const id = await payment.exec(payable.id, selectedConfig.value!);

  if (id) router.push(`/receipt/${id}`);
  else isPaying.value = false;
};

onMounted(() => {
  watch(() => amount.value, validateAmount);
  watch(
    () => selectedConfig.value,
    async () => {
      validateConfig();
      await validateBalance();
    }
  );
  watch(
    () => auth.currentUser,
    (_) => {
      // Reset the form when the user changes to avoid cross-chain token issues
      selectedConfig.value = null;
      selectedToken.value = null;
      configError.value = '';
      balanceError.value = '';
    }
  );

  if (!allowsFreePayments && allowedTokensAndAmounts.length == 1) {
    selectedConfig.value = allowedTokensAndAmounts[0];
  }

  if (allowsFreePayments) {
    setTimeout(() => {
      (
        document.querySelector('input.amount[type=number]') as HTMLInputElement
      ).addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
      });
    });
  }
});
</script>

<template>
  <section class="max-md:max-w-md md:max-w-screen-md mx-auto md:pt-8 pb-20">
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
              v-model="payable.description"
              class="outline-none w-full px-3 py-2 bg-primary bg-opacity-10 dark:bg-opacity-5 rounded-md shadow-inner mb-2 sm:mb-0 sm:mr-4"
            ></textarea>
          </div>
        </div>
      </div>

      <div class="grow md:max-w-xs md:mt-12">
        <div class="text-center pt-8" v-if="isPaying">
          <p class="mb-12">Paying ...</p>
          <IconSpinner height="144" width="144" class="mb-12 mx-auto" />
        </div>

        <form class="max-w-sm mx-auto" @submit.prevent="pay" v-else>
          <div class="mb-8 leading-tight" v-if="allowsFreePayments">
            <p class="mb-1">Amount</p>
            <div class="flex items-center mb-4">
              <div class="w-36 flex flex-col mr-4">
                <input
                  class="amount pb-1 border-b-2 mb-1 focus:outline-none focus:border-primary bg-transparent"
                  v-model="amount"
                  required
                  :min="0"
                  :step="10 ** -(1 * 18)"
                  type="number"
                  aria-label="Amount"
                />
                <small class="text-xs block text-red-500">{{
                  amountError
                }}</small>
              </div>
              <div class="flex flex-col">
                <Dropdown
                  :options="availableTokens"
                  optionLabel="name"
                  v-model="selectedToken"
                  @change="(e) => selectToken(e.value)"
                  placeholder="Select a Token"
                  class="mb-1"
                  ariaLabel="Select a Token"
                />
                <small class="text-xs block text-red-500">{{
                  configError
                }}</small>
              </div>
            </div>
          </div>

          <div class="pb-4" v-else>
            <p class="mb-1">
              {{
                allowedTokensAndAmounts.length == 1 ? 'Pay' : 'Select an Option'
              }}
            </p>
            <p
              class="font-bold text-3xl"
              v-if="allowedTokensAndAmounts.length == 1"
            >
              <!-- TODO: Review whether to use the payable's chain for 
           formatting tokenAndAmount display especially when swaps start -->
              {{ allowedTokensAndAmounts[0].display(payable.chain) }}
            </p>
            <div class="flex gap-2 flex-wrap mb-1" v-else>
              <Button
                v-for="taa of allowedTokensAndAmounts"
                :class="
                  'shadow-md px-3 py-2 ' +
                  (selectedConfig?.name == taa.name
                    ? 'bg-primary bg-opacity-30'
                    : '')
                "
                @click="selectedConfig = taa"
              >
                <!-- TODO: Review whether to use the payable's chain for 
           formatting tokenAndAmount display especially when swaps start -->
                {{ taa.display(payable.chain) }}
              </Button>
            </div>
            <small class="text-xs block text-red-500">{{ configError }}</small>
          </div>

          <template v-if="auth.currentUser">
            <p
              v-if="
                (allowsFreePayments ||
                  (!allowsFreePayments &&
                    allowedTokensAndAmounts.length != 1)) &&
                selectedConfig &&
                selectedConfig.amount
              "
              class="mb-4"
            >
              You are paying
              <span class="font-bold text-2xl">{{
                selectedConfig.display(auth.currentUser.chain)
              }}</span>
            </p>

            <small class="text-xs block text-red-500">{{ balanceError }}</small>
            <p
              class="mt-8 mb-24 text-right"
              v-if="auth.currentUser.chain == payable.chain"
            >
              <Button
                type="submit"
                class="bg-primary text-white dark:text-black text-xl px-6 py-2"
                >Pay Now</Button
              >
            </p>
          </template>
        </form>
      </div>
    </div>

    <template v-if="!auth.currentUser">
      <p class="mt-12 mb-6 text-center text-xl">
        Please connect your Wallet to continue
      </p>
      <p class="mx-auto w-fit max-md:mb-12"><SignInButton /></p>
    </template>

    <div
      class="mt-12 mb-6 text-center max-w-lg mx-auto text-gray-700 dark:text-gray-400"
      v-if="auth.currentUser && auth.currentUser.chain != payable.chain"
    >
      <p class="mb-8">
        Our Cross-Chain Features with
        <a
          href="https://wormhole.com"
          target="_blank"
          rel="noopener noreferer"
          class="underline text-primary"
          >Wormhole</a
        >
        are almost complete. As for now, as this Payable is on
        {{ payable.chain }}, you can only pay from {{ payable.chain }} wallets.
        Please switch wallets to continue.
      </p>
      <SignInButton />
    </div>
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
