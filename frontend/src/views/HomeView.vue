<script setup lang="ts">
import IconContactSupport from '@/icons/IconContactSupport.vue';
import IconFastForward from '@/icons/IconFastForward.vue';
import IconFinance from '@/icons/IconFinance.vue';
import IconLock from '@/icons/IconLock.vue';
import IconMobileFriendly from '@/icons/IconMobileFriendly.vue';
import IconPayCheck from '@/icons/IconPayCheck.vue';
import IconWallet from '@/icons/IconWallet.vue';
import { useAnalyticsStore } from '@/stores';
import Button from 'primevue/button';

const analytics = useAnalyticsStore();
</script>

<template>
  <section
    class="bg-primary rounded-2xl p-6 text-white md:flex md:gap-x-8 md:items-center lg:p-10 lg:pt-0 lg:h-[512px] mb-16 sm:mb-32 md:w-full md:relative max-w-screen-xl mx-auto"
  >
    <div class="md:w-1/2">
      <h2 class="text-3xl mb-6 lg:text-5xl lg:leading-tight">
        Receive any Crypto on any Chain from anyone.
      </h2>
      <div class="max-sm:block max-md:flex sm:gap-x-4 sm:items-center">
        <div>
          <p class="mb-4 lg:text-lg">
            Welcome to Chainbills! We help you easily manage your crypto
            transactions. Connect your wallet and handle your finances with our
            simple dashboard.
          </p>
          <p class="max-sm:mb-16">
            <router-link to="/start">
              <Button
                class="border-none bg-black text-white rounded-full px-6 py-2"
                @click="analytics.recordEvent('clicked_home_hero_get_started')"
                >Get Started</Button
              >
            </router-link>
          </p>
        </div>

        <img
          :src="`/assets/home-hero-mobile.png`"
          class="max-sm:w-full sm:w-1/2 md:hidden max-sm:max-w-xs max-sm:ml-auto sm:mt-auto sm:max-h-64"
        />
      </div>
    </div>

    <img
      :src="`/assets/home-hero-wide.png`"
      class="md:absolute max-md:hidden -bottom-12 -right-4 max-lg:max-h-96 max-lg:w-1/2 max-lg:max-w-sm lg:w-5/12"
    />
  </section>

  <section class="mb-16 sm:mb-32 max-w-screen-xl mx-auto">
    <h2 class="text-2xl sm:text-5xl mb-4">Some of Our Key Features</h2>
    <p class="sm:text-xl mb-4 sm:mb-8">
      See some of the key features Chainbills offers
    </p>

    <div class="sm:grid sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
      <div
        class="bg-black rounded-2xl p-6 text-white dark:bg-white dark:text-black max-sm:mb-4"
      >
        <div class="p-2 rounded-full bg-white dark:bg-black w-fit mb-4">
          <IconWallet class="stroke-black dark:stroke-white" />
        </div>
        <h3 class="text-xl font-medium mb-2">Sign In</h3>
        <p class="text-gray-500">
          Seamlessly connect your crypto wallet and start managing your
          transactions
        </p>
      </div>

      <div
        class="bg-primary bg-opacity-10 dark:bg-opacity-30 rounded-2xl p-6 border max-sm:mb-4"
      >
        <div class="p-2 rounded-full bg-primary w-fit mb-4">
          <IconPayCheck class="stroke-white" />
        </div>
        <h3 class="text-xl font-medium mb-2">Create Payables</h3>
        <p class="text-gray-500">
          Easily create payables with customizable options for tokens and
          amounts
        </p>
      </div>

      <div class="bg-purple-light dark:bg-opacity-90 rounded-2xl p-6">
        <div class="p-2 rounded-full bg-primary w-fit mb-4">
          <IconFinance class="stroke-white" />
        </div>
        <h3 class="text-xl font-medium mb-2 dark:text-black">
          Track Transactions
        </h3>
        <p class="text-gray-500">
          Monitor your payables and withdrawals with detailed transaction
          histories
        </p>
      </div>
    </div>
  </section>

  <section
    class="bg-primary bg-opacity-10 dark:bg-opacity-30 -ml-8 -mr-8 p-8 sm:p-12 mb-16 sm:mb-32 lg:-ml-12 lg:-mr-12"
  >
    <div
      class="sm:flex sm:justify-between sm:items-center mb-12 max-w-screen-xl mx-auto"
    >
      <h2 class="text-2xl font-medium max-sm:mb-4">How to Get Started</h2>
      <h2
        class="bg-black dark:bg-white text-xl text-white dark:text-black py-2 px-4 w-fit rounded-md relative"
      >
        How Chainbills Works
        <span triangle></span>
      </h2>
    </div>

    <div
      class="grid gap-4 sm:grid-cols-2 sm:gap-8 md:grid-cols-3 lg:grid-cols-4 mb-8 max-w-screen-xl mx-auto"
    >
      <div class="rounded-2xl px-3 py-5 bg-white dark:bg-black max-sm:max-w-sm">
        <div
          class="bg-primary bg-opacity-10 dark:bg-opacity-30 px-3 py-1 rounded-full text-sm w-fit mb-6"
        >
          Step 1
        </div>
        <h3 class="text-xl font-medium mb-3">Create a Payable</h3>
        <p>
          Fill out a form to create a payable and manage it from your dashboard
        </p>
      </div>
      <div class="rounded-2xl px-3 py-5 bg-white dark:bg-black max-sm:max-w-sm">
        <div
          class="bg-primary bg-opacity-10 dark:bg-opacity-30 px-3 py-1 rounded-full text-sm w-fit mb-6"
        >
          Step 2
        </div>
        <h3 class="text-xl font-medium mb-3">Share the Link</h3>
        <p>Copy the link to the payable and share with anybody, anywhere.</p>
      </div>
      <div class="rounded-2xl px-3 py-5 bg-white dark:bg-black max-sm:max-w-sm">
        <div
          class="bg-primary bg-opacity-10 dark:bg-opacity-30 px-3 py-1 rounded-full text-sm w-fit mb-6"
        >
          Step 3
        </div>
        <h3 class="text-xl font-medium mb-3">Get Paid</h3>
        <p>Your payable receives crypto from any chain, and gets funded.</p>
      </div>
      <div class="rounded-2xl px-3 py-5 bg-white dark:bg-black max-sm:max-w-sm">
        <div
          class="bg-primary bg-opacity-10 dark:bg-opacity-30 px-3 py-1 rounded-full text-sm w-fit mb-6"
        >
          Step 4
        </div>
        <h3 class="text-xl font-medium mb-3">Withdraw at Anytime</h3>
        <p>
          Select the payable, enter the amount, and confirm your withdrawal.
        </p>
      </div>
    </div>
  </section>

  <section class="p-8 sm:p-12 mb-16 sm:mb-32">
    <h2 class="text-2xl sm:text-5xl text-center mb-8 sm:mb-16">
      Why you should choose Chainbills
    </h2>

    <div
      class="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-8 max-w-screen-xl mx-auto"
    >
      <div data-aos="fade-up">
        <div class="bg-primary rounded-full p-2.5 w-fit mb-4 max-sm:mx-auto">
          <IconLock class="fill-white dark:fill-black" />
        </div>
        <h3 class="max-sm:text-center mb-2 font-medium text-xl">Secure</h3>
        <p class="max-sm:text-center max-sm:max-w-64 max-sm:mx-auto">
          Your transactions are secure and transparent on the blockchain
        </p>
      </div>
      <div data-aos="fade-up">
        <div class="bg-primary rounded-full p-2.5 w-fit mb-4 max-sm:mx-auto">
          <IconMobileFriendly class="fill-white dark:fill-black" />
        </div>
        <h3 class="max-sm:text-center mb-2 font-medium text-xl">
          User-Friendly
        </h3>
        <p class="max-sm:text-center max-sm:max-w-64 max-sm:mx-auto">
          Intuitive design makes managing crypto simple for everyone
        </p>
      </div>
      <div data-aos="fade-up">
        <div class="bg-primary rounded-full p-2.5 w-fit mb-4 max-sm:mx-auto">
          <IconFastForward class="fill-white dark:fill-black" />
        </div>
        <h3 class="max-sm:text-center mb-2 font-medium text-xl">Efficient</h3>
        <p class="max-sm:text-center max-sm:max-w-64 max-sm:mx-auto">
          Save time with quick and easy transaction management
        </p>
      </div>
      <div data-aos="fade-up">
        <div class="bg-primary rounded-full p-2.5 w-fit mb-4 max-sm:mx-auto">
          <IconContactSupport class="fill-white dark:fill-black" />
        </div>
        <h3 class="max-sm:text-center mb-2 font-medium text-xl">Support</h3>
        <p class="max-sm:text-center max-sm:max-w-64 max-sm:mx-auto">
          Save time with quick and easy transaction management
        </p>
      </div>
    </div>
  </section>

  <section
    class="bg-primary bg-opacity-10 dark:bg-opacity-30 -ml-8 -mr-8 px-8 pt-12 pb-24 sm:p-12 mb-24 lg:-ml-12 lg:-mr-12"
  >
    <h2
      class="text-2xl sm:text-3xl max-lg:text-center mb-8 max-w-screen-xl mx-auto"
    >
      Cross-Chain & Wormhole
    </h2>

    <div
      class="bg-gray-700 rounded-2xl p-4 text-white dark:bg-white dark:text-black max-lg:max-w-lg lg:max-w-screen-xl mx-auto lg:flex md:gap-8"
    >
      <img
        src="/assets/wormhole.png"
        alt="Wormhole"
        class="rounded-md max-lg:w-full max-lg:mb-8 lg:w-1/3 h-fit"
      />

      <div>
        <p class="mb-6 max-sm:text-sm">
          Our mission is to enable you receive money a large user base (across
          multiple chains). We are able to achieve this thanks to Wormhole's
          <a
            class="underline"
            href="https://wormhole.com/messaging/"
            target="_blank"
            rel="noopener noreferrer"
            >cross-chain messaging</a
          >
          and with payment
          <a
            class="underline"
            href="https://docs.wormhole.com/wormhole/wormhole-connect/routes"
            target="_blank"
            rel="noopener noreferrer"
            >routes</a
          >.
        </p>

        <p class="mb-6 max-sm:text-sm">
          When the blockchain network of a payer's wallet is different from your
          payable's chain, the payment goes through the route and info about
          your payable goes alongside through Wormhole messaging.
        </p>

        <p class="max-md:mb-2">
          <a
            class="underline"
            href="https://wormhole.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              class="border-none bg-black text-white rounded-full px-6 py-2 md:text-lg"
              @click="analytics.recordEvent('clicked_home_wormhole_learn_more')"
              >Learn More</Button
            >
          </a>
        </p>
      </div>
    </div>
  </section>

  <section
    class="px-4 py-8 sm:px-8 sm:py-12 mb-16 sm:mb-32 rounded-3xl text-white bg-primary text-center md:mx-16 lg:mx-32"
    data-aos="fade-up"
  >
    <h2 class="font-medium text-2xl sm:text-4xl mb-4">Join Us Today</h2>
    <p class="mb-8 max-w-lg sm:text-xl mx-auto">
      With Chainbills, you can do a lot of things: receive crypto on any chain,
      keep track of all your payments and withdrawals on Chainbills, make
      donations, and make payments easily.
    </p>
    <p>
      <router-link to="/start">
        <Button
          class="border-none bg-black text-white rounded-full px-6 py-2 md:text-lg"
          @click="analytics.recordEvent('clicked_home_hero_get_started')"
          >Get Started Now</Button
        >
      </router-link>
    </p>
  </section>
</template>

<style scoped>
[triangle] {
  border-left: 15px solid transparent;
  border-right: 15px solid transparent;
  border-top: 15px solid #000;
  bottom: -12px;
  height: 0;
  left: 20px;
  position: absolute;
  width: 0;
}

html.dark [triangle] {
  border-top-color: #fff;
}
</style>
