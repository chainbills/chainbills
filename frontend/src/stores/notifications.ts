import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { onMounted } from 'vue';

import { firebaseConfig } from './firebase';
import { useServerStore } from './server';
import { useWalletStore } from './wallet';

export const useNotificationsStore = defineStore('notifications', () => {
  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  const server = useServerStore();
  const toast = useToast();
  const wallet = useWalletStore();

  const ensure = async () => {
    if (
      !wallet.connected ||
      (Notification.permission == 'granted' &&
        wallet.address &&
        localStorage.getItem(`fcmToken:${wallet.address}`))
    ) {
      return;
    }

    // TODO: Show custom modal/popup to request permission, if denied, return

    const status = await Notification.requestPermission();
    if (status != 'granted') return;

    const fcmToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FCM_VAPID_KEY,
    });

    if (wallet.address && fcmToken) {
      const success = await server.saveNotificationToken(fcmToken);
      if (success) localStorage.setItem(`fcmToken:${wallet.address}`, 'true');
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
