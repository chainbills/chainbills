<script setup lang="ts">
import ConnectWalletButton from '@/components/ConnectWalletButton.vue';
import IconSpinner from '@/icons/IconSpinner.vue';
import { Payable } from '@/schemas/payable';
import {
  TokenAndAmount,
  tokens,
  type Token,
} from '@/schemas/tokens-and-amounts';
import { useChainStore } from '@/stores/chain';
import { usePaymentStore } from '@/stores/payment';
import { useWalletStore } from '@/stores/wallet';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import { onMounted, ref, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const amount = ref<any>('');
const amountError = ref('');
const balanceError = ref('');
const chain = useChainStore();
const configError = ref('');
const emailInput = ref(null) as unknown as Ref<HTMLInputElement>;
const email = ref('');
const emailError = ref('');
const isPaying = ref(false);
const payment = usePaymentStore();
const route = useRoute();
const details = route.meta.details as Payable;
const { allowsFreePayments, tokensAndAmounts } = details;
const router = useRouter();
const selectedConfig = ref<TokenAndAmount>();
const selectedToken = ref<Token>();
const wallet = useWalletStore();

const selectToken = (token: Token) => {
  selectedConfig.value = new TokenAndAmount(token, amount.value);
};

const validateAmount = () => {
  const v = amount.value;
  if (Number.isNaN(v) || +v == 0) amountError.value = 'Required';
  else if (v <= 0) amountError.value = 'Should be positive';
  else amountError.value = '';
  if (allowsFreePayments && selectedConfig.value) {
    selectedConfig.value.amount = v;
  }
};

const validateBalance = async () => {
  if (!wallet.whAddress) return;

  balanceError.value == '';
  if (selectedConfig.value) {
    const { amount: amt, name } = selectedConfig.value;
    const balance = await wallet.balance(selectedConfig.value.token());
    if (balance === null) balanceError.value = '';
    else if (amt && balance < amt) {
      balanceError.value =
        balance === 0
          ? `You have no ${name} and can't pay.`
          : `You have only ${balance} ${name} and it is less than ` +
            `the required ${amt} ${name}.`;
    } else balanceError.value = '';
  }
};

const validateConfig = () => {
  if (!selectedConfig.value) {
    configError.value = details.allowsFreePayments
      ? 'Please select a token'
      : 'Please make a choice';
  } else configError.value = '';
};

const validateEmail = () => {
  const { typeMismatch, valid, valueMissing } = emailInput.value.validity;
  if (valueMissing) emailError.value = 'Required';
  else if (typeMismatch) emailError.value = 'Invalid Email';
  else if (valid) emailError.value = '';
  else emailError.value = emailInput.value.validationMessage;
};

const pay = async () => {
  validateAmount();
  await validateBalance();
  validateConfig();
  validateEmail();
  if (
    (allowsFreePayments && amountError.value) ||
    balanceError.value ||
    emailError.value ||
    configError.value
  ) {
    return;
  }

  isPaying.value = true;
  const id = await payment.pay(email.value, details.id, selectedConfig.value!);

  if (id) router.push(`/receipt/${id}`);
  else isPaying.value = false;
};

onMounted(() => {
  watch(() => amount.value, validateAmount);
  watch(() => email.value, validateEmail);
  watch(
    () => selectedConfig.value,
    async () => {
      validateConfig();
      await validateBalance();
    },
  );
  watch(() => wallet.whAddress, validateBalance);

  if (!allowsFreePayments && tokensAndAmounts.length == 1) {
    selectedConfig.value = tokensAndAmounts[0];
  }
});
</script>

<template>
  <section class="max-w-md mx-auto pb-20">
    <h2 class="text-3xl mb-4 font-bold">Make Payment</h2>

    <p class="mb-8 leading-tight">
      <span>Payable ID:</span><br />
      <span class="text-xs break-all text-gray-500">{{ details.id }}</span>
    </p>

    <div class="max-w-lg">
      <h3 class="font-medium mb-2">Description</h3>
      <div class="mb-8 sm:flex items-end">
        <textarea
          readonly
          v-model="details.description"
          class="outline-none w-full px-3 py-2 bg-blue-50 dark:bg-slate-900 rounded-md shadow-inner mb-2 sm:mb-0 sm:mr-4"
        ></textarea>
      </div>
    </div>

    <div class="text-center pt-8" v-if="isPaying">
      <p class="mb-12">Paying ...</p>
      <IconSpinner height="144" width="144" class="mb-12 mx-auto" />
    </div>

    <form class="max-w-sm mx-auto" @submit.prevent="pay" v-else>
      <label
        :class="
          'text-sm focus-within:text-blue-500 ' +
          (emailError ? 'text-red-500 focus-within:text-red-500' : '')
        "
        ><span>Email *</span>
        <small class="text-xs text-gray-500 block mb-2"
          >For Notifications</small
        >
        <input
          type="email"
          v-model="email"
          ref="emailInput"
          autocomplete="email"
          class="block w-full pb-1 border-b-2 mb-1 focus:outline-none focus:border-blue-500 bg-transparent"
          :style="{ color: 'var(--text)' }"
          required
        />
        <small class="text-xs block mb-10">{{ emailError }}</small>
      </label>

      <div class="mb-8 leading-tight" v-if="allowsFreePayments">
        <p class="mb-1">Amount</p>
        <div class="flex items-center mb-4">
          <div class="w-36 flex flex-col mr-4">
            <input
              class="pb-1 border-b-2 mb-1 focus:outline-none focus:border-blue-500 bg-transparent"
              v-model="amount"
              required
              :min="0"
              :step="10 ** (-1 * 18)"
              type="number"
              aria-label="Amount"
            />
            <small class="text-xs block text-red-500">{{ amountError }}</small>
          </div>
          <div class="flex flex-col">
            <Dropdown
              :options="tokens"
              optionLabel="name"
              v-model="selectedToken"
              @change="(e) => selectToken(e.value)"
              placeholder="Select a Token"
              class="mb-1"
              ariaLabel="Select a Token"
            />
            <small class="text-xs block text-red-500">{{ configError }}</small>
          </div>
        </div>
      </div>

      <div class="pb-4" v-else>
        <p class="mb-1">
          {{ tokensAndAmounts.length == 1 ? 'Pay' : 'Select an Option' }}
        </p>
        <p class="font-bold text-3xl" v-if="tokensAndAmounts.length == 1">
          {{ tokensAndAmounts[0].display(chain.current ?? 'Solana') }}
        </p>
        <div class="flex gap-2 flex-wrap mb-1" v-else>
          <!-- TODO: Review whether to use the current chain for formatting -->
          <Button
            v-for="taa of tokensAndAmounts"
            :class="
              'shadow-md px-3 py-2 ' +
              (selectedConfig?.name == taa.name
                ? 'bg-blue-300 dark:bg-slate-800'
                : '')
            "
            @click="selectedConfig = taa"
          >
            {{ taa.display(chain.current ?? 'Solana') }}
          </Button>
        </div>
        <small class="text-xs block text-red-500">{{ configError }}</small>
      </div>

      <template v-if="wallet.whAddress">
        <p
          v-if="
            (allowsFreePayments ||
              (!allowsFreePayments && tokensAndAmounts.length != 1)) &&
            selectedConfig &&
            selectedConfig.amount
          "
          class="mb-4"
        >
          You are paying
          <span class="font-bold text-2xl">{{
            selectedConfig.display(chain.current ?? 'Solana')
          }}</span>
        </p>

        <small class="text-xs block text-red-500">{{ balanceError }}</small>
        <p class="mt-8 sm:mt-20 mb-24 text-right sm:text-center">
          <Button
            type="submit"
            class="bg-blue-500 text-white dark:text-black text-xl px-6 py-2"
            >Pay Now</Button
          >
        </p>
      </template>
    </form>

    <template v-if="!wallet.whAddress">
      <p class="my-12 text-center text-xl">
        Please connect your Wallet to continue
      </p>
      <p class="mx-auto w-fit"><ConnectWalletButton /></p>
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
