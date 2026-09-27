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

  /**
   * Cross-instance trigger for the sign-in dialog. Both SignInButton copies
   * (header and sidebar) mount simultaneously but only the header copy owns
   * the Dialog — nesting the Dialog inside the Drawer breaks on mobile
   * because the two overlays fight for focus and z-index. Sidebar copy sets
   * this to open the modal via the header copy; header copy watches it and
   * opens its own local Dialog, then clears the request.
   */
  const signInRequest = ref<{ mode: 'connect' | 'switch' } | null>(null);

  /** Requests the sign-in dialog. Closes the sidebar drawer first so the
   *  Dialog opens against a clean stacking context. Called from either
   *  SignInButton copy and from the wallet menu's Switch Chain action. */
  const requestSignIn = (mode: 'connect' | 'switch') => {
    status.value = false;
    signInRequest.value = { mode };
  };

  const clearSignInRequest = () => {
    signInRequest.value = null;
  };

  return { status, open, close, signInRequest, requestSignIn, clearSignInRequest };
});
