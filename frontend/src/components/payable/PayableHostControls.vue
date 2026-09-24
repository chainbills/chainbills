<script setup lang="ts">
/**
 * src/components/payable/PayableHostControls.vue: the "Manage payable"
 * section, visible only to the payable's host.
 *
 * Provides four controls, each driven by the matching `usePayableStore`
 * action (which in turn drives the correct `useTxFlowStore` flow so
 * `TxFlowDialog` in `App.vue` shows progress):
 *
 * 1. Close / Reopen: a danger "Close payable" button (or success "Reopen
 *    payable" when already closed), with a confirmation dialog.
 * 2. Payment rules: "Edit payment rules" opens a dialog with
 *    `PaymentRulesEditor`; shows a diff of current vs new; submits via
 *    `payable.updateTokens`.
 * 3. Auto-withdraw: a `ToggleSwitch` with a confirmation dialog.
 * 4. Description: an inline `DescriptionEditor` toggled by an "Edit" button.
 *
 * When the host is connected on a different chain than the payable's own
 * chain, every control is disabled and shows "Switch to {chain} to manage
 * this payable" with a chain-switch prompt.
 *
 * After each successful action, emits `updated` with the refreshed `Payable`.
 *
 * Props:
 *  - `payable`: the current `Payable`.
 *
 * Emits:
 *  - `updated`: fires with the refreshed `Payable` after any successful action.
 *
 * Usage:
 * ```vue
 * <PayableHostControls :payable="payable" @updated="onUpdated" />
 * ```
 */
import { GlassCard, StatusPill } from '@/components/ui';
import DescriptionEditor from './DescriptionEditor.vue';
import PaymentRulesEditor from './PaymentRulesEditor.vue';
import { type Payable, type TokenAndAmount } from '@/schemas';
import { useAnalyticsStore, useAuthStore, usePayableStore } from '@/stores';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, ref } from 'vue';

const props = defineProps<{
  /** The payable being managed. */
  payable: Payable;
}>();

const emit = defineEmits<{
  /** Fires with the refreshed Payable after any successful host action. */
  updated: [payable: Payable];
}>();

const analytics = useAnalyticsStore();
const auth = useAuthStore();
const payableStore = usePayableStore();

/** True when the connected wallet is on a different chain than the payable's home chain. */
const wrongChain = computed(() => {
  if (!auth.currentUser) return true;
  return auth.currentUser.chain.name !== props.payable.chain.name;
});

/** Tooltip / disabled message for controls when on the wrong chain. */
const wrongChainMsg = computed(
  () => `Switch your wallet to ${props.payable.chain.displayName} to manage this payable.`
);

// --- Close / Reopen ---
const showCloseConfirm = ref(false);
const showReopenConfirm = ref(false);
const isClosing = ref(false);
const isReopening = ref(false);

const confirmClose = async () => {
  showCloseConfirm.value = false;
  analytics.recordEvent('clicked_close_payable', { payable_id: props.payable.id });
  isClosing.value = true;
  const result = await payableStore.close(props.payable);
  isClosing.value = false;
  if (result.ok && result.payable) emit('updated', result.payable);
};

const confirmReopen = async () => {
  showReopenConfirm.value = false;
  analytics.recordEvent('clicked_reopen_payable', { payable_id: props.payable.id });
  isReopening.value = true;
  const result = await payableStore.reopen(props.payable);
  isReopening.value = false;
  if (result.ok && result.payable) emit('updated', result.payable);
};

// --- Payment rules ---
const showRulesDialog = ref(false);
const editedRules = ref<TokenAndAmount[]>([...props.payable.allowedTokensAndAmounts]);
const rulesError = ref('');
const isUpdatingRules = ref(false);

const saveRules = async () => {
  if (rulesError.value) return;
  showRulesDialog.value = false;
  analytics.recordEvent('clicked_update_payment_rules', { payable_id: props.payable.id });
  isUpdatingRules.value = true;
  const result = await payableStore.updateTokens(props.payable, editedRules.value);
  isUpdatingRules.value = false;
  if (result.ok && result.payable) emit('updated', result.payable);
};

