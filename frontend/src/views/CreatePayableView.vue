<script setup lang="ts">
import ConnectWalletButton from '@/components/ConnectWalletButton.vue';
import IconClose from '@/icons/IconClose.vue';
import IconSpinner from '@/icons/IconSpinner.vue';
import { tokens, useSolanaProgramStore } from '@/stores/solana-program';
import DomPurify from 'dompurify';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import InputSwitch from 'primevue/inputswitch';
import { useAnchorWallet } from 'solana-wallets-vue';
import { onMounted, ref, watch, type Ref } from 'vue';
import { useRouter } from 'vue-router';

const isCreating = ref(false);
const allowAnyToken = ref(false);
const description = ref('');
const descriptionError = ref('');
const emailInput = ref(null) as unknown as Ref<HTMLInputElement>;
const email = ref('');
const emailError = ref('');
const configError = ref('');
const selectedTokens = ref<any[]>([]);
const amounts = ref<Ref[]>([]);
const amountErrors = ref<Ref[]>([]);
const solanaProgram = useSolanaProgramStore();
const router = useRouter();
const wallet = useAnchorWallet();

const selectToken = (token: any) => {
  selectedTokens.value = [...selectedTokens.value, token];
  amounts.value.push(ref(0));
  amountErrors.value.push(ref(''));
};

const removeToken = (index: number) => {
  selectedTokens.value.splice(index, 1);
  selectedTokens.value = [...selectedTokens.value];
  amounts.value.splice(index, 1);
  amountErrors.value.splice(index, 1);
};

const validateDescription = () => {
  const v = description.value;
  if (v.length == 0) descriptionError.value = 'Required';
  else if (v.length < 15) descriptionError.value = 'Min. 15 characters';
  // From MAX_PAYABLES_DESCRIPTION_LENGTH in the solana program
  else if (v.length > 3000) descriptionError.value = 'Max. 3000 characters';
  else descriptionError.value = '';
};

const validateEmail = () => {
  const { typeMismatch, valid, valueMissing } = emailInput.value.validity;
  if (valueMissing) emailError.value = 'Required';
  else if (typeMismatch) emailError.value = 'Invalid Email';
  else if (valid) emailError.value = '';
  else emailError.value = emailInput.value.validationMessage;
};

const validateConfig = () => {
  configError.value =
    !allowAnyToken.value && selectedTokens.value.length == 0
      ? 'Either allow payments in any token or specify at least one accepted token or both.'
      : '';
};

const validateAmount = (v: any) => {
  if (Number.isNaN(v) || +v == 0) return 'Required';
  else if (v <= 0) return 'Should be positive';
  else return '';
};

const create = async () => {
  validateEmail();
  validateDescription();
  validateConfig();
  if (emailError.value || descriptionError.value || configError.value) return;

  const tokensAndAmounts = [];
  for (let i = 0; i < amounts.value.length; i++) {
    amountErrors.value[i].value = validateAmount(amounts.value[i].value);
    if (amountErrors.value[i].value) return;
    else
      tokensAndAmounts.push({
        token: selectedTokens.value[i].address,
        amount: amounts.value[i].value * 10 ** selectedTokens.value[i].decimals,
      });
  }

  isCreating.value = true;
  const address = await solanaProgram.initializePayable(
    email.value,
    DomPurify.sanitize(description.value),
    tokensAndAmounts,
    allowAnyToken.value,
  );
  isCreating.value = false;

  if (address) router.push(`/payable/${address}`);
};

onMounted(() => {
  watch(() => email.value, validateEmail);
  watch(() => description.value, validateDescription);
  watch(() => allowAnyToken.value, validateConfig);
  watch(() => selectedTokens.value, validateConfig);
});
</script>

