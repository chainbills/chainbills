<script setup lang="ts">
import IconCopy from '@/icons/IconCopy.vue';
import IconOpenInNew from '@/icons/IconOpenInNew.vue';
import {
  PayablePayment,
  UserPayment,
  Withdrawal,
  type Receipt,
} from '@/schemas';
import { useAuthStore, useTimeStore } from '@/stores';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const auth = useAuthStore();
const route = useRoute();
const receipt = route.meta.receipt as Receipt;
const time = useTimeStore();
const toast = useToast();

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

const payableRoute = computed(() => {
  const isMine = auth.currentUser?.walletAddress == receipt.user();
  return (
    `/${receipt instanceof Withdrawal && isMine ? 'payable' : 'pay'}/` +
    receipt.payableId
  );
});

const copy = (text: string, context: string) => {
  navigator.clipboard.writeText(text);
  toast.add({
    severity: 'info',
    summary: 'Copied',
    detail: `${context} copied to clipboard`,
    life: 3000,
  });
};
</script>

<template>
  <section class="max-w-screen-md mx-auto pb-20">
    <h2 class="text-3xl mb-4 font-bold">{{ receiptType }} Receipt</h2>

    <div class="mb-8 leading-tight">
      <span>Receipt ID:</span>
      <p class="mt-1 flex items-center">
        <span class="text-xs break-all text-gray-500 mr-1">{{
          receipt.id
        }}</span>
        <Button
          class="bg-transparent p-1 border-none"
          @click="copy(receipt.id, `Receipt ID: ${receipt.id}`)"
          title="Copy Receipt ID"
        >
          <IconCopy class="text-primary" />
        </Button>
      </p>
    </div>

    <p class="mb-8 leading-tight" v-if="userChain == payableChain">
      <span>Chain:</span><br />
      <span class="text-xs break-all text-gray-500">{{ userChain }}</span>
    </p>

    <div class="mb-8 leading-tight">
      <span>{{ userType }}'s Wallet Address:</span>
      <p class="mt-1 flex items-center">
        <span class="text-xs break-all text-gray-500 mr-1">
          {{ receipt.user() }}
        </span>
        <Button
          class="bg-transparent p-1 border-none"
          @click="copy(receipt.user(), `Wallet Address: ${receipt.user()}`)"
          title="Copy Wallet Address"
        >
          <IconCopy class="text-primary" />
        </Button>
        <a
          :href="auth.getExplorerUrl(receipt.user(), userChain)"
          target="_blank"
          rel="noopener noreferrer"
          title="View on Explorer"
          class="p-1 rounded-md"
          v-ripple
        >
          <IconOpenInNew class="text-primary" />
        </a>
      </p>
    </div>

    <p class="mb-8 leading-tight" v-if="userChain != payableChain">
      <span>{{ userType }}'s Chain:</span><br />
      <span class="text-xs break-all text-gray-500">{{ userChain }}</span>
    </p>

    <div class="mb-8 leading-tight">
      <span>{{ activityType }}:</span>
      <p class="mt-1 flex gap-x-2 items-center">
        <img
          :src="`/assets/tokens/${receipt.details.name}.png`"
          class="w-6 h-6"
          aria-hidden="true"
        />
        <span class="text-xl font-bold">{{
          receipt.details.display(receipt.chain)
        }}</span>
      </p>
    </div>

    <p class="mb-8 leading-tight">
      <span>{{ activityType }} At:</span><br />
      <span class="text-lg font-bold">{{
        time.display(receipt.timestamp)
      }}</span>
    </p>

    <div class="mb-8 leading-tight">
      <span>{{ payableIntro }} (Payable ID):</span>
      <p class="mt-1 flex items-center">
        <span class="text-xs break-all text-gray-500 mr-1">
          {{ receipt.payableId }}
        </span>
        <Button
          class="bg-transparent p-1 border-none"
          @click="copy(receipt.payableId, `Payable ID: ${receipt.payableId}`)"
          title="Copy Payable ID"
        >
          <IconCopy class="text-primary" />
        </Button>
        <a
          :href="`${payableRoute}`"
          target="_blank"
          rel="noopener noreferrer"
          title="About"
          class="p-1 rounded-md"
          v-ripple
        >
          <IconOpenInNew class="text-primary" />
        </a>
      </p>
    </div>

    <p class="mb-8 leading-tight" v-if="payableChain != userChain">
      <span>Payable's Chain:</span><br />
      <span class="text-xs break-all text-gray-500">{{ payableChain }}</span>
    </p>

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
        <Button class="px-3 py-2">Get Started</Button>
      </router-link>
    </p>
  </section>
</template>
