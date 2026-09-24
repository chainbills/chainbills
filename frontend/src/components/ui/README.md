# `src/components/ui/`

The "liquid glass" UI primitive library: every low-level building block later
briefs compose into pages. Import from the barrel (`@/components/ui`) rather
than individual files. Every component below also carries its own doc block
in `<script setup>` with the full prop/slot/event list — this file is the map,
not the reference.

Dev-only gallery: `/_ui` (`src/views/UiGalleryView.vue`, registered only when
`import.meta.env.DEV`) renders every primitive in every state, in both
themes, at both 360px and 1440px. Open it after changing any of these files.

## Layout and structure

| Component             | Purpose                                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AmbientBackdrop.vue` | The fixed, full-viewport glow-and-orbs layer behind every page. Mounted once in `App.vue`.                                                         |
| `GlassCard.vue`       | The base glass panel (`glass-surface` + one blur recipe + sheen). Every card in the app should be built from this rather than a hand-rolled `div`. |
| `SectionHeader.vue`   | Eyebrow + title (+ optional accent tail) + description + right-side actions, used above most page sections.                                        |
| `KeyValueList.vue`    | Label-left/value-right definition list for detail panels, with a scoped slot per row for rich values.                                              |

## Data display

| Component           | Purpose                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `StatTile.vue`      | A single labelled statistic with a loading skeleton state and an optional delta badge.    |
| `ChainBadge.vue`    | Chain logo + name, tinted by the chain's own `brandColor`; optional network tag.          |
| `NetworkPill.vue`   | Standalone "Mainnet"/"Testnet" tag (also used inside `ChainBadge`).                       |
| `TokenAmount.vue`   | Token logo + formatted amount + symbol, from either a raw `bigint` or a `TokenAndAmount`. |
| `AddressChip.vue`   | Truncated monospace address/id with copy-to-clipboard and an explorer link.               |
| `PayableAvatar.vue` | Deterministic gradient "avatar" hashed from a payable's id — no image storage involved.   |

## Status and controls

| Component           | Purpose                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `StatusPill.vue`    | Tone-coded status label (`success`/`warning`/`danger`/`info`/`neutral`/`accent`), optionally pulsing.                   |
| `IconChip.vue`      | Small tinted rounded square holding an icon (activity rows, toasts, stepper meta).                                      |
| `FilterChips.vue`   | Horizontally scrolling chip row, single- or multi-select, with an optional count per chip.                              |
| `SegmentedTabs.vue` | Keyboard-accessible pill segmented control (`role="tablist"`), for view switches that don't need PrimeVue Tabs' panels. |
| `SearchInput.vue`   | Glass search field with a clear button and the `/` shortcut to focus it, debounced `update:modelValue`.                 |

## Async states

| Component        | Purpose                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| `Skeleton.vue`   | Shimmering placeholder block — the loading state for any async region. |
| `EmptyState.vue` | Icon + title + description + action — the "nothing here yet" state.    |
| `ErrorState.vue` | Message + Retry button — the "something went wrong" state.             |

Every data-driven region in the app should have all three: `Skeleton` while
loading, `EmptyState` once loaded with nothing to show, `ErrorState` (with a
working `@retry`) if the load failed.

## Progress

| Component               | Purpose                                                                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Stepper.vue`           | Vertical or horizontal step list for transaction flows, with per-step status, optional meta slot and rotating hints. Purely presentational — brief 03's transaction-flow engine supplies the data. |
| `InFlightIndicator.vue` | Ping dot + staggered bouncing dots, used inside active `Stepper` steps and other in-progress states.                                                                                               |

## Other

| Component    | Purpose                                                                         |
| ------------ | ------------------------------------------------------------------------------- |
| `QrCode.vue` | Theme-coloured SVG QR code for a payable's pay link (via the `qrcode` package). |

## Conventions

- Every component is a typed `<script setup lang="ts">` SFC with a doc block
  describing its purpose, props, slots and events.
- Colour comes from the design tokens (`bg-fg/5`, `text-accent`, `bg-success/15`, …)
  defined in `src/assets/main.css` — never a hardcoded hex value — so every
  component works in both themes automatically.
- Components that read live state (theme, clipboard, `IntersectionObserver`)
  clean up after themselves (`onUnmounted`/`clearInterval`) rather than
  leaking timers or listeners.
