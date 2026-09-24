<script setup lang="ts">
/**
 * src/components/activity/ActivityFeed.vue — the smart container behind
 * every activity feed in the app: the user activity page, the payable page
 * and Scan all render one `ActivityFeed`, pointed at
 * a different `source`, instead of hand-rolling their own fetch/filter/
 * paginate logic.
 *
 * Data flows through `useActivityStore`:
 *  - a `'payable'`, `'chain'` or single-chain `'user'` source is a single
 *    on-chain stream, paged with ordinary numbered pagination
 *    (`getForPayable`/`getForChain`/`getForUser`);
 *  - a `'network'` source, or a `'user'` source with no `chain`, merges
 *    every EVM chain of a network into one newest-first stream
 *    (`getForNetwork`/`getForUserAcrossChains`), paged with cursor-based
 *    "Load more" since there is no single global offset to page by.
 *
 * Category tabs and type/token/chain filter chips narrow whatever window is
 * currently loaded. Because on-chain data has no server-side filter, a
 * filtered single-chain page is built with `useActivityStore().loadUntil`,
 * which keeps loading raw pages until enough matching items exist (or the
 * stream is exhausted) rather than ever showing a short page while more
 * data is available. A filtered merged stream does the equivalent inline,
 * fetching more "Load more" batches until enough of the accumulated window
 * matches.
 *
 * Renders `ActivityTable` on desktop and `ActivityList` on mobile (both
 * always mounted; only the CSS display toggles at the `md` breakpoint), with
 * `Skeleton`/`EmptyState`/`ErrorState` covering the loading/empty/error
 * states every async region needs.
 *
 * Props:
 *  - `source`: which feed to show — see `ActivitySource` below.
 *  - `tabs`: which category tabs to offer (default all four; a payable
 *    source always additionally gets a `Settings` tab for close/reopen/
 *    update-type activities).
 *  - `columns`: forwarded to `ActivityTable`.
 *  - `pageSize`: items per page/batch (default 20).
 *  - `persistKey`: when set, the active tab and page/scroll position are
 *    remembered in `localStorage` under this key, so navigating away and
 *    back (or a reload) restores where the user left off.
 *  - `searchable`/`filterable`: show the search box / filter chip row.
 *
 * Events:
 *  - `select`: a row was expanded (table) or its bottom sheet opened (list).
 *  - `loaded`: fires after every successful fetch, with the feed's best-known total.
 *
 * Usage:
 * ```vue
 * <ActivityFeed :source="{ kind: 'payable', payable }" searchable filterable persist-key="payable-activity" />
 * <ActivityFeed :source="{ kind: 'user', address, networkType: 'testnet' }" searchable filterable />
 * <ActivityFeed :source="{ kind: 'chain', chain: sepolia }" :tabs="['all', 'payments']" />
 * <ActivityFeed :source="{ kind: 'network', networkType: 'mainnet' }" filterable />
 * ```
 */
import ActivityList from './ActivityList.vue';
import ActivityTable, { type ActivityTableColumn } from './ActivityTable.vue';
import {
  EmptyState,
  ErrorState,
  FilterChips,
  SearchInput,
  SegmentedTabs,
  Skeleton,
  type FilterChipOption,
  type SegmentedTabOption,
} from '@/components/ui';
import {
  Activity,
  activityTypeMeta,
  ActivityType,
  chainNamesEvm,
  chainNamesToChains,
  Payable,
  type Chain,
  type ChainNetworkType,
} from '@/schemas';
import { useActivityStore, useAnalyticsStore, useEvmStore, type MultiChainCursor } from '@/stores';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

/** Which feed to render. A `'user'` source with no `chain` merges every EVM chain of `networkType` into one stream. */
export type ActivitySource =
  | { kind: 'payable'; payable: Payable }
  | { kind: 'user'; address: string; networkType: ChainNetworkType; chain?: Chain }
  | { kind: 'chain'; chain: Chain }
  | { kind: 'network'; networkType: ChainNetworkType };

type TabKey = 'all' | 'payments' | 'withdrawals' | 'payables' | 'settings';

