import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSidebarStore = defineStore('sidebar', () => {
  const status = ref(false);
  const open = () => (status.value = true);
  const close = () => (status.value = false);
  return { status, open, close };
});
