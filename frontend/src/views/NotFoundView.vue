<script setup lang="ts">
import { useAnalyticsStore } from '@/stores';
import Button from 'primevue/button';

const analytics = useAnalyticsStore();
</script>

<template>
  <section class="text-center pb-20">
    <h2 class="text-4xl mb-8 font-bold">Not Found</h2>
    <p class="text-lg max-w-sm mx-auto mb-4">
      404 Error. The page you requested doesn't exist.
    </p>
    <p class="text-lg max-w-md mx-auto mb-8">
      You can navigate to the Home page or Get Started with us today by Creating
      a Payable.
    </p>
    <p>
      <router-link
        to="/"
        @click="
          analytics.recordEvent('clicked_go_home', {
            from: 'not_found_page',
          })
        "
      >
        <Button class="bg-transparent text-primary px-3 py-2 mr-6"
          >Go Home</Button
        >
      </router-link>
      <router-link
        to="/start"
        @click="
          analytics.recordEvent('clicked_get_started', {
            from: 'not_found_page',
          })
        "
      >
        <Button class="-mt-1 px-3 py-2">Get Started</Button>
      </router-link>
    </p>
  </section>
</template>
