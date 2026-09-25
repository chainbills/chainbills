import { useAuthStore } from '@/stores';
import { defineStore } from 'pinia';
import { event, set } from 'vue-gtag';
import { onMounted, watch } from 'vue';

export const useAnalyticsStore = defineStore('analytics', () => {
  const auth = useAuthStore();

  const recordEvent = (name: string, params?: Record<string, any>) => {
    if (import.meta.env.DEV) return;
    event(name, params);
  };

  // Kept for backward compatibility — vue-gtag handles page_view automatically
  // via the Vue Router integration registered in main.ts.
  const recordNavigation = (_path: string, _name: string) => {};

  onMounted(() => {
    watch(
      () => auth.currentUser,
      (user) => {
        if (import.meta.env.DEV) return;
        set({ user_id: user?.walletAddress ?? undefined });
        if (user) {
          set({ user_properties: { connected_chain: user.chain.name } });
          recordEvent('user_signin', {
            walletAddress: user.walletAddress,
            chain: user.chain.name,
          });
        }
      }
    );
  });

  return { recordEvent, recordNavigation };
});
