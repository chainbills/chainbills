<script setup lang="ts">
/**
 * src/components/payable/DescriptionEditor.vue: inline description editor
 * for the host controls section.
 *
 * Renders a textarea with a 3 to 3000 character counter, a Save button and a
 * Cancel button. Calls `payable.updateDescription` from `usePayableStore`
 * on save (which drives the `'update-payable-description'` tx-flow and posts
 * to the Firebase server). Emits `saved` with the updated `Payable` on
 * success, and `cancel` when the host dismisses the editor without saving.
 *
 * Props:
 *  - `payable`: the current `Payable` whose description is being edited.
 *
 * Emits:
 *  - `saved`: emitted with the refreshed `Payable` after the description is saved.
 *  - `cancel`: emitted when the host clicks Cancel.
 *
 * Usage:
 * ```vue
 * <DescriptionEditor :payable="payable" @saved="onSaved" @cancel="showEditor = false" />
 * ```
 */
import { type Payable } from '@/schemas';
import { useAnalyticsStore, usePayableStore } from '@/stores';
import Button from 'primevue/button';
import { computed, ref } from 'vue';

const props = defineProps<{
  /** The payable whose description is being edited. Pre-fills the textarea. */
  payable: Payable;
}>();

const emit = defineEmits<{
  /** Fires with the refreshed Payable once the description is saved. */
  saved: [payable: Payable];
  /** Fires when the host clicks Cancel without saving. */
  cancel: [];
}>();

const analytics = useAnalyticsStore();
const payableStore = usePayableStore();

/** The description text currently in the textarea. Pre-filled from the payable. */
const text = ref(props.payable.description);

/** Character count of the trimmed text. */
const charCount = computed(() => text.value.trim().length);

/** Validation error: empty string when valid, non-empty string when not. */
const error = computed((): string => {
  const len = charCount.value;
  if (len === 0) return '';
  if (len < 3) return 'Minimum 3 characters.';
  if (len > 3000) return 'Maximum 3000 characters.';
  return '';
});

/** True when the description can be saved. */
const canSave = computed(() => charCount.value >= 3 && !error.value);

const isSaving = ref(false);

const save = async () => {
  if (!canSave.value) return;
  analytics.recordEvent('clicked_update_description', { payable_id: props.payable.id });
  isSaving.value = true;
  const result = await payableStore.updateDescription(props.payable, text.value.trim());
  isSaving.value = false;
  if (result.ok && result.payable) emit('saved', result.payable);
};

const cancel = () => emit('cancel');
</script>

<template>
  <div class="flex flex-col gap-2">
    <textarea
      v-model="text"
      rows="5"
      class="w-full rounded-xl border border-glass-border bg-glass-tint px-3.5 py-2.5 text-sm text-fg outline-none focus:border-accent resize-none"
      placeholder="Describe what this payable is for (3-3000 characters)."
      aria-label="Payable description"
      :aria-describedby="error ? 'desc-editor-error' : undefined"
    ></textarea>

    <div class="flex items-center justify-between text-xs">
      <span v-if="error" id="desc-editor-error" role="alert" class="text-danger">{{ error }}</span>
      <span v-else class="text-muted"> </span>
      <span class="text-muted tabular-nums">{{ charCount }} / 3000</span>
    </div>

    <div class="flex items-center gap-2 self-end">
      <Button severity="secondary" class="text-sm px-4" @click="cancel">Cancel</Button>
      <Button :disabled="!canSave || isSaving" class="text-sm px-4" @click="save">
        {{ isSaving ? 'Saving...' : 'Save' }}
      </Button>
    </div>
  </div>
</template>
