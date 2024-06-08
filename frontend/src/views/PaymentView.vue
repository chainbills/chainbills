<script setup lang="ts">
import type { Payable } from '@/schemas/payable';
import type { Payment } from '@/schemas/payment';
import { useTimeStore } from '@/stores/time';
import { useWalletStore } from '@/stores/wallet';
import Button from 'primevue/button';
import { useRoute } from 'vue-router';

const route = useRoute();
const payment = route.meta.payment as Payment;
const payableDetails = route.meta.payable as Payable;
const time = useTimeStore();
const wallet = useWalletStore();
</script>

<template>
  <section class="max-w-screen-md mx-auto pb-20">
    <h2 class="text-3xl mb-4 font-bold">Payment Receipt</h2>

    <p class="mb-8 leading-tight">
      <span>Receipt ID:</span><br />
      <span class="text-xs break-all text-gray-500">{{ payment.id }}</span>
    </p>

    <p class="mb-8 leading-tight">
      <span>Payer's Wallet Address:</span><br />
      <span class="text-xs break-all text-gray-500">{{
        wallet.canonical(payment.payerWallet, payment.chain)
      }}</span>
    </p>

    <p class="mb-8 leading-tight">
      <span>Payer's Chain:</span><br />
      <span class="text-xs break-all text-gray-500">{{ payment.chain }}</span>
    </p>

    <p class="mb-8 leading-tight">
      <span>Paid:</span><br />
      <span class="text-xl font-bold">{{ payment.displayDetails() }}</span>
    </p>

    <p class="mb-8 leading-tight">
      <span>Paid At:</span><br />
      <span class="text-lg font-bold">{{
        time.display(payment.timestamp)
      }}</span>
    </p>

    <p class="mb-8 leading-tight">
      <span>Payable ID:</span><br />
      <router-link
        :to="`/payable/${payment.payable}`"
        class="text-xs break-all text-gray-500 underline"
        v-if="
          wallet.whAddress &&
          wallet.areSame(wallet.whAddress, payableDetails.hostWallet)
        "
      >
        {{ payment.payable }}
      </router-link>
      <span class="text-xs break-all text-gray-500" v-else>{{
        payment.payable
      }}</span>
    </p>

    <div class="max-w-lg" v-if="payableDetails">
      <h3 class="font-medium mb-2">Paid For:</h3>
      <div class="mb-8 sm:flex items-end">
        <textarea
          readonly
          v-model="payableDetails.description"
          class="outline-none w-full px-3 py-2 bg-blue-50 dark:bg-slate-900 rounded-md shadow-inner mb-2 sm:mb-0 sm:mr-4"
        ></textarea>
      </div>
    </div>

    <p class="text-lg text-center max-w-md mx-auto pt-12 mb-8">
      Receive money from anyone on anychain on
      <span class="font-bold text-blue-500">Chainbills</span>. Get Started with
      us today by Creating a Payable.
    </p>
    <p class="text-center">
      <router-link to="/start">
        <Button class="bg-blue-500 text-white dark:text-black px-3 py-2"
          >Get Started</Button
        >
      </router-link>
    </p>
  </section>
</template>
