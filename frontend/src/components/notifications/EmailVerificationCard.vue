<script setup lang="ts">
/**
 * src/components/notifications/EmailVerificationCard.vue — the self-contained
 * card that walks a user through providing an email, entering the 6-digit
 * code, and (once verified) changing or removing it. Reads and writes
 * `useNotificationsStore`, so multiple mount points (the notifications page,
 * the create-payable form) stay in sync when the flow completes.
 *
 * The card renders one of four sub-states, driven entirely by the store plus
 * a local `mode` ref that lets a verified user re-enter the input step to
 * change their address.
 *
 * Props:
 *  - `dense`: strips the outer GlassCard chrome so the card can be dropped
 *    inline into another surface (e.g. the create-payable form) without a
 *    nested-card look.
 */
import { GlassCard, StatusPill } from '@/components/ui';
import IconEmail from '@/icons/IconEmail.vue';
import { useNotificationsStore } from '@/stores';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { computed, ref, watch } from 'vue';

const { dense = false } = defineProps<{ dense?: boolean }>();

const notifications = useNotificationsStore();

type Mode = 'idle' | 'changing';
const mode = ref<Mode>('idle');

const emailInput = ref('');
const codeInput = ref('');

const currentEmail = computed(() => notifications.profile?.email ?? null);
const verifiedAt = computed(() => notifications.profile?.emailVerifiedAt ?? null);

const isVerified = computed(() => !!currentEmail.value && !!verifiedAt.value);
const isPending = computed(() => !!notifications.pendingEmail);

const isEmailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim()));
const isCodeValid = computed(() => /^\d{6}$/.test(codeInput.value.trim()));

/** Which sub-view to render — order matters: pending code entry beats
 *  everything so a mid-flight verification survives a wallet re-mount. */
const view = computed<'pending' | 'verified' | 'input'>(() => {
  if (isPending.value) return 'pending';
  if (isVerified.value && mode.value === 'idle') return 'verified';
  return 'input';
});

const verifiedAtLabel = computed(() => {
  if (!verifiedAt.value) return '';
  try {
    return new Date(verifiedAt.value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
});

const submitEmail = async () => {
  if (!isEmailValid.value) return;
  const ok = await notifications.requestEmailVerification(emailInput.value);
  if (ok) {
    codeInput.value = '';
    mode.value = 'idle';
  }
};

const submitCode = async () => {
  if (!isCodeValid.value) return;
  const ok = await notifications.verifyEmail(codeInput.value);
  if (ok) {
    codeInput.value = '';
    emailInput.value = '';
  }
};

const resendCode = async () => {
  if (!notifications.pendingEmail) return;
  await notifications.requestEmailVerification(notifications.pendingEmail);
};

const useDifferentEmail = () => {
  notifications.cancelPending();
  codeInput.value = '';
  emailInput.value = notifications.pendingEmail ?? '';
  mode.value = 'changing';
};

const changeEmail = () => {
  emailInput.value = currentEmail.value ?? '';
  mode.value = 'changing';
};

const cancelChange = () => {
  emailInput.value = '';
  mode.value = 'idle';
};

const removeEmail = async () => {
  await notifications.removeEmail();
  mode.value = 'idle';
  emailInput.value = '';
};

watch(
  () => notifications.pendingEmail,
  (v) => {
    if (v) codeInput.value = '';
  }
);

const wrapperClass = computed(() =>
  dense ? 'space-y-4' : ''
);
</script>

<template>
  <component :is="dense ? 'div' : GlassCard" :class="wrapperClass">
    <div v-if="!dense" class="flex items-center gap-3 mb-5">
      <span
        class="inline-flex items-center justify-center rounded-xl border border-glass-border bg-fg/5 w-9 h-9 text-accent"
      >
        <IconEmail class="w-4 h-4" />
      </span>
      <div class="min-w-0">
        <h2 class="text-base font-semibold text-fg">Email notifications</h2>
        <p class="text-xs text-muted">Get an email whenever something happens on your payables.</p>
      </div>
    </div>

    <!-- Verified state: show the address plus manage buttons. -->
    <template v-if="view === 'verified'">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-2 flex-wrap">
            <StatusPill tone="success" label="Notifications on" />
            <span v-if="verifiedAtLabel" class="text-xs text-muted">Verified {{ verifiedAtLabel }}</span>
          </div>
          <p class="text-sm text-fg break-all font-medium">{{ currentEmail }}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <Button
            severity="secondary"
            size="small"
            :disabled="notifications.isRemovingEmail"
            label="Change email"
            @click="changeEmail"
          />
          <Button
            severity="danger"
            size="small"
            :loading="notifications.isRemovingEmail"
            label="Remove email"
            @click="removeEmail"
          />
        </div>
      </div>
    </template>

    <!-- Pending state: the user has requested a code and is entering it. -->
    <template v-else-if="view === 'pending'">
      <p class="text-sm text-fg mb-2">
        We sent a 6-digit code to
        <span class="font-medium break-all">{{ notifications.pendingEmail }}</span>.
      </p>
      <p class="text-xs text-muted mb-4">
        Enter the code below to finish setting up email notifications. Codes expire after a short window.
      </p>

      <form class="flex flex-wrap items-start gap-3" @submit.prevent="submitCode">
        <label class="flex-1 min-w-[10rem]">
          <span class="sr-only">Verification code</span>
          <InputText
            v-model="codeInput"
            placeholder="6-digit code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            class="w-full font-mono tracking-[0.4em] text-center"
          />
        </label>
        <Button
          type="submit"
          :disabled="!isCodeValid"
          :loading="notifications.isVerifyingCode"
          label="Verify"
        />
      </form>

      <div class="mt-4 flex items-center gap-4 text-xs">
        <button
          type="button"
          class="text-accent hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="notifications.isRequestingCode"
          @click="resendCode"
        >
          {{ notifications.isRequestingCode ? 'Sending...' : 'Send a new code' }}
        </button>
        <span class="text-muted">or</span>
        <button
          type="button"
          class="text-muted hover:text-fg transition-colors"
          @click="useDifferentEmail"
        >
          use a different email
        </button>
      </div>
    </template>

    <!-- Input state: user is entering (or changing) their email. -->
    <template v-else>
      <p v-if="mode === 'changing' && currentEmail" class="text-sm text-muted mb-3">
        Currently verified: <span class="text-fg font-medium break-all">{{ currentEmail }}</span>.
        Enter a new email below to replace it.
      </p>
      <p v-else-if="!dense" class="text-sm text-muted mb-3">
        Enter your email to start receiving notifications. We'll send you a 6-digit code to confirm it.
      </p>
      <p v-else class="text-sm text-muted mb-3">
        Get an email when you receive payments. We'll send a 6-digit code to confirm.
      </p>

      <form class="flex flex-wrap items-start gap-3" @submit.prevent="submitEmail">
        <label class="flex-1 min-w-[14rem]">
          <span class="sr-only">Email address</span>
          <InputText
            v-model="emailInput"
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder="you@example.com"
            :disabled="notifications.isRequestingCode"
            class="w-full"
          />
        </label>
        <Button
          type="submit"
          :disabled="!isEmailValid"
          :loading="notifications.isRequestingCode"
          label="Send verification code"
        />
        <Button
          v-if="mode === 'changing'"
          type="button"
          severity="secondary"
          label="Cancel"
          @click="cancelChange"
        />
      </form>
    </template>
  </component>
</template>
