<script setup lang="ts">
import Shimmer from '@/components/Shimmer.vue';
</script>

<template>
  <section class="max-md:max-w-md md:max-w-screen-md mx-auto md:pt-8 pb-20">
    <div class="md:flex gap-12">
      <div class="grow">
        <Shimmer class="w-48 h-12 !mb-8 rounded-md animate-pulse" :isLoading="true" />
        <Shimmer class="w-24 h-6 !mb-2 rounded-md animate-pulse" :isLoading="true" />
        <Shimmer class="w-full h-4 !mb-8 rounded-md animate-pulse" :isLoading="true" />
        <Shimmer class="w-24 h-6 !mb-2 rounded-md animate-pulse" :isLoading="true" />
        <Shimmer class="w-full h-32 !mb-8 rounded-md animate-pulse" :isLoading="true" />
      </div>

      <div class="grow md:max-w-md md:mt-20">
        <div class="max-w-sm mx-auto">
          <div class="pb-4">
            <Shimmer class="w-10 h-6 !mb-1 rounded-md animate-pulse" :isLoading="true" />
            <Shimmer class="w-28 h-10 !mb-2 rounded-md animate-pulse" :isLoading="true" />
          </div>
          <Shimmer class="!ml-auto !mt-8 !mb-24 w-32 h-12 rounded-md animate-pulse" :isLoading="true" />
        </div>
      </div>
    </div>
  </section>
</template>
