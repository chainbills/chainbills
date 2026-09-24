# Chainbills Frontend Redesign — Master Plan

This folder is the single source of truth for the frontend redesign. It holds:

- this plan (decisions, waves, global rules, ready-to-paste session prompts),
- one self-contained **brief** per work package in [`briefs/`](./briefs),
- **reference** material every brief relies on in [`reference/`](./reference): [`onchain-data.md`](./reference/onchain-data.md) (contract facts) and [`design-language.md`](./reference/design-language.md) (visual spec).

Each brief is written so that a fresh AI coding session (no prior context) can execute it end to end.

---

## 1. Product decisions (fixed for this round)

| Topic | Decision |
| --- | --- |
| Data source | **On-chain only.** Every list, count, status, balance, setting and statistic is read from the Chainbills contracts (CbGetters + main proxy public mappings). |
| Only off-chain data | Payable **descriptions**. They exist nowhere on-chain and are read/written through the existing server endpoints `GET /payable/:id` and `POST /payable` (host-verified upsert). |
| Forbidden sources | Firestore reads from the frontend, relayer APIs, `relayerJobs`, any indexer, Circle Iris attestation polling. (The existing Iris *fee* lookup in `payForeignViaCctp` stays.) |
| Cross-chain tracking | The browser polls the **destination chain** on-chain state while the relayer does its work (see `reference/onchain-data.md` §5). |
| Payable page | **Public.** Everyone sees identity, status, configuration (accepted tokens/amounts or "any amount", auto-withdraw), description, counts, cross-chain availability and the activity feed. Hosts additionally see balances, withdraw and host controls. |
| Host controls | In scope: close, reopen, edit accepted tokens & amounts, toggle auto-withdraw, edit description. |
| Scan | New public explorer at `/scan`, pure on-chain, per-chain **and** "all chains" views, **mainnet and testnet always kept separate**. |
| Activities | Unified activity feeds (all activity types) for users, payables and chains, with tab filters. |
| Landing page | Full rebuild, cross-chain-first story, live on-chain stats. |
| Stack | Vue 3 + TypeScript + Pinia + PrimeVue 4 + Tailwind CSS 3 stay. No framework or Tailwind major migration. |
| Look | "Liquid glass": ambient mesh backdrop, translucent frosted surfaces, hairline borders, brand blue `#057ec5` as accent, equal-quality light and dark themes. Full spec in [`reference/design-language.md`](./reference/design-language.md). |
| Solana | Inactive this round. Solana code paths must keep compiling and must degrade gracefully ("coming soon" states), but new features target EVM chains. |

---

## 2. Work packages and waves

Packages inside the same wave touch disjoint files and can run in parallel sessions. A wave starts only after the previous wave is merged into `main`.

| Wave | Brief | Summary | Main files owned |
| --- | --- | --- | --- |
| 1 | [`00-design-system`](./briefs/00-design-system.md) | Tokens, glass recipes, ambient backdrop, typography, motion, PrimeVue restyle, shared UI primitives, app shell (header, sidebar, footer, toasts). | `src/assets/*`, `tailwind.config.js`, `src/main.ts` (theme preset only), `src/components/ui/*`, `Header.vue`, `Sidebar.vue`, `Footer.vue`, `App.vue`, `ThemeMenu.vue`, `stores/theme.ts` |
| 1 | [`01-onchain-data-layer`](./briefs/01-onchain-data-layer.md) | On-chain chain discovery, activity + stats stores, host-control writes, transaction-flow step engine, destination-chain pollers, correctness fixes. Headless (no visual work). | `src/stores/*` (except `theme.ts`), `src/schemas/*` |
| 2 | [`02-activity-ui`](./briefs/02-activity-ui.md) | `ActivityFeed` / `ActivityTable` components (search, filters, tabs, expandable rows) + rebuilt user Activity page. | `src/components/activity/*`, `UserActivityView.vue` |
| 2 | [`03-transaction-flows`](./briefs/03-transaction-flows.md) | Step-by-step transaction progress UI; rebuilt Create Payable, Pay (same-chain + cross-chain), Receipt (live arrival), Withdraw dialog; Dashboard restyle. | `src/components/tx/*`, `CreatePayableView.vue`, `PayView.vue`, `ReceiptView.vue`, `DashboardView.vue`, `PayableInfoCard.vue` |
| 2 | [`06-landing`](./briefs/06-landing.md) | Landing page rebuild. | `HomeView.vue`, `src/components/landing/*`, `public/assets/landing/*` |
| 3 | [`04-payable-page`](./briefs/04-payable-page.md) | Public payable page with host controls and full activity. | `PayableDetailView.vue`, `src/components/payable/*` |
| 3 | [`05-scan`](./briefs/05-scan.md) | Chainbills Scan explorer + address page. | `src/views/scan/*`, `src/components/scan/*`, router entries for `/scan*` |

