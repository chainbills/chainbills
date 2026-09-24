<script setup lang="ts">
/**
 * src/components/ui/StatTile.vue — a single labelled statistic, used on
 * dashboards, the scan explorer and payable pages.
 *
 * Renders the "stat tile" recipe from design-language.md §7.4: a muted
 * uppercase label, a large tabular-numeral value in the display font, an
 * optional hint line, an optional signed delta badge, and a decorative
 * corner glow. While `loading` is true, the value and hint are replaced by
 * `Skeleton` blocks so the layout doesn't shift once real data arrives.
 *
 * Usage:
 * ```vue
 * <StatTile label="Total received" :value="'128,430 USDC'" hint="across 3 chains" />
 * <StatTile label="Payables" :value="12" :delta="{ value: '+2', tone: 'success' }" />
 * <StatTile label="Total received" loading />
 * ```
 */
import Skeleton from './Skeleton.vue';

withDefaults(
  defineProps<{
    /** The stat's name, e.g. "Total received". Rendered muted and uppercase. */
    label: string;
    /** The headline value. Accepts a pre-formatted string or number so callers
     *  control exact formatting (token symbols, decimals, bigint conversions)
     *  before passing it in — this component only lays it out. */
    value?: string | number;
    /** A short supporting line under the value, e.g. "across 3 chains". */
    hint?: string;
    /** An optional signed change indicator, e.g. `{ value: '+12%', tone: 'success' }`. */
    delta?: { value: string; tone?: 'success' | 'warning' | 'danger' | 'neutral' };
    /** When true, shows skeleton placeholders instead of `value`/`hint`. */
    loading?: boolean;
    /** Renders `value` in the accent colour instead of the default foreground. */
    accent?: boolean;
  }>(),
  { loading: false, accent: false }
);

const deltaClasses: Record<string, string> = {
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  danger: 'text-danger bg-danger/10',
  neutral: 'text-muted bg-fg/5',
};
</script>

<template>
  <div class="glass-surface glass-frost rounded-2xl p-5 relative overflow-hidden">
    <span class="glass-sheen" aria-hidden="true"></span>
    <!-- Decorative corner orb, purely visual. -->
    <div class="absolute -top-14 -right-14 w-40 h-40 rounded-full bg-accent/10 blur-2xl pointer-events-none"></div>

    <div class="relative">
      <p class="text-xs uppercase tracking-[0.12em] text-muted mb-2">{{ label }}</p>

      <template v-if="loading">
        <Skeleton w="w-24" h="h-8" class="mb-2" />
        <Skeleton w="w-16" h="h-3" />
      </template>
      <template v-else>
        <div class="flex items-baseline gap-2 flex-wrap">
          <p class="font-display text-display-md tabular-nums" :class="accent ? 'text-accent' : 'text-fg'">
            {{ value }}
          </p>
          <span
            v-if="delta"
            :class="['text-xs font-medium rounded-full px-2 py-0.5', deltaClasses[delta.tone ?? 'neutral']]"
          >
            {{ delta.value }}
          </span>
        </div>
        <p v-if="hint" class="mt-1 text-xs text-muted">{{ hint }}</p>
      </template>
    </div>
  </div>
</template>
