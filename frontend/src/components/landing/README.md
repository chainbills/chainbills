# `src/components/landing/`

The ten sections that make up the landing page (`src/views/HomeView.vue`,
route `/`), plus the one file every one of them reads its numbers and sample
activity from. The page performs **no on-chain or server reads** — every
statistic, chain fact used for identity (name, brand colour, network tier)
and sample activity row is either a static constant from `src/schemas/*` or
a hand-maintained placeholder here.

## Files

| File                     | Purpose                                                                                                                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `placeholders.ts`        | The single source of every number and sample activity shown on the page: `landingStats` (numbers strip), `landingActivitySamples` (activity ticker), `heroReceipts`/`heroReceiptsStartingCount` (hero visual). Edit this file to change what the landing page shows. |
| `LandingHero.vue`        | Section 1: eyebrow pill, shimmer headline, sub-headline, CTAs, trust row of chain badges, and the `ChainConstellation` visual.                                                                                                                                       |
| `ChainConstellation.vue` | The hero's animated SVG visual: three chain nodes on rails converging on a central payable card that cycles through sample receipts. No raster images; static under reduced motion.                                                                                  |
| `NumbersStrip.vue`       | Section 2: a `StatTile` row from `landingStats`, with a link to `/scan`.                                                                                                                                                                                             |
| `HowItWorks.vue`         | Section 3: the four-step create → share → pay → withdraw flow, one glass card per step with a tiny mock UI, arrow chips between cards on wide screens.                                                                                                               |
| `CrossChainDeepDive.vue` | Section 4: a two-column explanation of the CCTP burn → attest → relay → credit flow and payable-settings sync, paired with `CrossChainRoute` and a looping `Stepper`.                                                                                                |
| `CrossChainRoute.vue`    | A horizontal source-chain → burn → attest → relay → destination-chain diagram. A landing-only illustration used by `CrossChainDeepDive`.                                                   |
| `FeaturesBento.vue`      | Section 5: an eight-card bento grid of what a payable can do, varied cell sizes, hover lift and corner glows.                                                                                                                                                        |
| `ActivityTicker.vue`     | Section 6: a slow vertical marquee of `landingActivitySamples`, paused on hover and under reduced motion.                                                                                                                                                            |
| `SupportedChains.vue`    | Section 7: one card per deployed chain with its messaging capabilities (Wormhole/CCTP), plus a Solana "coming soon" card.                                                                                                                                            |
| `BuildersTrust.vue`      | Section 8: non-custodial/cbChainId/Scan/fee trust points, each backed by a real contract function snippet, plus a GitHub link.                                                                                                                                       |
| `FaqSection.vue`         | Section 9: a glass-restyled PrimeVue `Accordion` answering the most common visitor questions.                                                                                                                                                                        |
| `ClosingCta.vue`         | Section 10: two side-by-side glass cards ("Start receiving" → `/start`, "Pay or explore" → `/scan").                                                                                                                                                                 |

## Conventions

- Every section component is self-contained: it imports what it needs from
  `src/components/ui/*` and `src/schemas/*`, and takes no props — `HomeView.vue`
  only composes them in order.
- Any timer-driven animation (the hero's rotating receipt, the deep dive's
  looping stepper, the activity ticker's marquee, the rail sweeps) checks
  `window.matchMedia('(prefers-reduced-motion: reduce)')` once on setup and
  either skips starting the timer/animation or renders a single static frame.
- Chain facts (name, brand colour, network tier, logo) always come from
  `src/schemas/chain.ts`'s constants (`chainNamesToChains`, `getChainLogo`),
  never hand-typed, so the landing page can never drift from the rest of the
  app's chain data.
- Numbers and sample activity rows always come from `placeholders.ts` —
  no component defines its own inline stat or sample row.