// --- Auto-withdraw ---
const showAutoWithdrawConfirm = ref(false);
/** Shadow toggle value shown in the UI. Follows the payable's value until the host changes it. */
const autoWithdrawLocal = computed(() => props.payable.isAutoWithdraw);
const pendingAutoWithdraw = ref<boolean | null>(null);
const isUpdatingAutoWithdraw = ref(false);

const requestAutoWithdrawChange = (val: boolean) => {
  pendingAutoWithdraw.value = val;
  showAutoWithdrawConfirm.value = true;
};

const confirmAutoWithdraw = async () => {
  if (pendingAutoWithdraw.value === null) return;
  showAutoWithdrawConfirm.value = false;
  analytics.recordEvent('clicked_set_auto_withdraw', {
    payable_id: props.payable.id,
    value: pendingAutoWithdraw.value,
  });
  isUpdatingAutoWithdraw.value = true;
  const result = await payableStore.setAutoWithdraw(props.payable, pendingAutoWithdraw.value);
  isUpdatingAutoWithdraw.value = false;
  pendingAutoWithdraw.value = null;
  if (result.ok && result.payable) emit('updated', result.payable);
};

const cancelAutoWithdraw = () => {
  pendingAutoWithdraw.value = null;
  showAutoWithdrawConfirm.value = false;
};

// --- Description ---
const showDescriptionEditor = ref(false);

const onDescriptionSaved = (refreshed: Payable) => {
  showDescriptionEditor.value = false;
  emit('updated', refreshed);
};
</script>

