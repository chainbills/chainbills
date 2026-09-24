# Phase 1b — Diamond Alignment and Green Checks

**Branch:** `backend-v2-01b-diamond-alignment` (worktree from `main`) → merged locally into `main` after review
**Depends on:** phase 1 (merged)
**Read first:** `WORKER_RULES.md`, `SPEC.md` §5, §6, §7, §16; `evm/CLAUDE.md`,
`evm/DEPLOYED.md`, `evm/src/types/CbTypes.sol`, `evm/abi/chainbills.ts`

## Goal

The scaffold targets the EVM contracts as they now exist in `evm/` — one
ERC-2535 diamond per chain — and every check in `WORKER_RULES.md` §5 passes on
`main`, so phases 2a and 2b start from a green, correctly-shaped base.

Starting point on `main`: 107 unit tests pass, but `pnpm lint` reports 2
errors and coverage is below the thresholds (lines ≈ 87.8 %, branches ≈ 73.9 %).

## Tasks

1. **ABI.** Replace `src/chains/abis.ts` (legacy `mainAbi` / `gettersAbi`) with
   a verbatim copy of `evm/abi/chainbills.ts` at `src/chains/abi/chainbills.ts`
   (`chainbillsAbi`, `as const`). Add `src/chains/abi/abi-sync.spec.ts`: when
   `../evm/abi/chainbills.json` exists, the copied ABI must deep-equal it;
   otherwise the test is skipped with a message. Exclude the ABI file from
   coverage (as the old one was).
2. **Registry** (SPEC §6.2):
   - EVM entries carry `diamondAddress` (replacing `contractAddress` and
     `gettersAddress`), `caip2`, `network` (`mainnet` | `testnet` | `local`),
     `deploymentBlock`, optional `wormholeChainId` / `circleDomain`.
   - Entries: `arcmainnet` (values from `evm/DEPLOYED.md`; `diamondAddress`
     and `deploymentBlock` left `null` with a `TODO(owner)` comment until the
     diamond is deployed), `anvil` (chain id 31337; diamond address from
     `evm/script/DeployLocalStack.s.sol` / `evm/script/PredictAddresses.s.sol`
     if deterministic, otherwise `null` + `TODO(owner)`), and `solanadevnet`
     (unchanged, plus `relayEnabled: false`).
   - Remove the legacy `arctestnet`, `sepolia` and `megaeth` entries.
   - Helpers: `enabledChains()`, `sameNetwork(a, b)`, lookups by `cbChainId`
     and slug.
3. **Tokens** (SPEC §6.3): per-chain symbol / decimals registry for the new
   chains (Arc mainnet USDC per `evm/DEPLOYED.md`, `TODO(owner)` where the
   address is still unknown; anvil mock USDC + native), plus an injectable
   resolver that falls back to ERC-20 `symbol()` / `decimals()` over the chain
   client and caches results. Unit-test both paths with a mocked client.
4. **Config** (SPEC §5.2): replace `RPC_ARC_TESTNET`, `RPC_SEPOLIA`,
   `RPC_MEGAETH`, `RPC_SOLANA_DEVNET` with `ENABLED_CHAINS` plus
   `RPC_<SLUG>` for each enabled slug. Validation rejects unknown slugs,
   enabling a chain with no diamond address / program id, and a missing RPC
   URL for an enabled chain — listing every problem, never values. Update
   `ChainsService`, `.env.example`, `docs/ENV.md` and the schema tests.
5. **Schema migration** (SPEC §7): add a second migration (`prisma migrate dev
   --name diamond_alignment`) that brings the database to the SPEC schema:
   `requestedAmount` on `UserPayment` and `PayablePayment`, `fee` on
   `Withdrawal`, `relayScanBlock` on `ChainCursor`, `RelayJobType` with
   `PAYMENT_VIA_CCTP` (replacing the two legacy payment types), and
   `RelayJob.cctpMessage` / `cctpAttestation` (replacing the four
   `circle*` columns). Do not edit the initial migration. The tables are empty
   in every environment, so drop / add columns directly.
6. **Green checks.** Fix the 2 lint errors. Review the existing specs added by
   the tests commit (`src/chains/*.spec.ts`, `src/common/**/*.spec.ts`,
   `src/prisma/prisma.service.spec.ts`) for meaningful assertions, then add
   tests until `pnpm test:cov` meets the thresholds. Never lower thresholds or
   widen exclusions.
7. **Docker check.** `docker build` the image and run it with
   `docker compose up -d` against a `.env` with `ENABLED_CHAINS=anvil` (or any
   chain with an address), confirm migrations apply and `/health` + `/docs`
   respond. Record the commands in the handoff note.
8. **Docs.** `backend/CLAUDE.md` (module map: `chains/abi/`, registry shape,
   invariants: diamond-only, networks never mix, `ENABLED_CHAINS`),
   `backend/README.md` quick start (`ENABLED_CHAINS=anvil` for local work with
   `evm/script/DeployLocalStack.s.sol`), `docs/ENV.md`, `.env.example`.

## Acceptance criteria

- `pnpm lint`, `pnpm build`, `pnpm test:cov` (thresholds met),
  `pnpm prisma validate` all pass; `pnpm prisma migrate deploy` applies both
  migrations to an empty database.
- No reference to `mainAbi`, `gettersAbi`, `contractAddress`,
  `gettersAddress`, `RPC_SEPOLIA`, `RPC_MEGAETH` or `RPC_ARC_TESTNET` remains
  in `backend/`.
- The ABI sync test passes against `evm/abi/chainbills.json`.
- The Docker image builds and serves `/health` and `/docs`.
