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
import {
  EmptyState,
  ErrorState,
  SearchInput,
  SegmentedTabs,
  Skeleton,
  type FilterChipOption,
  type SegmentedTabOption,
} from '@/components/ui';
import {
  Activity,
  ActivityType,
  activityTypeMeta,
  chainNamesEvm,
  chainNamesToChains,
  getChainLogo,
  Payable,
  type Chain,
  type ChainNetworkType,
} from '@/schemas';
import { useActivityStore, useAnalyticsStore, useEvmStore, usePaginatorsStore, type MultiChainCursor } from '@/stores';
import Paginator from 'primevue/paginator';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import ActivityList from './ActivityList.vue';
import ActivityTable, { type ActivityTableColumn } from './ActivityTable.vue';

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
  { tabs: () => ['all', 'payables', 'payments', 'withdrawals'], pageSize: 20, searchable: false, filterable: false }
);

const emit = defineEmits<{
  select: [activity: Activity];
  loaded: [payload: { total: number }];
  /** Fires whenever the chain filter changes — lets a parent sync stats to the selected chain. */
  'update:chainFilter': [value: string];
}>();

const activityStore = useActivityStore();
const evm = useEvmStore();
const analytics = useAnalyticsStore();
const paginators = usePaginatorsStore();

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

const sourceNetworkType = computed<ChainNetworkType | null>(() => {
  if (!isMerged.value) return null;
  const src = props.source;
  if (src.kind === 'network') return src.networkType;
  if (src.kind === 'user') return src.networkType;
  return null;
});

