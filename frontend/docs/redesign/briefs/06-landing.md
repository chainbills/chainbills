# Brief 06 — Landing Page Rebuild

**Wave:** 2 (runs in parallel with 02 and 03) · **Depends on:** 00 merged

## Read first

1. `frontend/docs/redesign/README.md`: the global rules.
2. `frontend/docs/redesign/reference/design-language.md`. Read all of it, and especially §4 (backdrop), §5 (type), §6 (motion) and §9 (voice).
3. `src/components/ui/README.md`.
4. The current `src/views/HomeView.vue`.

## Goal

Replace the generic landing page with a bold, cross-chain-first story. The page should make a visitor feel within five seconds that Chainbills means **one payment link, payable from any chain, verifiable on-chain**. The page makes **no on-chain or server reads**: numbers, stats and sample activity are static placeholders.

## Positioning

- **Headline direction:** "One link. Paid from any chain." Alternatives to try: "Get paid on any chain.", "Invoices that cross chains.".
- **Sub-headline:** "Create a payable, share one link, and accept crypto from any supported chain. Payments settle on-chain through Circle CCTP and Wormhole, with no custodian in between."
- Keep copy short, concrete and confident. Name the real technology: Circle CCTP, Wormhole, EVM, the chain names.

## Sections, in order

1. **Hero**
   - Eyebrow pill: "Cross-chain payments · Live on {chains}".
   - Display headline: the first line carries the shimmer gradient, which appears only here on the page.
   - Sub-headline.
   - CTAs: "Create a payable" (primary, `/start`) and "Explore Scan" (secondary, `/scan`).
   - A trust row with small chain badges.
   - **Visual (right side, or below on mobile):** an animated SVG "chain constellation".
     - Chain nodes (logos in glass circles, tinted by their brand colours) connect to a central Chainbills payable card through rails.
     - Payment packets travel along the rails using the rail sweep.
     - The central card cycles through "Received 25 USDC from Sepolia" → "Received 0.01 ETH on MegaETH", with a small counter tick.
   - Pure SVG and CSS, no images. Static under reduced motion.
   - Delete `public/assets/home-hero-*.png` once they are unused.
2. **Numbers strip (placeholders).** `StatTile`s showing payables created, payments, withdrawals, users and volume received, with the values read from `src/components/landing/placeholders.ts`. That file holds clearly named constants with a header comment stating that they are hand-maintained placeholder figures shown on the landing page. No network toggle, no fetching.
   - A caption "Explore live data on Scan" links to `/scan`.
3. **How it works.** Four step cards with arrow chips on their edges:
   1. Create a payable (choose any amount or exact token amounts).
   2. Share one link.
   3. Payers pay from their chain (same-chain directly; cross-chain via CCTP).
   4. Withdraw, or let auto-withdraw do it.

   Each card has a tiny illustrative mock UI in glass.
4. **Cross-chain deep dive.** Two columns:
   - Left: an explanation of the flow (burn on the source chain → Circle attests → the Chainbills relayer delivers → the payable is credited on its home chain), plus how payable settings sync to every chain via Wormhole or CCTP messages.
   - Right: the reusable `CrossChainRoute` component (brief 03). It is being built in parallel, so build a local equivalent in `src/components/landing/` if brief 03 has not merged yet; replace it with the shared one in the follow-up polish pass. Beside it, an animated mini stepper that loops through the relay steps.
5. **Features bento grid** (glass cards of varied sizes, with hover lift and corner glows):
   - Payable links
   - Exact-amount enforcement
   - Accept any token or specific options
   - Auto-withdraw
   - Close and reopen anytime
   - Public receipts
   - On-chain explorer (Scan)
   - Transparent 2% withdrawal fee
6. **Activity ticker (placeholders).** 8 sample activities (payment received, cross-chain payment, withdrawal, payable created…) defined in `placeholders.ts`.
   - Rendered as compact activity rows in a slow vertical marquee, which pauses on hover and under reduced motion.
   - Rows are illustrative and do not link to entities; the section ends with "Open Scan →".
7. **Supported chains.** Cards per chain with a `ChainBadge`, a `NetworkPill`, and static capability tags: "Wormhole messaging" and "Circle CCTP" (MegaETH: Wormhole; Sepolia: Wormhole + CCTP; Arc Testnet: CCTP).
   - Include a "Solana — coming soon" card.
8. **For builders and trust.** Non-custodial contracts, open source (GitHub link), cross-chain ids (`cbChainId`), the verifiable Scan, and fee transparency. Include small code-style snippets of real contract function names.
9. **FAQ.** A PrimeVue Accordion, styled glass, with 6–8 questions:
   - What is a payable?
   - Which chains?
   - How long do cross-chain payments take?
   - What are the fees?
   - Can I restrict amounts?
   - Is it custodial?
   - What is auto-withdraw?
   - Where is my description stored? (Answer: off-chain on the Chainbills server; everything else is on-chain.)
10. **Closing CTA.** Two side-by-side glass cards, each with a coloured top wash: "Start receiving" (`/start`) and "Pay or explore" (`/scan`).

## Implementation

- Split sections into `src/components/landing/*.vue`, one component per section, each documented. Add `src/components/landing/README.md`.
- `HomeView.vue` composes the sections only.
- Use `v-reveal` for scroll reveals, staggered within grids. Honour reduced motion everywhere.
- Performance:
  - The hero is visible without waiting on RPC calls.
  - No layout shift: reserve heights.
- SEO:
  - Update `index.html` `<title>`, meta description and Open Graph/Twitter tags to the new positioning.
  - Keep the existing favicon or logo assets.
- Analytics: keep `clicked_home_hero_get_started`, and add `clicked_home_explore_scan` and `clicked_home_closing_cta`.

## Acceptance criteria

- [ ] All ten sections exist, in order, responsive from 360 px to 1440 px+, and polished in light and dark themes.
- [ ] The hero visual animates smoothly, uses no raster images, and is static under reduced motion.
- [ ] The numbers strip and activity ticker use placeholder values from `placeholders.ts` only; the landing page performs no network reads.
- [ ] Copy is concrete and cross-chain-first, with no filler or duplicated text.
- [ ] Documentation is complete. Type-check and build pass.
