<script setup lang="ts">
/**
 * src/components/ui/GlassCard.vue — the base glass panel used for every
 * card, section and focal widget in the app.
 *
 * Renders the standard glass structure from
 * `frontend/docs/redesign/reference/design-language.md` §3: an outer
 * `glass-surface` element carrying one of the three blur recipes, a
 * `glass-sheen` overlay for the top highlight, and a `relative` wrapper so
 * slotted content paints above the sheen.
 *
 * Usage:
 * ```vue
 * <GlassCard variant="frost" hoverable>
 *   <template #default>...</template>
 * </GlassCard>
 * ```
 */
withDefaults(
  defineProps<{
    /** Which blur recipe to use. `frost` (default) is the general-purpose
     *  card blur. `refract` adds the SVG liquid-lens filter and is reserved
     *  for a page's one or two focal panels (hero, pay widget) — using it
     *  everywhere would make the displacement filter's cost add up.
     *  `dense` is a less transparent fill meant for data tables and long
     *  lists, where stacking many glass panels would otherwise compound
     *  into mush. */
    variant?: 'frost' | 'refract' | 'dense';
    /** Tailwind padding classes applied to the inner content wrapper.
     *  Defaults to the standard card padding from the design language. */
    padding?: string;
    /** When true, adds `.glass-hover-lift` so the card lifts 2px on hover.
     *  Only set this on cards that are themselves clickable (e.g. wrapped in
     *  a `<router-link>`), not on static display panels. */
    hoverable?: boolean;
    /** The root element/component to render as, e.g. `'a'` or `router-link`
     *  when the whole card is a link. Defaults to a plain `div`. */
    as?: string | object;
  }>(),
  {
    variant: 'frost',
    padding: 'p-5 sm:p-6',
    hoverable: false,
    as: 'div',
  }
);
</script>

<template>
  <component
    :is="as"
    :class="[
      'glass-surface rounded-2xl overflow-hidden',
      variant === 'frost' ? 'glass-frost' : variant === 'refract' ? 'glass-refract' : 'glass-dense',
      hoverable && 'glass-hover-lift',
    ]"
  >
    <!-- Top highlight. Sits behind the content wrapper (z-index 0) and never
         intercepts pointer events. -->
    <span class="glass-sheen" aria-hidden="true"></span>
    <div :class="['relative', padding]">
      <slot />
    </div>
  </component>
</template>
