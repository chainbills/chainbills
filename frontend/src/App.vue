<script setup lang="ts">
/**
 * src/App.vue — the application root: mounts the ambient backdrop, the
 * shared glass refraction filter, the header/sidebar/footer shell, the
 * router view and the global toast host.
 *
 * The stores instantiated here (`useAuthStore`, `useCacheStore`,
 * `useThemeStore`) have no template output of their own; calling them once
 * at the root ensures their `onMounted` side effects (wallet auth listeners,
 * cache hydration, the initial theme class) run exactly once for the whole
 * app rather than once per component that happens to use them.
 */
import AmbientBackdrop from '@/components/ui/AmbientBackdrop.vue';
import Footer from '@/components/Footer.vue';
import Header from '@/components/Header.vue';
import Sidebar from '@/components/Sidebar.vue';
import TxFlowDialog from '@/components/tx/TxFlowDialog.vue';
import { useAuthStore, useCacheStore, useThemeStore } from '@/stores';
import Toast from 'primevue/toast';
import { RouterView } from 'vue-router';

useAuthStore();
useCacheStore();
useThemeStore();
</script>

<template>
  <AmbientBackdrop />

  <!-- The liquid-lens displacement filter `.glass-refract` (main.css) refers
       to by id. An SVG filter only needs to exist once in the whole document
       for every element using it to pick it up, so it lives here rather than
       inside GlassCard. -->
  <svg width="0" height="0" aria-hidden="true" style="position: absolute">
    <filter id="glass-displace">
      <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" />
      <feGaussianBlur stdDeviation="1.5" />
      <feDisplacementMap in="SourceGraphic" scale="28" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </svg>

  <Header />

  <main class="px-4 py-8 sm:px-8 lg:px-12">
    <Sidebar />

    <RouterView />
  </main>

  <TxFlowDialog />

  <Toast position="top-right" />

  <Footer />
</template>
