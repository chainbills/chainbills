<script setup lang="ts">
import Shimmer from '@/components/Shimmer.vue';
</script>

<template>
  <section class="max-w-screen-md mx-auto pb-20">
    <Shimmer class="w-48 h-12 !mb-8 rounded-md animate-pulse" :isLoading="true" />
    <Shimmer class="w-24 h-6 !mb-2 rounded-md animate-pulse" :isLoading="true" />
    <Shimmer class="max-w-lg h-4 !mb-8 rounded-md animate-pulse" :isLoading="true" />
    <Shimmer class="w-24 h-6 !mb-2 rounded-md animate-pulse" :isLoading="true" />
    <Shimmer class="w-20 h-4 !mb-8 rounded-md animate-pulse" :isLoading="true" />
    <Shimmer class="w-24 h-6 !mb-2 rounded-md animate-pulse" :isLoading="true" />
    <Shimmer class="max-w-sm h-4 !mb-8 rounded-md animate-pulse" :isLoading="true" />
    <Shimmer class="w-20 h-5 !mb-2 rounded-md animate-pulse" :isLoading="true" />
    <p class="flex gap-x-2 items-center mb-10">
      <Shimmer class="w-8 h-8 rounded-full animate-pulse" :isLoading="true" />
      <Shimmer class="w-32 h-8 rounded-md animate-pulse" :isLoading="true" />
    </p>
    <Shimmer class="w-24 h-6 !mb-2 rounded-md animate-pulse" :isLoading="true" />
    <Shimmer class="w-32 h-8 !mb-8 rounded-md animate-pulse" :isLoading="true" />
    <Shimmer class="w-24 h-6 !mb-2 rounded-md animate-pulse" :isLoading="true" />
    <Shimmer class="max-w-lg h-4 !mb-8 rounded-md animate-pulse" :isLoading="true" />
  </section>
</template>