Router (`src/router/index.ts`) edits are small and additive; each brief lists the exact routes it adds.

---

## 3. Global rules (apply to every brief)

### 3.1 Code comments and documentation

- Comment **generously**: every exported function, store action, component prop, emitted event, non-trivial computed, contract call, polling loop and CSS recipe gets a comment explaining what it is and why.
- Comments describe the code **as it stands**, in the present tense, self-contained. They are written to stay true for future readers.
- Comments never mention the change being made, previous behaviour, other briefs, phases, waves, tickets, "new", "now", "replaced", "refactored", "previously", "moved from", "TODO from redesign", or who asked for it.
  - Good: `// Polls the payable's home chain until the payer's nonce is marked consumed, which means the relayer delivered the payment.`
  - Bad: `// New: we now poll instead of showing a toast like before.`
- Markdown docs follow the same rule. When a brief adds or changes files, update `frontend/CLAUDE.md` (file map, store patterns, routes) so it describes the resulting codebase.
- Commit messages and PR descriptions are where "what changed" belongs.

### 3.2 In-place documentation (write a lot of it)

Documentation lives next to the code it describes and is **descriptive**: what the thing is, what it is for, how it behaves, and what it expects.

- **Every file** starts with a header comment: its purpose, what it exports, and how it fits into the app (which stores or components use it, which contract calls it makes).
- **Every exported function and store action** gets a TSDoc block: purpose, each `@param`, `@returns`, failure behaviour (returns `null`? toasts? throws?), and the contract functions or events it reads.
- **Every Vue component** starts with a doc block in `<script setup>`: purpose, props (each with a comment in `defineProps`), emits, slots, and usage example.
- **Every type, interface and enum member** gets a one-line comment.
- **Non-obvious logic** (pagination maths, k-way merges, polling cadence, fee maths, bigint conversions, cache keys) gets inline comments explaining the reasoning.
- **Styles:** CSS recipes and Tailwind plugin entries are commented with where and why to use them.
- **Folder READMEs:** every new folder under `src/` (for example `src/components/ui/`, `src/components/activity/`, `src/components/tx/`, `src/components/scan/`, `src/components/landing/`, `src/components/payable/`, `src/composables/`) gets a `README.md` describing each file in it, how the pieces relate, and usage examples.
- `frontend/CLAUDE.md` stays the top-level map: it links to each folder README and describes the stores, routes, design tokens and data rules.
- Documentation and code never name, link to or borrow identifiers from outside projects or example repositories. Everything is described in Chainbills terms.

### 3.3 Data rules