<template>
  <GlassCard>
    <h2 id="host-controls-heading" class="text-base font-semibold text-fg mb-1">Manage payable</h2>
    <p class="text-xs text-muted mb-5">Only you (the host) see this section.</p>

    <!-- Wrong-chain banner -->
    <div
      v-if="wrongChain"
      class="mb-5 rounded-xl bg-warning/10 border border-warning/30 px-4 py-3 text-sm text-warning"
      role="alert"
    >
      {{ wrongChainMsg }}
    </div>

    <div class="flex flex-col gap-6">

      <!-- Close / Reopen -->
      <div class="border-b border-fg/5 pb-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-fg">
              {{ payable.isClosed ? 'Reopen payable' : 'Close payable' }}
            </p>
            <p class="text-xs text-muted mt-0.5">
              <template v-if="payable.isClosed">
                Allow payers to pay this payable again. The change syncs to all other chains.
              </template>
              <template v-else>
                Stop accepting payments. Payers everywhere will be blocked once the change syncs.
              </template>
            </p>
          </div>
          <Button
            v-if="payable.isClosed"
            :disabled="wrongChain || isReopening"
            :title="wrongChain ? wrongChainMsg : ''"
            class="shrink-0 text-sm px-4"
            @click="showReopenConfirm = true"
          >
            {{ isReopening ? 'Reopening...' : 'Reopen' }}
          </Button>
          <Button
            v-else
            severity="danger"
            :disabled="wrongChain || isClosing"
            :title="wrongChain ? wrongChainMsg : ''"
            class="shrink-0 text-sm px-4"
            @click="showCloseConfirm = true"
          >
            {{ isClosing ? 'Closing...' : 'Close' }}
          </Button>
        </div>
      </div>

      <!-- Payment rules -->
      <div class="border-b border-fg/5 pb-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-fg">Accepted tokens &amp; amounts</p>
            <p class="text-xs text-muted mt-0.5">
              <template v-if="payable.allowedTokensAndAmounts.length === 0">Any token, any amount.</template>
              <template v-else>
                {{ payable.allowedTokensAndAmounts.length }} specific
                option{{ payable.allowedTokensAndAmounts.length !== 1 ? 's' : '' }}.
              </template>
            </p>
          </div>
          <Button
            :disabled="wrongChain || isUpdatingRules"
            :title="wrongChain ? wrongChainMsg : ''"
            class="shrink-0 text-sm px-4"
            @click="showRulesDialog = true"
          >
            Edit payment rules
          </Button>
        </div>
      </div>

      <!-- Auto-withdraw -->
      <div class="border-b border-fg/5 pb-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-fg">Auto-withdraw</p>
            <p class="text-xs text-muted mt-0.5">
              When on, payments go directly to your wallet. This setting stays on the home chain only.
            </p>
          </div>
          <ToggleSwitch
            :model-value="autoWithdrawLocal"
            :disabled="wrongChain || isUpdatingAutoWithdraw"
            :title="wrongChain ? wrongChainMsg : ''"
            aria-label="Toggle auto-withdraw"
            @update:model-value="requestAutoWithdrawChange"
          />
        </div>
      </div>

      <!-- Description -->
      <div>
        <div class="flex items-start justify-between gap-4 mb-3">
          <p class="text-sm font-medium text-fg">Description</p>
          <Button
            v-if="!showDescriptionEditor"
            :disabled="wrongChain"
            :title="wrongChain ? wrongChainMsg : ''"
            class="shrink-0 text-sm px-4"
            @click="showDescriptionEditor = true"
          >
            Edit
          </Button>
        </div>

        <DescriptionEditor
          v-if="showDescriptionEditor"
          :payable="payable"
          @saved="onDescriptionSaved"
          @cancel="showDescriptionEditor = false"
        />
        <p
          v-else-if="payable.description"
          class="text-sm text-fg whitespace-pre-line"
        >{{ payable.description }}</p>
        <p v-else class="text-sm text-muted italic">No description set.</p>
      </div>
    </div>
  </GlassCard>

  <!-- Close confirmation dialog -->
  <Dialog v-model:visible="showCloseConfirm" modal header="Close payable?" class="w-full max-w-sm max-sm:m-4">
    <p class="text-sm text-muted mb-4">
      Closing will prevent anyone from paying this payable. The change will broadcast to all other chains, and payers
      everywhere will be blocked once each chain syncs.
    </p>
    <p class="text-sm text-fg font-medium mb-2">Are you sure?</p>
    <template #footer>
      <Button severity="secondary" @click="showCloseConfirm = false">Cancel</Button>
      <Button severity="danger" @click="confirmClose">Close payable</Button>
    </template>
  </Dialog>

  <!-- Reopen confirmation dialog -->
  <Dialog v-model:visible="showReopenConfirm" modal header="Reopen payable?" class="w-full max-w-sm max-sm:m-4">
    <p class="text-sm text-muted mb-4">
      Reopening will allow payers to pay this payable again. The change will broadcast to all other chains.
    </p>
    <template #footer>
      <Button severity="secondary" @click="showReopenConfirm = false">Cancel</Button>
      <Button @click="confirmReopen">Reopen payable</Button>
    </template>
  </Dialog>

  <!-- Payment rules dialog -->
  <Dialog
    v-model:visible="showRulesDialog"
    modal
    header="Edit payment rules"
    class="w-full max-w-md max-sm:m-4"
  >
    <p class="text-sm text-muted mb-4">Update the accepted tokens and amounts for this payable.</p>
    <PaymentRulesEditor
      :home-chain="payable.chain"
      v-model="editedRules"
      @update:error="rulesError = $event"
    />
    <template #footer>
      <Button severity="secondary" @click="showRulesDialog = false">Cancel</Button>
      <Button :disabled="!!rulesError" @click="saveRules">Save rules</Button>
    </template>
  </Dialog>

  <!-- Auto-withdraw confirmation dialog -->
  <Dialog
    v-model:visible="showAutoWithdrawConfirm"
    modal
    :header="pendingAutoWithdraw ? 'Enable auto-withdraw?' : 'Disable auto-withdraw?'"
    class="w-full max-w-sm max-sm:m-4"
  >
    <p class="text-sm text-muted mb-4">
      <template v-if="pendingAutoWithdraw">
        Enabling auto-withdraw means every payment will be sent directly to your wallet, minus the fee. This setting
        stays on the home chain only and is not broadcast to other chains.
      </template>
      <template v-else>
        Disabling auto-withdraw means payments will accumulate in the payable's balance until you withdraw manually.
        This setting stays on the home chain only.
      </template>
    </p>
    <div class="flex items-center gap-2">
      <span class="text-xs text-muted">New status:</span>
      <StatusPill
        :tone="pendingAutoWithdraw ? 'success' : 'neutral'"
        :label="pendingAutoWithdraw ? 'Auto-withdraw: On' : 'Auto-withdraw: Off'"
      />
    </div>
    <template #footer>
      <Button severity="secondary" @click="cancelAutoWithdraw">Cancel</Button>
      <Button @click="confirmAutoWithdraw">Confirm</Button>
    </template>
  </Dialog>
</template>
