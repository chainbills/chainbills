<script setup lang="ts">
/**
 * src/components/activity/ActivityTable.vue — the desktop (≥ md)
 * presentation of an activity feed: a `glass-dense` table with the columns
 * from design-language.md §7.4 (`#`, Activity, Details, Route, Payable,
 * Actor, Time, expand chevron), each independently hideable via `columns`.
 *
 * Clicking a row expands a detail panel (`ActivityDetailPanel`) below it,
 * which is also where the lazy "has this cross-chain payment arrived yet?"
 * check runs (see `ActivityDetailPanel`'s doc block) — expanding a row is
 * what triggers it, never the table itself up front.
 *
 * Usage:
 * ```vue
 * <ActivityTable :activities="activities" count-field="payableCount" />
 * <ActivityTable :activities="activities" :columns="['activity', 'details', 'time']" />
 * ```
 */
import ActivityDetailPanel from './ActivityDetailPanel.vue';
import ActivityDetails from './ActivityDetails.vue';
import ActivityIcon from './ActivityIcon.vue';
import { AddressChip, ChainBadge } from '@/components/ui';
import { type Activity } from '@/schemas';
import { useAuthStore, useTimeStore } from '@/stores';
import { ref } from 'vue';

/** Every column this table can render, in default left-to-right order. */
export type ActivityTableColumn = 'count' | 'activity' | 'details' | 'route' | 'payable' | 'actor' | 'time';

const props = withDefaults(
  defineProps<{
    /** The activities to render, newest first. `entity` must already be resolved. */
    activities: Activity[];
    /** Which columns to show, and in what order. Defaults to every column. */
    columns?: ActivityTableColumn[];
    /** Which of `Activity`'s three position counters backs the `#` column — the caller picks the one that matches its source (e.g. `payableCount` for a payable feed, `chainCount` for a chain/network feed). */
    countField?: 'chainCount' | 'userCount' | 'payableCount';
    /** Activity ids to give a brief accent highlight to — set by `ActivityFeed` right after a live-refresh prepends newly-arrived items. */
    highlightIds?: Set<string>;
  }>(),
  // `defineProps` defaults are hoisted out of `<script setup>`'s scope, so this list is inlined here
  // rather than shared with a module-level constant (see `ActivityTableColumn` above for the same set, named).
  { columns: () => ['count', 'activity', 'details', 'route', 'payable', 'actor', 'time'], countField: 'chainCount' }
);

const emit = defineEmits<{
  /** Fires whenever a row is expanded or collapsed, with the activity that was toggled. */
  select: [activity: Activity];
}>();

const auth = useAuthStore();
const time = useTimeStore();

/** Which row (by activity id) is currently expanded, or `null` when none is. */
const expandedId = ref<string | null>(null);

/** Rows confirmed (by the lazy `ActivityDetailPanel` check) to still be awaiting cross-chain delivery — keyed by activity id, so the pending rail persists after the row is collapsed again. */
const pendingById = ref<Record<string, boolean>>({});

const toggle = (activity: Activity) => {
  expandedId.value = expandedId.value === activity.id ? null : activity.id;
  emit('select', activity);
};

const has = (column: ActivityTableColumn) => props.columns.includes(column);
</script>

<template>
  <div class="glass-surface glass-dense rounded-2xl overflow-hidden overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="sticky top-0 bg-bg/80 backdrop-blur text-xs uppercase tracking-wider text-muted">
        <tr>
          <th v-if="has('count')" class="text-left px-4 py-3.5 font-medium">#</th>
          <th v-if="has('activity')" class="text-left px-4 py-3.5 font-medium">Activity</th>
          <th v-if="has('details')" class="text-left px-4 py-3.5 font-medium">Details</th>
          <th v-if="has('route')" class="text-left px-4 py-3.5 font-medium">Route</th>
          <th v-if="has('payable')" class="text-left px-4 py-3.5 font-medium">Payable</th>
          <th v-if="has('actor')" class="text-left px-4 py-3.5 font-medium">Actor</th>
          <th v-if="has('time')" class="text-left px-4 py-3.5 font-medium">Time</th>
          <th class="w-10"></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="activity in activities" :key="activity.id">
          <tr
            class="relative border-t border-fg/5 hover:bg-fg/[0.03] cursor-pointer transition-colors duration-1000"
            :class="highlightIds?.has(activity.id) && 'bg-accent/10'"
            @click="toggle(activity)"
          >
            <td v-if="has('count')" class="px-4 py-3.5 font-mono text-xs text-muted">
              <span
                v-if="pendingById[activity.id]"
                class="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full bg-accent"
                aria-hidden="true"
              ></span>
              #{{ activity[countField] || '—' }}
            </td>
            <td v-if="has('activity')" class="px-4 py-3.5">
              <span class="inline-flex items-center gap-2">
                <ActivityIcon :type="activity.type" size="sm" />
                <span class="font-medium text-fg">{{ activity.meta.label }}</span>
                <span
                  v-if="auth.currentUser && activity.actor === auth.currentUser.walletAddress"
                  class="text-[10px] uppercase tracking-wider text-accent bg-accent/10 rounded-full px-1.5 py-0.5"
                >
                  You
                </span>
              </span>
            </td>
            <td v-if="has('details')" class="px-4 py-3.5"><ActivityDetails :activity="activity" /></td>
            <td v-if="has('route')" class="px-4 py-3.5">
              <span v-if="activity.isCrossChain" class="inline-flex items-center gap-1.5">
                <ChainBadge :chain="activity.chain" size="sm" />
                <span class="text-muted text-xs" aria-hidden="true">→</span>
                <ChainBadge :chain="activity.counterpartChain!" size="sm" />
              </span>
              <ChainBadge v-else :chain="activity.chain" size="sm" />
            </td>
            <td v-if="has('payable')" class="px-4 py-3.5">
              <AddressChip
                v-if="activity.payableId"
                :value="activity.payableId"
                kind="id"
                :to="`/payable/${activity.payableId}`"
              />
              <span v-else class="text-muted text-xs">—</span>
            </td>
            <td v-if="has('actor')" class="px-4 py-3.5">
              <AddressChip
                v-if="activity.actor"
                :value="activity.actor"
                :chain="activity.chain"
                kind="address"
                :to="`/scan/address/${activity.actor}`"
              />
              <span v-else class="text-muted text-xs">—</span>
            </td>
            <td v-if="has('time')" class="px-4 py-3.5 text-muted whitespace-nowrap">
              {{ time.display(activity.timestamp) }}
            </td>
            <td class="px-4 py-3.5 text-right">
              <button
                type="button"
                class="text-muted hover:text-fg transition-transform"
                :class="expandedId === activity.id && 'rotate-180'"
                :aria-expanded="expandedId === activity.id"
                :aria-label="expandedId === activity.id ? 'Collapse row' : 'Expand row'"
                @click.stop="toggle(activity)"
              >
                <svg viewBox="0 0 24 24" fill="none" class="w-4 h-4" aria-hidden="true">
                  <path
                    d="m6 9 6 6 6-6"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </td>
          </tr>
          <tr v-if="expandedId === activity.id">
            <td :colspan="columns.length + 1" class="bg-fg/[0.015] px-4 py-4">
              <ActivityDetailPanel
                :activity="activity"
                @resolved="(arrived) => (pendingById[activity.id] = !arrived)"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
