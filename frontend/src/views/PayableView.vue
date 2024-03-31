<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();
const address = route.params['address'];
</script>

<template>
  <h2 class="text-xl">Payable Address: {{ address }}</h2>
</template>
