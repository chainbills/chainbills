<script setup lang="ts">
const { isLoading } = defineProps(['isLoading']);
import { useThemeStore } from '@/stores';
import { computed } from 'vue';
import Shimmer from 'vue3-loading-shimmer';

const theme = useThemeStore();
const bgColor = computed(() => (theme.isDisplayDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'));
const duration = computed(() => (!isLoading ? 10000000 : 2200));
const shimmerColor = computed(() => (theme.isDisplayDark ? '#434343' : '#bcbcbc'));
</script>

<template>
  <Shimmer :duration="duration" :bgColor="bgColor" :shimmerColor="shimmerColor" />
</template>