- Reads go through CbGetters (and the main proxy's public mappings `consumedPaymentNonces`, `payableUpdateNonces`, `getWormholeMessageFee`). Facts, signatures and gotchas are in [`reference/onchain-data.md`](./reference/onchain-data.md).
- No Firestore, relayer, or indexer reads. Descriptions only via the server store.
- Amount maths uses `bigint` / viem `parseUnits` / `formatUnits`; never `number * 10 ** decimals`.
- Mainnet and testnet data are never mixed in one list, total or chart.

### 3.4 UI rules

- Use the primitives from `src/components/ui/*` (delivered by brief 00). Do not hand-roll a new card, badge, address chip, stat tile, empty state or skeleton.
- Every screen works at 360 px wide and at 1440 px, in light and dark mode, with `prefers-reduced-motion` and `prefers-reduced-transparency` honoured.
- Every async region has three designed states: loading skeleton, empty state, error state with retry.
- Keep `analytics.recordEvent(...)` calls on user actions (add new ones for new actions, snake_case names).
- Accessible: semantic headings, labelled buttons (icon-only buttons have `aria-label`/`title`), visible focus rings, colour is never the only signal.

### 3.5 Scope rules

- Do not modify `evm/`, `relayer/`, `server/`, `solana/`.
- Stay inside the files your brief owns; if a shared file needs a small additive change, keep it minimal and mention it in the PR.
- Dependencies: prefer none. Small, well-maintained additions are allowed when a brief names them (e.g. `@fontsource-variable/*`, `qrcode`, `@vueuse/core`). Justify any other addition in the PR.

### 3.6 Verification before opening a PR

**Local setup.** `src/stores/firebase.ts` is gitignored and a fresh clone lacks it, so the app cannot compile without it. If it is missing, create this local stub. It is ignored by git; never commit it.

```ts
// src/stores/firebase.ts — local stub for development sessions (gitignored).
import { initializeApp } from 'firebase/app';
export const firebaseApp = initializeApp({
  apiKey: 'local-dev',
  appId: '1:000000000000:web:0000000000000000',
  projectId: 'chainbills-local',
  messagingSenderId: '000000000000',
  measurementId: 'G-LOCALDEV',
});
```

Also copy `.env.sample` to `.env` if there is none. Leaving `VITE_SERVER_URL` empty is fine: descriptions then fail to load, and every page must still work because descriptions are optional decoration. Analytics or messaging console errors caused by the stub config can be ignored.

```bash
cd frontend
npm ci                # if node_modules is missing
npm run type-check
npm run build
npx prettier --check <files you touched>   # or: npx prettier --write <files>
```

Then run `npm run dev` and capture Playwright screenshots (Chromium is pre-installed; do **not** run `playwright install`; use `executablePath: '/opt/pw-browsers/chromium'` if needed) of every page you touched: desktop 1440 px and mobile 390 px, light and dark. Attach or list them in the PR description. Wallet-gated states can be screenshotted in their "connect wallet" state; on-chain reads work without a wallet.

### 3.7 Git

- Branch from the latest `main`. Use the branch your session assigns.
- One PR per brief, targeting `main`, titled `frontend: <brief title>`.
- PR description: summary, screenshots, checklist of the brief's acceptance criteria with ✅/❌, and any deviations.

---

## 4. Ready-to-paste session prompts

Start each session on the `chainbills/chainbills` repository. Paste the prompt as the first message.

**Wave 1 — two sessions in parallel**

```
Read frontend/docs/redesign/README.md fully, then execute the brief frontend/docs/redesign/briefs/00-design-system.md end to end. Follow every global rule in the README (especially the code-comment rules and on-chain-only data rule). When done, run the verification steps, commit, push, and open a PR against main.
```

```
Read frontend/docs/redesign/README.md fully, then execute the brief frontend/docs/redesign/briefs/01-onchain-data-layer.md end to end. Follow every global rule in the README (especially the code-comment rules and on-chain-only data rule). When done, run the verification steps, commit, push, and open a PR against main.
```

**Wave 2 — three sessions in parallel (after wave 1 is merged)**: same prompt with `02-activity-ui.md`, `03-transaction-flows.md`, `06-landing.md`.

**Wave 3 — two sessions in parallel (after wave 2 is merged)**: same prompt with `04-payable-page.md`, `05-scan.md`.

A final polish pass (cross-page consistency, copy review, screenshot audit) can run as one session after wave 3.
