<script setup lang="ts">
/**
 * src/components/activity/ActivityRow.vue — one stacked activity row,
 * following the "activity row" recipe in
 * `frontend/docs/redesign/reference/design-language.md` §7.4: a tinted icon
 * chip, a title line with a chain badge, a mono sub-line of ids/addresses,
 * and the amount/time on the right.
 *
 * This is `ActivityList`'s (mobile) row, and is reused wherever a compact
 * one-line activity summary is needed outside a table.
 *
 * Usage:
 * ```vue
 * <ActivityRow :activity="activity" :is-own="activity.actor === myAddress" @click="openDetails(activity)" />
 * ```
 */
import ActivityDetails from './ActivityDetails.vue';
import ActivityIcon from './ActivityIcon.vue';
import { ChainBadge } from '@/components/ui';
import { type Activity } from '@/schemas';
import { useAnalyticsStore, useTimeStore } from '@/stores';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** The activity to render. `entity` must already be resolved. */
    activity: Activity;
    /** Shows a small "You" tag when this activity was performed by the connected wallet. */
    isOwn?: boolean;
    /** Shows the pending accent rail: a cross-chain payment whose delivery has not (yet) been confirmed. */
    pending?: boolean;
    /** Briefly tints the row's background — set right after a live-refresh reveals this as a newly-arrived item. */
    highlighted?: boolean;
  }>(),
  { isOwn: false, pending: false, highlighted: false }
);

const emit = defineEmits<{
  /** Fires when the row is tapped/clicked — the parent opens the detail bottom sheet or expanded panel. */
  click: [];
}>();

const analytics = useAnalyticsStore();
const time = useTimeStore();

const handleClick = () => {
  analytics.recordEvent('activity_entry_opened', {
    activity_type: props.activity.type,
    chain: props.activity.chain.name,
  });
  emit('click');
};

const shorten = (v: string) => (v.length <= 10 ? v : `${v.slice(0, 6)}...${v.slice(-4)}`);

/** Mono sub-line: the acting wallet, then the related payable, whichever are known for this activity. */
const subLine = computed(() => {
  const parts: string[] = [];
  if (props.activity.actor) parts.push(shorten(props.activity.actor));
  if (props.activity.payableId) parts.push(shorten(props.activity.payableId));
  return parts.join(' · ');
});
</script>

<template>
  <button
    type="button"
    class="relative w-full flex items-center gap-3 px-2 py-3 text-left rounded-xl hover:bg-fg/[0.03] transition-colors duration-1000"
    :class="highlighted && 'bg-accent/10'"
    @click="handleClick()"
  >
    <span
      v-if="pending"
      class="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full bg-accent"
      aria-hidden="true"
    ></span>

    <ActivityIcon :type="activity.type" />

    <div class="flex-1 min-w-0">
      <p class="flex items-center gap-1.5 text-sm font-medium text-fg">
        <span class="truncate">{{ activity.meta.label }}</span>
        <span
          v-if="isOwn"
          class="shrink-0 text-[10px] uppercase tracking-wider text-accent bg-accent/10 rounded-full px-1.5 py-0.5"
        >
          You
        </span>
      </p>
      <p class="flex items-center gap-1.5 mt-0.5">
        <ChainBadge :chain="activity.chain" size="sm" />
        <span v-if="subLine" class="text-xs text-muted font-mono truncate">{{ subLine }}</span>
      </p>
    </div>

    <div class="text-right shrink-0">
      <ActivityDetails :activity="activity" />
      <p class="text-[10px] uppercase tracking-wider text-muted mt-1">{{ time.display(activity.timestamp) }}</p>
    </div>
  </button>
</template>
