import { firebaseApp, useAuthStore } from '@/stores';
import { getAnalytics, logEvent, setAnalyticsCollectionEnabled, setUserId } from 'firebase/analytics';
import { defineStore } from 'pinia';
import { onMounted, watch } from 'vue';

export const useAnalyticsStore = defineStore('analytics', () => {
  const auth = useAuthStore();
  const analytics = getAnalytics(firebaseApp);

  const recordEvent = (event: string, params?: any) => {
    logEvent(analytics, event, params);
  };

  const recordNavigation = (path: string, name: string) => {
    logEvent(analytics, 'screen_view', {
      firebase_screen: path,
      firebase_screen_class: name,
    });
  };

  onMounted(() => {
    if (import.meta.env.DEV) setAnalyticsCollectionEnabled(analytics, false);

    watch(
      () => auth.currentUser,
      (user) => {
        setUserId(analytics, user?.walletAddress ?? null);
      }
    );
  });

  return { recordEvent, recordNavigation };
});
