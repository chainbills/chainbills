<script setup lang="ts">
import Footer from '@/components/Footer.vue';
import Header from '@/components/Header.vue';
import Sidebar from '@/components/Sidebar.vue';
import { useThemeStore } from '@/stores/theme';
import Toast from 'primevue/toast';
import { RouterView } from 'vue-router';

// this forces the theme refresh when the app loads
useThemeStore();
</script>

<template>
  <Header />

  <main class="p-8">
    <Sidebar />

    <RouterView />

    <Toast />
  </main>

  <Footer />
</template>
