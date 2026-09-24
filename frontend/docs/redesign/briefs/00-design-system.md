# Brief 00 — Design System, Glass Primitives and App Shell

**Wave:** 1 (runs in parallel with brief 01) · **Depends on:** nothing · **Blocks:** briefs 02–06

## Read first

1. `frontend/docs/redesign/README.md`: global rules. Code comments are mandatory and must follow the comment style defined there.
2. `frontend/docs/redesign/reference/design-language.md`: the visual language to implement.
3. `frontend/CLAUDE.md`, `frontend/src/main.ts`, `frontend/src/assets/main.css`, `frontend/tailwind.config.js`, `frontend/src/stores/theme.ts`, `frontend/src/App.vue`, `frontend/src/components/{Header,Sidebar,Footer,ThemeMenu,SignInButton,Shimmer,TableLoader}.vue`.

## Goal

Give Chainbills a cohesive "liquid glass" design system that every later brief builds on:

- tokens,
- glass surface recipes,
- an ambient backdrop,
- typography,
- motion utilities,
- a restyled PrimeVue theme,
- a library of Vue UI primitives,
- a rebuilt app shell (header, mobile drawer, footer, toasts).

Page-level redesigns are **out of scope**. Pages may look inconsistent until later briefs land. Only make the minimal edits needed so existing pages still render correctly on the new backdrop.

## Current state

- Tailwind 3 with a few colours (`app-bg`, `primary #057ec5`, `purple-light`, `shadow`). Dark mode is `.dark` on `<html>` (`darkModeSelector: '.dark'` in the PrimeVue config; `darkMode: 'selector'` in Tailwind).
- PrimeVue 4 uses the Aura preset via `definePreset` in `main.ts`, with a custom primary palette.
- AOS is initialised in `main.ts` and used by `data-aos` attributes in `HomeView.vue`.
- Inter var is self-hosted at `/assets/Inter-var.ttf`.
- The header is a plain fixed bar with a shadow. The sidebar is a PrimeVue `Drawer`. The toast template lives in `App.vue`.

## Requirements

### 1. Tokens (`src/assets/main.css` + `tailwind.config.js`)

Keep the `.dark` class mechanism. Define CSS variables for light (`:root`) and dark (`html.dark`):

| Token | Purpose | Light (suggested) | Dark (suggested) |
| --- | --- | --- | --- |
| `--bg` | page background | `#f6f8fb` | `#07090d` |
| `--fg` | primary text | `#0b1220` | `#f3f6fb` |
| `--muted` | secondary text | `#5b6474` | `#98a2b3` |
| `--accent` | brand | `#057ec5` | `#38a8ec` |
| `--accent-fg` | text on accent | `#ffffff` | `#04121c` |
| `--accent-2` | secondary glow (teal/violet) | `#7c5cff` | `#8b7bff` |
| `--glass-tint` | glass fill | `rgb(255 255 255 / 0.6)` | `rgb(17 22 30 / 0.55)` |
| `--glass-border` | hairline | `rgb(11 18 32 / 0.08)` | `rgb(255 255 255 / 0.08)` |
| `--glass-sheen` | top highlight | see reference | see reference |
| `--popover-bg` | menus and dialogs | `rgb(255 255 255 / 0.92)` | `rgb(14 18 25 / 0.94)` |
| `--shadow-glass` | elevation | see reference | see reference |
| `--success` / `--warning` / `--danger` / `--info` | status | emerald / amber / rose / sky | lighter variants |

Also:
- Keep `--app-bg`, `--text`, `--shadow` and `--primary` as aliases so existing pages keep working.
- Map every token into `tailwind.config.js` (`colors.bg`, `colors.fg`, `colors.muted`, `colors.accent`, `colors['glass-tint']`, `colors['glass-border']`, …). Use `rgb(var(--x-rgb) / <alpha-value>)`-style channels for `fg`, `bg` and `accent` so opacity modifiers like `bg-fg/5` and `text-accent/80` work.
- Add a `prefers-reduced-transparency: reduce` block that swaps glass tints for solid colours.
- Add chain brand colours to `src/schemas/chain.ts` as a `brandColor` field on `Chain`. Sepolia `#627EEA`. Pick sensible values for Arc Testnet and MegaETH from their official branding, and Solana `#9945FF`. This one additive field is the only change allowed in `schemas/` for this brief.

### 2. Glass utilities

Implement the glass recipes from `design-language.md` §3 as a Tailwind plugin or `@layer components` classes: `.glass-surface`, `.glass-frost`, `.glass-refract`, `.glass-dense`, `.glass-sheen`, `.glass-popover`, `.glass-hover-lift`. Mount the `#glass-displace` SVG filter once in `App.vue`.

