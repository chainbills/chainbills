<script setup lang="ts">
/**
 * src/views/CreatePayableView.vue: `/start`. The form a host fills in to
 * create a new payable: a description, payment rules (any amount, or a
 * fixed list of accepted token/amount options), and the auto-withdraw
 * toggle. A live preview card on the right mirrors what the resulting
 * payable page will look like. Submitting drives the `'create-payable'`
 * tx-flow (`stores/payable.ts`, `create`); `TxFlowDialog` (mounted in
 * `App.vue`) shows its progress and, on success, offers "Open payable" and
 * "Copy payment link". This view does not navigate away on its own, so the
 * form stays available to create another payable while the flow's `sync`
 * step keeps broadcasting to the other chains in the background.
 */
import { useTxRetry } from '@/components/tx/retry';
import {
  AddressChip,
  ChainBadge,
  GlassCard,
  PayableAvatar,
  SectionHeader,
  StatusPill,
  TokenAmount,
} from '@/components/ui';
import PaymentRulesEditor from '@/components/payable/PaymentRulesEditor.vue';
import SignInButton from '@/components/SignInButton.vue';
import { chainNamesEvm, chainNamesToChains, TokenAndAmount } from '@/schemas';
import { useAnalyticsStore, useAuthStore, usePayableStore } from '@/stores';
import DomPurify from 'dompurify';
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, ref } from 'vue';

const analytics = useAnalyticsStore();
const auth = useAuthStore();
const payableStore = usePayableStore();
const { setRetry } = useTxRetry();

const description = ref('');
const descriptionLength = computed(() => description.value.trim().length);
const descriptionError = computed(() => {
  if (descriptionLength.value === 0) return '';
  if (descriptionLength.value < 3) return 'Minimum 3 characters.';
  if (descriptionLength.value > 3000) return 'Maximum 3000 characters.';
  return '';
});

const homeChain = computed(() => auth.currentUser?.chain ?? null);

/** The parsed, validated tokens and amounts to submit. An empty array means "any token, any amount". */
const tokensAndAmounts = ref<TokenAndAmount[]>([]);

/** Validation error from PaymentRulesEditor. Empty when valid. */
const configError = ref('');

/** The other EVM chains of the connected wallet's network. These are where this payable will sync once created, per `payable.availability`'s "same network, EVM" rule. No payable exists yet to probe `getForeignPayable` on, so this mirrors that rule statically. */
const syncChains = computed(() => {
  if (!homeChain.value) return [];
  return chainNamesEvm
    .map((name) => chainNamesToChains[name])
    .filter((chain) => chain.name !== homeChain.value!.name && chain.networkType === homeChain.value!.networkType);
});

const isAutoWithdraw = ref(false);
const isSubmitting = ref(false);

const canSubmit = computed(
  () => !!auth.currentUser && descriptionLength.value >= 3 && !descriptionError.value && !configError.value
);

const resetForm = () => {
  description.value = '';
  tokensAndAmounts.value = [];
  configError.value = '';
  isAutoWithdraw.value = false;
};

const submit = async () => {
  analytics.recordEvent('clicked_create_payable');
  if (!canSubmit.value) return;

  setRetry(() => submit());
  isSubmitting.value = true;
  const id = await payableStore.create(
    DomPurify.sanitize(description.value.trim()),
    tokensAndAmounts.value,
    isAutoWithdraw.value
  );
  isSubmitting.value = false;
  if (id) resetForm();
};

const previewTitle = computed(() => `Payable preview`);
</script>

