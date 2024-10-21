<script setup lang="ts">
import Footer from '@/components/Footer.vue';
import Header from '@/components/Header.vue';
import Sidebar from '@/components/Sidebar.vue';
import IconSpinner from '@/icons/IconSpinner.vue';
import { useAuthStore, useThemeStore } from '@/stores';
import { useAppLoadingStore } from '@/stores/app-loading';
import Toast from 'primevue/toast';
import { RouterView } from 'vue-router';

const appLoading = useAppLoadingStore();

// ensures necessary stores are initialized
useAuthStore();
useThemeStore();
</script>

<template>
  <Header />

  <main class="p-8 lg:px-12">
    <Sidebar />

    <div v-if="appLoading.status" class="py-20">
      <p class="text-center text-xl mb-12">{{ appLoading.text }} ...</p>
      <IconSpinner height="144" width="144" class="mx-auto" />
    </div>

    <RouterView v-else />

    <Toast />
  </main>

  <Footer />
</template>
