# Chainbills EVM

Solidity contracts for Chainbills on EVM chains, built with Foundry. Read this file end to end before touching any `.sol` file.

## Architecture

Chainbills on EVM is one ERC-2535 diamond per chain. The diamond holds all state and routes every call to a facet by selector. Facets are stateless; they read and write ERC-7201 namespaced storage through storage libraries. Heavy shared logic lives in linked (public) libraries that facets call by `DELEGATECALL`, so it runs in the diamond's storage context.

```
Diamond (owner + DiamondCutFacet at construction; everything else via the first diamondCut)
├── diamond machinery   DiamondCutFacet · DiamondLoupeFacet (+ERC-165) · OwnershipFacet (two-step)
├── admin facets        CbGovernanceFacet · CbConfigFacet · CbChainRegistryFacet · CbTokenRegistryFacet
├── operation facets    CbPayablesFacet · CbPayableSyncFacet · CbPaymentsFacet · CbWithdrawalsFacet
├── view facets         CbCoreViewsFacet · CbRegistryViewsFacet · CbPayableViewsFacet · CbPaymentViewsFacet
│                       CbWithdrawalViewsFacet · CbActivityViewsFacet · CbCrossChainViewsFacet · CbQuoteViewsFacet
└── ChainbillsDiamondInit (runs once inside the first diamondCut)
```

The diamond constructor takes only `(owner, diamondCutFacet)` so the diamond deploys to the same address on every chain through CREATE2. It has no `receive` function; native tokens enter only through payable facet functions.

## Directory layout

```
src/
  Diamond + machinery   diamond/        Diamond, LibDiamond, DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet
  access/                               LibOwnership (two-step), LibAccessControl (enumerable roles), LibPause
                                        (global + per-feature), LibReentrancyGuard (transient storage)
  storage/                              One ERC-7201 library per domain (see Storage)
  types/                                CbTypes (structs, enums), CbConstants (wire format, CCTP layout, features),
                                        CbRoles (role identifiers)
  interfaces/                           ICb<Facet> per facet, ICbErrors, ICbEvents, IChainbills (aggregate),
                                        diamond/ (IDiamondCut, IDiamondLoupe, IERC173), circle/ (CCTP V2)
  libraries/                            Internal: LibCbIds, LibAddressFormat, LibTokenTransfer, LibFees, LibRelayGuard
                                        Linked: CbPayloadCodec, CbPagination, CbLedger, CbWormholeMessaging,
                                        CbCctpMessaging, CbPayableSync
  facets/                               CbFacetBase (shared modifiers) and every Cb<X>Facet
  selectors/                            <Facet>Selectors: the selector list of each facet
  CbFacetSet.sol                        Canonical ordered facet list used by deploy scripts and tests
  ChainbillsDiamondInit.sol             One-time initializer
test/
  base/                                 CbDeployer (full diamond deploy) and CbTestBase (single and two-chain fixture)
  mocks/                                MockCctp (TokenMessengerV2, MessageTransmitterV2, TokenMinterV2), MockWormhole,
                                        MockERC20, MockTaxToken, RejectEth
  <area>/                               Test suites grouped by area (diamond, governance, payables, payments, ...)
script/                                 Deploy, cut, and admin scripts plus run.sh and env/<chain>.env
legacy/                                 Previous single-proxy implementation, kept for reference. Not compiled.
```

## Interfaces are the contract

- `src/interfaces/ICb<Facet>.sol` fixes every external signature. A facet implements exactly its interface: `contract Cb<X>Facet is CbFacetBase, ICb<X>`.
- `IChainbills` aggregates every facet interface plus `ICbErrors` and `ICbEvents`. Tests, scripts, and ABI consumers talk to the diamond through `IChainbills`.
- Adding, removing, or renaming an external function means updating, in the same change: the interface, the facet, `src/selectors/<Facet>Selectors.sol`, and (for a new facet) `CbFacetSet.sol`, `test/base/CbDeployer.sol`, and the deploy script. `test/diamond/DiamondSetup.t.sol` fails when a selector is missing or routed twice.
- Custom errors live only in `ICbErrors`; events live only in `ICbEvents` (plus the standard diamond and ERC-173 events). Libraries revert with `ICbErrors.X(...)` and emit with `emit ICbEvents.X(...)`.

## Storage

Every piece of state lives in an ERC-7201 namespace owned by one storage library:

