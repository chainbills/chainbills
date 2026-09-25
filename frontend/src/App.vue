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
import IconChip from '@/components/ui/IconChip.vue';
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

/** Maps a PrimeVue toast severity to the `IconChip` tone and PrimeIcons class
 *  shown in its leading icon chip. `contrast`/`secondary` (used for neutral,
 *  non-error notices like "please select a chain") fall back to a plain
 *  bell rather than forcing them into a colour they don't mean. */
const toastVisuals: Record<string, { tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral'; icon: string }> = {
  info: { tone: 'info', icon: 'pi-info-circle' },
  success: { tone: 'success', icon: 'pi-check-circle' },
  warn: { tone: 'warning', icon: 'pi-exclamation-triangle' },
  error: { tone: 'danger', icon: 'pi-times-circle' },
  contrast: { tone: 'neutral', icon: 'pi-bell' },
  secondary: { tone: 'neutral', icon: 'pi-bell' },
};
const visualsFor = (severity: string) => toastVisuals[severity] ?? toastVisuals.info;
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

  <Toast position="top-right">
    <template #message="slotProps">
      <div class="flex flex-col gap-2 w-full">
        <div class="flex gap-3 items-start">
          <IconChip :tone="visualsFor(slotProps.message.severity).tone">
            <span :class="['pi', visualsFor(slotProps.message.severity).icon]"></span>
          </IconChip>
          <div class="flex flex-col gap-1 min-w-0">
            <div class="font-semibold text-sm text-fg">{{ slotProps.message.summary }}</div>
            <div class="text-sm text-muted line-clamp-3">{{ slotProps.message.detail }}</div>
            <a
              v-if="slotProps.message.data?.url"
              :href="slotProps.message.data.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-accent underline hover:opacity-80 transition-opacity w-fit"
            >
              View on Explorer
            </a>
          </div>
        </div>
        <!-- Countdown bar: shrinks from full width to empty over the
             toast's own `life` duration, giving a visual cue for how long
             is left before it auto-dismisses. -->
        <div class="h-0.5 rounded-full bg-fg/10 overflow-hidden">
          <div
            class="h-full bg-accent origin-left toast-countdown"
            :style="{ animationDuration: `${slotProps.message.life ?? 3000}ms` }"
          ></div>
        </div>
      </div>
    </template>
  </Toast>

  <Footer />
</template>

<style>
/* Drives the toast countdown bar above. Kept unscoped (rather than relying
   on Vue's scoped-style id) since `@keyframes` names aren't scoped anyway,
   and the class is only ever used by the toast template in this file. */
@keyframes toast-countdown-shrink {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}
.toast-countdown {
  animation-name: toast-countdown-shrink;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}
</style>
