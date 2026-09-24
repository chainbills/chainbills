<script setup lang="ts">
/**
 * src/components/ui/IconChip.vue — a small tinted rounded square holding an
 * icon, used as the leading element of activity rows, toasts and stepper
 * meta slots.
 *
 * The icon itself is passed as the default slot so any icon component (or
 * raw SVG) can be used; this component only supplies the tinted background,
 * size and rounding.
 *
 * Usage:
 * ```vue
 * <IconChip tone="success"><IconCheck class="w-4 h-4" /></IconChip>
 * ```
 */
withDefaults(
  defineProps<{
    /** Colour tone of the tint. `neutral` is the default for icons with no
     *  particular status meaning (e.g. a chain logo wrapper). */
    tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';
    /** Chip size in Tailwind units. `md` (9x9, design-language.md §7.4's
     *  activity-row icon chip) is the default; `sm` fits dense rows. */
    size?: 'sm' | 'md';
  }>(),
  { tone: 'neutral', size: 'md' }
);

const toneClasses: Record<string, string> = {
  success: 'text-success bg-success/15',
  warning: 'text-warning bg-warning/15',
  danger: 'text-danger bg-danger/15',
  info: 'text-info bg-info/15',
  neutral: 'text-muted bg-fg/5',
  accent: 'text-accent bg-accent/15',
};
</script>

<template>
  <span
    :class="[
      'inline-flex items-center justify-center rounded-2xl shrink-0',
      size === 'sm' ? 'w-7 h-7' : 'w-9 h-9',
      toneClasses[tone],
    ]"
  >
    <slot />
  </span>
</template>
