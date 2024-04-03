import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppLoadingStore = defineStore('app-loading', () => {
  const text = ref('Loading');
  const status = ref(false);

  const show = (display: string = 'Loading') => {
    status.value = true;
    text.value = display;
  };

  const hide = () => {
    status.value = false;
    text.value = 'Loading';
  };
  return { hide, show, status, text };
});
