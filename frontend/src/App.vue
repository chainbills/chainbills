<script setup lang="ts">
import Footer from '@/components/Footer.vue';
import Header from '@/components/Header.vue';
import Sidebar from '@/components/Sidebar.vue';
import IconSpinner from '@/icons/IconSpinner.vue';
import { useAppLoadingStore } from '@/stores/app-loading';
import { useThemeStore } from '@/stores/theme';
import Toast from 'primevue/toast';
import { RouterView } from 'vue-router';

const appLoading = useAppLoadingStore();
// this forces the theme refresh when the app loads
useThemeStore();
</script>

<template>
  <Header />

  <main class="p-8">
    <Sidebar />

    <div v-if="appLoading.status" class="py-20">
      <p class="text-center mb-12">Loading ...</p>
      <IconSpinner height="144" width="144" class="mx-auto" />
    </div>

    <RouterView v-else />

    <Toast />
  </main>

  <Footer />
</template>