Fallback: when `backdrop-filter` is unsupported (`@supports not (backdrop-filter: blur(1px))`), use a solid tint.

### 3. Ambient backdrop

`src/components/ui/AmbientBackdrop.vue`:
- fixed, `-z-10`, `pointer-events-none`;
- two radial washes (accent at the top, accent-2 at the bottom right);
- two blurred orbs drifting on 22–28 s CSS keyframes;
- a subtle noise overlay is optional (inline SVG data URI, 3–4 % opacity);
- orbs are static under `prefers-reduced-motion`.

Mount it in `App.vue`. The body background becomes `var(--bg)`.

### 4. Typography

- Keep Inter var for body text.
- Add a display face for headings and large numerals: **Space Grotesk**, via `@fontsource-variable/space-grotesk`. Expose it as `font-display` in Tailwind.
- Numerals in stats and tables use `tabular-nums`.
- Add Tailwind `fontSize` entries for fluid display sizes (`display-xl: clamp(44px, 7vw, 88px)`, `display-lg: clamp(32px, 4.5vw, 52px)`, `display-md: clamp(26px, 3.2vw, 38px)`).

### 5. Motion

- Easing tokens `--ease-out-expo: cubic-bezier(0.22,1,0.36,1)` and `--ease-spring: cubic-bezier(0.2,0.8,0.2,1)`.
- A `v-reveal` directive (`src/directives/reveal.ts`, registered globally in `main.ts`):
  - IntersectionObserver, triggers once with `rootMargin: '-80px'`;
  - `opacity 0 → 1, translateY(24px) → 0`, 600 ms;
  - optional stagger via `v-reveal="{ delay: 120 }"`;
  - no-op under reduced motion.
- **Remove AOS** (dependency, CSS import and `AOS.init`). Replace `data-aos` usages in `HomeView.vue` with `v-reveal` so the page keeps working. Brief 06 rebuilds that page anyway.
- Theme changes cross-fade via `document.startViewTransition` when available (in `stores/theme.ts`).

### 6. PrimeVue restyle

Update the `definePreset(Aura, …)` in `main.ts`:
- primary palette derived from `#057ec5`;
- surface palette aligned with the tokens;
- rounded (`borderRadius` md 12px, lg 16px, xl 24px);
- buttons `rounded-full`;
- inputs with glass fill and hairline border;
- Dialog, Drawer, Select overlay, Menu and Toast using `--popover-bg` + blur;
- Tabs rendered as segmented pills;
- DataTable transparent, with hairline rows.

Prefer preset tokens and component design tokens. Use `pt`/CSS overrides only where tokens cannot reach. Keep `ripple: true`.

### 7. UI primitives (`src/components/ui/`)

Each is a typed SFC (`<script setup lang="ts">`) with a doc comment block at the top describing its purpose, props, slots and events. Build all of these:

| Component | Purpose |
| --- | --- |
| `GlassCard.vue` | Glass container. Props: `variant: 'frost' \| 'refract' \| 'dense'`, `padding`, `hoverable`, `as`. Includes the sheen span. |
| `SectionHeader.vue` | Eyebrow + title (with an optional accent-coloured tail slot) + description + right-side actions slot. |
| `StatTile.vue` | Label, big value (tabular, display font), optional hint, optional delta, `loading` state with skeleton, corner glow. |
| `ChainBadge.vue` | Chain logo + name, tinted by `chain.brandColor`. Sizes `sm/md`. Optional `network` tag (Mainnet/Testnet). |
| `NetworkPill.vue` | Mainnet/Testnet pill. |
| `TokenAmount.vue` | Token logo + formatted amount + symbol. Props: `token`, `amount` (bigint or `TokenAndAmount`), `chain`, `size`. Uses `formatUnits`. |
| `AddressChip.vue` | Truncated mono address or id. Copy button (check feedback) and explorer link (via `getWalletUrl`). Optional `to` router link for internal pages. Props: `value`, `chain?`, `kind: 'address' \| 'id'`, `to?`. Records analytics on copy. |
| `StatusPill.vue` | Tones `success \| warning \| danger \| info \| neutral \| accent`. Optional pulsing dot. Adapts to light and dark. |
| `IconChip.vue` | Tinted rounded square holding an icon; `tone` prop. |
| `FilterChips.vue` | Horizontal chip group; `v-model` single or multi select; optional count per chip; scrolls on mobile. |
| `SegmentedTabs.vue` | Pill segmented control with `v-model`, keyboard accessible, `role="tablist"`. |
| `SearchInput.vue` | Glass search field with icon, clear button, `/` keyboard shortcut to focus, debounced `update:modelValue`. |
| `EmptyState.vue` | Illustration slot or icon, title, description, action slot. |
| `ErrorState.vue` | Message + Retry button emitting `retry`. |
| `Skeleton.vue` | Shimmer block (`w`, `h`, `rounded`); replaces the `vue3-loading-shimmer` usage in new code. |
| `PayableAvatar.vue` | Deterministic gradient avatar from an id hash (recipe in `design-language.md` §7.3). |
| `Stepper.vue` | Visual step list: vertical (default) and horizontal. Each step has `title`, `description`, `status: 'upcoming' \| 'active' \| 'waiting' \| 'done' \| 'skipped' \| 'failed'`, an optional `meta` slot (tx link, chain badge) and an optional rotating `hints: string[]` shown while the step is active or waiting (fade every 2.4 s). Purely presentational; brief 03 wires it to data. |
| `InFlightIndicator.vue` | Ping dot + three bouncing dots, used inside active steps and waiting states. |
| `KeyValueList.vue` | Definition-list layout for detail panels (label left, value right, stacked on mobile). |
| `QrCode.vue` | Renders a QR for a URL (use the `qrcode` package; SVG output; themed colours). |

