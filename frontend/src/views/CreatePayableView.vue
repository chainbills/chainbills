<script setup lang="ts">
import SignInButton from '@/components/SignInButton.vue';
import IconClose from '@/icons/IconClose.vue';
import IconSpinner from '@/icons/IconSpinner.vue';
import {
  TokenAndAmount,
  tokens,
  type Token,
} from '@/schemas/tokens-and-amounts';
import { useChainStore } from '@/stores';
import { usePayableStore } from '@/stores/payable';
import { useWalletStore } from '@/stores/wallet';
import DomPurify from 'dompurify';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import InputSwitch from 'primevue/inputswitch';
import { computed, onMounted, ref, watch, type Ref } from 'vue';
import { useRouter } from 'vue-router';

const allowsFreePayments = ref(false);
const amounts = ref<Ref[]>([]);
const amountErrors = ref<Ref[]>([]);
const chain = useChainStore();
const availableTokens = computed(() =>
  tokens.filter((t) => chain.current && !!t.details[chain.current!])
);
const configError = ref('');
const displayedConfig = ref<TokenAndAmount[]>([]);
const isCreating = ref(false);
const description = ref('');
const descriptionError = ref('');
const payable = usePayableStore();
const router = useRouter();
const selectedTokens = ref<Token[]>([]);
const wallet = useWalletStore();

const removeToken = (index: number) => {
  selectedTokens.value.splice(index, 1);
  selectedTokens.value = [...selectedTokens.value];
  amounts.value.splice(index, 1);
  amountErrors.value.splice(index, 1);
};

const chooseToken = (token: any) => {
  selectedTokens.value = [...selectedTokens.value, token];
  // wrapping in set time out to allow the other listeners to finish
  setTimeout(() => {
    // undefined is to keep the placeholder (Amount) in the input field
    amounts.value.push(ref(undefined));
    amountErrors.value.push(ref('Required'));
    displayedConfig.value = [];
  });
};

const updateDisplayedConfig = () => {
  const tokensAndAmounts: TokenAndAmount[] = [];
  if (!allowsFreePayments.value) {
    for (let i = 0; i < amounts.value.length; i++) {
      amountErrors.value[i].value = validateAmount(amounts.value[i].value);
      if (amountErrors.value[i].value) {
        displayedConfig.value = [];
        return;
      } else {
        tokensAndAmounts.push(
          new TokenAndAmount(selectedTokens.value[i], amounts.value[i].value)
        );
      }
    }
    displayedConfig.value = tokensAndAmounts;
  }
};

const validateAmount = (v: any) => {
  if (Number.isNaN(v) || +v == 0) return 'Required';
  else if (v <= 0) return 'Should be positive';
  else return '';
};

const validateConfig = () => {
  configError.value =
    !allowsFreePayments.value && selectedTokens.value.length == 0
      ? 'Either allow free payments OR specify at least one allowed ' +
        'token and its amount.'
      : '';
};

const validateDescription = () => {
  const v = description.value.trim();
  if (v.length == 0) descriptionError.value = 'Required';
  else if (v.length < 15) descriptionError.value = 'Min. 15 characters';
  else if (v.length > 3000) descriptionError.value = 'Max. 3000 characters';
  else descriptionError.value = '';
};

const create = async () => {
  validateDescription();
  validateConfig();
  if (descriptionError.value || configError.value) return;

  const tokensAndAmounts: TokenAndAmount[] = [];
  if (!allowsFreePayments.value) {
    for (let i = 0; i < amounts.value.length; i++) {
      amountErrors.value[i].value = validateAmount(amounts.value[i].value);
      if (amountErrors.value[i].value) return;
      else
        tokensAndAmounts.push(
          new TokenAndAmount(
            selectedTokens.value[i],
            amounts.value[i].value *
              10 ** selectedTokens.value[i].details[chain.current!]!.decimals
          )
        );
    }
  }

  isCreating.value = true;
  const id = await payable.create(
    DomPurify.sanitize(description.value.trim()),
    tokensAndAmounts
  );
  isCreating.value = false;

  if (id) router.push(`/payable/${id}`);
};

const reviewConfig = () => {
  updateDisplayedConfig();
  validateConfig();
};

onMounted(() => {
  watch(() => description.value, validateDescription);
  watch(() => allowsFreePayments.value, reviewConfig);
  watch(() => selectedTokens.value, reviewConfig);
});
</script>

