<script setup lang="ts">
/**
 * src/components/notifications/NotificationPreferencesCard.vue — per-type
 * toggles for the four notification types the backend can send. Each toggle
 * flips `preferences[type].email` and PATCHes /me/preferences in the
 * background; failed writes revert automatically because
 * `useNotificationsStore.updatePreferences` only mutates `profile` on a
 * successful response.
 *
 * The whole card is disabled and dimmed when the user has no verified email —
 * there is nowhere for a notification to go, so a toggle would be misleading.
 */
import { GlassCard } from '@/components/ui';
import IconHorizontalAdjustments from '@/icons/IconHorizontalAdjustments.vue';
import {
  NOTIFICATION_TYPES_ORDERED,
  NOTIFICATION_TYPE_LABELS,
  useNotificationsStore,
  type NotificationType,
} from '@/stores';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, reactive } from 'vue';

const notifications = useNotificationsStore();

const hasVerifiedEmail = computed(() => !!notifications.profile?.email && !!notifications.profile?.emailVerifiedAt);

const savingType = reactive<Record<NotificationType, boolean>>({
  PAYABLE_CREATED: false,
  PAYMENT_RECEIVED: false,
  PAYMENT_RECEIPT: false,
  WITHDRAWAL_COMPLETED: false,
});

const isEnabled = (type: NotificationType) =>
  !!notifications.profile?.preferences?.[type]?.email;

const toggle = async (type: NotificationType) => {
  if (!hasVerifiedEmail.value) return;
  const next = !isEnabled(type);
  savingType[type] = true;
  await notifications.updatePreferences({ [type]: { email: next } });
  savingType[type] = false;
};
</script>

<template>
  <GlassCard>
    <div class="flex items-center gap-3 mb-5">
      <span
        class="inline-flex items-center justify-center rounded-xl border border-glass-border bg-fg/5 w-9 h-9 text-accent"
      >
        <IconHorizontalAdjustments class="w-4 h-4" />
      </span>
      <div class="min-w-0">
        <h2 class="text-base font-semibold text-fg">What we email you about</h2>
        <p class="text-xs text-muted">Turn each type on or off. Applied instantly.</p>
      </div>
    </div>

    <p
      v-if="!hasVerifiedEmail"
      class="mb-4 rounded-xl border border-glass-border bg-fg/5 px-3.5 py-2.5 text-xs text-muted"
    >
      Verify an email address above to start receiving these notifications.
    </p>

    <ul
      :class="[
        'divide-y divide-fg/5 rounded-xl border border-glass-border bg-fg/[0.03]',
        !hasVerifiedEmail && 'opacity-60 pointer-events-none',
      ]"
    >
      <li
        v-for="type in NOTIFICATION_TYPES_ORDERED"
        :key="type"
        class="flex items-start justify-between gap-4 px-3.5 py-3"
      >
        <div class="min-w-0">
          <p class="text-sm font-medium text-fg">{{ NOTIFICATION_TYPE_LABELS[type].title }}</p>
          <p class="text-xs text-muted">{{ NOTIFICATION_TYPE_LABELS[type].blurb }}</p>
        </div>
        <ToggleSwitch
          :model-value="isEnabled(type)"
          :disabled="!hasVerifiedEmail || savingType[type]"
          class="shrink-0 mt-0.5"
          @update:model-value="toggle(type)"
        />
      </li>
    </ul>
  </GlassCard>
</template>
