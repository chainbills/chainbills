<script setup lang="ts">
/**
 * src/components/scan/ScanEntityTable.vue
 *
 * The generic glass-dense table shell shared by every entity tab in Scan
 * (Payables, Payments, Withdrawals, Users). Specific tab wrappers
 * (`ScanPayablesTable`, etc.) supply `columns` and `rows` and own fetching;
 * this component owns the layout, pagination, expandable-row detail panel,
 * skeleton/empty/error states, and the "Load more" vs numbered-page footer.
 *
 * Expandable rows: clicking any row expands a `KeyValueList` detail panel
 * beneath it on desktop. On mobile (<md), expansion opens a bottom-sheet
 * `Dialog` instead. The detail data is supplied via a named slot
 * `row-detail(row)`.
 *
 * Props:
 *  - `columns`: column definitions label, key, and an optional slot name
 *    for custom cell rendering.
 *  - `rows`: the current page's data.
 *  - `loading`: true while data is fetching.
 *  - `total`: total count across all pages (for numbered pagination).
 *  - `page`: current 0-based page (numbered pagination only).
 *  - `pageSize`: items per page.
 *  - `allChains`: when true, shows "Load more" instead of numbered pagination.
 *  - `hasMore`: whether more data is available to load (all-chains mode).
 *  - `filterNote`: an optional note about the loaded-window size, e.g.
 *    "Filtering the latest 200 payments · Load more".
 *  - `error`: an error string to display in the error state.
 *
 * Emits:
 *  - `update:page`: numbered pagination page change.
 *  - `loadMore`: the "Load more" button was clicked.
 *  - `retry`: the error state retry button was clicked.
 *
 * Slots:
 *  - `cell-{column.slotName}(row)`: custom cell renderer for a column.
 *  - `row-detail(row)`: the expanded-row detail content (receives the row).
 *
 * Usage:
 * ```vue
 * <ScanEntityTable :columns="cols" :rows="items" :loading="loading" :total="total" :page="page" :page-size="20" :all-chains="false" @update:page="page = $event">
 *   <template #cell-id="{ row }"><AddressChip :id="row.id" /></template>
 *   <template #row-detail="{ row }"><KeyValueList :items="detailItems(row)" /></template>
 * </ScanEntityTable>
 * ```
 */
import { EmptyState, ErrorState, KeyValueList, Skeleton } from '@/components/ui';
import { useAnalyticsStore } from '@/stores';
import { computed, ref } from 'vue';
import Dialog from 'primevue/dialog';

/** One column definition for the table header and cell mapping. */
export interface ColumnDef {
  /** Header label text. */
  label: string;
  /** Key into the row object for the default cell text renderer. */
  key: string;
  /** When set, this column's cells render using the `cell-{slotName}` slot
   *  instead of `row[key]`. */
  slotName?: string;
}

const props = withDefaults(defineProps<{
  /** Column definitions. */
  columns: ColumnDef[];
  /** Rows for the current page. */
  rows: any[];
  /** True while data is fetching. */
  loading: boolean;
  /** Total row count across all pages (numbered pagination). */
  total: number;
  /** Current 0-based page (numbered pagination). */
  page: number;
  /** Rows per page. */
  pageSize: number;
  /** True when the "all chains" merged view is active shows "Load more" footer. */
  allChains: boolean;
  /** True when more data is available in "Load more" mode. */
  hasMore?: boolean;
  /** Note about the current loaded-window size, shown above the table when set. */
  filterNote?: string | null;
  /** Error message to display in the error state. */
  error?: string | null;
  /** Entity type label for analytics (e.g. 'payable', 'payment', 'withdrawal', 'user'). */
  entityType?: string;
}>(), {
  hasMore: false,
  filterNote: null,
  error: null,
  entityType: 'entity',
});

const emit = defineEmits<{
  /** Fires when the user selects a page in numbered pagination mode. */
  'update:page': [page: number];
  /** Fires when the "Load more" button is clicked. */
  loadMore: [];
  /** Fires when the retry button in the error state is clicked. */
  retry: [];
}>();

const analytics = useAnalyticsStore();