<template>
  <section class="pt-12 md:pt-4 pb-20">
    <h2
      class="text-center text-xl max-w-sm md:text-2xl md:max-w-lg mx-auto mb-12"
    >
      Create a Payable to Receive Payments on any chain from anyone
    </h2>

    <div class="text-center pb-20" v-if="!wallet.connected">
      <p class="mb-8">Please connect your wallet to continue.</p>
      <p class="mx-auto w-fit"><SignInButton /></p>
    </div>

    <div class="text-center" v-else-if="isCreating">
      <p class="mb-12">Creating ...</p>
      <IconSpinner height="144" width="144" class="mb-12 mx-auto" />
    </div>

    <form
      class="max-md:max-w-sm md:max-w-screen-md mx-auto md:flex gap-12"
      @submit.prevent="create"
      v-else
    >
      <div class="grow">
        <label
          :class="
            'text-sm focus-within:text-primary ' +
            (descriptionError ? 'text-red-500 focus-within:text-red-500' : '')
          "
        >
          <span>Description *</span>
          <small class="text-xs text-gray-500 block mb-2"
            >About your Payable. What others see when they are paying.</small
          >
          <textarea
            class="block w-full pb-1 border-b-2 mb-1 focus:outline-none focus:border-primary bg-transparent"
            :style="{ color: 'var(--text)' }"
            required
            @input="() => (description = DomPurify.sanitize(description))"
            v-model="description"
            rows="5"
          ></textarea>
          <small class="text-xs block mb-10">{{ descriptionError }}</small>
        </label>
      </div>

      <div class="">
        <div class="mb-10">
          <label for="allow-any-token" class="inline-block"
            >Allow Free Payments ?
          </label>
          <small class="text-xs text-gray-500 block mb-4"
            >Do you want to accept any token and any amount?</small
          >
          <p class="flex items-center">
            <span :class="'mr-2 ' + (allowsFreePayments ? '' : 'font-bold')"
              >No</span
            >
            <InputSwitch
              inputId="allow-any-token"
              v-model="allowsFreePayments"
            />
            <span :class="'ml-2 ' + (allowsFreePayments ? 'font-bold' : '')"
              >Yes</span
            >
          </p>
        </div>

        <template v-if="!allowsFreePayments">
          <p>Allowed Tokens and Amounts</p>
          <small class="text-xs text-gray-500 block mb-4"
            >If no above, please specify the payments you want.</small
          >
          <label
            v-for="(token, i) of selectedTokens"
            class="flex items-start mb-4"
          >
            <div class="w-36 flex flex-col mr-4">
              <input
                class="pb-1 border-b-2 mb-1 focus:outline-none focus:border-primary bg-transparent"
                placeholder="Amount"
                v-model="amounts[i].value"
                required
                :min="0"
                :step="10 ** (-1 * 18)"
                type="number"
                @input="
                  () => {
                    amountErrors[i].value = validateAmount(amounts[i].value);
                    updateDisplayedConfig();
                  }
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
            :options="
              availableTokens.filter(
                (t) => !selectedTokens.find((st) => st.name == t.name)
              )
            "
            optionLabel="name"
            v-if="availableTokens.length > selectedTokens.length"
            @change="(e) => chooseToken(e.value)"
            placeholder="Select a Token"
            class="mb-2"
          />
        </template>
        <small class="text-xs block mb-2 text-red-500 md:max-w-xs">{{
          configError
        }}</small>

        <p v-if="allowsFreePayments" class="text-xl mb-2 md:max-w-xs">
          This payable will accept payments of any amounts in any token.
        </p>
        <p v-else-if="displayedConfig.length == 1" class="md:max-w-xs">
          This payable will accept
          <span class="font-bold text-2xl"
            >{{ displayedConfig[0].amount }}&nbsp;{{
              displayedConfig[0].name
            }}</span
          >
        </p>
        <div class="pt-4" v-else-if="displayedConfig.length > 1">
          <p class="mb-2 text-lg md:max-w-xs">
            This payable will accept <span class="font-bold">any</span> of the
            following
          </p>
          <div class="flex gap-4 flex-wrap">
            <span
              v-for="config of displayedConfig"
              class="border rounded-md px-3 py-2 font-medium text-xl"
              style="border-color: var(--shadow)"
            >
              {{ config.amount }}&nbsp;{{ config.name }}
            </span>
          </div>
        </div>

        <p class="mt-12 text-right">
          <Button
            type="submit"
            class="bg-primary text-white dark:text-black text-xl px-6 py-2"
            >Create</Button
          >
        </p>
      </div>
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
