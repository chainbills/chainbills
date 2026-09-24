<script setup lang="ts">
/**
 * src/components/scan/ScanSearch.vue
 *
 * A search input paired with a results popover for the Scan explorer. Debounces
 * the input by 300 ms, cancels stale in-flight probes via `AbortController`,
 * and delegates all resolution logic to `useScanStore().search`.
 *
 * When the store returns an `entity` result with multiple matches, this
 * component renders a glass-card popover listing each match (type pill,
 * `ChainBadge`, navigation link). A single-match entity result is emitted
 * immediately as a `result` event so the parent can navigate without showing
 * a popover.
 *
 * Props:
 *  - `modelValue`: the current search string (controlled).
 *  - `networkType`: which network to probe first passed to `scan.search`.
 *
 * Emits:
 *  - `update:modelValue`: on every keystroke.
 *  - `result`: whenever a `SearchResult` is resolved (parent handles routing).
 *
 * Usage:
 * ```vue
 * <ScanSearch v-model="q" :network-type="network" @result="handleResult" />
 * ```
 */
import { ChainBadge, GlassCard, SearchInput, StatusPill } from '@/components/ui';
import { chainNamesToChains } from '@/schemas';
import { useScanStore, type SearchResult } from '@/stores/scan';
import { ref, watch } from 'vue';
import type { ChainNetworkType } from '@/schemas';

const props = defineProps<{
  /** Current search string (v-model). */
  modelValue: string;
  /** The primary network to probe when resolving a 32-byte id. */
  networkType: ChainNetworkType;
}>();

const emit = defineEmits<{
  /** Fires on every keystroke with the new query string. */
  'update:modelValue': [value: string];
  /** Fires when the store resolves a `SearchResult`. The parent routes based on kind. */
  result: [result: SearchResult];
}>();

const scan = useScanStore();

/** The last resolved result, used to drive the popover. */
const lastResult = ref<SearchResult | null>(null);
/** True while a search probe is in flight. */
const searching = ref(false);
/** True when the popover is visible (entity multi-match results). */
const showPopover = ref(false);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentController: AbortController | null = null;

/** Human-readable label for each entity match type. */
const typeLabels: Record<string, string> = {
  payable: 'Payable',
  userPayment: 'Payment (made)',
  payablePayment: 'Payment (received)',
  withdrawal: 'Withdrawal',
  activity: 'Activity',
};

/** The route path for an entity match link. */
const entityPath = (match: { type: string; id: string }): string => {
  if (match.type === 'userPayment' || match.type === 'payablePayment') return `/receipt/${match.id}`;
  if (match.type === 'payable') return `/payable/${match.id}`;
  return `/scan?q=${match.id}`;
};

/** Runs whenever the model value changes (after a 300 ms debounce). */
watch(
  () => props.modelValue,
  (q) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!q.trim()) {
      lastResult.value = null;
      showPopover.value = false;
      searching.value = false;
      return;
    }
    debounceTimer = setTimeout(() => runSearch(q), 300);
  }
);

const runSearch = async (q: string) => {
  // Cancel any in-flight probe from the previous keystroke.
  currentController?.abort();
  currentController = new AbortController();
  searching.value = true;
  showPopover.value = false;
  lastResult.value = null;

  try {
    const result = await scan.search(q, props.networkType, currentController.signal);
    if (currentController.signal.aborted) return;

    lastResult.value = result;

    if (result.kind === 'entity' && result.matches.length > 1) {
      showPopover.value = true;
    } else {
      // Let the parent handle navigation / filter updates for all other kinds.
      emit('result', result);
    }
  } finally {
    searching.value = false;
  }
};

const closePopover = () => { showPopover.value = false; };
</script>

<template>
  <div class="relative">
    <!-- Search input -->
    <SearchInput
      :modelValue="modelValue"
      placeholder="Search by address, payable id, payment id..."
      @update:modelValue="emit('update:modelValue', $event)"
    />

    <!-- Multi-match popover -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 -translate-y-1"
    >
      <div
        v-if="showPopover && lastResult?.kind === 'entity'"
        class="absolute top-full mt-2 left-0 right-0 z-50"
      >
        <GlassCard>
          <div class="py-1">
            <p class="px-4 py-2 text-xs uppercase tracking-[0.12em] text-muted">
              {{ lastResult.matches.length }} matches found
            </p>
            <RouterLink
              v-for="match in lastResult.matches"
              :key="`${match.chainName}-${match.type}-${match.id}`"
              :to="entityPath(match)"
              @click="closePopover"
              class="flex items-center gap-3 px-4 py-2.5 hover:bg-fg/5 transition-colors"
            >
              <StatusPill
                :label="typeLabels[match.type] ?? match.type"
                tone="accent"
              />
              <ChainBadge :chain="chainNamesToChains[match.chainName]" />
              <span class="font-mono text-[11px] text-muted truncate flex-1">
                {{ match.id.slice(0, 18) }}...
              </span>
            </RouterLink>
          </div>
        </GlassCard>
      </div>
    </Transition>

    <!-- No-match message -->
    <p
      v-if="lastResult?.kind === 'text-filter' && lastResult.message && !searching"
      class="mt-2 text-xs text-muted"
    >
      {{ lastResult.message }}
    </p>
  </div>
</template>
