import tailwindcssPremeui from 'tailwindcss-primeui';

/**
 * tailwind.config.js — Tailwind theme extension for the "liquid glass"
 * design system.
 *
 * Colours are not literal hex values here: `bg`, `fg`, `muted`, `accent`,
 * `accent-2` and `accent-fg` are wired to the `--x-rgb` CSS custom
 * properties defined in `src/assets/main.css`, using the
 * `rgb(var(--x-rgb) / <alpha-value>)` pattern. Tailwind substitutes
 * `<alpha-value>` with whatever opacity modifier is used in a class
 * (`bg-fg/5`, `text-accent/80`, …), so every one of those colours supports
 * opacity modifiers out of the box while still flipping between light and
 * dark values automatically (the CSS variables themselves change under
 * `html.dark`, see `main.css`).
 *
 * `glass-tint`, `glass-border` and `popover-bg` are plain `var(--x)`
 * references instead, because their source tokens already bake in their own
 * alpha channel (e.g. `rgb(255 255 255 / 0.6)`) and are always used as a
 * whole fill rather than with a Tailwind opacity modifier.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  darkMode: 'selector',
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core surface + text tokens, opacity-modifier aware.
        bg: 'rgb(var(--bg-rgb) / <alpha-value>)',
        fg: 'rgb(var(--fg-rgb) / <alpha-value>)',
        muted: 'rgb(var(--muted-rgb) / <alpha-value>)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        'accent-2': 'rgb(var(--accent-2-rgb) / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-fg-rgb) / <alpha-value>)',

        // Glass fills. These already carry their own alpha, so they are
        // plain `var()` references rather than `<alpha-value>` colours.
        'glass-tint': 'var(--glass-tint)',
        'glass-border': 'var(--glass-border)',
        'popover-bg': 'var(--popover-bg)',

        // Status tones used by StatusPill and inline banners.
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',

        // Legacy aliases so pages that predate the redesign keep compiling
        // and rendering with the same visual intent as before.
        'app-bg': 'var(--app-bg)',
        primary: 'var(--primary)',
        'purple-light': '#eae6fe',
        shadow: 'var(--shadow)',
      },
      fontFamily: {
        // Body copy: Inter var, self-hosted (see the @font-face in main.css).
        sans: ['Inter var', 'sans-serif'],
        // Headings, big numerals and the logo wordmark.
        display: ['Space Grotesk Variable', 'Inter var', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Fluid display sizes used by hero headings and large stat values.
        // Each clamps between a mobile floor and a viewport-scaled ceiling
        // so headings shrink gracefully on narrow screens without a
        // separate breakpoint override.
        'display-xl': ['clamp(44px, 7vw, 88px)', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
        'display-lg': ['clamp(32px, 4.5vw, 52px)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-md': ['clamp(26px, 3.2vw, 38px)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
      },
      keyframes: {
        // Ambient backdrop orb drift (`AmbientBackdrop.vue`), 22-28s per
        // orb. Kept here so both orbs can share one keyframe definition at
        // different durations/delays instead of duplicating the animation.
        drift: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '33%': { transform: 'translate(60px, -30px)' },
          '66%': { transform: 'translate(-40px, 40px)' },
        },
      },
      animation: {
        drift: 'drift 26s var(--ease-out-expo, ease-in-out) infinite',
      },
    },
  },
  plugins: [tailwindcssPremeui],
};
