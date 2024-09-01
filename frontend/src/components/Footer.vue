<script setup lang="ts">
const year = new Date().getFullYear();
</script>

<template>
  <footer class="p-4 mt-auto text-center sm:flex justify-center">
    <p>
      Powered by
      <a
        href="https://wormhole.com/"
        class="font-semibold text-primary"
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
footer {
  box-shadow:
    0 -1px 3px 0 var(--shadow),
    0 -1px 2px -1px var(--shadow);
}
</style>
