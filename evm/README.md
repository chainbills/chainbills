# Chainbills — EVM

Chainbills is a cross-chain payment gateway: hosts create **payables** (public invoices), payers send crypto to
them from any supported chain, and hosts withdraw. Cross-chain reach is powered by [Wormhole](https://wormhole.com)
and [Circle CCTP](https://www.circle.com/cross-chain-transfer-protocol). Withdrawals carry a 2% fee by default.

This directory holds the Solidity implementation for EVM chains, built with [Foundry](https://book.getfoundry.sh/).
For the protocol's features and overall design, see the [top-level README](../README.md).

## Table of contents

- [Architecture](#architecture)
- [Directory layout](#directory-layout)
- [Storage](#storage)
- [Access control](#access-control)
- [Pausing](#pausing)
- [Money rules](#money-rules)
- [Cross-chain messaging](#cross-chain-messaging)
- [Deterministic deployment](#deterministic-deployment)
- [Upgrading](#upgrading)
- [Admin runbook](#admin-runbook)
- [Testing](#testing)
- [ABI export](#abi-export)

## Architecture

Chainbills on EVM is one [ERC-2535 diamond](https://eips.ethereum.org/EIPS/eip-2535) per chain: a single address
that holds all state and routes every call to a facet by selector. Facets are stateless; they read and write
ERC-7201 namespaced storage through storage libraries. Heavy logic shared by several facets lives in linked
(`public`) libraries that facets reach by `DELEGATECALL`, so it runs in the diamond's own storage context.

```
Diamond (owner + DiamondCutFacet at construction; everything else via the first diamondCut)
├── diamond machinery   DiamondCutFacet · DiamondLoupeFacet (+ERC-165) · OwnershipFacet (two-step)
├── admin facets        CbGovernanceFacet · CbConfigFacet · CbChainRegistryFacet · CbTokenRegistryFacet
├── operation facets    CbPayablesFacet · CbPayableSyncFacet · CbPaymentsFacet · CbWithdrawalsFacet
├── view facets         CbCoreViewsFacet · CbRegistryViewsFacet · CbPayableViewsFacet · CbPaymentViewsFacet
│                       CbWithdrawalViewsFacet · CbActivityViewsFacet · CbCrossChainViewsFacet · CbQuoteViewsFacet
└── ChainbillsDiamondInit (runs once, inside the first diamondCut)
```

The diamond's constructor takes only `(owner, diamondCutFacet)`, so it deploys to the same address on every chain
through CREATE2 (see [Deterministic deployment](#deterministic-deployment)). It has no `receive` function — native
tokens enter only through payable facet functions.

### Facets and what they do

| Facet | Responsibility |
|---|---|
| `DiamondCutFacet` | `diamondCut` — add, replace, or remove selectors. Owner only. Installed by the constructor. |
| `DiamondLoupeFacet` | ERC-2535 introspection (`facets`, `facetAddresses`, `facetAddress`, ...) and ERC-165. |
| `OwnershipFacet` | Two-step ERC-173 ownership (`transferOwnership` + `acceptOwnership`). |
| `CbGovernanceFacet` | Enumerable role grants (`AccessControl`-style) and global/per-feature pausing. |
| `CbConfigFacet` | Protocol-wide settings: fee collector, default fee, relay/publish restrictions, Wormhole and CCTP wiring. |
| `CbChainRegistryFacet` | Registers and configures foreign chains (protocol IDs, addresses, switches, finality, limits). |
| `CbTokenRegistryFacet` | Token support, payment limits, fee overrides, transfer-tax policy, matching-token mapping. |
| `CbPayablesFacet` | `createPayable`, `closePayable`, `reopenPayable`, `updatePayableAllowedTokensAndAmounts`, `updatePayableAutoWithdraw`, `publishPayableDetails`. Broadcasts payable updates. |
| `CbPayableSyncFacet` | Inbound payable-update entry points: Wormhole VAA, CCTP data message (`IMessageHandlerV2`), and `adminSyncForeignPayable`. |
| `CbPaymentsFacet` | `pay` (same-chain), `payForeignViaCctp` (outbound cross-chain), `receiveForeignPaymentViaCctp` (inbound). |
| `CbWithdrawalsFacet` | `withdraw`, `withdrawAll`, `rescueUntrackedBalance`. |
| `Cb*ViewsFacet`s | Read-only getters and pagination over every domain: protocol config, registries, payables, payments, withdrawals, activity log, cross-chain state, and CCTP/Wormhole fee quoting. |

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
  mocks/                                MockCctp, MockWormhole, MockERC20, MockTaxToken, RejectEth
  script/                               In-process tests of the deploy, upgrade, and admin scripts
  <area>/                               Test suites grouped by area (diamond, governance, payables, payments, ...)
script/
  base/                                 CbScript (CREATE2 + linking), CbLibrarySet, CbFacetDeployer, CbAdminScript,
                                        CbForeignChainScript, CbRoleScript, CbFeatureScript
  admin/                                One contract per admin operation (see Admin runbook)
  env/                                  <chain>.env (committed) + <chain>.env.local (gitignored secrets), tokens.json
  DeployChainbills.s.sol                Deterministic full deploy
  PredictAddresses.s.sol                Prints every address DeployChainbills would produce, without deploying
  DiamondCutUpgrade.s.sol               Redeploys named facets and cuts the diamond over to them
  DeployLocalStack.s.sol                Two wired diamonds with mocks, for manual anvil runs
  export-abi.mjs                        Writes abi/ from build artifacts
  run.sh                                Script runner (env loading, target-chain derivation, broadcast flags)
abi/                                    Generated — see ABI export
legacy/                                 Previous single-proxy implementation and its scripts, kept for reference.
                                        Not compiled.
```

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

Facets never declare state variables. `Layout` structs are append-only. Slot constants are hardcoded and computed
as `keccak256(abi.encode(uint256(keccak256(id)) - 1)) & ~bytes32(uint256(0xff))` (`cast index-erc7201 <id>`); a test
asserts every constant against its id.

## Access control

- **Owner** (two-step, `OwnershipFacet`): the only account that can `diamondCut`. Transfer with
  `transferOwnership` + `acceptOwnership`.
- **Roles** (`CbGovernanceFacet`, identifiers in `CbRoles.sol`):
  - `DEFAULT_ADMIN_ROLE` administers every role; the last holder cannot be removed.
  - `CONFIG_MANAGER_ROLE` — Wormhole/CCTP wiring, allowed-tokens limit, relay and publish restrictions.
  - `CHAIN_MANAGER_ROLE` — foreign chain registry.
  - `TOKEN_MANAGER_ROLE` — token support, payment limits, transfer-tax policy, matching tokens.
  - `FEE_MANAGER_ROLE` — fee collector, global fee, per-token fee overrides and caps.
  - `PAUSER_ROLE` / `UNPAUSER_ROLE` — pause and unpause, globally or per feature.
  - `RELAYER_ROLE` — submits inbound messages while relaying is restricted.
  - `PAYABLE_SYNC_ROLE` — `adminSyncForeignPayable`.
  - `RESCUER_ROLE` — moves balances above the sum of payable balances.
- The initializer grants `DEFAULT_ADMIN_ROLE` and every role except `RELAYER_ROLE` to the deploy-time `ADMIN`.
  Admin functions are never pause-gated.

## Pausing

`LibPause` blocks a feature when the protocol is paused globally or that feature's bit is set. Features
(`CbConstants.sol`): `FEATURE_CREATE_PAYABLE`, `FEATURE_UPDATE_PAYABLE`, `FEATURE_PUBLISH_PAYABLE`, `FEATURE_PAY`,
`FEATURE_PAY_FOREIGN`, `FEATURE_RECEIVE_FOREIGN_PAYMENT`, `FEATURE_RECEIVE_PAYABLE_UPDATE`, `FEATURE_WITHDRAW`,
`FEATURE_AUTO_WITHDRAW`. When `FEATURE_AUTO_WITHDRAW` is paused, payments to auto-withdraw payables stay in the
payable balance and `AutoWithdrawSkipped` is emitted instead of reverting.

## Money rules

- The native token is represented by the diamond's own address in every token field.
- `pay(payableId, token, amount, maxAmountIn)`: `amount` is the price matched against allowed tokens and amounts;
  `maxAmountIn` is what the diamond may pull. Every ERC-20 transfer in is measured by balance difference.
  - Tokens without `isTransferTaxAllowed`: `maxAmountIn == amount` and exactly `amount` must arrive.
  - Tokens with `isTransferTaxAllowed`: at least `amount` must arrive; the payable is credited with everything
    that arrives.
  - Native: `msg.value == maxAmountIn == amount`. ERC-20: `msg.value == 0`.
- Withdrawal fee: token override bps when set, otherwise the global bps; capped by the token's
  `maxWithdrawalFee` only when a cap is set. Zero transfers are skipped.
- Invariant: for every token, the diamond's balance is at least `TokenStats.totalPayableBalance`.
  `rescueUntrackedBalance` can move only the excess.

## Cross-chain messaging

All cross-chain references use `cbChainId = keccak256("namespace:reference")` (CAIP-2). Wormhole chain IDs and
Circle domains are transport identifiers only, mapped per foreign chain in the registry.

Each foreign chain carries protocol IDs, addresses per messaging role (Wormhole emitter, CCTP message sender, CCTP
burn sender, CCTP recipient, mint recipient, destination caller), switches (CCTP updates, inbound updates, outbound
payments, inbound payments), CCTP finality (outbound update and payment thresholds, inbound minimums), and an
optional cap on the CCTP `maxFee`.

### Payable updates (payload type 1)

Every host action increments one chain-wide nonce and broadcasts once over Wormhole (when active) and once per
registered chain with CCTP updates enabled over a CCTP data message. The receiver binds each foreign payable to the
chain it was first seen from and applies only strictly increasing nonces, so duplicate deliveries over Wormhole,
CCTP, and admin sync apply once. Inbound CCTP updates arrive through `IMessageHandlerV2` callbacks and must meet the
source chain's minimum finality. `destinationCaller = bytes32(0)` on these messages — no funds are involved, so
anyone can submit.

Wire format (unchanged across VMs; the Solana program decodes the same bytes):

```
payloadType(1)=1 | version(1) | actionType(1) | payableId(32) | nonce(8) | initiatedAt(8)
  then, for actionType 1 (create/snapshot) or 4 (update allowed tokens and amounts):
    count(1) | [token(32) | amount(8)]*
  or, for actionType 2 (close) or 3 (reopen):
    isClosed(1)
```

The create action does not carry the closed status, so republishing a closed payable sends a snapshot followed by
a close.

### Hook-data payments (payload type 2)

`payForeignViaCctp` burns `amount + maxFee` through Circle's `depositForBurnWithHook`, with the 251-byte payment
payload as hook data. The burn and the payment are one attested message, so no relayer can pair a payment with
another payment's funds. `receiveForeignPaymentViaCctp(burnMessage, attestation)` verifies domains, destination
caller, mint recipient, burn sender, finality, payload route, and token mapping; marks the burn and payment nonces;
receives the message; and credits exactly the minted amount (at least the payload amount).
`destinationCaller = address(this)` on these burns — only the registered Chainbills contract on the destination
chain can submit, preventing griefing.

Payment payload wire format, exactly 251 bytes:

```
payloadType(1)=2 | version(1) | actionType(1)=5 | payableId(32) | nonce(8) | initiatedAt(8) | amount(8)
  | payableChainToken(32) | payableChainId(32) | payer(32) | payerChainToken(32) | payerChainId(32)
  | payerPaymentId(32)
```

This payload sits as `hookData` inside a standard CCTP V2 burn message. `CbConstants.sol` gives the byte offsets of
every CCTP V2 header and body field `CbCctpMessaging` reads: source/destination domain, nonce, sender, recipient,
destination caller, `minFinalityThreshold`, `finalityThresholdExecuted` in the header; `burnToken`, `mintRecipient`,
burn `amount`, `messageSender`, `maxFee`, `feeExecuted`, `expirationBlock`, and `hookData` in the body.

### CCTP finality

Each foreign chain's `ForeignChainFinality` sets `minFinalityThreshold` (`1000` fast or `2000` finalized) on
outbound payable-update and payment messages, and the lowest `finalityThresholdExecuted` this chain accepts on
each inbound direction. `RegisterForeignChain`/`UpdateForeignChain` default every value to `2000` (finalized);
override with `FINALITY_OUTBOUND_UPDATE`, `FINALITY_OUTBOUND_PAYMENT`, `FINALITY_MIN_INBOUND_UPDATE`,
`FINALITY_MIN_INBOUND_PAYMENT` for faster (and less final) delivery.

## Deterministic deployment

Every contract `DeployChainbills` produces — the six linked libraries, every facet, `DiamondCutFacet`,
`ChainbillsDiamondInit`, and the diamond itself — is deployed through the canonical deterministic deployment proxy
at `0x4e59b44847b379578588920cA78FbF26c0B4956C` under one caller-chosen salt (`CB_SALT`). A CREATE2 address depends
only on the deployer, the salt, and the creation code — never on the broadcaster's nonce or the chain ID — so the
same `CB_SALT` and `OWNER` (a diamond constructor argument) produce the **same diamond address on every chain**.
`script/PredictAddresses.s.sol` proves this: it computes every address without deploying anything, so you can
confirm two chains agree before spending any gas.

### Library linking, deterministically

A linked library's address depends only on its own (already-linked) creation code. `CbCctpMessaging` links
`CbPayloadCodec`; `CbPayableSync` links `CbCctpMessaging`, `CbPayloadCodec`, and `CbWormholeMessaging` — so
libraries deploy bottom-up, and each dependent's raw creation code is patched with its dependencies' addresses
before it is hashed or deployed. The same patching is applied, unconditionally, to every facet's raw creation code
against all six libraries — patching a library placeholder a given facet doesn't reference is simply a no-op.

This deliberately bypasses `forge`'s own automatic library auto-linking. `forge` *can* auto-link and auto-deploy
unlinked libraries when it detects a plain `new Facet()` inside a broadcast — but it does so through its own
internal salt (`create2_library_salt`, independent of any salt the calling script chose), which would decouple
library addresses from `CB_SALT` and make idempotent-rerun bookkeeping (see below) unreliable. Instead,
`script/base/CbScript.sol` reads each contract's raw, possibly-still-unlinked creation code directly from its build
artifact (`out/<Name>.sol/<Name>.json`'s `bytecode.object`) — `vm.getCode` refuses to return bytecode that still
carries unresolved library placeholders, so artifacts are read and patched as hex-encoded strings and only decoded
to bytes once every placeholder that contract has is resolved. A placeholder is the literal 20-byte ASCII text
`__$<34 hex chars>$__` solc writes in place of an unlinked library address; `CbScript._linkHex` computes the same
placeholder for a given library's fully-qualified name (`keccak256("path/To.sol:Name")`, first 17 bytes, hex) and
replaces every occurrence with the target address. `script/base/CbLibrarySet.sol` orders the six libraries'
deployment and prediction; `script/base/CbFacetDeployer.sol` does the same for every facet in `CbFacetSet.sol`'s
canonical order.

Before broadcasting, `CbScript._requireCreate2Deployer` checks the target chain actually has code at the CREATE2
deployer address and fails with a clear message otherwise. Every deployment call goes through
`CbScript._deployIfNeeded`, which predicts the address first and skips broadcasting when code is already there —
reruns of `DeployChainbills` (or `DiamondCutUpgrade`) are idempotent.

### Running it

```shell
# 1. Deploy (reads CB_SALT, CAIP2, CHAIN_NAME, OWNER, ADMIN, FEE_COLLECTOR, WITHDRAWAL_FEE_BPS,
#    MAX_ALLOWED_TOKENS_AND_AMOUNTS from script/env/<chain>.env; applies optional CCTP/Wormhole/token/relayer
#    config when those env vars are set — see script/env/arcmainnet.env)
$ ./script/run.sh arcmainnet DeployChainbills

# 2. Confirm another chain would land at the same diamond address, before spending any gas
$ ./script/run.sh sepolia PredictAddresses

# Local, no real chain needed
$ anvil --gas-limit 18446744073709551615 &
$ ./script/run.sh anvil DeployChainbills
```

`deploys/<chain>.json` is written after every deploy: chain name, chain ID, cbChainId, salt, owner, diamond, every
facet and library address, the init address, and the deployment block. Commit it — other scripts (like
`RegisterForeignChain`) read a foreign chain's record to find its diamond address.

## Upgrading

`script/DiamondCutUpgrade.s.sol` redeploys the facets named in `FACETS` (comma-separated `CbFacetSet` names,
e.g. `FACETS=CbPaymentsFacet,CbQuoteViewsFacet`) through the same CREATE2 machinery under `CB_SALT`, then diffs
each one's selectors (as declared by `CbFacetSet.sol` — this branch's source) against what the diamond's loupe
currently routes:

- a selector already routed to the new implementation needs nothing;
- a selector routed elsewhere is `Replace`d;
- a selector routed nowhere is `Add`ed;
- a selector the old implementation served that the new selector set no longer includes is `Remove`d.

One cut, built from up to three `FacetCut`s per facet (`Replace`, `Add`, `Remove` — whichever are non-empty), is
sent in a single `diamondCut` call.

```shell
# Preview the cut without broadcasting
$ CB_SALT=0x... DIAMOND=0x... FACETS=CbPaymentsFacet ./script/run.sh arcmainnet DiamondCutUpgrade --dry-run

# Broadcast it
$ CB_SALT=0x... DIAMOND=0x... FACETS=CbPaymentsFacet ./script/run.sh arcmainnet DiamondCutUpgrade
```

Bump `CB_SALT` for an upgrade whose *source changed* (so the new facet lands at a fresh CREATE2 address); reusing
the deploy-time salt with unchanged source is a no-op (nothing to cut).

## Admin runbook

Every admin operation is its own script under `script/admin/`, a thin, env-driven call through `IChainbills` at
`DIAMOND` (defaulted by `run.sh` from `deploys/<chain>.json` when not already set). Run any of them with:

```shell
$ ./script/run.sh <chain> <ScriptName> [<target-chain>] [--dry-run]
```

Passing a `<target-chain>` makes `run.sh` derive `FOREIGN_*` variables from that chain's env and (for
`RegisterForeignChain`/`UpdateForeignChain`) its `deploys/<chain>.json`.

| Script | Env | Notes |
|---|---|---|
| `RegisterForeignChain` / `UpdateForeignChain` | `TARGET_CHAIN`, `FOREIGN_CB_CHAIN_ID` | Every messaging address role defaults to the target chain's diamond. Optional: `FOREIGN_WORMHOLE_CHAIN_ID`, `FOREIGN_CIRCLE_DOMAIN`, `SWITCH_*`, `FINALITY_*`, `MAX_OUTBOUND_CCTP_FEE_BPS`. |
| `UnregisterForeignChain` | `FOREIGN_CB_CHAIN_ID` | Mirrored payables and nonces are kept. |
| `SetForeignChainSwitches` / `SetForeignChainFinality` / `SetForeignChainLimits` | `FOREIGN_CB_CHAIN_ID`, plus the relevant fields | Partial updates to an already-registered chain. |
| `RegisterMatchingToken` / `UnregisterMatchingToken` | `TARGET_CHAIN`, `FOREIGN_CB_CHAIN_ID`, `FOREIGN_TOKEN`, `LOCAL_TOKEN` | Maps a foreign token to a local one. |
| `AllowPaymentsForToken` / `StopPaymentsForToken` | `TOKEN` | |
| `SetTokenFeeConfig` / `SetTokenPaymentLimits` / `SetTokenTransferTaxAllowed` | `TOKEN`, plus fields | |
| `SetWithdrawalFeeBps` / `SetFeeCollector` / `SetMaxAllowedTokensAndAmounts` | field-specific | |
| `SetRelayerRestricted` / `SetPublishPayableRestricted` | bool field | |
| `SetupCctp` / `SetupWormhole` | `TOKEN_MESSENGER`, or `WORMHOLE_ADDRESS` + `WORMHOLE_CHAIN_ID` + `WORMHOLE_FINALITY` | |
| `GrantRole` / `RevokeRole` | `ROLE_NAME` (e.g. `TOKEN_MANAGER_ROLE`), `ACCOUNT` | Role names resolved through the diamond's own getters. |
| `PauseFeatures` / `UnpauseFeatures` | `FEATURE_NAMES` (e.g. `PAY,PAY_FOREIGN`) | |
| `Pause` / `Unpause` | — | Global pause. |
| `TransferOwnership` / `AcceptOwnership` | `NEW_OWNER` | Two-step. |
| `RescueUntrackedBalance` | `TOKEN`, `TO` | |
| `AdminSyncForeignPayable` | `PAYABLE_ID`, `FOREIGN_CB_CHAIN_ID`, `NONCE`, `INITIATED_AT`, `ACTION_TYPE`, `IS_CLOSED`, optional `ALLOWED_TOKENS`/`ALLOWED_AMOUNTS` | Requires `PAYABLE_SYNC_ROLE`. |
| `ComputeCbChainId` | `CAIP2` | Pure computation; no `DIAMOND`, no broadcast. |

```shell
# Register Sepolia and Arc mainnet as foreign chains of each other
$ ./script/run.sh sepolia    RegisterForeignChain arcmainnet
$ ./script/run.sh arcmainnet RegisterForeignChain sepolia

# Pause outbound and inbound cross-chain payments
$ FEATURE_NAMES=PAY_FOREIGN,RECEIVE_FOREIGN_PAYMENT ./script/run.sh arcmainnet PauseFeatures

# Grant a relayer
$ ROLE_NAME=RELAYER_ROLE ACCOUNT=0x... ./script/run.sh arcmainnet GrantRole
```

## Testing

```shell
forge build
forge test
FOUNDRY_PROFILE=lite forge test        # fast profile
FOUNDRY_PROFILE=deep forge test        # heavy fuzz and invariants
forge test --match-path 'test/payments/*' -vvv
forge coverage --ir-minimum
forge fmt
cast index-erc7201 chainbills.<domain>
```

`test/script/*.t.sol` run the deploy, upgrade, and foreign-chain-registration scripts in-process — instantiating
the script contracts directly and calling their `deploy`, `upgrade`, `register`, and `update` functions with config
structs instead of env vars. No process-environment side effects, so these tests run cleanly under the default
parallel runner.

`script/DeployLocalStack.s.sol` needs a generous gas ceiling for its single simulated call (it deploys two full
diamonds): `anvil --gas-limit 18446744073709551615` (or let `run.sh` add `--gas-limit` automatically, which it does
for `DeployLocalStack` specifically).

## ABI export

`node script/export-abi.mjs` (or `npm run abi:export`) reads `out/IChainbills.sol/IChainbills.json` — the
aggregate interface's full ABI, every routed function plus `ICbErrors` and `ICbEvents` — and the error ABIs of
`Diamond`, `LibDiamond`, and `CbFacetSet` (diamond- and cut-level reverts that live outside `IChainbills`), dedupes
by canonical signature (equivalent to deduping by selector/topic, without needing a hash function), and writes:

- `abi/chainbills.json` — the combined ABI as JSON.
- `abi/chainbills.ts` — the same array as `export const chainbillsAbi = [...] as const;`.
- `abi/facets/ICb<Facet>.json` — one file per facet interface, its own ABI only.

Plain Node, no runtime dependencies (`package.json` has no `dependencies` — `abi:export` is its only script). Run
`forge build` first; the export reads build artifacts, not source.
