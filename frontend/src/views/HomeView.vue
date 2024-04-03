<script setup lang="ts">
import Button from 'primevue/button';
</script>

<template>
  <section class="pt-12 pb-20">
    <h2 class="text-center font-bold text-blue-500 text-3xl sm:text-7xl">
      <vue-writer
        :array="['Pay Merchants', 'Make Donations', 'Subscribe to Creators']"
      />
    </h2>
  </section>

  <section class="py-20">
    <h2
      class="text-2xl sm:text-5xl mb-8 text-center font-black flex flex-col sm:leading-10"
    >
      <span class="mb-2 sm:mb-4">Receive </span>
      <span class="mb-2 sm:mb-4 blue-gradient">any crypto</span>
      <span class="mb-2 sm:mb-4"
        >on <span class="blue-gradient">any chain</span></span
      >
      <span class="mb-2 sm:mb-4"
        >from <span class="blue-gradient">any one</span></span
      >
    </h2>
    <p class="text-center">
      <router-link to="/start">
        <Button class="bg-blue-500 text-white dark:text-black text-xl px-6 py-2"
          >Get Started</Button
        ></router-link
      >
    </p>
  </section>

  <section class="py-20">
    <h2 class="text-5xl text-center font-bold mb-8" data-aos="fade-up">
      How it Works
    </h2>
    <ol class="text-2xl max-w-96 mx-auto mb-8">
      <li class="mb-4" data-aos="fade-up">
        1. Create a Payable (public invoice)
      </li>
      <li class="mb-4" data-aos="fade-up">2. Share the link</li>
      <li class="mb-4" data-aos="fade-up">3. Get Paid</li>
      <li class="mb-4" data-aos="fade-up">4. Withdraw at anytime</li>
    </ol>
    <p class="text-center">
      <router-link to="/start">
        <Button
          class="bg-blue-500 text-white dark:text-black text-xl px-6 py-2"
          data-aos="fade-up"
          >Get Started</Button
        ></router-link
      >
    </p>
  </section>

  <section class="py-20">
    <h2 class="text-5xl text-center font-bold mb-8" data-aos="fade-up">
      Withdraw Now
    </h2>
    <p class="text-2xl max-w-96 mx-auto mb-4 text-center" data-aos="fade-up">
      View your balances and withdraw at anytime.
    </p>
    <p class="text-gray-500 text-center mb-12" data-aos="fade-up">
      * We charge 2% on every withdrawal
    </p>
    <p class="text-center">
      <router-link to="/dashboard">
        <Button
          class="bg-blue-500 text-white dark:text-black text-xl px-6 py-2"
          data-aos="fade-up"
          >Dashboard</Button
        ></router-link
      >
    </p>
  </section>

  <section class="py-20">
    <h2 class="text-5xl text-center font-bold mb-8" data-aos="fade-up">
      Keeping Records
    </h2>
    <p class="text-2xl max-w-96 mx-auto mb-12 text-center" data-aos="fade-up">
      Keep track of all your payments and withdrawals on
      <span class="font-bold text-blue-500">Chainbills</span>.
    </p>
    <p class="text-center">
      <router-link to="/activity">
        <Button
          class="bg-blue-500 text-white dark:text-black text-xl px-6 py-2"
          data-aos="fade-up"
          >My Activity</Button
        ></router-link
      >
    </p>
  </section>

  <section class="py-20">
    <h2 class="text-5xl text-center font-bold mb-8" data-aos="fade-up">
      Wormhole Magic
    </h2>
    <p class="text-2xl max-w-96 mx-auto mb-6 text-center" data-aos="fade-up">
      Paying and Receiving seamlessly across any chain is powered by
      <a
        class="font-bold text-blue-500"
        href="https://wormhole.com"
        rel="noreferrer noopener"
        target="_blank"
        >Wormhole</a
      >.
    </p>
    <p class="text-2xl max-w-96 mx-auto mb-12 text-center" data-aos="fade-up">
      <a
        class="font-bold text-blue-500"
        href="https://wormhole.com"
        rel="noreferrer noopener"
        target="_blank"
        >Wormhole</a
      >
      makes this possible through cross-chain assets and cross-chain messaging.
    </p>
    <p class="text-center">
      <a href="https://wormhole.com" rel="noreferrer noopener" target="_blank">
        <Button
          class="bg-blue-500 text-white dark:text-black text-xl px-6 py-2"
          data-aos="fade-up"
          >Learn More</Button
        ></a
      >
    </p>
  </section>

  <section class="pt-20 pb-32 md:flex justify-between max-w-screen-md mx-auto">
    <h2 class="text-4xl font-bold mb-8 basis-3/5" data-aos="fade-up">
      Start Receiving Payments Today!
    </h2>
    <p>
      <router-link to="/start">
        <Button
          class="bg-blue-500 text-white dark:text-black text-xl px-6 py-2"
          data-aos="fade-up"
          >Get Started</Button
        ></router-link
      >
    </p>
  </section>
</template>

<style scoped>
.blue-gradient {
  background: -webkit-linear-gradient(left, var(--blue-100), var(--blue-900));
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

body.dark .blue-gradient {
  background: -webkit-linear-gradient(
    left,
    var(--blue-800) 40%,
    var(--blue-300)
  );
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