| Library | Namespace | Holds |
|---|---|---|
| `LibDiamond` | `chainbills.diamond` | selector table, facets, ERC-165 registry |
| `LibOwnership` | `chainbills.ownership` | owner, pending owner |
| `LibAccessControl` | `chainbills.access` | enumerable role members and role admins |
| `LibPause` | `chainbills.pause` | global pause, paused feature bits |
| `LibReentrancyGuard` | `chainbills.reentrancy` (transient) | entered flag |
| `LibConfigStorage` | `chainbills.config` | chain ID, fees, limits, relay and publish policy, Wormhole and CCTP wiring |
| `LibChainRegistryStorage` | `chainbills.chains` | registered foreign chains and reverse lookups |
| `LibTokenRegistryStorage` | `chainbills.tokens` | token configs, token totals, matching tokens |
| `LibUserStorage` | `chainbills.users` | users and their ID lists |
| `LibPayableStorage` | `chainbills.payables` | local payables, allowed tokens, balances, ID lists |
| `LibForeignPayableStorage` | `chainbills.foreign.payables` | mirrored foreign payables |
| `LibPaymentStorage` | `chainbills.payments` | user payments, payable payments |
| `LibWithdrawalStorage` | `chainbills.withdrawals` | withdrawals |
| `LibActivityStorage` | `chainbills.activities` | activity records |
| `LibMessagingStorage` | `chainbills.messaging` | replay protection, nonces, Wormhole and CCTP counters |
| `LibStatsStorage` | `chainbills.stats` | chain entity counters |

Rules:

- Facets never declare state variables.
- `Layout` structs are append-only: add fields at the end, never reorder, retype, or remove.
- Slot constants are hardcoded and computed as `keccak256(abi.encode(uint256(keccak256(id)) - 1)) & ~bytes32(uint256(0xff))` (`cast index-erc7201 <id>`). A test asserts every constant against its id.
- A library writes only its own domain's storage unless the write is part of a documented cross-domain record (for example `CbLedger`, which keeps counters of several domains consistent).

## Libraries

- **Internal libraries** (`Lib*`) are compiled into their callers. Use them for storage accessors, guards, and small helpers.
- **Linked libraries** (`Cb*` in `src/libraries/`) have `public` functions, are deployed once per chain, and are linked into facets. Use them for heavy logic shared by several facets: payload codec, pagination, the ledger, Wormhole and CCTP messaging, payable sync. They read and write diamond storage directly because they run through `DELEGATECALL`.
- Changing a linked library means redeploying it, redeploying every facet that links it, and replacing those facets' selectors with a diamond cut.

## Access control

- **Owner** (two-step, `OwnershipFacet`): the only account that can `diamondCut`. Transfer with `transferOwnership` + `acceptOwnership`.
- **Roles** (`CbGovernanceFacet`, identifiers in `CbRoles.sol`):
  - `DEFAULT_ADMIN_ROLE` administers every role; the last holder cannot be removed.
  - `CONFIG_MANAGER_ROLE`: Wormhole/CCTP wiring, allowed-tokens limit, relay and publish restrictions.
  - `CHAIN_MANAGER_ROLE`: foreign chain registry.
  - `TOKEN_MANAGER_ROLE`: token support, payment limits, transfer-tax policy, matching tokens.
  - `FEE_MANAGER_ROLE`: fee collector, global fee, per-token fee overrides and caps.
  - `PAUSER_ROLE` / `UNPAUSER_ROLE`: pause and unpause, globally or per feature.
  - `RELAYER_ROLE`: submits inbound messages while relaying is restricted.
  - `PAYABLE_SYNC_ROLE`: `adminSyncForeignPayable`.
  - `RESCUER_ROLE`: moves balances above the sum of payable balances.
- The initializer grants `DEFAULT_ADMIN_ROLE` and every role except `RELAYER_ROLE` to the initial admin.
- Admin functions are never pause-gated.

## Pausing

`LibPause` blocks a feature when the protocol is paused globally or the feature bit is set. Features (`CbConstants.sol`): `FEATURE_CREATE_PAYABLE`, `FEATURE_UPDATE_PAYABLE`, `FEATURE_PUBLISH_PAYABLE`, `FEATURE_PAY`, `FEATURE_PAY_FOREIGN`, `FEATURE_RECEIVE_FOREIGN_PAYMENT`, `FEATURE_RECEIVE_PAYABLE_UPDATE`, `FEATURE_WITHDRAW`, `FEATURE_AUTO_WITHDRAW`. When `FEATURE_AUTO_WITHDRAW` is paused, payments to auto-withdraw payables stay in the payable balance and `AutoWithdrawSkipped` is emitted instead of reverting.

## Money rules

- The native token is represented by the diamond address in every token field.
- `pay(payableId, token, amount, maxAmountIn)`: `amount` is the price matched against allowed tokens and amounts; `maxAmountIn` is what the diamond may pull. Every ERC-20 transfer in is measured by balance difference.
  - Tokens without `isTransferTaxAllowed`: `maxAmountIn == amount` and exactly `amount` must arrive.
  - Tokens with `isTransferTaxAllowed`: at least `amount` must arrive; the payable is credited with everything that arrives.
  - Native: `msg.value == maxAmountIn == amount`. ERC-20: `msg.value == 0`.
