<script setup lang="ts">
import IconClose from '@/icons/IconClose.vue';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import InputSwitch from 'primevue/inputswitch';
import { ref, type Ref } from 'vue';

const allowAnyToken = ref(false);
const description = ref('');
const email = ref('');
const tokens = ref(['USDC', 'SOL', 'ETH']);
const selectedTokens = ref<string[]>([]);
const amounts = ref<Ref[]>([]);
const selectToken = (token: string) => {
  selectedTokens.value.push(token);
  amounts.value.push(ref(0));
};
const removeToken = (index: number) => {
  selectedTokens.value.splice(index, 1);
  amounts.value.splice(index, 1);
};
</script>

<template>
  <section class="pt-12 pb-20">
    <h2
      class="text-center text-xl max-w-sm md:text-2xl md:max-w-lg mx-auto mb-12"
    >
      Create a Payable to Receive Payments on any chain from anyone
    </h2>
    <form class="max-w-sm mx-auto" novalidate>
      <label for="email" class="text-sm">Email * </label>
      <small class="text-xs text-gray-500 block mb-2">For Notifications</small>
      <input
        id="email"
        type="email"
        v-model="email"
        class="block w-full pb-1 border-b-2 mb-12 focus:outline-none focus:valid:border-blue-500 invalid:border-red-500 bg-transparent"
        required
      />

      <label for="description" class="text-sm">Description * </label>
      <small class="text-xs text-gray-500 block mb-2"
        >What users see when paying</small
      >
      <textarea
        id="description"
        class="block w-full pb-1 border-b-2 mb-12 focus:outline-none focus:valid:border-blue-500 invalid:border-red-500 bg-transparent"
        required
        v-model="description"
      ></textarea>

      <div class="mb-12">
        <label for="allow-any-token" class="mb-2 inline-block"
          >Allow Payments in any Token ?
        </label>
        <p class="flex items-center">
          <span :class="'mr-2 ' + (allowAnyToken ? '' : 'font-bold')">No</span>
          <InputSwitch inputId="allow-any-token" v-model="allowAnyToken" />
          <span :class="'ml-2 ' + (allowAnyToken ? 'font-bold' : '')">Yes</span>
        </p>
      </div>

      <p class="mb-2">Accepted Tokens</p>
      <label
        v-for="(token, i) of selectedTokens"
        class="flex items-center mb-4"
      >
        <input
          class="w-36 pb-1 border-b-2 mr-4 focus:outline-none focus:valid:border-blue-500 invalid:border-red-500 bg-transparent"
          placeholder="Amount"
          :v-model="amounts[i]"
          type="number"
          required
          :min="0"
          :step="10 ** -9"
        />
        <span class="px-2 py-1 border mr-2 rounded">{{ token }}</span>
        <Button
          @click="() => removeToken(i)"
          :aria-label="'Remove Selected ' + token"
          ><IconClose
        /></Button>
      </label>
      <Dropdown
        :options="tokens.filter((t) => !selectedTokens.includes(t))"
        v-if="tokens.length > selectedTokens.length"
        @change="(e) => selectToken(e.value)"
        placeholder="Select a Token"
        class="mb-4"
      />

      <p class="mt-12 sm:mt-20 mb-24 text-right sm:text-center">
        <Button class="bg-blue-500 text-white dark:text-black text-xl px-6 py-2"
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
