<script setup lang="ts">
/**
 * src/components/ui/Skeleton.vue — a shimmering placeholder block used for
 * every loading state (design-language.md §7.4). Replaces the
 * `vue3-loading-shimmer` package in new code; that package stays only for
 * `components/Shimmer.vue`, used by pages this brief doesn't redesign.
 *
 * Usage: `<Skeleton w="w-24" h="h-4" />`, `<Skeleton w="w-full" h="h-10" rounded="rounded-2xl" />`
 */
withDefaults(
  defineProps<{
    /** Tailwind width class, e.g. `'w-24'` or `'w-full'`. */
    w?: string;
    /** Tailwind height class, e.g. `'h-4'`. */
    h?: string;
    /** Tailwind border-radius class. Defaults to `'rounded-xl'`. */
    rounded?: string;
  }>(),
  { w: 'w-full', h: 'h-4', rounded: 'rounded-xl' }
);
</script>

<template>
  <div
    :class="[
      w,
      h,
      rounded,
      'animate-pulse bg-gradient-to-r from-fg/[0.06] via-fg/[0.12] to-fg/[0.06] bg-[length:200%_100%]',
    ]"
    aria-hidden="true"
  ></div>
</template>