Add `src/components/ui/index.ts` re-exporting all of them.

Also add a dev-only gallery route `/_ui` (`src/views/UiGalleryView.vue`) that renders every primitive in each state. Guard it with `import.meta.env.DEV` so it is not registered in production builds. It is the screenshot surface for this brief.

### 8. App shell

**Header** (`Header.vue`):
- sticky, `h-16`, `max-w-7xl`;
- a transparent glass layer that fades in after the page scrolls past 8 px;
- logo on the left; nav **Dashboard · Activity · Scan · Blog**, with the active link in the accent colour;
- wallet pill (`SignInButton` restyled: shows the chain logo + truncated address when connected; the connect CTA is an accent pill);
- theme toggle as a round icon button with a glass popover (light / dark / system);
- the `Scan` link points to `/scan`, which brief 05 creates. Until then it hits the 404 page, which is acceptable.

**Sidebar** (`Sidebar.vue`, mobile): PrimeVue Drawer styled as `glass-popover`, the same links with icons, wallet pill and theme control at the bottom.

**Footer** (`Footer.vue`): glass band with the logo and tagline, link columns (Product: Create payable, Dashboard, Activity, Scan; Resources: Blog, GitHub, Docs if present; Community: X, Discord), supported chains row using `ChainBadge`, and a copyright line.

**Toasts** (`App.vue`): glass popover style. Severity is shown by an `IconChip` plus a thin countdown bar. The "View on Explorer" link is kept.

**Layout:** `main` keeps horizontal padding. Pages own their own max width (`max-w-7xl`). Remove the old `padding-top: 64px` hack if the header becomes sticky rather than fixed; either way, no content may hide under the header.

**`NotFoundView.vue`:** restyle using `EmptyState`.

### 9. Minimal page compatibility

Existing views (`HomeView`, `DashboardView`, `PayView`, etc.) must not break visually. Replace hard-coded `bg-app-bg` backgrounds on tabs and headers with transparent or glass where needed. Do not redesign them.

## Out of scope

- Page redesigns.
- Any store or data logic (brief 01 owns `src/stores/*` except `theme.ts`).
- Routing beyond the dev gallery.

## Acceptance criteria

- [ ] All tokens exist in light and dark and are usable with Tailwind opacity modifiers.
- [ ] The glass classes, ambient backdrop and reduced-motion and reduced-transparency fallbacks work.
- [ ] Space Grotesk loads for `font-display`; AOS is fully removed.
- [ ] Every primitive in the table exists, is typed and documented, and is exported from `components/ui/index.ts`.
- [ ] The `/_ui` gallery shows every primitive in every state in dev.
- [ ] Header, sidebar, footer and toasts are rebuilt, work at 360 px and 1440 px, and have a Scan link.
- [ ] PrimeVue components (Button, Select, InputNumber, Dialog, Drawer, Tabs, DataTable, Toast, ToggleSwitch) look native to the glass system in both themes.
- [ ] `frontend/CLAUDE.md` documents the design tokens, the primitives, the `v-reveal` directive and the gallery route.
- [ ] `npm run type-check` and `npm run build` pass. Screenshots of `/_ui`, `/` and `/dashboard` are attached (desktop and mobile, light and dark).
