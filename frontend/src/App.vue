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

    <Toast>
      <template #message="slotProps">
        <div class="flex flex-col gap-2 w-full">
          <div class="flex gap-2">
            <span
              :class="[
                'p-toast-message-icon pi',
                {
                  'pi-info-circle': slotProps.message.severity === 'info',
                  'pi-check-circle': slotProps.message.severity === 'success',
                  'pi-exclamation-triangle': slotProps.message.severity === 'warn',
                  'pi-times-circle': slotProps.message.severity === 'error',
                },
              ]"
            ></span>
            <div class="flex flex-col gap-1">
              <div class="p-toast-message-summary font-bold">{{ slotProps.message.summary }}</div>
              <div class="p-toast-message-detail text-sm">{{ slotProps.message.detail }}</div>
            </div>
          </div>
          <a
            v-if="slotProps.message.data?.url"
            :href="slotProps.message.data.url"
            target="_blank"
            class="ml-6 text-xs underline hover:opacity-80 transition-opacity"
          >
            View on Explorer
          </a>
        </div>
      </template>
    </Toast>
  </main>

  <Footer />
</template>