/** Static tab definitions: which activity category (or, for `settings`, exact types) each tab shows. `all` has no filter. */
const TAB_DEFS: Record<
  TabKey,
  { label: string; category?: 'payments' | 'withdrawals' | 'payables'; types?: ActivityType[] }
> = {
  all: { label: 'All' },
  payments: { label: 'Payments', category: 'payments' },
  withdrawals: { label: 'Withdrawals', category: 'withdrawals' },
  payables: { label: 'Payables', category: 'payables' },
  settings: {
    label: 'Settings',
    types: [
      ActivityType.ClosedPayable,
      ActivityType.ReopenedPayable,
      ActivityType.UpdatedPayableAllowedTokensAndAmounts,
      ActivityType.UpdatedPayableAutoWithdrawStatus,
    ],
  },
};

const props = withDefaults(
  defineProps<{
    source: ActivitySource;
    tabs?: TabKey[];
    columns?: ActivityTableColumn[];
    pageSize?: number;
    persistKey?: string;
    searchable?: boolean;
    filterable?: boolean;
  }>(),
  { tabs: () => ['all', 'payments', 'withdrawals', 'payables'], pageSize: 20, searchable: false, filterable: false }
);

const emit = defineEmits<{
  select: [activity: Activity];
  loaded: [payload: { total: number }];
}>();

const activityStore = useActivityStore();
const evm = useEvmStore();
const analytics = useAnalyticsStore();

// ---------------------------------------------------------------------------
// Source classification
// ---------------------------------------------------------------------------

/** A `'network'` source, or a `'user'` source with no fixed `chain`, streams from every EVM chain of the network at once and pages with a cursor instead of a page number. */
const isMerged = computed(
  () => props.source.kind === 'network' || (props.source.kind === 'user' && !props.source.chain)
);

/** The `Activity` counter (`chainCount`/`userCount`/`payableCount`) that best identifies "row N" for this source, forwarded to `ActivityTable`'s `#` column. */
const countField = computed<'chainCount' | 'userCount' | 'payableCount'>(() => {
  if (props.source.kind === 'payable') return 'payableCount';
  if (props.source.kind === 'user') return 'userCount';
  return 'chainCount';
});

/** Every tab to offer: the `tabs` prop, plus a `Settings` tab automatically for a payable source. */
const availableTabs = computed<TabKey[]>(() => {
  const base = [...props.tabs];
  if (props.source.kind === 'payable' && !base.includes('settings')) base.push('settings');
  return base;
});

// ---------------------------------------------------------------------------
// Filter/tab/search state
// ---------------------------------------------------------------------------

const activeTab = ref<TabKey>('all');
const activeTypeFilters = ref<string[]>([]);
const activeTokenFilter = ref<string[]>([]);
const activeChainFilter = ref<string[]>([]);
const searchQuery = ref('');
const showFilters = ref(false);

const hasActiveFilter = computed(
  () =>
    activeTab.value !== 'all' ||
    activeTypeFilters.value.length > 0 ||
    activeTokenFilter.value.length > 0 ||
    activeChainFilter.value.length > 0
);

const activeFilterCount = computed(
  () => activeTypeFilters.value.length + activeTokenFilter.value.length + activeChainFilter.value.length
);

/** True when `a` belongs under the active tab/type/token/chain filters (search is applied separately, on top of this). */
const matchesFilters = (a: Activity): boolean => {
  if (props.source.kind === 'user' && a.type === ActivityType.InitializedUser) return false;
  const def = TAB_DEFS[activeTab.value];
  if (def.category && a.meta.category !== def.category) return false;
  if (def.types && !def.types.includes(a.type)) return false;
  if (activeTypeFilters.value.length && !activeTypeFilters.value.includes(String(a.type))) return false;
  if (activeTokenFilter.value.length && !(a.amount && activeTokenFilter.value.includes(a.amount.name))) return false;
  if (isMerged.value && activeChainFilter.value.length && !activeChainFilter.value.includes(a.chain.name)) return false;
  return true;
};

