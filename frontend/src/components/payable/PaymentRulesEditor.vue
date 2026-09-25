<script setup lang="ts">
/**
 * src/components/payable/PaymentRulesEditor.vue: reusable rule-builder for a
 * payable's "accepted tokens and amounts" configuration.
 *
 * Shared by `CreatePayableView` (new payable form) and
 * `PayableHostControls.vue` (edit existing payable). Renders two modes via
 * `SegmentedTabs`: "Any token, any amount" or "Specific tokens and amounts"
 * (a list of token/amount rows the host builds up). Validates each row and
 * emits a `change` event whenever the parsed value changes.
 *
 * Props:
 *  - `homeChain`: the payable's home chain; drives which tokens are available.
 *  - `modelValue`: the current parsed list; `[]` means "any amount".
 *
 * Emits:
 *  - `update:modelValue`: the new `TokenAndAmount[]` whenever valid rows change.
 *  - `update:error`: the current validation error string (empty when valid).
 *
 * Usage:
 * ```vue
 * <PaymentRulesEditor :homeChain="chain" v-model="tokensAndAmounts" @update:error="err = $event" />
 * ```
 */
import { SegmentedTabs } from '@/components/ui';
import IconClose from '@/icons/IconClose.vue';
import { parseTokenAmount, TokenAndAmount, tokens, type Chain, type Token } from '@/schemas';
import { useAnalyticsStore } from '@/stores';
import Select from 'primevue/select';
import { computed, ref, watch } from 'vue';

/** One row in the "specific tokens and amounts" list. `amount` stays a raw string while typed. */
interface RuleRow {
  token: Token | null;
  amount: string;
}

const props = defineProps<{
  /** The payable's home chain; limits which tokens are selectable. */
  homeChain: Chain;
  /** The current parsed list. An empty array means "any token, any amount". */
  modelValue: TokenAndAmount[];
}>();

const emit = defineEmits<{
  /** Fires with the new parsed list on every valid change. */
  'update:modelValue': [TokenAndAmount[]];
  /** Fires with the current validation error string (empty string when valid). */
  'update:error': [string];
}>();

const analytics = useAnalyticsStore();

const ruleOptions = [
  { label: 'Any amount', value: 'any' },
  { label: 'Specific amounts', value: 'specific' },
];

/** Current mode: 'any' shows no row list; 'specific' shows the token/amount builder. */
const ruleMode = ref<'any' | 'specific'>(props.modelValue.length > 0 ? 'specific' : 'any');

/** Builds initial rows from the incoming modelValue so the editor pre-fills when editing. */
const buildInitialRows = (): RuleRow[] =>
  props.modelValue.map((ta) => ({
    token: ta.token(),
    amount: ta.format(props.homeChain),
  }));

const rows = ref<RuleRow[]>(buildInitialRows());

/** Tokens available on the payable's home chain. */
const availableTokens = computed(() => tokens.filter((t) => !!t.details[props.homeChain.name]));

/** Parses one row: `{token, amount}` when valid, `'invalid'` for bad input, `null` when still incomplete. */
const parseRow = (row: RuleRow): { token: Token; amount: bigint } | 'invalid' | null => {
  if (!row.token || !row.amount.trim()) return null;
  try {
    const decimals = row.token.details[props.homeChain.name]?.decimals ?? 0;
    const amount = parseTokenAmount(row.amount, decimals);
    return amount > 0n ? { token: row.token, amount } : 'invalid';
  } catch {
    return 'invalid';
  }
};

/** Validation error for the current rule set. Empty string means valid. */
const configError = computed((): string => {
  if (ruleMode.value === 'any') return '';
  if (rows.value.length === 0) return 'Add at least one token and amount, or switch to "Any token, any amount".';

  const parsed: { token: Token; amount: bigint }[] = [];
  for (const row of rows.value) {
    const result = parseRow(row);
    if (result === null) return 'Choose a token and enter an amount for every row.';
    if (result === 'invalid') return 'Enter a positive amount for every row.';
    parsed.push(result);
  }
  const keys = parsed.map((p) => `${p.token.name}:${p.amount}`);
  if (new Set(keys).size !== keys.length) return 'Remove duplicate token and amount pairs.';
  return '';
});

/** The validated parsed list to emit upward. Empty while mode is 'any' or while there are errors. */
const parsedValue = computed<TokenAndAmount[]>(() => {
  if (ruleMode.value === 'any' || configError.value) return [];
  return rows.value.map((row) => TokenAndAmount.parse(row.token!, row.amount, props.homeChain));
});

/** Adds an empty row and scrolls to it so the host can fill it in. */
const addRow = () => {
  rows.value.push({ token: null, amount: '' });
  analytics.recordEvent('payable_rules_editor_add_row');
};

/** Removes the row at `index`. */
const removeRow = (index: number) => {
  rows.value.splice(index, 1);
  analytics.recordEvent('payable_rules_editor_remove_row');
};

// Emit upward whenever parsed value or validation error changes.
watch(parsedValue, (val) => emit('update:modelValue', val), { immediate: true });
watch(configError, (err) => emit('update:error', err), { immediate: true });

watch(ruleMode, (mode) => {
  if (mode === 'any') emit('update:modelValue', []);
  if (mode === 'specific' && rows.value.length === 0) addRow();
});
</script>

<template>
  <div>
    <SegmentedTabs v-model="ruleMode" :options="ruleOptions" />

    <div v-if="ruleMode === 'specific'" class="mt-4 flex flex-col gap-2">
      <div v-for="(row, i) in rows" :key="i" class="flex items-center gap-2">
        <Select
          v-model="row.token"
          :options="availableTokens"
          optionLabel="name"
          placeholder="Token"
          class="w-32 shrink-0"
          aria-label="Token"
        />
        <input
          v-model="row.amount"
          type="number"
          min="0"
          step="any"
          placeholder="Amount"
          :aria-label="`Amount for row ${i + 1}`"
          class="w-full rounded-xl border border-glass-border bg-glass-tint px-3 py-2 text-sm text-fg outline-none focus:border-accent"
        />
        <button
          type="button"
          class="shrink-0 p-1.5 rounded-full text-muted hover:text-danger hover:bg-danger/10"
          :aria-label="`Remove option ${i + 1}`"
          title="Remove option"
          @click="removeRow(i)"
        >
          <IconClose class="w-4 h-4" />
        </button>
      </div>

      <button type="button" class="self-start text-sm text-accent hover:underline mt-1" @click="addRow">
        + Add option
      </button>

      <p v-if="configError" class="text-xs text-danger mt-1">{{ configError }}</p>
    </div>

    <p v-else class="mt-3 text-xs text-muted">Payers can pay any supported token, in any amount.</p>
  </div>
</template>
