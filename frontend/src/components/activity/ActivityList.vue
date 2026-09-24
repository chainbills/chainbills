<script setup lang="ts">
/**
 * src/components/activity/ActivityList.vue — the mobile (< md) presentation
 * of an activity feed: stacked `ActivityRow`s, each opening a bottom-sheet
 * dialog with the same field-by-field breakdown `ActivityTable`'s expanded
 * row shows (`ActivityDetailPanel`), per design-language.md §7.4/§7.6.
 *
 * `ActivityFeed` renders this alongside `ActivityTable` and toggles which
 * one is visible with `md:hidden`/`hidden md:block` — both always exist in
 * the DOM so there is no layout flash when the viewport crosses the
 * breakpoint.
 *
 * Usage: `<ActivityList :activities="activities" />`
 */
import ActivityDetailPanel from './ActivityDetailPanel.vue';
import ActivityRow from './ActivityRow.vue';
import { useAuthStore } from '@/stores';
import { type Activity } from '@/schemas';
import Dialog from 'primevue/dialog';
import { ref } from 'vue';

defineProps<{
  /** The activities to render, newest first. */
  activities: Activity[];
  /** Activity ids to give a brief accent highlight to — set by `ActivityFeed` right after a live-refresh prepends newly-arrived items. */
  highlightIds?: Set<string>;
}>();

const emit = defineEmits<{
  /** Fires whenever a row's bottom sheet is opened, with the activity it belongs to. */
  select: [activity: Activity];
}>();

const auth = useAuthStore();

/** The activity whose bottom sheet is currently open, or `null` when none is. */
const openActivity = ref<Activity | null>(null);

const open = (activity: Activity) => {
  openActivity.value = activity;
  emit('select', activity);
};

/** Which rows have been confirmed (by `ActivityDetailPanel`'s lazy check) to still be awaiting cross-chain delivery — keyed by activity id, so the row keeps showing the pending rail after the sheet closes. */
const pendingById = ref<Record<string, boolean>>({});
</script>

<template>
  <div class="divide-y divide-fg/5">
    <ActivityRow
      v-for="activity in activities"
      :key="activity.id"
      :activity="activity"
      :is-own="!!auth.currentUser && activity.actor === auth.currentUser.walletAddress"
      :pending="!!pendingById[activity.id]"
      :highlighted="!!highlightIds?.has(activity.id)"
      @click="open(activity)"
    />
  </div>

  <Dialog
    :visible="!!openActivity"
    @update:visible="(v) => !v && (openActivity = null)"
    modal
    :draggable="false"
    position="bottom"
    :header="openActivity?.meta.label"
    class="w-full !rounded-b-none sm:max-w-lg"
  >
    <ActivityDetailPanel
      v-if="openActivity"
      :activity="openActivity"
      @resolved="(arrived) => openActivity && (pendingById[openActivity.id] = !arrived)"
    />
  </Dialog>
</template>
