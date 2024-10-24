<script setup lang="ts">
import Shimmer from '@/components/Shimmer.vue';
</script>

<template>
  <div class="border border-shadow" wrapper>
    <div
      class="px-3 py-2 border-b border-shadow"
      v-for="_ of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]"
    >
      <Shimmer class="h-8 rounded-md animate-pulse" />
    </div>
  </div>
</template>

<style scoped>
[wrapper] {
  box-shadow:
    0 0 1.5px 0 var(--shadow),
    0 0 1px -1px var(--shadow);
}
</style>
