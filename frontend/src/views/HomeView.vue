<script setup lang="ts">
import IconContactSupport from '@/icons/IconContactSupport.vue';
import IconFastForward from '@/icons/IconFastForward.vue';
import IconFinance from '@/icons/IconFinance.vue';
import IconGlobe from '@/icons/IconGlobe.vue';
import IconHorizontalAdjustments from '@/icons/IconHorizontalAdjustments.vue';
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
      <h2 class="text-3xl mb-6 lg:text-5xl lg:leading-tight">Simplified On-Chain Payments for Everyone.</h2>
      <div class="max-sm:block max-md:flex sm:gap-x-4 sm:items-center">
        <div>
          <p class="mb-4 lg:text-lg">
            Decentralized payment gateway that makes crypto payments easy... no wallet addresses, no confusion. Just one
            link.
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
    <h2 class="text-2xl sm:text-5xl mb-4">Key Features</h2>
    <p class="sm:text-xl mb-4 sm:mb-8">Powerful Simplicity, Built for Web3.</p>

    <div class="sm:grid sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
      <div class="bg-black rounded-2xl p-6 text-white dark:bg-white dark:text-black max-sm:mb-4">
        <div class="p-2 rounded-full bg-white dark:bg-black w-fit mb-4">
          <IconPayCheck class="stroke-black dark:stroke-white" />
        </div>
        <h3 class="text-xl font-medium mb-2">Payable Links</h3>
        <p class="text-gray-500">Send or receive crypto with a shareable link.</p>
      </div>

      <div class="bg-primary bg-opacity-10 dark:bg-opacity-30 rounded-2xl p-6 border max-sm:mb-4">
        <div class="p-2 rounded-full bg-primary w-fit mb-4">
          <IconFinance class="stroke-white" />
        </div>
        <h3 class="text-xl font-medium mb-2">Focused Dashboards</h3>
        <p class="text-gray-500">Track payments, payables, and withdrawals easily.</p>
      </div>

      <div class="bg-purple-light dark:bg-opacity-90 rounded-2xl p-6 max-sm:mb-4">
        <div class="p-2 rounded-full bg-primary w-fit mb-4">
          <IconWallet class="stroke-white" />
        </div>
        <h3 class="text-xl font-medium mb-2 dark:text-black">Payment Control</h3>
        <p class="text-gray-500">Pause, resume, or stop payments on demand.</p>
      </div>

      <div class="bg-primary bg-opacity-10 dark:bg-opacity-30 rounded-2xl p-6 border max-sm:mb-4">
        <div class="p-2 rounded-full bg-primary w-fit mb-4">
          <IconHorizontalAdjustments class="stroke-white" />
        </div>
        <h3 class="text-xl font-medium mb-2">Payment Enforcement</h3>
        <p class="text-gray-500">Ensure exact tokens and amounts are paid.</p>
      </div>

      <div class="bg-black rounded-2xl p-6 text-white dark:bg-white dark:text-black max-sm:mb-4">
        <div class="p-2 rounded-full bg-white dark:bg-black w-fit mb-4">
          <IconGlobe class="stroke-black dark:stroke-white" />
        </div>
        <h3 class="text-xl font-medium mb-2">On-Chain Transparency</h3>
        <p class="text-gray-500">Everything is verified, secure, and on-chain.</p>
      </div>
    </div>
  </section>

  <section
    class="bg-primary bg-opacity-10 dark:bg-opacity-30 -ml-8 -mr-8 p-8 sm:p-12 mb-16 sm:mb-32 lg:-ml-12 lg:-mr-12"
  >
    <div class="sm:flex sm:justify-between sm:items-center mb-12 max-w-screen-xl mx-auto">
      <h2 class="text-2xl font-medium max-sm:mb-4">How to Get Started</h2>
      <h2 class="bg-black dark:bg-white text-xl text-white dark:text-black py-2 px-4 w-fit rounded-md relative">
        How Chainbills Works
        <span triangle></span>
      </h2>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 sm:gap-8 md:grid-cols-3 lg:grid-cols-4 mb-8 max-w-screen-xl mx-auto">
      <div class="rounded-2xl px-3 py-5 bg-white dark:bg-black max-sm:max-w-sm">
        <div class="bg-primary bg-opacity-10 dark:bg-opacity-30 px-3 py-1 rounded-full text-sm w-fit mb-6">Step 1</div>
        <h3 class="text-xl font-medium mb-3">Create a Payable</h3>
        <p>Fill out a form to create a payable and manage it from your dashboard</p>
      </div>
      <div class="rounded-2xl px-3 py-5 bg-white dark:bg-black max-sm:max-w-sm">
        <div class="bg-primary bg-opacity-10 dark:bg-opacity-30 px-3 py-1 rounded-full text-sm w-fit mb-6">Step 2</div>
        <h3 class="text-xl font-medium mb-3">Share the Link</h3>
        <p>Copy the link to the payable and share with anybody, anywhere.</p>
      </div>
      <div class="rounded-2xl px-3 py-5 bg-white dark:bg-black max-sm:max-w-sm">
        <div class="bg-primary bg-opacity-10 dark:bg-opacity-30 px-3 py-1 rounded-full text-sm w-fit mb-6">Step 3</div>
        <h3 class="text-xl font-medium mb-3">Get Paid</h3>
        <p>Your payable receives crypto from anyone, and gets funded.</p>
      </div>
      <div class="rounded-2xl px-3 py-5 bg-white dark:bg-black max-sm:max-w-sm">
        <div class="bg-primary bg-opacity-10 dark:bg-opacity-30 px-3 py-1 rounded-full text-sm w-fit mb-6">Step 4</div>
        <h3 class="text-xl font-medium mb-3">Withdraw at Anytime</h3>
        <p>Select the payable, enter the amount, and confirm your withdrawal.</p>
      </div>
    </div>
  </section>

  <section class="p-8 sm:p-12 mb-16 sm:mb-32">
    <h2 class="text-2xl sm:text-5xl text-center mb-8 sm:mb-16">Why you should choose Chainbills</h2>

    <div class="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-8 max-w-screen-xl mx-auto">
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
        <h3 class="max-sm:text-center mb-2 font-medium text-xl">User-Friendly</h3>
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
    class="px-4 py-8 sm:px-8 sm:py-12 mb-16 sm:mb-32 rounded-3xl text-white bg-primary text-center md:mx-16 lg:mx-32"
    data-aos="fade-up"
  >
    <h2 class="font-medium text-2xl sm:text-4xl mb-4">Join Us Today</h2>
    <p class="mb-8 max-w-lg sm:text-xl mx-auto">
      With Chainbills, you can do a lot of things: receive crypto on anyone, keep track of all your payments and
      withdrawals on Chainbills, make donations, and make payments easily.
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
