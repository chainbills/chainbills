<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const visible = ref(false);

const onScroll = () => {
  visible.value = window.scrollY > 300;
};

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));
</script>

<template>
  <Transition name="scroll-fab">
    <button
      v-if="visible"
      type="button"
      aria-label="Scroll to top"
      class="fixed bottom-6 right-6 z-40 flex items-center justify-center w-11 h-11 rounded-full border border-glass-border bg-glass-tint backdrop-blur-md shadow-glass text-fg/60 hover:text-fg hover:bg-fg/5 transition-colors motion-reduce:transition-none"
      @click="scrollToTop"
    >
      <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5" aria-hidden="true">
        <path d="M18 15l-6-6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </Transition>
</template>

<style scoped>
.scroll-fab-enter-active,
.scroll-fab-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.scroll-fab-enter-from,
.scroll-fab-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.88);
}
</style>
