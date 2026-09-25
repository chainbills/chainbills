<script setup lang="ts">
/**
 * src/components/ui/StatTile.vue — a single labelled statistic, used on
 * dashboards, the scan explorer and payable pages.
 */
import Skeleton from './Skeleton.vue';
import { ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    value?: string | number;
    hint?: string;
    delta?: { value: string; tone?: 'success' | 'warning' | 'danger' | 'neutral' };
    loading?: boolean;
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

/** Animated display value — counts from previous to new number. */
const displayValue = ref(props.value);
let animationFrame: number | undefined;

watch(
  () => props.value,
  (next, prev) => {
    if (animationFrame) cancelAnimationFrame(animationFrame);

    const nextNum = typeof next === 'number' ? next : parseInt(String(next ?? '').replace(/[^0-9]/g, ''), 10);
    const prevNum = typeof prev === 'number' ? prev : parseInt(String(prev ?? '').replace(/[^0-9]/g, ''), 10);

    if (isNaN(nextNum) || isNaN(prevNum) || nextNum === prevNum) {
      displayValue.value = next;
      return;
    }

    const duration = 600;
    const start = performance.now();
    const diff = nextNum - prevNum;

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(prevNum + diff * eased);
      displayValue.value = typeof next === 'string' ? current.toLocaleString() : current;
      if (progress < 1) animationFrame = requestAnimationFrame(step);
      else displayValue.value = next;
    };

    animationFrame = requestAnimationFrame(step);
  },
  { immediate: true }
);
</script>

<template>
  <div class="glass-surface glass-frost rounded-2xl p-5 relative overflow-hidden">
    <span class="glass-sheen" aria-hidden="true"></span>
    <div class="absolute -top-14 -right-14 w-40 h-40 rounded-full bg-accent/10 blur-2xl pointer-events-none"></div>

    <div class="relative flex flex-col h-full">
      <p class="text-xs uppercase tracking-[0.12em] text-muted mb-2">{{ label }}</p>

      <template v-if="loading">
        <Skeleton w="w-24" h="h-8" class="mb-2" />
        <Skeleton w="w-16" h="h-3" />
      </template>
      <template v-else>
        <div class="flex items-baseline gap-2 flex-wrap">
          <p class="font-display text-display-md tabular-nums" :class="accent ? 'text-accent' : 'text-fg'">
            {{ displayValue }}
          </p>
          <span
            v-if="delta"
            :class="['text-xs font-medium rounded-full px-2 py-0.5 shrink-0', deltaClasses[delta.tone ?? 'neutral']]"
          >
            {{ delta.value }}
          </span>
        </div>
        <!-- hint is inline after value, not a separate line, to prevent tile height variation -->
        <p v-if="hint" class="mt-1 text-xs text-muted whitespace-nowrap overflow-hidden text-ellipsis">{{ hint }}</p>
      </template>
    </div>
  </div>
</template>
