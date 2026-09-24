<script setup lang="ts">
/**
 * src/components/ui/StatusPill.vue — a small rounded tone-coded label for
 * statuses like "Open", "Closed", "Pending" or "Failed".
 *
 * Colour alone never carries the meaning: the label text is always shown
 * alongside the tone, and a `pulse` dot (for live/pending states) uses shape
 * and motion rather than colour to draw attention.
 *
 * Usage: `<StatusPill tone="success" label="Open" />`, `<StatusPill tone="info" label="Relaying" pulse />`
 */
withDefaults(
  defineProps<{
    /** The pill's colour tone. `neutral` and `accent` are for non-status
     *  labels (counts, generic tags) that still want the pill shape. */
    tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';
    /** The visible text. */
    label: string;
    /** Adds a pulsing dot before the label, for in-progress/live states. */
    pulse?: boolean;
  }>(),
  { pulse: false }
);

const toneClasses: Record<string, string> = {
  success: 'text-success bg-success/15 ring-success/30',
  warning: 'text-warning bg-warning/15 ring-warning/30',
  danger: 'text-danger bg-danger/15 ring-danger/30',
  info: 'text-info bg-info/15 ring-info/30',
  neutral: 'text-muted bg-fg/5 ring-fg/10',
  accent: 'text-accent bg-accent/15 ring-accent/30',
};

const dotClasses: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-muted',
  accent: 'bg-accent',
};
</script>

<template>
  <span
    :class="['inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1', toneClasses[tone]]"
  >
    <span v-if="pulse" class="relative flex w-1.5 h-1.5">
      <span
        :class="['absolute inline-flex h-full w-full rounded-full animate-ping opacity-75', dotClasses[tone]]"
      ></span>
      <span :class="['relative inline-flex rounded-full h-1.5 w-1.5', dotClasses[tone]]"></span>
    </span>
    {{ label }}
  </span>
</template>