/** Row index currently expanded (null = none). */
const expandedRow = ref<number | null>(null);
/** Row opened in mobile bottom-sheet (null = none). */
const mobileDetailRow = ref<any | null>(null);

/** Total page count for numbered pagination. */
const totalPages = computed(() => Math.ceil(props.total / props.pageSize));

const toggleRow = (index: number) => {
  const opening = expandedRow.value !== index;
  expandedRow.value = opening ? index : null;
  if (opening) analytics.recordEvent('scan_entity_clicked', { entity_type: props.entityType });
};

const openMobileDetail = (row: any) => {
  mobileDetailRow.value = row;
  analytics.recordEvent('scan_entity_clicked', { entity_type: props.entityType });
};
const closeMobileDetail = () => { mobileDetailRow.value = null; };

const handleLoadMore = () => {
  analytics.recordEvent('scan_load_more', { entity_type: props.entityType });
  emit('loadMore');
};

const handlePageChange = (newPage: number) => {
  analytics.recordEvent('scan_page_changed', { entity_type: props.entityType, page: newPage });
  emit('update:page', newPage);
};

/** Skeleton row count while loading (show previous rows greyed out). */
const skeletonCount = computed(() => props.rows.length || props.pageSize);
</script>

<template>
  <div class="space-y-3">
    <!-- Loaded-window filter note (honest about what is being filtered) -->
    <p v-if="filterNote" class="text-xs text-muted px-1">{{ filterNote }}</p>

    <!-- Error state -->
    <ErrorState v-if="error && !loading" :message="error" @retry="emit('retry')" />

    <!-- Table (desktop md+) -->
    <div
      v-else
      class="glass-surface glass-dense rounded-2xl overflow-hidden overflow-x-auto hidden md:block"
      role="table"
      :aria-label="`${columns[0]?.label ?? 'Entity'} table`"
      :aria-busy="loading"
    >
      <!-- Sticky header -->
      <div
        role="row"
        class="grid sticky top-0 bg-bg/80 backdrop-blur border-b border-glass-border"
        :style="{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr)) 2rem` }"
      >
        <div
          v-for="col in columns"
          :key="col.key"
          role="columnheader"
          class="px-4 py-3 text-xs uppercase tracking-wider text-muted font-semibold"
        >
          {{ col.label }}
        </div>
        <!-- Expand chevron column header (empty) -->
        <div role="columnheader" aria-hidden="true" />
      </div>

      <!-- Skeleton rows while loading -->
      <template v-if="loading">
        <div
          v-for="i in skeletonCount"
          :key="`skel-${i}`"
          role="row"
          class="grid border-b border-glass-border last:border-0 px-4 py-3.5 gap-4"
          :style="{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr)) 2rem` }"
        >
          <Skeleton v-for="col in columns" :key="col.key" h="h-4" w="w-full" />
          <div />
        </div>
      </template>

      <!-- Data rows -->
      <template v-else-if="rows.length > 0">
        <template v-for="(row, i) in rows" :key="i">
          <!-- Main row -->
          <div
            role="row"
            class="grid border-b border-glass-border last:border-0 hover:bg-fg/[0.03] cursor-pointer transition-colors relative"
            :style="{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr)) 2rem` }"
            @click="toggleRow(i)"
            :aria-expanded="expandedRow === i"
          >
            <div
              v-for="col in columns"
              :key="col.key"
              role="cell"
              class="px-4 py-3.5 text-sm truncate flex items-center"
            >
              <slot v-if="col.slotName" :name="`cell-${col.slotName}`" :row="row">
                {{ row[col.key] ?? '-' }}
              </slot>
              <span v-else class="truncate">{{ row[col.key] ?? '-' }}</span>
            </div>
            <!-- Expand chevron -->
            <div role="presentation" class="flex items-center justify-center text-muted">
              <svg
                class="w-4 h-4 transition-transform duration-200"
                :class="expandedRow === i ? 'rotate-180' : ''"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <!-- Expanded detail panel -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out overflow-hidden"
            enter-from-class="max-h-0 opacity-0"
            enter-to-class="max-h-[40rem] opacity-100"
            leave-active-class="transition-all duration-150 ease-in overflow-hidden"
            leave-from-class="max-h-[40rem] opacity-100"
            leave-to-class="max-h-0 opacity-0"
          >
            <div
              v-if="expandedRow === i"
              role="row"
              class="bg-fg/[0.015] border-b border-glass-border last:border-0"
            >
              <div role="cell" :colspan="columns.length + 1" class="px-6 py-4">
                <slot name="row-detail" :row="row" />
              </div>
            </div>
          </Transition>
        </template>
      </template>

      <!-- Empty state -->
      <div v-else role="row">
        <div role="cell" :colspan="columns.length + 1" class="px-4 py-12">
          <EmptyState title="Nothing here yet" description="No items found for this selection." />
        </div>
      </div>
    </div>

    <!-- Mobile stacked list (< md) -->
    <div class="md:hidden space-y-2" v-if="!error">
      <template v-if="loading">
        <div v-for="i in skeletonCount" :key="`m-skel-${i}`" class="glass-surface glass-frost rounded-2xl p-4 space-y-2">
          <Skeleton h="h-4" w="w-3/4" />
          <Skeleton h="h-3" w="w-1/2" />
        </div>
      </template>
      <template v-else-if="rows.length > 0">
        <button
          v-for="(row, i) in rows"
          :key="`m-${i}`"
          class="w-full text-left glass-surface glass-frost rounded-2xl p-4 space-y-1 hover:bg-fg/5 transition-colors"
          @click="openMobileDetail(row)"
          :aria-label="`View details for row ${i + 1}`"
        >
          <div
            v-for="col in columns.slice(0, 2)"
            :key="col.key"
            class="flex items-center gap-2"
          >
            <span class="text-[10px] uppercase tracking-wider text-muted w-20 shrink-0">{{ col.label }}</span>
            <span class="text-sm truncate">
              <slot v-if="col.slotName" :name="`cell-${col.slotName}`" :row="row">
                {{ row[col.key] ?? '-' }}
              </slot>
              <span v-else>{{ row[col.key] ?? '-' }}</span>
            </span>
          </div>
        </button>
      </template>
      <EmptyState v-else title="Nothing here yet" description="No items found for this selection." />
    </div>

    <!-- Mobile bottom-sheet detail dialog -->
    <Dialog
      v-model:visible="mobileDetailRow"
      modal
      :draggable="false"
      class="w-full max-w-lg"
      :style="{ margin: '0', marginTop: 'auto', borderRadius: '1.5rem 1.5rem 0 0' }"
    >
      <slot v-if="mobileDetailRow" name="row-detail" :row="mobileDetailRow" />
    </Dialog>

    <!-- Pagination footer -->
    <div v-if="!loading && !error && rows.length > 0" class="flex items-center justify-between gap-4 pt-2">
      <!-- Numbered pagination (single-chain) -->
      <template v-if="!allChains">
        <p class="text-xs text-muted">
          Page {{ page + 1 }} of {{ totalPages }} &middot; {{ total.toLocaleString() }} total
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            :disabled="page === 0"
            @click="handlePageChange(page - 1)"
            class="rounded-full px-4 py-1.5 text-sm border border-glass-border text-muted hover:text-fg disabled:opacity-40 transition-colors"
            aria-label="Previous page"
          >
            Prev
          </button>
          <button
            type="button"
            :disabled="page >= totalPages - 1"
            @click="handlePageChange(page + 1)"
            class="rounded-full px-4 py-1.5 text-sm border border-glass-border text-muted hover:text-fg disabled:opacity-40 transition-colors"
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </template>

      <!-- "Load more" footer (all-chains merged view) -->
      <template v-else>
        <p class="text-xs text-muted">{{ rows.length.toLocaleString() }} loaded</p>
        <button
          v-if="hasMore"
          type="button"
          @click="handleLoadMore()"
          class="rounded-full px-5 py-2 text-sm font-medium border border-glass-border text-muted hover:text-fg transition-colors"
        >
          Load more
        </button>
        <span v-else class="text-xs text-muted">All loaded</span>
      </template>
    </div>
  </div>
</template>