const networkChains = computed<Chain[]>(() => {
  if (!sourceNetworkType.value) return [];
  return chainNamesEvm.map((n) => chainNamesToChains[n]).filter((c) => c.networkType === sourceNetworkType.value);
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
const singleChainFilter = ref<string>('all');
const searchQuery = ref('');
const showFilters = ref(false);

// Chain filter popover — teleported to body so it escapes any overflow-x-auto ancestor
const chainFilterOpen = ref(false);
const chainFilterEl = ref<HTMLElement | null>(null);
const chainFilterDropdownEl = ref<HTMLElement | null>(null);
const chainDropdownStyle = ref({ top: '0px', left: '0px' });

const openChainFilter = () => {
  if (!chainFilterOpen.value) {
    const btn = chainFilterEl.value?.querySelector('button');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      chainDropdownStyle.value = {
        top: `${rect.bottom + 8}px`,
        left: `${rect.left}px`,
      };
    }
  }
  chainFilterOpen.value = !chainFilterOpen.value;
};

const closeChainFilter = (e: MouseEvent) => {
  if (!chainFilterOpen.value) return;
  const target = e.target as Node;
  const inButton = chainFilterEl.value?.contains(target) ?? false;
  const inDropdown = chainFilterDropdownEl.value?.contains(target) ?? false;
  if (!inButton && !inDropdown) chainFilterOpen.value = false;
};

// Filters popover
const filtersEl = ref<HTMLElement | null>(null);

const closeFiltersPopover = (e: MouseEvent) => {
  if (showFilters.value && filtersEl.value && !filtersEl.value.contains(e.target as Node)) {
    showFilters.value = false;
  }
};

const toggleTypeFilter = (value: string) => {
  activeTypeFilters.value = activeTypeFilters.value.includes(value)
    ? activeTypeFilters.value.filter((v) => v !== value)
    : [...activeTypeFilters.value, value];
};

const toggleTokenFilter = (value: string) => {
  activeTokenFilter.value = activeTokenFilter.value.includes(value)
    ? activeTokenFilter.value.filter((v) => v !== value)
    : [...activeTokenFilter.value, value];
};

const activeChainOption = computed(() => {
  if (singleChainFilter.value === 'all') return null;
  return networkChains.value.find((c) => c.name === singleChainFilter.value) ?? null;
});

const selectChain = (value: string) => {
  singleChainFilter.value = value;
  chainFilterOpen.value = false;
};

// Expand/collapse all rows
const expandAllRows = ref(false);

const hasActiveFilter = computed(
  () =>
    activeTab.value !== 'all' ||
    activeTypeFilters.value.length > 0 ||
    activeTokenFilter.value.length > 0 ||
    (isMerged.value && singleChainFilter.value !== 'all')
);

/** True when any filter or search is active — used to distinguish "no matching results" from "truly empty feed". */
const hasAnyFilterOrSearch = computed(() => hasActiveFilter.value || !!searchQuery.value.trim());

const activeFilterCount = computed(() => activeTypeFilters.value.length + activeTokenFilter.value.length);

/** True when `a` belongs under the active tab/type/token/chain filters (search is applied separately, on top of this). */
const matchesFilters = (a: Activity): boolean => {
  if (props.source.kind === 'user' && a.type === ActivityType.InitializedUser) return false;
  const def = TAB_DEFS[activeTab.value];
  if (def.category && a.meta.category !== def.category) return false;
  if (def.types && !def.types.includes(a.type)) return false;
  if (activeTypeFilters.value.length && !activeTypeFilters.value.includes(String(a.type))) return false;
  if (activeTokenFilter.value.length && !(a.amount && activeTokenFilter.value.includes(a.amount.name))) return false;
  if (isMerged.value && singleChainFilter.value !== 'all' && a.chain.name !== singleChainFilter.value) return false;
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

const goToMergedPage = async (uiPage: number) => {
  mergedPage.value = uiPage;
  const needed = (uiPage + 1) * paginators.rowsPerPage;
  if (mergedFiltered.value.length < needed && mergedHasMore.value) {
    loadingMore.value = true;
    try {
      await fillMergedTo(needed);
    } finally {
      loadingMore.value = false;
    }
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

/** Resets to the first page/batch and fetches it.
 *  Pass `alwaysSkeleton = true` when a user-initiated filter change should
 *  always show the shimmer skeleton rather than keeping stale rows visible. */
const load = async (alwaysSkeleton = false) => {
  const hasData = isMerged.value ? mergedRaw.value.length > 0 : singleItems.value.length > 0;
  if (hasData && !alwaysSkeleton) {
    refreshing.value = true;
  } else {
    loading.value = true;
  }
  page.value = 0;
  if (isMerged.value) {
    mergedRaw.value = [];
    mergedCursor.value = undefined;
    mergedHasMore.value = true;
    mergedPage.value = 0;
  }
  try {
    await fetchCurrent(props.pageSize);
    failed.value = false;
  } catch {
    failed.value = true;
  }
  loading.value = false;
  refreshing.value = false;
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

watch([activeTab, activeTypeFilters, activeTokenFilter, singleChainFilter], () => {
  load(true); // explicit filter change — always shimmer, never show stale rows
});

watch(singleChainFilter, (v) => {
  emit('update:chainFilter', v);
  analytics.recordEvent('changed_activity_chain_filter', { chain: v, source: props.source.kind });
});

watch(searchQuery, (q) => {
  if (q.length >= 3) {
    analytics.recordEvent('searched_activity_feed', { source: props.source.kind, query_length: q.length });
  }
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
  document.addEventListener('click', closeChainFilter);
  document.addEventListener('click', closeFiltersPopover);
});
onUnmounted(() => {
  window.removeEventListener('focus', onWindowFocus);
  document.removeEventListener('click', closeChainFilter);
  document.removeEventListener('click', closeFiltersPopover);
});

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
    if (mergedRaw.value.length > props.pageSize) return;
    const before = new Set(mergedRaw.value.map((a) => a.id));
    const previousTotal = mergedTotal.value;
    // Fetch a fresh first batch without clearing the displayed data, to avoid an empty-state flash
    const source = props.source;
    try {
      const result =
        source.kind === 'network'
          ? await activityStore.getForNetwork(source.networkType, undefined, props.pageSize)
          : source.kind === 'user' && !source.chain
            ? await activityStore.getForUserAcrossChains(source.address, source.networkType, undefined, props.pageSize)
            : null;
      if (result) {
        // Atomically replace: old items stay visible until the swap
        mergedRaw.value = result.items;
        mergedCursor.value = result.cursor;
        mergedHasMore.value = result.hasMore;
      }
    } catch {
      return;
    }
    await fetchMergedTotal();
    if (previousTotal !== null && (mergedTotal.value ?? 0) > previousTotal) {
      highlight(mergedRaw.value.filter((a) => !before.has(a.id)).map((a) => a.id));
    }
    return;
  }

  if (page.value !== 0) return;
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

// Current page index for the merged paginator
const mergedPage = ref(0);

// For merged: show only the current page slice; for single: show whatever page was fetched
const rawWindow = computed(() => {
  if (isMerged.value) {
    const rpp = paginators.rowsPerPage;
    return mergedFiltered.value.slice(mergedPage.value * rpp, (mergedPage.value + 1) * rpp);
  }
  return singleItems.value;
});
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

/** True when there is at least one filter section to show in the popover. */
const hasFilterOptions = computed(
  () => typeChipOptions.value.length > 1 || (showTokenChips.value && tokenChipOptions.value.length > 1)
);
const tokenChipOptions = computed<FilterChipOption[]>(() => {
  // Scan all loaded items, not just the current page, so filter chips stay stable during pagination
  const allLoaded = isMerged.value ? mergedFiltered.value : singleItems.value;
  const names = new Set<string>();
  for (const a of allLoaded) if (a.amount) names.add(a.amount.name);
  return [...names].sort().map((name) => ({ label: name, value: name }));
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
    <!-- Toolbar: tabs row + actions row — always stacked to prevent tablet cramping -->
    <div class="mb-6 gap-2 items-end flex flex-wrap">
      <!-- Row 1: chain filter + tabs (scrollable) -->
      <div class="flex items-center gap-2 overflow-x-auto">
        <!-- Decorated chain filter popover (only for merged/network sources) -->
        <div v-if="isMerged && networkChains.length > 1" ref="chainFilterEl" class="relative shrink-0">
          <button
            type="button"
            :aria-expanded="chainFilterOpen"
            aria-haspopup="listbox"
            @click="openChainFilter"
            :class="[
              'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              singleChainFilter !== 'all'
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-glass-border bg-glass-tint text-fg hover:border-fg/30',
            ]"
          >
            <img
              v-if="activeChainOption"
              :src="getChainLogo(activeChainOption)"
              :alt="activeChainOption.displayName"
              class="w-4 h-4 rounded-full"
            />
            <span>{{ activeChainOption ? activeChainOption.displayName : 'All chains' }}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              class="w-3.5 h-3.5 text-muted transition-transform"
              :class="chainFilterOpen && 'rotate-180'"
              aria-hidden="true"
            >
              <path
                d="m6 9 6 6 6-6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <Teleport to="body">
          <div
            v-if="chainFilterOpen"
            ref="chainFilterDropdownEl"
            role="listbox"
            aria-label="Select chain"
            class="fixed z-50 w-52 glass-popover rounded-2xl p-1.5 shadow-glass"
            :style="chainDropdownStyle"
          >
            <button
              type="button"
              role="option"
              :aria-selected="singleChainFilter === 'all'"
              @click="selectChain('all')"
              :class="[
                'w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-left transition-colors',
                singleChainFilter === 'all' ? 'bg-fg/10 text-fg font-medium' : 'text-muted hover:bg-fg/5 hover:text-fg',
              ]"
            >
              <span class="w-5 h-5 rounded-full border border-glass-border shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" class="w-3 h-3" aria-hidden="true">
                  <path
                    d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10A15.3 15.3 0 0 1 8 12a15.3 15.3 0 0 1 4-10z"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                </svg>
              </span>
              All chains
              <svg
                v-if="singleChainFilter === 'all'"
                viewBox="0 0 24 24"
                fill="none"
                class="w-4 h-4 ml-auto text-accent shrink-0"
                aria-hidden="true"
              >
                <path
                  d="M20 6 9 17l-5-5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <button
              v-for="c in networkChains"
              :key="c.name"
              type="button"
              role="option"
              :aria-selected="singleChainFilter === c.name"
              @click="selectChain(c.name)"
              :class="[
                'w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-left transition-colors',
                singleChainFilter === c.name
                  ? 'bg-fg/10 text-fg font-medium'
                  : 'text-muted hover:bg-fg/5 hover:text-fg',
              ]"
            >
              <img :src="getChainLogo(c)" :alt="c.displayName" class="w-5 h-5 rounded-full shrink-0" />
              {{ c.displayName }}
              <svg
                v-if="singleChainFilter === c.name"
                viewBox="0 0 24 24"
                fill="none"
                class="w-4 h-4 ml-auto text-accent shrink-0"
                aria-hidden="true"
              >
                <path
                  d="M20 6 9 17l-5-5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
          </Teleport>
        </div>
        <SegmentedTabs v-model="activeTab" :options="tabOptions" />
      </div>
      <!-- Row 2: search + filters + expand + refresh — right-aligned, wrappable -->
      <div v-if="filterable || searchable" class="ml-auto flex flex-wrap items-center justify-end gap-2">
        <SearchInput
          v-if="searchable"
          v-model="searchQuery"
          placeholder="Search by id, address or payable"
          class="max-w-xs"
        />
        <!-- Filters popover trigger + floating panel -->
        <div v-if="filterable && hasFilterOptions" ref="filtersEl" class="relative">
          <button
            type="button"
            :aria-expanded="showFilters"
            aria-haspopup="dialog"
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
            <span
              v-if="activeFilterCount > 0"
              class="rounded-full bg-accent text-accent-fg px-1.5 py-0.5 text-[10px] font-semibold leading-none"
            >
              {{ activeFilterCount }}
            </span>
          </button>
          <!-- Floating filters panel — vertical list layout -->
          <div
            v-if="showFilters"
            role="dialog"
            aria-label="Filters"
            class="absolute right-0 top-full mt-2 z-30 w-60 glass-popover rounded-2xl py-3 shadow-glass"
          >
            <!-- Activity type section -->
            <template v-if="typeChipOptions.length > 1">
              <p class="text-[10px] uppercase tracking-wider text-muted font-semibold px-4 pb-2">Activity type</p>
              <button
                v-for="opt in typeChipOptions"
                :key="opt.value"
                type="button"
                @click="toggleTypeFilter(opt.value)"
                :class="[
                  'w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors',
                  activeTypeFilters.includes(opt.value) ? 'text-fg font-medium' : 'text-muted hover:text-fg',
                ]"
              >
                <span>{{ opt.label }}</span>
                <svg
                  v-if="activeTypeFilters.includes(opt.value)"
                  viewBox="0 0 24 24"
                  fill="none"
                  class="w-3.5 h-3.5 text-accent shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="M20 6 9 17l-5-5"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </template>

            <!-- Token section -->
            <template v-if="showTokenChips && tokenChipOptions.length > 1">
              <div v-if="typeChipOptions.length > 1" class="my-3 border-t border-glass-border" />
              <p class="text-[10px] uppercase tracking-wider text-muted font-semibold px-4 pb-2">Token</p>
              <button
                v-for="opt in tokenChipOptions"
                :key="opt.value"
                type="button"
                @click="toggleTokenFilter(opt.value)"
                :class="[
                  'w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors',
                  activeTokenFilter.includes(opt.value) ? 'text-fg font-medium' : 'text-muted hover:text-fg',
                ]"
              >
                <span>{{ opt.label }}</span>
                <svg
                  v-if="activeTokenFilter.includes(opt.value)"
                  viewBox="0 0 24 24"
                  fill="none"
                  class="w-3.5 h-3.5 text-accent shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="M20 6 9 17l-5-5"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </template>

            <!-- Empty state -->
            <p
              v-if="typeChipOptions.length <= 1 && !(showTokenChips && tokenChipOptions.length > 1)"
              class="text-xs text-muted px-4 py-1"
            >
              No filters available.
            </p>

            <!-- Clear all -->
            <template v-if="activeFilterCount > 0">
              <div class="mt-3 border-t border-glass-border" />
              <button
                type="button"
                class="w-full flex items-center justify-between px-4 py-2.5 text-sm text-muted hover:text-fg transition-colors"
                @click="
                  activeTypeFilters = [];
                  activeTokenFilter = [];
                "
              >
                Clear all
                <span class="text-xs tabular-nums text-accent">{{ activeFilterCount }} active</span>
              </button>
            </template>
          </div>
        </div>
        <button
          v-if="displayItems.length > 0"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass-tint px-3 py-1.5 text-xs font-medium text-muted hover:text-fg transition-colors"
          @click="expandAllRows = !expandAllRows"
        >
          {{ expandAllRows ? 'Collapse all' : 'Expand all' }}
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

    <!-- Filter/search produced no results — offer a clear action -->
    <template v-else-if="displayItems.length === 0 && hasAnyFilterOrSearch">
      <EmptyState
        title="No matching activity"
        description="No activities match your current filters or search. Try adjusting or clearing them."
      >
        <template #action>
          <button
            type="button"
            class="rounded-full border border-glass-border bg-glass-tint backdrop-blur px-4 py-2 text-sm text-fg hover:bg-fg/5 transition-colors"
            @click="
              activeTypeFilters = [];
              activeTokenFilter = [];
              singleChainFilter = 'all';
              activeTab = 'all';
              searchQuery = '';
            "
          >
            Clear filters
          </button>
        </template>
      </EmptyState>
    </template>

    <!-- True empty: nothing exists on-chain for this feed -->
    <template v-else-if="displayItems.length === 0">
      <EmptyState :title="emptyCopy.title" :description="emptyCopy.description" />
    </template>

    <template v-else>
      <div class="hidden lg:block">
        <ActivityTable
          :activities="displayItems"
          :columns="columns"
          :count-field="countField"
          :highlight-ids="highlightedIds"
          :expand-all="expandAllRows"
          @select="(a) => emit('select', a)"
        />
      </div>
      <div class="lg:hidden">
        <ActivityList :activities="displayItems" :highlight-ids="highlightedIds" @select="(a) => emit('select', a)" />
      </div>

      <!-- Single-chain paginator: right-aligned, glassy -->
      <div v-if="!isMerged && displayTotal > 0" class="flex justify-end mt-4">
        <div class="glass-surface glass-frost rounded-2xl overflow-hidden">
          <Paginator
            :first="page * paginators.rowsPerPage"
            :rows="paginators.rowsPerPage"
            :total-records="displayTotal"
            :rows-per-page-options="paginators.rowsPerPageOptions"
            current-page-report-template="{first} to {last} of {totalRecords}"
            template="FirstPageLink PrevPageLink JumpToPageDropdown CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
            @page="
              (e) => {
                paginators.setRowsPerPage(e.rows);
                goToPage(e.page);
              }
            "
          />
        </div>
      </div>

      <!-- Merged: Load more (left) + paginator (right) -->
      <div v-else-if="isMerged" class="flex flex-wrap items-center justify-between gap-4 mt-4">
        <button
          v-if="mergedHasMore"
          type="button"
          class="rounded-full border border-glass-border bg-glass-tint backdrop-blur px-4 py-2 text-sm disabled:opacity-60"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? 'Loading...' : 'Load more' }}
        </button>
        <span v-else class="text-xs text-muted">All loaded</span>

        <div v-if="displayTotal > 0" class="glass-surface glass-frost rounded-2xl overflow-hidden">
          <Paginator
            :first="mergedPage * paginators.rowsPerPage"
            :rows="paginators.rowsPerPage"
            :total-records="displayTotal"
            :rows-per-page-options="paginators.rowsPerPageOptions"
            current-page-report-template="{first} to {last} of {totalRecords}"
            template="FirstPageLink PrevPageLink JumpToPageDropdown CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
            @page="
              (e) => {
                paginators.setRowsPerPage(e.rows);
                goToMergedPage(e.page);
              }
            "
          />
        </div>
      </div>
    </template>
  </div>
</template>
