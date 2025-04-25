<script setup lang="ts">
import Footer from '@/components/Footer.vue';
import Header from '@/components/Header.vue';
import Sidebar from '@/components/Sidebar.vue';
import { useAuthStore, useCacheStore, useNotificationsStore, useThemeStore } from '@/stores';
import Toast from 'primevue/toast';
import { RouterView } from 'vue-router';

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

    <RouterView />

    <Toast />
  </main>

  <Footer />
</template>