const matchesSearch = (a: Activity): boolean => {
  if (!searchQuery.value.trim()) return true;
  const q = searchQuery.value.trim().toLowerCase();
  return [a.id, a.actor, a.payableId].some((v) => v?.toLowerCase().includes(q));
};

// ---------------------------------------------------------------------------
// Single-chain (numbered) pagination
// ---------------------------------------------------------------------------

const page = ref(0);
const singleItems = ref<Activity[]>([]);
const singleTotal = ref(0);
const singleHasNext = ref(false);

const loadRawPage = (rawPage: number) => {
  const source = props.source;
  if (source.kind === 'payable')
    return activityStore.getForPayable(source.payable, { page: rawPage, size: props.pageSize });
  if (source.kind === 'chain') return activityStore.getForChain(source.chain, { page: rawPage, size: props.pageSize });
  if (source.kind === 'user' && source.chain)
    return activityStore.getForUser(source.address, source.chain, { page: rawPage, size: props.pageSize });
  throw new Error('loadRawPage is only for single-chain sources');
};

const fetchSingleChainPage = async (uiPage: number) => {
  if (!hasActiveFilter.value) {
    const result = await loadRawPage(uiPage);
    singleItems.value = result.items;
    singleTotal.value = result.total;
    singleHasNext.value = (uiPage + 1) * props.pageSize < result.total;
    return;
  }

  const minCount = (uiPage + 1) * props.pageSize;
  const { items: window, exhausted } = await activityStore.loadUntil(
    loadRawPage,
    props.pageSize,
    matchesFilters,
    minCount
  );
  const filtered = window.filter(matchesFilters);
  singleItems.value = filtered.slice(uiPage * props.pageSize, (uiPage + 1) * props.pageSize);
  singleTotal.value = filtered.length;
  singleHasNext.value =
    filtered.length > (uiPage + 1) * props.pageSize || (!exhausted && singleItems.value.length === props.pageSize);
};

// ---------------------------------------------------------------------------
// Merged (cursor-based "Load more") streaming
// ---------------------------------------------------------------------------

const mergedRaw = ref<Activity[]>([]);
const mergedCursor = ref<MultiChainCursor | undefined>(undefined);
const mergedHasMore = ref(true);
const mergedTotal = ref<number | null>(null);
const loadingMore = ref(false);

const mergedFiltered = computed(() => mergedRaw.value.filter(matchesFilters));

/** Fetches one more merge batch and appends it to `mergedRaw`. */
const fetchMergedBatch = async () => {
  const source = props.source;
  const result =
    source.kind === 'network'
      ? await activityStore.getForNetwork(source.networkType, mergedCursor.value, props.pageSize)
      : source.kind === 'user' && !source.chain
        ? await activityStore.getForUserAcrossChains(
            source.address,
            source.networkType,
            mergedCursor.value,
            props.pageSize
          )
        : null;
  if (!result) throw new Error('fetchMergedBatch is only for merged sources');
  mergedRaw.value = [...mergedRaw.value, ...result.items];
  mergedCursor.value = result.cursor;
  mergedHasMore.value = result.hasMore;
};

/** Fetches batches until at least `targetCount` filtered items are loaded, or the stream is exhausted. */
const fillMergedTo = async (targetCount: number) => {
  while (mergedFiltered.value.length < targetCount && mergedHasMore.value) {
    await fetchMergedBatch();
  }
};

/** Sums `getUser(...).activitiesCount`/`getChainStats().activitiesCount` across the network's chains — a cheap, independent total for the "Showing X of Y" line, since the merge cursor itself does not track one. */
const fetchMergedTotal = async () => {
  const source = props.source;
  if (source.kind !== 'network' && source.kind !== 'user') return;
  const chains = chainNamesEvm.filter((n) => chainNamesToChains[n].networkType === source.networkType);
  const counts = await Promise.all(
    chains.map(async (n) => {
      if (source.kind === 'network') {
        const stats = await evm.getChainStatsOnChain(n);
        return stats ? Number(stats.activitiesCount) : 0;
      }
      const user = await evm.fetchUserOnChain(source.address, n);
      return user ? Number(user.activitiesCount) : 0;
    })
  );
  mergedTotal.value = counts.reduce((a, b) => a + b, 0);
};