- Withdrawal fee: token override bps when set, otherwise the global bps; capped by the token's `maxWithdrawalFee` only when a cap is set. Zero transfers are skipped.
- `CbLedger.withdraw` is the only path that moves funds out of a payable (host withdrawals and auto-withdrawals).
- Invariant: for every token, the diamond's balance is at least `TokenStats.totalPayableBalance`. `rescueUntrackedBalance` can move only the excess.

## Cross-chain messaging

All cross-chain references use `cbChainId = keccak256("namespace:reference")` (CAIP-2). Wormhole chain IDs and Circle domains are only transport identifiers, mapped per foreign chain in the registry.

Each foreign chain carries protocol IDs, addresses per messaging role (Wormhole emitter, CCTP message sender, CCTP burn sender, CCTP recipient, mint recipient, destination caller), switches (CCTP updates, inbound updates, outbound payments, inbound payments), CCTP finality (outbound update and payment thresholds, inbound minimums), and an optional cap on the CCTP `maxFee`.

**Payable updates** (payload type 1): every host action increments one chain-wide nonce and broadcasts once over Wormhole (when active) and once per registered chain with CCTP updates enabled over a CCTP data message. The receiver binds each foreign payable to the chain it was first seen from and applies only strictly increasing nonces, so duplicate deliveries over Wormhole, CCTP, and admin sync apply once. Inbound CCTP updates arrive through `IMessageHandlerV2` callbacks and must meet the source chain's minimum finality.

**Payments** (payload type 2): `payForeignViaCctp` burns `amount + maxFee` through `depositForBurnWithHook` with the 251-byte payment payload as hook data. The burn and the payment are one attested message, so no relayer can pair a payment with another payment's funds. `receiveForeignPaymentViaCctp(burnMessage, attestation)` verifies domains, destination caller, mint recipient, burn sender, finality, payload route, and token mapping; marks the burn and payment nonces; receives the message; and credits exactly the minted amount (at least the payload amount).

Wire formats (unchanged across VMs; the Solana program decodes the same bytes):

- Payable payload: `payloadType(1)=1 | version(1) | actionType(1) | payableId(32) | nonce(8) | initiatedAt(8)` then `count(1) | [token(32) | amount(8)]*` for actions 1 and 4, or `isClosed(1)` for actions 2 and 3. The create action does not carry the closed status, so republishing a closed payable sends a snapshot followed by a close.
- Payment payload: `payloadType(1)=2 | version(1) | actionType(1)=5 | payableId(32) | nonce(8) | initiatedAt(8) | amount(8) | payableChainToken(32) | payableChainId(32) | payer(32) | payerChainToken(32) | payerChainId(32) | payerPaymentId(32)` = 251 bytes.

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

## Commands

```bash
forge build
forge test -j 1                        # -j 1: test/script/*.t.sol share process env via vm.setEnv
FOUNDRY_PROFILE=lite forge test -j 1
forge test --match-path 'test/payments/*' -vvv
forge coverage --ir-minimum
forge fmt
cast index-erc7201 chainbills.<domain>
node script/export-abi.mjs             # after forge build; writes abi/
```

## Scripts

Every deployment (the six linked libraries, every facet, `DiamondCutFacet`, `ChainbillsDiamondInit`, the diamond
itself) goes through the CREATE2 deployer under one salt (`CB_SALT`), so the same salt and owner produce the same
diamond address on every chain — see `script/base/CbScript.sol` and the README's Deterministic deployment section.

- `script/DeployChainbills.s.sol` — full deterministic deploy plus optional CCTP/Wormhole/token/relayer config.
- `script/PredictAddresses.s.sol` — every address a deploy would produce, without deploying.
- `script/DiamondCutUpgrade.s.sol` — redeploys named facets (`FACETS=Cb...,Cb...`) and diffs their selectors
  against the diamond's current routing into one Add/Replace/Remove cut.
- `script/DeployLocalStack.s.sol` — two wired diamonds with mocks, for manual anvil runs.
- `script/admin/` — one contract per admin operation, each a thin env-driven call through `IChainbills`.
- `script/run.sh <chain> <ScriptName> [<target-chain>] [--dry-run]` — loads `script/env/<chain>.env` (+
  `.env.local`), derives `FOREIGN_*` vars from a target chain's env, and defaults `DIAMOND` from
  `deploys/<chain>.json`.

## Commits

Conventional commit messages (`feat(evm): ...`, `test(evm): ...`, `fix(evm): ...`, `docs(evm): ...`) that describe the change itself. No references to tools, assistants, sessions, task numbers, or phases.
