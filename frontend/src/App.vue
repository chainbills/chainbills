<script setup lang="ts">
import Footer from '@/components/Footer.vue';
import Header from '@/components/Header.vue';
import Sidebar from '@/components/Sidebar.vue';
import {
  useAuthStore,
  useCacheStore,
  useNotificationsStore,
  useThemeStore,
} from '@/stores';
import { useAppLoadingStore } from '@/stores/app-loading';
import Toast from 'primevue/toast';
import { RouterView } from 'vue-router';

const appLoading = useAppLoadingStore();

// ensures necessary stores are initialized
useAuthStore();
useCacheStore();
useNotificationsStore();
useThemeStore();
</script>

<template>
  <Header />

  <main class="p-8 lg:px-12">
    <Sidebar />

    <component v-if="appLoading.loader" :is="appLoading.loader" />
    <RouterView v-else />

    <Toast />
  </main>

  <Footer />
</template>
