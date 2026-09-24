<script setup lang="ts">
/**
 * src/components/activity/ActivityIcon.vue — the tinted icon chip an
 * activity row leads with, resolved from `ActivityType` via
 * `schemas/activity.ts`'s `activityTypeMeta` (icon key + tone).
 *
 * Shared by `ActivityRow`, `ActivityTable` and `ActivityDetailPanel` so
 * every presentation of an activity uses the exact same icon/tone mapping.
 *
 * Usage: `<ActivityIcon :type="activity.type" />`, `<ActivityIcon :type="activity.type" size="sm" />`
 */
import { activityTypeMeta, ActivityType } from '@/schemas';
import { IconChip } from '@/components/ui';
import IconArrowDownLeft from '@/icons/IconArrowDownLeft.vue';
import IconArrowUpRight from '@/icons/IconArrowUpRight.vue';
import IconFilePlus from '@/icons/IconFilePlus.vue';
import IconHorizontalAdjustments from '@/icons/IconHorizontalAdjustments.vue';
import IconLock from '@/icons/IconLock.vue';
import IconLockOpen from '@/icons/IconLockOpen.vue';
import IconToggleLeft from '@/icons/IconToggleLeft.vue';
import IconUserPlus from '@/icons/IconUserPlus.vue';
import IconWallet from '@/icons/IconWallet.vue';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** Which activity type to render the icon/tone for. */
    type: ActivityType;
    /** Chip size, forwarded to `IconChip`. */
    size?: 'sm' | 'md';
  }>(),
  { size: 'md' }
);

/** Maps `activityTypeMeta[type].icon`'s string key to the icon component that renders it. */
const iconComponents: Record<string, unknown> = {
  'user-plus': IconUserPlus,
  'file-plus': IconFilePlus,
  'arrow-up-right': IconArrowUpRight,
  'arrow-down-left': IconArrowDownLeft,
  wallet: IconWallet,
  lock: IconLock,
  'lock-open': IconLockOpen,
  sliders: IconHorizontalAdjustments,
  'toggle-left': IconToggleLeft,
};

const meta = computed(() => activityTypeMeta[props.type]);
const icon = computed(() => iconComponents[meta.value.icon]);
</script>

<template>
  <IconChip :tone="meta.tone" :size="size">
    <component :is="icon" class="w-4 h-4" />
  </IconChip>
</template>
