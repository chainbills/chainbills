/**
 * src/directives/reveal.ts — the `v-reveal` scroll-entrance directive.
 *
 * Registered globally in `main.ts` as `app.directive('reveal', vReveal)`, so
 * any template can write `v-reveal` or `v-reveal="{ delay: 120 }"` on an
 * element to have it fade and slide up into place the first time it scrolls
 * into view. It replaces the AOS library: AOS shipped its own CSS, its own
 * global `AOS.init()` call and re-scanned the DOM on every route change,
 * whereas this directive is a plain Vue directive with no extra CSS import
 * and no global re-scan.
 *
 * Behaviour:
 *  - a single shared `IntersectionObserver` (module-level, not per element)
 *    watches every element the directive is bound to;
 *  - `rootMargin: '-80px'` means the element must scroll 80px past the
 *    viewport edge before it is considered "visible", so the reveal doesn't
 *    fire the instant an element's edge peeks onto screen;
 *  - once an element intersects, it fades in (`opacity 0 → 1`) and slides up
 *    (`translateY(24px) → 0`) over 600ms, then is unobserved — the reveal
 *    plays at most once per element;
 *  - `v-reveal="{ delay: 120 }"` staggers a group of elements by applying a
 *    CSS `transition-delay` before the fade-in starts;
 *  - under `prefers-reduced-motion: reduce` the directive does nothing at
 *    all: the element keeps its natural opacity/position and never animates.
 */
import type { Directive } from 'vue';

/** Options accepted by `v-reveal="{ ... }"`. Both fields are optional; a bare
 *  `v-reveal` with no value reveals immediately (no stagger) once visible. */
interface RevealOptions {
  /** Milliseconds to wait, after the element becomes visible, before the
   *  fade/slide transition starts. Used to stagger a row of cards or list
   *  items so they don't all reveal in the same frame. */
  delay?: number;
}

/** Whether the user's OS/browser asks for reduced motion. Checked once per
 *  `mounted` call rather than cached, since a user can change this setting
 *  without reloading the page. */
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** One observer shared by every `v-reveal` element in the app. Sharing an
 *  observer (instead of creating one per element) keeps the cost of the
 *  directive constant regardless of how many elements use it. `null` in
 *  environments without `IntersectionObserver` (e.g. server-side rendering),
 *  in which case the directive is a no-op and elements render fully visible. */
const observer: IntersectionObserver | null =
  typeof IntersectionObserver === 'undefined'
    ? null
    : new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const el = entry.target as HTMLElement;
            // Reveal, then stop watching — the animation plays once.
            el.style.opacity = '1';
            el.style.transform = 'none';
            observer!.unobserve(el);
          }
        },
        { rootMargin: '-80px', threshold: 0 }
      );

export const vReveal: Directive<HTMLElement, RevealOptions | undefined> = {
  mounted(el, binding) {
    if (prefersReducedMotion() || !observer) return;

    const delay = binding.value?.delay ?? 0;
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = `opacity 600ms var(--ease-out-expo), transform 600ms var(--ease-out-expo)`;
    if (delay) el.style.transitionDelay = `${delay}ms`;

    observer.observe(el);
  },
};
