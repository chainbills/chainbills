<script setup lang="ts">
import ReceiptLoader from '@/components/ReceiptLoader.vue';
import IconCopy from '@/icons/IconCopy.vue';
import IconOpenInNew from '@/icons/IconOpenInNew.vue';
import {
  PayablePayment,
  UserPayment,
  Withdrawal,
  type Receipt,
} from '@/schemas';
import {
  useAuthStore,
  usePaymentStore,
  useTimeStore,
  useWithdrawalStore,
} from '@/stores';
import NotFoundView from '@/views/NotFoundView.vue';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const auth = useAuthStore();
const isLoading = ref(true);
const payments = usePaymentStore();
const route = useRoute();
const receipt = ref<Receipt | null>(null);
const time = useTimeStore();
const toast = useToast();
const withdrawals = useWithdrawalStore();

const receiptType = computed(() =>
  receipt.value instanceof Withdrawal ? 'Withdrawal' : 'Payment'
);
const userType = computed(() =>
  receipt.value instanceof Withdrawal ? 'Host' : 'Payer'
);
const activityType = computed(() =>
  receipt.value instanceof Withdrawal ? 'Withdrew' : 'Paid'
);
const payableIntro = computed(() =>
  receipt.value instanceof Withdrawal ? 'Withdrew From' : 'Paid To'
);

const userChain = computed(() =>
  receipt.value instanceof PayablePayment
    ? (receipt.value as PayablePayment).payerChain
    : receipt.value?.chain
);
const payableChain = computed(() =>
  receipt.value instanceof UserPayment
    ? (receipt.value as UserPayment).payableChain
    : receipt.value?.chain
);

const payableRoute = computed(() => {
  const isMine = auth.currentUser?.walletAddress == receipt.value?.user();
  return (
    `/${receipt instanceof Withdrawal && isMine ? 'payable' : 'pay'}/` +
    receipt.value?.payableId
  );
});

const copy = (text: string, context: string) => {
  navigator.clipboard.writeText(text);
  toast.add({
    severity: 'info',
    summary: 'Copied',
    detail: `${context} copied to clipboard.`,
    life: 3000,
  });
};

onMounted(async () => {
  const id = route.params.id as string;
  receipt.value = (await payments.get(id, undefined, true)) as Receipt | null;
  if (!receipt.value) {
    receipt.value = await withdrawals.get(id, undefined, true);
  }
  isLoading.value = false;
});
</script>

<template>
  <ReceiptLoader v-if="isLoading" />

  <NotFoundView v-else-if="!receipt" />

  <section class="max-w-screen-md mx-auto pb-20" v-else>
    <h2 class="text-3xl mb-4 font-bold">{{ receiptType }} Receipt</h2>

    <div class="mb-8 leading-tight">
      <span>Receipt ID:</span>
      <p class="mt-1 flex items-center">
        <span class="text-xs break-all text-gray-500 mr-1">{{
          receipt.id
        }}</span>
        <Button
          class="bg-transparent p-1 border-none block w-fit h-fit"
          @click="copy(receipt.id, `Receipt ID: ${receipt.id}`)"
          title="Copy Receipt ID"
        >
          <IconCopy class="text-primary w-4 h-4" />
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
          class="bg-transparent p-1 border-none block w-fit h-fit"
          @click="copy(receipt.user(), `Wallet Address: ${receipt.user()}`)"
          title="Copy Wallet Address"
        >
          <IconCopy class="text-primary w-4 h-4" />
        </Button>
        <a
          :href="auth.getExplorerUrl(receipt.user(), userChain)"
          target="_blank"
          rel="noopener noreferrer"
          title="View on Explorer"
          class="p-1 rounded-md block w-fit h-fit"
          v-ripple
          v-if="userChain"
        >
          <IconOpenInNew class="text-primary w-4 h-4" />
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
          class="bg-transparent p-1 border-none block w-fit h-fit"
          @click="copy(receipt.payableId, `Payable ID: ${receipt.payableId}`)"
          title="Copy Payable ID"
        >
          <IconCopy class="text-primary w-4 h-4" />
        </Button>
        <a
          :href="`${payableRoute}`"
          target="_blank"
          rel="noopener noreferrer"
          title="About"
          class="p-1 rounded-md block w-fit h-fit"
          v-ripple
        >
          <IconOpenInNew class="text-primary w-4 h-4" />
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
