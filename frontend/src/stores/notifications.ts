import { firebaseApp, useAuthStore, useServerStore } from '@/stores';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { onMounted } from 'vue';

export const useNotificationsStore = defineStore('notifications', () => {
  const auth = useAuthStore();
  const messaging = getMessaging(firebaseApp);
  const server = useServerStore();
  const toast = useToast();

  const lsKey = () => `chainbills::fcmToken=>${auth.currentUser!.walletAddress}`;
  const ensure = async () => {
    if (
      !auth.currentUser ||
      !('Notification' in window) ||
      (Notification.permission == 'granted' && localStorage.getItem(lsKey()))
    ) {
      return;
    }

    // TODO: Show custom modal/popup to request permission, if denied, return

    const status = await Notification.requestPermission();
    if (status != 'granted') return;

    const fcmToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FCM_VAPID_KEY,
    });

    if (auth.currentUser && fcmToken) {
      const success = await server.saveNotificationToken(fcmToken);
      if (success) localStorage.setItem(lsKey(), 'true');
    }
  };

  onMounted(() => {
    onMessage(messaging, (payload) => {
      if (payload.notification && payload.data && payload.data.paymentId) {
        // TODO: Navigate to `/payments/${payload.data.paymentId}` on click
        const { title: summary, body: detail } = payload.notification;
        toast.add({ severity: 'info', summary, detail, life: 12000 });
      }
    });
  });

  return { ensure };
});