const loadMore = async () => {
  loadingMore.value = true;
  try {
    await fillMergedTo(mergedFiltered.value.length + props.pageSize);
    analytics.recordEvent('loaded_more_activity', { source: props.source.kind });
  } finally {
    loadingMore.value = false;
  }
};

// ---------------------------------------------------------------------------
// Orchestration: loading/error state, (re)fetch on source/tab/filter change
// ---------------------------------------------------------------------------

const loading = ref(true);
const refreshing = ref(false);
const failed = ref(false);

/** Fetches whatever `page`/the merged accumulator is currently pointed at, without resetting position — the shared body of the initial load and the manual refresh button. */
const fetchCurrent = async (mergedTargetCount: number) => {
  if (isMerged.value) {
    await Promise.all([fillMergedTo(mergedTargetCount), fetchMergedTotal()]);
  } else {
    await fetchSingleChainPage(page.value);
  }
  emit('loaded', { total: displayTotal.value });
};

/** Resets to the first page/batch and fetches it — used on mount, whenever the tab/filters change, and by the error state's retry. */
const load = async () => {
  loading.value = true;
  page.value = 0;
  if (isMerged.value) {
    mergedRaw.value = [];
    mergedCursor.value = undefined;
    mergedHasMore.value = true;
  }
  try {
    await fetchCurrent(props.pageSize);
    failed.value = false;
  } catch {
    failed.value = true;
  }
  loading.value = false;
};

