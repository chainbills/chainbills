# Chainbills EVM

Solidity contracts for Chainbills on EVM chains, built with Foundry. Read the README for architecture, storage layout, cross-chain messaging, and the admin runbook. This file covers the rules that govern edits to this directory.

## Interfaces are the contract

- `src/interfaces/ICb<Facet>.sol` fixes every external signature. A facet implements exactly its interface: `contract Cb<X>Facet is CbFacetBase, ICb<X>`.
- `IChainbills` aggregates every facet interface plus `ICbErrors` and `ICbEvents`. Tests, scripts, and ABI consumers talk to the diamond through `IChainbills`.
- Adding, removing, or renaming an external function means updating, in the same change: the interface, the facet, `src/selectors/<Facet>Selectors.sol`, and (for a new facet) `CbFacetSet.sol`, `test/base/CbDeployer.sol`, and the deploy script. `test/diamond/DiamondSetup.t.sol` fails when a selector is missing or routed twice.
- Custom errors live only in `ICbErrors`; events live only in `ICbEvents` (plus the standard diamond and ERC-173 events). Libraries revert with `ICbErrors.X(...)` and emit with `emit ICbEvents.X(...)`.

## Storage rules

- Facets never declare state variables.
- `Layout` structs are append-only: add fields at the end, never reorder, retype, or remove.
- Slot constants are hardcoded and computed as `keccak256(abi.encode(uint256(keccak256(id)) - 1)) & ~bytes32(uint256(0xff))` (`cast index-erc7201 <id>`). A test asserts every constant against its id.
- A library writes only its own domain's storage unless the write is part of a documented cross-domain record (for example `CbLedger`, which keeps counters of several domains consistent).

## Library rules

- Internal libraries (`Lib*`) are compiled into their callers. Use them for storage accessors, guards, and small helpers.
- Linked libraries (`Cb*` in `src/libraries/`) have `public` functions, are deployed once per chain, and are linked into facets. Use them for heavy logic shared by several facets. They read and write diamond storage directly because they run through `DELEGATECALL`.
- Changing a linked library means redeploying it, redeploying every facet that links it, and replacing those facets' selectors with a diamond cut.

## Code style

- Solidity `0.8.30`, `evm_version = cancun`, `via_ir`, optimizer 200 runs. Two-space indentation, single quotes, 120 columns (`forge fmt`).
- Full NatSpec on every external, public, and non-trivial internal function, struct, event, and error. Implementations use `/// @inheritdoc ICb<X>` plus `@dev` notes only where the implementation adds something.
- Function bodies are narrated with short present-tense comments. Group steps with `/* CHECKS */`, `/* STATE CHANGES */`, `/* TRANSFER */` banners. External calls come last; any deviation from checks-effects-interactions is explained inline.
- Comments describe the code as it is. No history, no references to earlier versions, no future plans, no references to other projects.
- Booleans start with `is`, `has`, `can`, `should`, or `wants`. Internal and private helpers start with `_`. Errors are PascalCase conditions; events are past-tense verbs.
- Every state-changing user function is `nonReentrant` and pause-gated by its feature. Inbound message entry points use `onlyPermittedRelayer`.

## Tests

- Inherit `test/base/CbTestBase.sol`. `setUp` deploys chain A fully configured (Wormhole mock, CCTP mocks, USDC, native token allowed, a relayer). Call `_setUpChainB()` for a second chain wired both ways.
- Relay helpers: `_lastVaa(chain)` for Wormhole; `_lastCctp(chain, finality, feeExecuted, isBurn)` and `_cctpAt(...)` return an attested CCTP message and attestation ready for the destination diamond.
- Naming: `test_<Action>_<Variant>`, `test_RevertWhen_<Cause>`, `testFuzz_<Action>`, `invariant_<Property>`.
- Fuzz inputs use `bound(...)`; `vm.assume` only for predicates that cannot be expressed as a range.
- Every custom error has at least one test that triggers it. Every event has at least one `vm.expectEmit` test.
- Profiles: default, `FOUNDRY_PROFILE=lite` (fast), `FOUNDRY_PROFILE=deep` (heavy fuzz and invariants).
- Run script tests single-threaded: `forge test -j 1`. The files under `test/script/` share process env via `vm.setEnv` and race under the default parallel runner.

## Commands

```bash
forge build
forge test -j 1
FOUNDRY_PROFILE=lite forge test -j 1
forge test --match-path 'test/payments/*' -vvv
forge coverage --ir-minimum
forge fmt
cast index-erc7201 chainbills.<domain>
node script/export-abi.mjs             # after forge build; writes abi/
```

## Scripts

All deployments go through the CREATE2 deployer under `CB_SALT`, so the same salt and owner produce the same diamond address on every chain.

- `script/DeployChainbills.s.sol`: full deterministic deploy plus optional CCTP/Wormhole/token/relayer config.
- `script/PredictAddresses.s.sol`: every address a deploy would produce, without deploying.
- `script/DiamondCutUpgrade.s.sol`: redeploys named facets (`FACETS=Cb...,Cb...`) and diffs their selectors against the diamond's current routing into one Add/Replace/Remove cut.
- `script/DeployLocalStack.s.sol`: two wired diamonds with mocks, for manual anvil runs.
- `script/admin/`: one contract per admin operation, each a thin env-driven call through `IChainbills`.
- `script/run.sh <chain> <ScriptName> [<target-chain>] [--dry-run]`: loads `script/env/<chain>.env` (plus `.env.local`), derives `FOREIGN_*` vars from a target chain's env, and defaults `DIAMOND` from `deploys/<chain>.json`.

## Commits

Conventional commit messages (`feat(evm): ...`, `test(evm): ...`, `fix(evm): ...`, `docs(evm): ...`) that describe the change itself. No references to tools, assistants, sessions, or task numbers.
