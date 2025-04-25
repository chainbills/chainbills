import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useAnalyticsStore } from './analytics';

export const useSidebarStore = defineStore('sidebar', () => {
  const analytics = useAnalyticsStore();

  const status = ref(false);

  const open = () => {
    status.value = true;
    analytics.recordEvent('opened_sidebar');
  };

  const close = () => {
    status.value = false;
    analytics.recordEvent('closed_sidebar');
  };

  return { status, open, close };
});
