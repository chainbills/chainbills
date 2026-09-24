# Chainbills Design Language

This document defines the Chainbills visual language: "liquid glass". Every screen follows these recipes. The values here are the starting point for brief 00; brief 00 turns them into tokens, utilities and components, and later briefs consume those instead of copying snippets.

Chainbills uses Vue 3 + Tailwind CSS 3 + PrimeVue 4. Snippets are Tailwind 3 syntax or plain CSS. Motion uses Vue `<Transition>`, CSS keyframes and the `v-reveal` directive.

---

## 1. Principles

1. **Depth through translucency.** Content sits on frosted glass panels floating over a softly lit, slowly moving backdrop. Surfaces use hairline borders and gentle shadows instead of heavy fills.
2. **One accent, many chains.** Brand blue is the only UI accent. Each chain has its own brand colour, used only for chain identity (badges, rails, avatars).
3. **Numbers are heroes.** Amounts, counts and stats use the display face, tabular numerals and generous size.
4. **Always say what is happening.** Every wait shows a named step, a live indicator and plain-language hints.
5. **Equal light and dark.** Both themes are first-class. Contrast meets WCAG AA for text.
6. **Respect the user.** `prefers-reduced-motion` stops ambient and decorative motion. `prefers-reduced-transparency` swaps glass for solid surfaces.

---

## 2. Tokens

```css
:root {
  --bg: #f6f8fb; --fg: #0b1220; --muted: #5b6474;
  --accent: #057ec5; --accent-fg: #ffffff; --accent-2: #7c5cff;
  --glass-tint: rgb(255 255 255 / 0.6);
  --glass-border: rgb(11 18 32 / 0.08);
  --glass-sheen: linear-gradient(180deg, rgb(255 255 255 / 0.35), rgb(255 255 255 / 0));
  --popover-bg: rgb(255 255 255 / 0.92);
  --shadow-glass: 0 8px 32px rgb(15 23 42 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.5);
  --ease-out-expo: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-spring: cubic-bezier(0.2, 0.8, 0.2, 1);
}
html.dark {
  --bg: #07090d; --fg: #f3f6fb; --muted: #98a2b3;
  --accent: #38a8ec; --accent-fg: #04121c; --accent-2: #8b7bff;
  --glass-tint: rgb(17 22 30 / 0.55);
  --glass-border: rgb(255 255 255 / 0.08);
  --glass-sheen: linear-gradient(180deg, rgb(255 255 255 / 0.06), transparent);
  --popover-bg: rgb(14 18 25 / 0.94);
  --shadow-glass: 0 8px 32px rgb(0 0 0 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.06);
}
@media (prefers-reduced-transparency: reduce) {
  :root { --glass-tint: #ffffff; } html.dark { --glass-tint: #11161e; }
}
```

Status colours:

| Status | Light text | Dark text |
| --- | --- | --- |
| success | emerald-700 | emerald-300 |
| warning | amber-700 | amber-300 |
| danger | rose-700 | rose-300 |
| info | sky-700 | sky-300 |

Status backgrounds use the `/15` tint of the same hue, and rings use `/30`.

**Radii:**

| Radius | Used for |
| --- | --- |
| `rounded-3xl` | sections and hero panels |
| `rounded-2xl` | cards, tables and dialogs |
| `rounded-xl` | inputs and menu items |
| `rounded-full` | buttons, pills, chips and tabs |

**Borders:** always hairline alpha (`border-glass-border`). Dividers inside cards are `divide-fg/5`.

---

## 3. Glass surfaces

```css
.glass-surface { position: relative; background: var(--glass-tint); border: 1px solid var(--glass-border); isolation: isolate; }
.glass-frost   { backdrop-filter: blur(20px) saturate(180%); }                          /* default for cards */
.glass-refract { backdrop-filter: blur(10px) saturate(180%) url('#glass-displace'); }   /* focal panels only: hero, pay widget */
.glass-dense   { backdrop-filter: blur(10px) saturate(160%);
                 background: color-mix(in srgb, var(--glass-tint) 76%, var(--bg) 24%); } /* data tables, long lists */
.glass-sheen   { position: absolute; inset: 0; border-radius: inherit; background: var(--glass-sheen); pointer-events: none; z-index: 0; }
.glass-popover { background: var(--popover-bg); border: 1px solid var(--glass-border);
                 backdrop-filter: blur(24px) saturate(180%); box-shadow: var(--shadow-glass); } /* menus, dialogs, toasts */
.glass-hover-lift { transition: transform 220ms var(--ease-spring), box-shadow 220ms; }
.glass-hover-lift:hover { transform: translateY(-2px); }
@supports not (backdrop-filter: blur(1px)) { .glass-surface { background: var(--bg); } }
```

The refraction filter is mounted once at the app root:

