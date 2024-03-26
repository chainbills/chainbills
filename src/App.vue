<script setup lang="ts">
import ThemeMenu from '@/components/ThemeMenu.vue';
import { useThemeStore } from '@/stores/theme';
import { RouterView } from 'vue-router';

const year = new Date().getFullYear();

// this forces the theme refresh when the app loads
useThemeStore();
</script>

<template>
  <header class="p-4 pl-8 fixed top-0 left-0 right-0 z-10 flex justify-between">
    <h1 class="text-2xl font-bold">Gateway</h1>
    <ThemeMenu />
  </header>

  <main class="p-8">
    <RouterView />
  </main>

  <footer class="p-4 mt-auto text-center sm:flex justify-center">
    <p>
      Powered by
      <a
        href="https://wormhole.com/"
        class="font-semibold text-indigo-500"
        target="_blank"
        rel="noopener noreferrer"
        >Wormhole</a
      >
    </p>
    <p class="hidden font-bold sm:block mx-4" style="color: var(--shadow)">|</p>
    <div
      class="h-0.5 mx-auto w-3/5 my-3 sm:hidden"
      style="background: var(--shadow)"
    ></div>
    <p>All Rights Reserved &copy; {{ year }}</p>
  </footer>
</template>

<style scoped>
header {
  background-color: var(--app-bg);
  box-shadow:
    0 1px 3px 0 var(--shadow),
    0 1px 2px -1px var(--shadow);
  height: 64px;
}

footer {
  box-shadow:
    0 -1px 3px 0 var(--shadow),
    0 -1px 2px -1px var(--shadow);
}
</style>
