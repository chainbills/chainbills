import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppLoadingStore = defineStore('app-loading', () => {
  const status = ref(false);
  const show = () => (status.value = true);
  const hide = () => (status.value = false);
  return { status, show, hide };
});
