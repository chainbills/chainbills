<script setup lang="ts">
import { RouterView } from 'vue-router';
const year = new Date().getFullYear();
</script>

<template>
  <header class="shadow p-4 pl-8 fixed top-0 left-0 right-0 z-10">
    <h1 class="text-2xl font-bold">Gateway</h1>
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
    <p class="hidden sm:block mx-4 text-stone-300 dark:text-slate-500">|</p>
    <div
      class="h-px bg-stone-300 dark:bg-slate-500 mx-auto w-3/5 my-3 sm:hidden"
    ></div>
    <p>All Rights Reserved &copy; {{ year }}</p>
  </footer>
</template>

<style scoped>
header {
  height: 64px;
}

footer {
  box-shadow:
    0 -1px 3px 0 rgb(0 0 0 / 0.1),
    0 -1px 2px -1px rgb(0 0 0 / 0.1);
}
</style>