```html
<svg width="0" height="0" aria-hidden="true" style="position:absolute">
  <filter id="glass-displace">
    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" />
    <feGaussianBlur stdDeviation="1.5" />
    <feDisplacementMap in="SourceGraphic" scale="28" xChannelSelector="R" yChannelSelector="G" />
  </filter>
</svg>
```

Card structure: an outer `glass-surface glass-frost rounded-2xl overflow-hidden`, then `<span class="glass-sheen" aria-hidden="true">`, then content in `relative p-5 sm:p-6`.

**Emphasis glows** (decorative, `pointer-events-none`):
- **Corner orb:** `absolute -top-14 -right-14 w-40 h-40 rounded-full bg-accent/10 blur-2xl`.
- **Top wash:** `radial-gradient(ellipse 80% 60% at 50% 0%, rgb(var(--accent-rgb) / 0.22), transparent 60%)`.
- **Deep stat shadow:**
  - light: `shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_16px_44px_rgba(15,23,42,0.16)]`
  - dark: `shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_18px_48px_rgba(0,0,0,0.32)]`

---

## 4. Ambient backdrop

A fixed full-viewport layer behind all content:

- Radial wash 1: `radial-gradient(ellipse 80% 60% at 50% 0%, accent / 0.10 (light 0.18), transparent 60%)`.
- Radial wash 2: `radial-gradient(ellipse 60% 50% at 100% 100%, accent-2 / 0.10 (light 0.12), transparent 60%)`.
- Two orbs (`w-[520px] h-[520px] rounded-full blur-3xl opacity-40`, radial accent and accent-2 fills) drifting on 22–28 s ease-in-out keyframes (`translate(0,0) → (60px,-30px) → (-40px,40px) → (0,0)`).
- An optional noise texture at 3–4 % opacity.
- Motion stops under reduced motion.

---

## 5. Typography

- **Body:** Inter var.
- **Display:** Space Grotesk variable (`font-display`), used for headings, big numbers and the logo wordmark.
- **Fluid sizes:**
  - `display-xl: clamp(44px, 7vw, 88px) / 0.95 / -0.03em`
  - `display-lg: clamp(32px, 4.5vw, 52px) / 1.05 / -0.02em`
  - `display-md: clamp(26px, 3.2vw, 38px) / 1.1 / -0.02em`
- **Eyebrow:** `text-[11px] font-semibold uppercase tracking-[0.22em] text-accent`.
- **Label:** `text-xs uppercase tracking-[0.12em] text-muted`.
- **Mono:** ids, addresses and hashes use `font-mono text-[12px]`.
- **Numbers:** `tabular-nums` wherever numbers align or update.
- **Accent tail:** in section titles the second phrase takes the accent colour ("One link. <span class="text-accent">Every chain.</span>").

---

## 6. Motion

| Motion | Spec |
| --- | --- |
| Entrance | `opacity 0 → 1`, `translateY(30px) → 0`, 650 ms `--ease-out-expo`, staggered 50 / 150 / 250 ms |
| Scroll reveal (`v-reveal`) | `translateY(24px) → 0`, 600 ms, once, root margin -80 px |
| Hover | lift 2 px (cards); an arrow inside buttons nudges 2 px right |
| Rail sweep | a gradient light (`linear-gradient(90deg, transparent, accent/35%, transparent)`) slides across a track, `translateX(-100%) → 120%`, 4 s linear, infinite. Used for "payment travelling between chains". |
| Pulse | dashed connectors pulse opacity between 0.25 and 0.6 over 2 s; live dots use `animate-ping` |
| Shimmer text | a gradient text with `background-size: 200% 200%` animated over 3 s. Used at most once per page (hero). |
| Theme switch | `document.startViewTransition` cross-fade, 240 ms |

---

## 7. Components

### 7.1 Buttons

| Variant | Style |
| --- | --- |
| Primary | `rounded-full bg-accent text-accent-fg px-5 py-2.5 font-medium shadow-lg shadow-accent/30`, with a trailing arrow that nudges on hover |
| Secondary | glass pill: `rounded-full border border-glass-border bg-glass-tint backdrop-blur` |
| Ghost | text + icon, `hover:bg-fg/5` |
| Danger | rose tone, used only for close-payable and destructive confirms |

Loading state: an inline spinner (`w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent`) with the label kept.

### 7.2 Pills, chips, tabs

- **Status pill:** `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1` plus the tone classes. Live or pending states carry a pulsing dot.
- **Filter chip:** `rounded-full px-3 py-1.5 text-[11px] uppercase tracking-wider font-semibold border`; active `bg-fg text-bg border-fg`; optional mono count bubble; the chip row scrolls horizontally on mobile.
- **Segmented tabs:** `inline-flex rounded-full border border-glass-border bg-bg/30 p-1`; active segment `bg-fg text-bg`; counts shown in a small mono bubble.
- **Network pill:** Mainnet (emerald) or Testnet (amber).
- **Chain badge:** chain logo + name on a `/12` tint of the chain brand colour. The runtime tag (`EVM` / `SVM`) is optional.