<template>
  <section class="pt-12 pb-20">
    <h2
      class="text-center text-xl max-w-sm md:text-2xl md:max-w-lg mx-auto mb-12"
    >
      Create a Payable to Receive Payments on any chain from anyone
    </h2>

    <div class="text-center pb-20" v-if="!wallet">
      <p class="mb-8">Please connect your wallet to continue.</p>
      <p class="mx-auto w-fit"><ConnectWalletButton /></p>
    </div>

    <div class="text-center" v-else-if="isCreating">
      <p class="mb-12">Creating ...</p>
      <IconSpinner height="144" width="144" class="mb-12 mx-auto" />
      <p class="pb-24">
        <Button
          @click="isCreating = false"
          class="border border-blue-500 text-blue-500 text-sm px-3 py-1 mr-6"
          >Cancel</Button
        >
        <Button
          @click="isCreating = false"
          class="border border-blue-500 text-blue-500 text-sm px-3 py-1"
          >Retry</Button
        >
      </p>
    </div>

    <form class="max-w-sm mx-auto" @submit.prevent="create" v-else>
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

      <label
        :class="
          'text-sm focus-within:text-blue-500 ' +
          (descriptionError ? 'text-red-500 focus-within:text-red-500' : '')
        "
      >
        <span>Description *</span>
        <small class="text-xs text-gray-500 block mb-2"
          >What others see when they are paying</small
        >
        <textarea
          class="block w-full pb-1 border-b-2 mb-1 focus:outline-none focus:border-blue-500 bg-transparent"
          :style="{ color: 'var(--text)' }"
          required
          @input="() => (description = DomPurify.sanitize(description))"
          v-model="description"
          rows="5"
        ></textarea>
        <small class="text-xs block mb-10">{{ descriptionError }}</small>
      </label>

      <div class="mb-12">
        <label for="allow-any-token" class="inline-block"
          >Allow Payments in any Token ?
        </label>
        <small class="text-xs text-gray-500 block mb-4"
          >Permanent. You can't change this after creating.</small
        >
        <p class="flex items-center">
          <span :class="'mr-2 ' + (allowAnyToken ? '' : 'font-bold')">No</span>
          <InputSwitch inputId="allow-any-token" v-model="allowAnyToken" />
          <span :class="'ml-2 ' + (allowAnyToken ? 'font-bold' : '')">Yes</span>
        </p>
      </div>

      <p>Accepted Tokens and Amounts</p>
      <small class="text-xs text-gray-500 block mb-4"
        >Permanent. You can't change this after creating.</small
      >
      <label v-for="(token, i) of selectedTokens" class="flex items-start mb-4">
        <div class="w-36 flex flex-col mr-4">
          <input
            class="pb-1 border-b-2 mb-1 focus:outline-none focus:border-blue-500 bg-transparent"
            placeholder="Amount"
            v-model="amounts[i].value"
            required
            :min="0"
            :step="10 ** (-1 * 18)"
            type="number"
            @input="
              () => (amountErrors[i].value = validateAmount(amounts[i].value))
            "
          />
          <small class="text-xs block text-red-500">{{
            amountErrors[i].value
          }}</small>
        </div>
        <span class="px-2 py-1 border mr-2 rounded">{{ token.name }}</span>
        <Button
          @click="() => removeToken(i)"
          type="button"
          :aria-label="'Remove Selected ' + token"
        >
          <IconClose />
        </Button>
      </label>
      <Dropdown
        :options="tokens.filter((t) => !selectedTokens.includes(t))"
        optionLabel="name"
        v-if="tokens.length > selectedTokens.length"
        @change="(e) => selectToken(e.value)"
        placeholder="Select a Token"
        class="mb-2"
      />
      <small class="text-xs block mb-2 text-red-500">{{ configError }}</small>

      <p class="mt-12 sm:mt-20 mb-24 text-right sm:text-center">
        <Button
          type="submit"
          class="bg-blue-500 text-white dark:text-black text-xl px-6 py-2"
          >Create</Button
        >
      </p>
    </form>
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
