<script setup lang="ts">
import Shimmer from '@/components/Shimmer.vue';
import TableLoader from '@/components/TableLoader.vue';
</script>

<template>
  <section class="max-w-screen-xl mx-auto pb-20">
    <div class="sm:flex items-start justify-between !mb-8">
      <Shimmer
        class="max-sm:!mb-8 w-60 h-8 rounded-md animate-pulse"
        :isLoading="true"
      />
      <Shimmer
        class="w-28 h-8 max-sm:!ml-auto rounded-md animate-pulse"
        :isLoading="true"
      />
    </div>

    <div class="sm:flex sm:justify-between sm:gap-x-4 !mb-16">
      <div class="sm:w-1/2">
        <div class="max-w-sm !mb-12">
          <Shimmer
            class="w-44 h-6 !mb-2 rounded-md animate-pulse"
            :isLoading="true"
          />
          <Shimmer
            class="w-full h-8 rounded-md animate-pulse"
            :isLoading="true"
          />
        </div>

        <div class="max-w-lg">
          <Shimmer
            class="w-40 h-6 !mb-1.5 rounded-md animate-pulse"
            :isLoading="true"
          />
          <Shimmer
            class="w-60 h-4 !mb-4 rounded-md animate-pulse"
            :isLoading="true"
          />

          <div class="mb-12 flex items-end">
            <Shimmer
              class="w-48 h-12 !mr-6 rounded-md animate-pulse"
              :isLoading="true"
            />
            <Shimmer
              class="w-24 h-7 rounded-md animate-pulse"
              :isLoading="true"
            />
          </div>
        </div>
      </div>

      <div class="max-w-lg sm:w-1/2">
        <Shimmer
          class="w-32 h-6 !mb-2 rounded-md animate-pulse"
          :isLoading="true"
        />
        <Shimmer
          class="w-full h-32 !mb-2 rounded-md animate-pulse"
          :isLoading="true"
        />
        <Shimmer
          class="w-20 h-7 !ml-auto rounded-md animate-pulse"
          :isLoading="true"
        />
      </div>
    </div>

    <TableLoader />
  </section>
</template>
