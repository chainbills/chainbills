<script setup lang="ts">
/**
 * src/views/NotificationsView.vue — `/notifications`. Signed-in host manages
 * their email address (verify, change, remove) and per-type notification
 * preferences. Both cards read from `useNotificationsStore`, which fetches
 * `/me` when the wallet connects and rewrites its cached profile on every
 * mutation.
 */
import EmailVerificationCard from '@/components/notifications/EmailVerificationCard.vue';
import NotificationPreferencesCard from '@/components/notifications/NotificationPreferencesCard.vue';
import SignInButton from '@/components/SignInButton.vue';
import { EmptyState, SectionHeader } from '@/components/ui';
import { useAnalyticsStore, useAuthStore } from '@/stores';

const analytics = useAnalyticsStore();
const auth = useAuthStore();
</script>

<template>
  <section class="pt-6 pb-20 max-w-3xl mx-auto">
    <SectionHeader eyebrow="Settings" title="Notifications">
      <template #description>
        Get an email whenever something happens on your payables. You can turn each type on or off, and remove your
        email at any time.
      </template>
    </SectionHeader>

    <template v-if="!auth.currentUser">
      <EmptyState
        title="Connect your wallet"
        description="Sign in to set up email notifications for your payables."
      >
        <template #action>
          <SignInButton @click="analytics.recordEvent('clicked_signin', { from: 'notifications_page' })" />
        </template>
      </EmptyState>
    </template>

    <template v-else>
      <div class="flex flex-col gap-6">
        <EmailVerificationCard />
        <NotificationPreferencesCard />
      </div>

      <p class="text-xs text-muted text-center mt-8">
        Emails are sent from a Chainbills address. Each one has a one-click unsubscribe link that turns off all future
        notifications immediately, no login required.
      </p>
    </template>
  </section>
</template>
