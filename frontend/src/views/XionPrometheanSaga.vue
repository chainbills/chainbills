<script setup lang="ts">
import IconSpinner from '@/icons/IconSpinner.vue';
import { useServerStore, useThemeStore } from '@/stores';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import ConfettiExplosion from 'vue-confetti-explosion';
import { onMounted, ref, type Ref, watch } from 'vue';

const emailInput = ref(null) as unknown as Ref<HTMLInputElement>;
const email = ref('');
const emailError = ref('');
const isJoining = ref(false);
const hasJoined = ref(false);
const server = useServerStore();
const theme = useThemeStore();
const toast = useToast();

const joinPrometheanSaga = async () => {
  if (emailError.value) return;

  isJoining.value = true;
  await server.saveXionSagaEmail(email.value);
  toast.add({
    severity: 'success',
    summary: 'Welcome!',
    detail:
      "You've joined the Promethean Saga. You will receive more info later on.",
    life: 5000,
  });
  hasJoined.value = true;
  isJoining.value = false;
};

const validateEmail = () => {
  const { typeMismatch, valid, valueMissing } = emailInput.value.validity;
  if (valueMissing) emailError.value = 'Required';
  else if (typeMismatch) emailError.value = 'Invalid Email';
  else if (valid) emailError.value = '';
  else emailError.value = emailInput.value.validationMessage;
};

onMounted(() => {
  watch(() => email.value, validateEmail);
});
</script>

<template>
  <ConfettiExplosion
    :duration="7000"
    :particleSize="6"
    :particleCount="200"
    class="absolute top-0 left-[50%] w-full h-full"
    v-if="hasJoined"
  />
          
  <section class="max-w-screen-xl mx-auto">
    <img
      :src="`/assets/xion-${theme.isDisplayDark ? 'dark' : 'light'}.png`"
      class="w-full max-w-sm mx-auto mb-4"
    />

    <p class="text-2xl text-center mb-16 sm:text-3xl">
      Joining the
      <h3 class="font-bold animate-pulse inline">Promethean Saga</h3> Soon ...
    </p>

    <div class="max-w-sm mx-auto mb-24">
      <div class="text-center" v-if="hasJoined">
        <h4 class="mb-2 text-xl font-bold">Welcome</h4>
        <p>You will get more info later. Stay Tuned 😎</p>
      </div>

      <div class="text-center" v-else-if="isJoining">
        <p class="mb-4">Joining ...</p>
        <IconSpinner class="mb-12 mx-auto w-32 h-32" />
      </div>

      <form @submit.prevent="joinPrometheanSaga" v-else>
        <label
          :class="
            'text-sm focus-within:text-primary w-full ' +
            (emailError ? 'text-red-500 focus-within:text-red-500' : '')
          "
          ><span>Your Email *</span>
          <small class="text-xs text-gray-500 block mb-2"
            >Get Priority Notification of Mainnet Launch</small
          >
          <input
            type="email"
            v-model="email"
            ref="emailInput"
            autocomplete="email"
            class="block w-full pb-1 border-b-2 mb-1 focus:outline-none focus:border-primary bg-transparent"
            :style="{ color: 'var(--text)' }"
            required
          />
          <small class="text-xs block mb-6">{{ emailError }}</small>
        </label>

        <p class="text-right">
          <Button type="submit" class="px-4 py-1 text-lg">Join Now</Button>
        </p>
      </form>
    </div>
  </section>
</template>
