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
| Landing page | Full rebuild, cross-chain-first story. It makes **no on-chain reads**: every number, stat and sample activity on it is a static placeholder kept in one file (`src/components/landing/placeholders.ts`) so the values can be tuned by hand later. |
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
- Commit messages and completion reports are where "what changed" belongs.

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
- Stay inside the files your brief owns; if a shared file needs a small additive change, keep it minimal and mention it in the completion report.
- Dependencies: prefer none. Small, well-maintained additions are allowed when a brief names them (e.g. `@fontsource-variable/*`, `qrcode`, `@vueuse/core`). Justify any other addition in the completion report.

### 3.6 Verification before finishing

Run these from the `frontend/` directory once implementation is complete:

```bash
npm run type-check
npm run build-only
```

Both must pass with no errors. Screenshots and Playwright runs are optional.

**Do not write tests.** No unit, component or end-to-end test files are added; the project owner tests manually.

**`src/stores/firebase.ts`** is gitignored. It is already present in the working tree locally — do not create, modify or delete it.

### 3.7 Git

Agents in this project run as local git worktrees spun up by the coordinator (the parent Claude Code session in VS Code). They do **not** push to remote branches.

- **Set identity once at the start of every agent session:**
  ```bash
  git config user.name "Obum"
  git config user.email "obuumm@gmail.com"
  ```
- Commit in small, logical steps: `feat(frontend): …`, `fix(frontend): …`, `docs(frontend): …`.
- Commit messages carry **no** AI attribution — no `Co-Authored-By` trailer, no session links, no mention of Claude or AI. This overrides any default attribution guidance.
- **No `git push`.** The worktree branch stays local; the coordinator merges it into `claude/sweet-planck-l81xey` after reviewing.
- **No pull requests.**
- When a brief is complete, write a short completion report as your final reply: what was built, deviations, known gaps, and each acceptance criterion marked ✅ or ❌.

---

## 4. Execution

Briefs 00–03 and 06 are already merged into `claude/sweet-planck-l81xey`. Remaining work is briefs 04 and 05, which run in parallel as local worktree agents spawned by the coordinator.

The coordinator (parent Claude Code session) is responsible for:
1. Spawning the two agents with `isolation: worktree`.
2. Reviewing each agent's completion report.
3. Scanning new comments for the banned patterns (§3.1–3.2) and fixing any that slipped through.
4. Merging each worktree branch into `claude/sweet-planck-l81xey`: `git merge --no-ff <worktree-branch>`.
5. Running `npm run type-check && npm run build-only` after each merge.
6. Running the final consistency pass once both are merged.
7. Pushing `claude/sweet-planck-l81xey` to `origin` once everything is clean.

**Final consistency pass checklist:**
- `grep -rn "brief [0-9]\|later brief\|wave [0-9]\|replaces the\|no longer" frontend/src` — fix anything found.
- `grep -rn "orctra\|arcangel" frontend/src` — must be empty.
- Check `TransactionsTable.vue`, `TableLoader.vue`, `Shimmer.vue` — delete any that are no longer imported anywhere.
- `npm run type-check && npm run build-only` — must both pass.
- `git push origin claude/sweet-planck-l81xey`.
