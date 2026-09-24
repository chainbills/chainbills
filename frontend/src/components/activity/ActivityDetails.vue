<script setup lang="ts">
/**
 * src/components/activity/ActivityDetails.vue — the "Details" cell/line for
 * one activity: a `TokenAmount` for payments and withdrawals, or the
 * payable's current-state summary for settings activities.
 *
 * `resolveEntities` (`stores/activity.ts`) only ever attaches a settings
 * activity's `Payable` with its counters, `host`, `isClosed` and
 * `isAutoWithdraw` populated — never its `allowedTokensAndAmounts` array
 * (the bulk getter behind it returns counts only, not the token list), so
 * the summary here sticks to what is actually known rather than guessing a
 * token count.
 *
 * Shared by `ActivityRow`, `ActivityTable` and `ActivityDetailPanel`.
 *
 * Usage: `<ActivityDetails :activity="activity" />`
 */
import { TokenAmount } from '@/components/ui';
import { ActivityType, Payable, type Activity } from '@/schemas';
import { computed } from 'vue';

const props = defineProps<{
  /** The activity to summarize. `entity` must already be resolved (see `useActivityStore().resolveEntities`). */
  activity: Activity;
}>();

/** Plain-text current-state summary for a payable-settings activity, using only the counters/flags the resolved `Payable` actually carries. */
const settingsSummary = computed(() => {
  const payable = props.activity.entity instanceof Payable ? props.activity.entity : null;
  if (!payable) return '';
  switch (props.activity.type) {
    case ActivityType.CreatedPayable:
      return payable.isClosed ? 'Created, now closed' : 'Payable created, now open';
    case ActivityType.ClosedPayable:
      return 'Now closed';
    case ActivityType.ReopenedPayable:
      return 'Now open';
    case ActivityType.UpdatedPayableAllowedTokensAndAmounts:
      return 'Accepted tokens updated';
    case ActivityType.UpdatedPayableAutoWithdrawStatus:
      return payable.isAutoWithdraw ? 'Auto-withdraw is now on' : 'Auto-withdraw is now off';
    default:
      return '';
  }
});
</script>

<template>
  <TokenAmount v-if="activity.amount" :amount="activity.amount" :chain="activity.chain" size="sm" />
  <span v-else-if="activity.type === ActivityType.InitializedUser" class="text-sm text-muted">New wallet</span>
  <span v-else class="text-sm text-muted">{{ settingsSummary }}</span>
</template>