const goToPage = async (uiPage: number) => {
  page.value = uiPage;
  loading.value = true;
  try {
    await fetchSingleChainPage(uiPage);
    failed.value = false;
    emit('loaded', { total: displayTotal.value });
    if (props.persistKey) localStorage.setItem(`chainbills::activity::${props.persistKey}::page`, `${uiPage}`);
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
};

/** Re-fetches whatever is currently on screen (same page / same amount of merged history) without resetting scroll position — unlike `load`, which always jumps back to the first page. */
const refresh = async () => {
  refreshing.value = true;
  try {
    await fetchCurrent(Math.max(mergedRaw.value.length, props.pageSize));
    failed.value = false;
  } catch {
    failed.value = true;
  }
  refreshing.value = false;
  analytics.recordEvent('refreshed_activity_feed', { source: props.source.kind });
};

watch([activeTab, activeTypeFilters, activeTokenFilter, activeChainFilter], () => {
  load();
});

onMounted(async () => {
  if (props.persistKey) {
    const savedTab = localStorage.getItem(`chainbills::activity::${props.persistKey}::tab`);
    if (savedTab && (savedTab as TabKey) in TAB_DEFS) activeTab.value = savedTab as TabKey;
    const savedPage = Number(localStorage.getItem(`chainbills::activity::${props.persistKey}::page`) ?? '0');
    if (Number.isInteger(savedPage) && savedPage > 0) page.value = savedPage;
  }

  loading.value = true;
  try {
    await fetchCurrent(props.pageSize);
    failed.value = false;
  } catch {
    failed.value = true;
  }
  loading.value = false;

  window.addEventListener('focus', onWindowFocus);
});
onUnmounted(() => window.removeEventListener('focus', onWindowFocus));

watch(activeTab, (v) => {
  if (props.persistKey) {
    localStorage.setItem(`chainbills::activity::${props.persistKey}::tab`, v);
    localStorage.setItem(`chainbills::activity::${props.persistKey}::page`, '0');
  }
  analytics.recordEvent('changed_activity_tab', { tab: v, source: props.source.kind });
});

// ---------------------------------------------------------------------------
// Live refresh on window focus: silently re-check the total; if it grew and
// the user is on the newest page/first batch, refresh and highlight the
// items that weren't there before.
// ---------------------------------------------------------------------------

const highlightedIds = ref<Set<string>>(new Set());

const onWindowFocus = async () => {
  if (isMerged.value) {
    if (mergedRaw.value.length > props.pageSize) return; // user has scrolled past the first "Load more" batch
    const before = new Set(mergedRaw.value.map((a) => a.id));
    const previousTotal = mergedTotal.value;
    mergedRaw.value = [];
    mergedCursor.value = undefined;
    mergedHasMore.value = true;
    await Promise.all([fillMergedTo(props.pageSize), fetchMergedTotal()]);
    if (previousTotal !== null && (mergedTotal.value ?? 0) > previousTotal) {
      highlight(mergedRaw.value.filter((a) => !before.has(a.id)).map((a) => a.id));
    }
    return;
  }

  if (page.value !== 0) return; // only the newest page auto-refreshes
  const before = new Set(singleItems.value.map((a) => a.id));
  const previousTotal = singleTotal.value;
  await fetchSingleChainPage(0);
  if (singleTotal.value > previousTotal) {
    highlight(singleItems.value.filter((a) => !before.has(a.id)).map((a) => a.id));
  }
};

const highlight = (ids: string[]) => {
  if (!ids.length) return;
  highlightedIds.value = new Set(ids);
  setTimeout(() => (highlightedIds.value = new Set()), 2500);
};

// ---------------------------------------------------------------------------
// Display data
// ---------------------------------------------------------------------------

const rawWindow = computed(() => (isMerged.value ? mergedFiltered.value : singleItems.value));
const displayItems = computed(() => rawWindow.value.filter(matchesSearch));
const displayTotal = computed(() =>
  isMerged.value ? (mergedTotal.value ?? mergedFiltered.value.length) : singleTotal.value
);

// ---------------------------------------------------------------------------
// Toolbar option lists
// ---------------------------------------------------------------------------

const tabOptions = computed<SegmentedTabOption[]>(() =>
  availableTabs.value.map((key) => ({ label: TAB_DEFS[key].label, value: key }))
);

/** Every `ActivityType`, as a numeric array — `activityTypeMeta` is indexed by the enum's numeric value. */
const allActivityTypes = Object.keys(activityTypeMeta).map(Number) as ActivityType[];

const typeChipOptions = computed<FilterChipOption[]>(() => {
  const def = TAB_DEFS[activeTab.value];
  const types =
    def.types ?? allActivityTypes.filter((t) => !def.category || activityTypeMeta[t].category === def.category);
  return types.map((t) => ({ label: activityTypeMeta[t].label, value: String(t) }));
});

const showTokenChips = computed(() => ['all', 'payments', 'withdrawals'].includes(activeTab.value));
const tokenChipOptions = computed<FilterChipOption[]>(() => {
  const names = new Set<string>();
  for (const a of rawWindow.value) if (a.amount) names.add(a.amount.name);
  return [...names].sort().map((name) => ({ label: name, value: name }));
});

const chainChipOptions = computed<FilterChipOption[]>(() => {
  const names = new Map<string, string>();
  for (const a of mergedRaw.value) names.set(a.chain.name, a.chain.displayName);
  return [...names.entries()].map(([value, label]) => ({ label, value }));
});

const emptyCopy = computed(() => {
  const source = props.source;
  switch (source.kind) {
    case 'payable':
      return {
        title: 'No activity yet',
        description: 'Payments, withdrawals and settings changes for this payable will show up here.',
      };
    case 'user':
      return {
        title: 'No activity yet',
        description: 'Payments, payables and withdrawals for this wallet will show up here.',
      };
    case 'chain':
      return { title: 'No activity yet', description: `Nothing has happened on ${source.chain.displayName} yet.` };
    case 'network':
      return { title: 'No activity yet', description: 'Nothing has happened on this network yet.' };
    default:
      return { title: 'No activity yet', description: '' };
  }
});
</script>

<template>
  <div>
    <div class="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
      <SegmentedTabs v-model="activeTab" :options="tabOptions" />
      <div v-if="filterable || searchable" class="flex flex-wrap items-center gap-2">
        <SearchInput
          v-if="searchable"
          v-model="searchQuery"
          placeholder="Search by id, address or payable"
          class="max-w-xs"
        />
        <button
          v-if="filterable"
          type="button"
          :aria-pressed="showFilters"
          @click="showFilters = !showFilters"
          :class="[
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            showFilters || activeFilterCount > 0
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-glass-border bg-glass-tint text-muted hover:text-fg',
          ]"
        >
          <svg viewBox="0 0 24 24" fill="none" class="w-3.5 h-3.5" aria-hidden="true">
            <path d="M3 6h18M7 12h10M11 18h2" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          Filters
          <span v-if="activeFilterCount > 0" class="rounded-full bg-accent text-accent-fg px-1.5 py-0.5 text-[10px] font-semibold leading-none">
            {{ activeFilterCount }}
          </span>
        </button>
        <button
          type="button"
          :disabled="refreshing"
          :aria-label="refreshing ? 'Refreshing' : 'Refresh'"
          title="Refresh"
          class="rounded-full border border-glass-border bg-glass-tint backdrop-blur p-2 text-muted hover:text-fg disabled:opacity-60"
          @click="refresh"
        >
          <svg viewBox="0 0 24 24" fill="none" class="w-4 h-4" :class="refreshing && 'animate-spin'" aria-hidden="true">
            <path
              d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="filterable && showFilters" class="flex flex-col gap-2 mb-4 p-3 rounded-2xl bg-fg/[0.03] border border-glass-border">
      <FilterChips v-if="typeChipOptions.length > 1" v-model="activeTypeFilters" multi :options="typeChipOptions" />
      <FilterChips
        v-if="showTokenChips && tokenChipOptions.length > 1"
        v-model="activeTokenFilter"
        multi
        :options="tokenChipOptions"
      />
      <FilterChips
        v-if="isMerged && chainChipOptions.length > 1"
        v-model="activeChainFilter"
        multi
        :options="chainChipOptions"
      />
      <button
        v-if="activeFilterCount > 0"
        type="button"
        class="self-start text-xs text-muted hover:text-fg mt-1"
        @click="activeTypeFilters = []; activeTokenFilter = []; activeChainFilter = []"
      >
        Clear all filters
      </button>
    </div>

    <p v-if="!loading && !failed" class="text-xs text-muted mb-2">
      Showing {{ displayItems.length }} of {{ displayTotal }}
    </p>

    <template v-if="loading">
      <div class="space-y-2">
        <Skeleton v-for="n in 6" :key="n" h="h-14" rounded="rounded-2xl" />
      </div>
    </template>

    <template v-else-if="failed">
      <ErrorState message="Couldn't load this activity feed from the chain." @retry="load" />
    </template>

    <template v-else-if="displayItems.length === 0">
      <EmptyState :title="emptyCopy.title" :description="emptyCopy.description" />
    </template>

    <template v-else>
      <div class="hidden md:block">
        <ActivityTable
          :activities="displayItems"
          :columns="columns"
          :count-field="countField"
          :highlight-ids="highlightedIds"
          @select="(a) => emit('select', a)"
        />
      </div>
      <div class="md:hidden">
        <ActivityList :activities="displayItems" :highlight-ids="highlightedIds" @select="(a) => emit('select', a)" />
      </div>

      <div v-if="!isMerged" class="flex items-center justify-between mt-4 text-sm">
        <button
          type="button"
          class="rounded-full border border-glass-border bg-glass-tint backdrop-blur px-3.5 py-1.5 disabled:opacity-40"
          :disabled="page === 0"
          @click="goToPage(page - 1)"
        >
          Previous
        </button>
        <span class="text-muted text-xs">Page {{ page + 1 }}</span>
        <button
          type="button"
          class="rounded-full border border-glass-border bg-glass-tint backdrop-blur px-3.5 py-1.5 disabled:opacity-40"
          :disabled="!singleHasNext"
          @click="goToPage(page + 1)"
        >
          Next
        </button>
      </div>

      <div v-else-if="mergedHasMore" class="flex justify-center mt-4">
        <button
          type="button"
          class="rounded-full border border-glass-border bg-glass-tint backdrop-blur px-4 py-2 text-sm disabled:opacity-60"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? 'Loading...' : 'Load more' }}
        </button>
      </div>
    </template>
  </div>
</template>