### 7.3 Identity

- **Address chip:** `rounded-full border border-glass-border bg-bg/30 px-2.5 py-1 font-mono text-xs` with the value truncated to `0x1234…abcd`. Copy (icon swaps to a check for 1.5 s) and explorer icons are revealed on hover on desktop and always visible on touch. Optional internal link.
- **Payable avatar:** a deterministic gradient from the id hash. Two hues `h1`, `h2` come from the hash, rendered as `radial-gradient(120% 90% at 20% 10%, hsl(h1 75% 70%), transparent 60%), radial-gradient(110% 80% at 80% 90%, hsl(h2 75% 55%), transparent 60%), linear-gradient(135deg, hsl(h1 60% 45%), hsl(h2 60% 35%))`.

### 7.4 Data display

- **Stat tile:** label (`text-xs uppercase tracking-[0.12em] text-muted`) over value (`font-display text-display-md tabular-nums`, optionally accent) over hint, plus a corner orb.
- **Activity row:**
  - a tinted icon chip (`w-9 h-9 rounded-2xl`, tone per activity type);
  - a title line ("Payment received") with a chain badge;
  - a sub line with mono ids and addresses;
  - on the right, the amount (`tabular-nums font-semibold`) over the relative time (`text-[10px] uppercase tracking-wider text-muted`).
- **Data table:**
  - wrapper `glass-surface glass-dense rounded-2xl`;
  - sticky header (`bg-bg/80 backdrop-blur text-xs uppercase tracking-wider text-muted`);
  - cells `px-4 py-3.5`, rows `hover:bg-fg/[0.03]`;
  - clicking a row expands a detail panel (`bg-fg/[0.015]`) laid out as a key–value list;
  - pending rows carry a faint accent tint and a left rail (`absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full bg-accent`).
  - On mobile, tables collapse to stacked activity rows.
- **Key–value list:** label left (muted), value right (mono where relevant), stacked on narrow screens.
- **Skeleton:** `animate-pulse rounded-xl bg-fg/5`, with shimmer bars `bg-gradient-to-r from-fg/[0.06] via-fg/[0.12] to-fg/[0.06]`.
- **Empty state:** muted icon in a glass circle, a title, one sentence and one action.

### 7.5 Progress

- **Stepper:**
  - vertical by default (a horizontal variant exists for wide headers);
  - node states: done (accent fill + check), active (accent ring + glow + in-flight dots), waiting (amber ring + ping), upcoming (hairline + muted), skipped (dashed + muted), failed (rose + cross);
  - connectors are 2 px lines, accent-filled up to the active step;
  - each step shows a title and description, optional meta (tx link, chain badge) and, while active or waiting, **rotating hints** that fade every 2.4 s;
  - on mobile a horizontal stepper collapses to "Step N of M" plus a segmented bar.
- **In-flight indicator:** a ping dot plus three bouncing dots staggered by 150 ms.
- **Approval gate:** an explainer row shown before any ERC-20 approval, stating which token, how much and why, so an approval never happens silently.

### 7.6 Overlays

- **Dialog:**
  - backdrop `bg-black/35 backdrop-blur-sm`;
  - panel `glass-popover rounded-2xl`;
  - on mobile it becomes a bottom sheet (`items-end md:items-center`, top radius only).
- **Toast:** `glass-popover rounded-2xl p-3`, severity icon chip, title and detail, an optional action link ("View on explorer"), and a 2 px countdown bar. At most three are stacked.
- **Menus and popovers:** `glass-popover rounded-2xl p-2`, entering with `scale(0.96) translateY(-4px) → none`.

### 7.7 Navigation

- **Header:**
  - sticky `h-16` inside `max-w-7xl`;
  - a glass layer (`backdrop-blur border-b border-glass-border`) that fades in after the page scrolls past 8 px;
  - links hover to the accent colour, and the active link is accent-coloured;
  - the wallet pill shows the chain logo + truncated address.
- **Mobile drawer:** a right-side glass drawer holding the same links, the wallet pill and the theme control.

---

## 8. Chain identity

| Chain | Brand colour | Network |
| --- | --- | --- |
| Sepolia | `#627EEA` | testnet |
| Arc Testnet | from official Arc branding | testnet |
| MegaETH | from official MegaETH branding | mainnet |
| Solana Devnet | `#9945FF` | testnet |

Chain colours appear only in chain badges, cross-chain rails and chain-scoped stat accents, never as button or text accents.

---

## 9. Voice

Short, concrete and calm:

- Use "Paying 25 USDC from Sepolia to a payable on Arc Testnet", not "Processing…".
- Name the actor: "Your wallet", "Circle", "The Chainbills relayer", "Arc Testnet".
- Give time expectations: "usually 1–3 minutes".
- For errors, say what happened and what to do next.
