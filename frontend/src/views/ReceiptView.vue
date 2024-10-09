<script setup lang="ts">
import {
  Payable,
  PayablePayment,
  UserPayment,
  Withdrawal,
  type Receipt,
} from '@/schemas';
import { useTimeStore, useWalletStore } from '@/stores';
import Button from 'primevue/button';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const receipt = route.meta.receipt as Receipt;
const payableDetails = route.meta.payable as Payable;

const time = useTimeStore();
const wallet = useWalletStore();

const receiptType = receipt instanceof Withdrawal ? 'Withdrawal' : 'Payment';
const userType = receipt instanceof Withdrawal ? 'Host' : 'Payer';
const activityType = receipt instanceof Withdrawal ? 'Withdrew' : 'Paid';
const payableIntro =
  receipt instanceof Withdrawal ? 'Withdrew From' : 'Paid To';

const userChain =
  receipt instanceof PayablePayment
    ? (receipt as PayablePayment).payerChain
    : receipt.chain;
const payableChain =
  receipt instanceof UserPayment
    ? (receipt as UserPayment).payableChain
    : receipt.chain;

const isMine = computed(() => wallet.address == payableDetails.host);
const payableRoute = computed(
  () => `/${isMine.value ? 'payable' : 'pay'}/${receipt.payableId}`
);
</script>

<template>
  <section class="max-w-screen-md mx-auto pb-20">
    <h2 class="text-3xl mb-4 font-bold">{{ receiptType }} Receipt</h2>

    <p class="mb-8 leading-tight">
      <span>Receipt ID:</span><br />
      <span class="text-xs break-all text-gray-500">{{ receipt.id }}</span>
    </p>

    <p class="mb-8 leading-tight" v-if="userChain == payableChain">
      <span>Chain:</span><br />
      <span class="text-xs break-all text-gray-500">{{ userChain }}</span>
    </p>

    <p class="mb-8 leading-tight">
      <span>{{ userType }}'s Wallet Address:</span><br />
      <span class="text-xs break-all text-gray-500">{{ receipt.user() }}</span>
    </p>

    <p class="mb-8 leading-tight" v-if="userChain != payableChain">
      <span>{{ userType }}'s Chain:</span><br />
      <span class="text-xs break-all text-gray-500">{{ userChain }}</span>
    </p>

    <p class="mb-8 leading-tight">
      <span>{{ activityType }}:</span><br />
      <span class="text-xl font-bold">{{
        receipt.details.display(receipt.chain)
      }}</span>
    </p>

    <p class="mb-8 leading-tight">
      <span>{{ activityType }} At:</span><br />
      <span class="text-lg font-bold">{{
        time.display(receipt.timestamp)
      }}</span>
    </p>

    <p class="mb-8 leading-tight">
      <span>{{ payableIntro }} (Payable ID):</span><br />
      <router-link
        :to="payableRoute"
        class="text-xs break-all text-gray-500 underline"
      >
        {{ receipt.payableId }}
      </router-link>
    </p>

    <p class="mb-8 leading-tight" v-if="payableChain != userChain">
      <span>Payable's Chain:</span><br />
      <span class="text-xs break-all text-gray-500">{{ payableChain }}</span>
    </p>

    <div
      class="max-w-lg"
      v-if="payableDetails && !(receipt instanceof Withdrawal)"
    >
      <h3 class="font-medium mb-2">Paid For:</h3>
      <div class="mb-8 sm:flex items-end">
        <textarea
          readonly
          v-model="payableDetails.description"
          class="outline-none w-full px-3 py-2 bg-blue-50 dark:bg-slate-900 rounded-md shadow-inner mb-2 sm:mb-0 sm:mr-4"
        ></textarea>
      </div>
    </div>

    <p
      class="text-lg text-center max-w-md mx-auto pt-12 mb-8"
      v-if="!(receipt instanceof Withdrawal)"
    >
      Receive money from anyone on anychain on
      <span class="font-bold text-primary">Chainbills</span>. Get Started with
      us today by Creating a Payable.
    </p>
    <p class="text-center" v-if="!(receipt instanceof Withdrawal)">
      <router-link to="/start">
        <Button class="bg-primary text-white dark:text-black px-3 py-2"
          >Get Started</Button
        >
      </router-link>
    </p>
  </section>
</template>