<template>
  <section class="pt-6 pb-20 max-w-screen-xl mx-auto">
    <SectionHeader eyebrow="Create" title="New payable" accent-tail="in one link.">
      <template #description>
        Set up how you want to get paid. Anyone with the link can pay it, on any chain of your network.
      </template>
    </SectionHeader>

    <div class="grid lg:grid-cols-[1.1fr,0.9fr] gap-6 items-start">
      <GlassCard class="relative">
        <div
          v-if="!auth.currentUser"
          class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-bg/70 backdrop-blur-sm text-center px-6"
        >
          <p class="text-sm text-muted max-w-xs">Connect your wallet to create a payable.</p>
          <SignInButton @click="analytics.recordEvent('clicked_signin', { from: 'create_payable_page' })" />
        </div>

        <form
          :class="['flex flex-col gap-8', !auth.currentUser && 'opacity-40 pointer-events-none select-none']"
          @submit.prevent="submit"
        >
          <label class="block">
            <span class="text-sm font-medium text-fg">Description</span>
            <p class="text-xs text-muted mb-2">
              What payers see when they open this payable. Stored off-chain and editable any time later.
            </p>
            <textarea
              v-model="description"
              rows="4"
              class="w-full rounded-xl border border-glass-border bg-glass-tint px-3.5 py-2.5 text-sm text-fg outline-none focus:border-accent resize-none"
              placeholder="What is this payable for?"
            ></textarea>
            <div class="mt-1 flex items-center justify-between text-xs">
              <span :class="descriptionError ? 'text-danger' : 'text-muted'">{{ descriptionError || ' ' }}</span>
              <span class="text-muted tabular-nums">{{ descriptionLength }} / 3000</span>
            </div>
          </label>

          <div>
            <span class="text-sm font-medium text-fg">Payment rules</span>
            <p class="text-xs text-muted mb-3">What can payers send this payable?</p>
            <PaymentRulesEditor
              v-if="homeChain"
              :home-chain="homeChain"
              v-model="tokensAndAmounts"
              @update:error="configError = $event"
            />
            <p v-else class="mt-3 text-xs text-muted">Connect your wallet to configure payment rules.</p>
          </div>

          <label class="flex items-start gap-3">
            <ToggleSwitch v-model="isAutoWithdraw" />
            <span>
              <span class="block text-sm font-medium text-fg">Auto-withdraw</span>
              <span class="block text-xs text-muted">
                Every payment is sent straight to your wallet, minus the 2% fee, instead of sitting in the payable's
                balance until you withdraw manually.
              </span>
            </span>
          </label>

          <div v-if="homeChain">
            <span class="text-sm font-medium text-fg">Home chain</span>
            <p class="text-xs text-muted mb-2">
              This payable lives on the chain you're connected to, and syncs automatically to every other chain of the
              same network.
            </p>
            <ChainBadge :chain="homeChain" network />
            <p v-if="syncChains.length" class="mt-2 text-xs text-muted">
              Will also sync to:
              <span class="text-fg">{{ syncChains.map((c) => c.displayName).join(', ') }}</span>
            </p>
          </div>

          <Button type="submit" :disabled="!canSubmit || isSubmitting" class="self-end px-6">
            {{ isSubmitting ? 'Creating...' : 'Create payable' }}
          </Button>
        </form>
      </GlassCard>

      <GlassCard variant="refract" :aria-label="previewTitle">
        <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent mb-4">Live preview</p>
        <div class="flex items-center gap-3 mb-4">
          <PayableAvatar :id="auth.currentUser?.walletAddress ?? 'preview'" />
          <div>
            <StatusPill tone="success" label="Open" />
          </div>
        </div>

        <p class="text-sm text-fg whitespace-pre-wrap break-words mb-4 line-clamp-6">
          {{ description.trim() || 'Your description will appear here.' }}
        </p>

        <div class="mb-4">
          <p class="text-xs uppercase tracking-wider text-muted mb-1.5">Accepts</p>
          <p v-if="tokensAndAmounts.length === 0" class="text-sm text-fg">Any supported token, any amount</p>
          <div v-else-if="tokensAndAmounts.length && homeChain" class="flex flex-wrap gap-2">
            <span
              v-for="(ta, i) in tokensAndAmounts"
              :key="i"
              class="rounded-full border border-glass-border bg-bg/30 px-2.5 py-1"
            >
              <TokenAmount :amount="ta" :chain="homeChain" size="sm" />
            </span>
          </div>
          <p v-else class="text-sm text-muted">Add a token and amount to preview it here.</p>
        </div>

        <div v-if="isAutoWithdraw" class="mb-4">
          <span
            class="inline-flex items-center rounded-full bg-accent/15 text-accent text-[11px] font-medium px-2.5 py-1"
          >
            Auto-withdraw on
          </span>
        </div>

        <div v-if="homeChain" class="flex items-center justify-between text-xs text-muted pt-3 border-t border-fg/5">
          <ChainBadge :chain="homeChain" size="sm" />
          <AddressChip
            v-if="auth.currentUser"
            :value="auth.currentUser.walletAddress"
            :chain="homeChain"
            kind="address"
          />
        </div>
      </GlassCard>
    </div>
  </section>
</template>
