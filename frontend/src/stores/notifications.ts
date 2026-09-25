import { FEATURES } from '@/config/features';
import { useAuthStore } from '@/stores/auth';
import { useServerStore } from '@/stores/server';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { ref, watch } from 'vue';

export type NotificationType = 'PAYABLE_CREATED' | 'PAYMENT_RECEIVED' | 'PAYMENT_RECEIPT' | 'WITHDRAWAL_COMPLETED';

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, { title: string; blurb: string }> = {
  PAYABLE_CREATED: {
    title: 'Payable created',
    blurb: 'When a new payable of yours is confirmed on-chain.',
  },
  PAYMENT_RECEIVED: {
    title: 'Payment received',
    blurb: 'When someone pays one of your payables.',
  },
  PAYMENT_RECEIPT: {
    title: 'Payment sent',
    blurb: 'When one of your payments settles. Receipt-style confirmation.',
  },
  WITHDRAWAL_COMPLETED: {
    title: 'Withdrawal completed',
    blurb: 'When a withdrawal from one of your payables goes through.',
  },
};

export const NOTIFICATION_TYPES_ORDERED: NotificationType[] = [
  'PAYABLE_CREATED',
  'PAYMENT_RECEIVED',
  'PAYMENT_RECEIPT',
  'WITHDRAWAL_COMPLETED',
];

export interface PreferenceState {
  email: boolean;
}

export interface UserProfile {
  id: string;
  wallets: { key: string; namespace: string; address: string }[];
  email: string | null;
  emailVerifiedAt: string | null;
  preferences: Record<NotificationType, PreferenceState>;
}

export const useNotificationsStore = defineStore('notifications', () => {
  const auth = useAuthStore();
  const server = useServerStore();
  const toast = useToast();

  const profile = ref<UserProfile | null>(null);
  const isLoadingProfile = ref(false);

  /** The email address whose 6-digit code is currently outstanding. Held in
   *  the store so the verification card can re-render at the code-entry step
   *  even after the user navigates away and back to the page. */
  const pendingEmail = ref<string | null>(null);

  const isRequestingCode = ref(false);
  const isVerifyingCode = ref(false);
  const isRemovingEmail = ref(false);

  const reset = () => {
    profile.value = null;
    pendingEmail.value = null;
    isLoadingProfile.value = false;
  };

  const fetchProfile = async (): Promise<UserProfile | null> => {
    if (!FEATURES.emailNotifications) return null;
    if (!auth.currentUser) {
      reset();
      return null;
    }
    isLoadingProfile.value = true;
    const res = await server.call('GET', '/me', undefined, true);
    isLoadingProfile.value = false;
    if (res && typeof res === 'object') {
      profile.value = res as UserProfile;
      return profile.value;
    }
    return null;
  };

  const requestEmailVerification = async (email: string): Promise<boolean> => {
    if (!FEATURES.emailNotifications) return false;
    const trimmed = email.trim().toLowerCase();
    isRequestingCode.value = true;
    const res = await server.call('POST', '/me/email', { email: trimmed });
    isRequestingCode.value = false;
    if (res === true) {
      pendingEmail.value = trimmed;
      toast.add({
        severity: 'success',
        summary: 'Check your inbox',
        detail: `A 6-digit code was sent to ${trimmed}.`,
        life: 8000,
      });
      return true;
    }
    return false;
  };

  const verifyEmail = async (code: string): Promise<boolean> => {
    if (!FEATURES.emailNotifications) return false;
    const cleaned = code.trim();
    isVerifyingCode.value = true;
    const res = await server.call('POST', '/me/email/verify', { code: cleaned });
    isVerifyingCode.value = false;
    if (res && typeof res === 'object') {
      profile.value = res as UserProfile;
      pendingEmail.value = null;
      toast.add({
        severity: 'success',
        summary: 'Email verified',
        detail: `You'll now receive notifications at ${(res as UserProfile).email}.`,
        life: 8000,
      });
      return true;
    }
    return false;
  };

  const removeEmail = async (): Promise<boolean> => {
    if (!FEATURES.emailNotifications) return false;
    isRemovingEmail.value = true;
    const res = await server.call('DELETE', '/me/email');
    isRemovingEmail.value = false;
    if (res && typeof res === 'object') {
      profile.value = res as UserProfile;
      pendingEmail.value = null;
      toast.add({
        severity: 'info',
        summary: 'Email removed',
        detail: 'Notifications by email are now off.',
        life: 6000,
      });
      return true;
    }
    return false;
  };

  const cancelPending = () => {
    pendingEmail.value = null;
  };

  const updatePreferences = async (patch: Partial<Record<NotificationType, PreferenceState>>): Promise<boolean> => {
    if (!FEATURES.emailNotifications) return false;
    const res = await server.call('PATCH', '/me/preferences', patch);
    if (res && typeof res === 'object') {
      profile.value = res as UserProfile;
      return true;
    }
    return false;
  };

  if (FEATURES.emailNotifications) {
    watch(
      () => auth.currentUser?.walletAddress,
      (addr, prev) => {
        if (!addr) {
          reset();
          return;
        }
        if (addr !== prev) fetchProfile();
      },
      { immediate: true }
    );
  }

  return {
    profile,
    pendingEmail,
    isLoadingProfile,
    isRequestingCode,
    isVerifyingCode,
    isRemovingEmail,
    fetchProfile,
    requestEmailVerification,
    verifyEmail,
    removeEmail,
    cancelPending,
    updatePreferences,
  };
});
