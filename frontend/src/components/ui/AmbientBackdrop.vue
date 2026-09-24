<script setup lang="ts">
/**
 * src/components/ui/AmbientBackdrop.vue — the fixed, full-viewport ambient
 * layer behind every page.
 *
 * Mounted once, at the very top of `App.vue`, behind the router view. It has
 * no props, slots or events: it is a purely decorative layer that reads only
 * the current theme's CSS custom properties (`--accent`, `--accent-2`),
 * which already flip between light and dark automatically.
 *
 * Structure (back to front):
 *  1. two radial "wash" gradients (accent near the top, accent-2 near the
 *     bottom right) that tint the page background without needing a solid
 *     colour fill;
 *  2. two large blurred orbs that slowly drift along an ease-in-out loop
 *     (22s and 28s, so they fall in and out of phase with each other) —
 *     the drift keyframes live in `tailwind.config.js` (`animate-drift`);
 *  3. a faint inline-SVG noise texture, at 3% opacity, breaking up any banding
 *     in the blurred gradients.
 *
 * The whole layer sits at `-z-10` with `pointer-events-none`, so it never
 * intercepts clicks or sits above real content, and it is hidden from
 * assistive tech (`aria-hidden`) since it carries no information. Under
 * `prefers-reduced-motion: reduce` the orbs are pinned in place — Tailwind's
 * `motion-reduce:` variant swaps the `animate-drift` class for `animate-none`
 * on each orb.
 */
</script>

<template>
  <div class="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
    <!-- Top wash: a soft accent-coloured glow anchored to the top edge. -->
    <div
      class="absolute inset-x-0 top-0 h-[60vh]"
      style="background: radial-gradient(ellipse 80% 60% at 50% 0%, rgb(var(--accent-rgb) / 0.14), transparent 60%)"
    ></div>

    <!-- Bottom-right wash: a secondary accent-2 (teal/violet) glow. -->
    <div
      class="absolute inset-x-0 bottom-0 h-[60vh]"
      style="
        background: radial-gradient(ellipse 60% 50% at 100% 100%, rgb(var(--accent-2-rgb) / 0.11), transparent 60%);
      "
    ></div>

    <!-- Drifting orb 1: accent-coloured, slower 28s loop. -->
    <div
      class="absolute top-[-10%] left-[8%] w-[520px] h-[520px] rounded-full blur-3xl opacity-40 motion-reduce:animate-none"
      style="
        background: radial-gradient(circle, rgb(var(--accent-rgb) / 0.55), transparent 70%);
        animation: drift 28s var(--ease-out-expo) infinite;
      "
    ></div>

    <!-- Drifting orb 2: accent-2-coloured, faster 22s loop so the pair falls out of sync. -->
    <div
      class="absolute bottom-[-15%] right-[6%] w-[520px] h-[520px] rounded-full blur-3xl opacity-40 motion-reduce:animate-none"
      style="
        background: radial-gradient(circle, rgb(var(--accent-2-rgb) / 0.5), transparent 70%);
        animation: drift 22s var(--ease-out-expo) infinite reverse;
      "
    ></div>

    <!-- Noise overlay: a tiled inline-SVG fractal-noise texture at very low
         opacity, breaking up banding in the blurred gradients above. -->
    <div
      class="absolute inset-0 opacity-[0.03]"
      style="
        background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>');
      "
    ></div>
  </div>
</template>
