# Chainbills EVM — CLAUDE.md

## Overview

Solidity contracts (Foundry). UUPS upgradeable proxy pattern. Deployed on 3 chains: MegaETH (mainnet), Sepolia (testnet), Arc Testnet.

## File Map

```
src/
  Chainbills.sol         Main UUPS proxy — governance + thin delegatecall forwarders
  CbState.sol            All state variables (mappings, arrays, config)
  CbStructs.sol          All structs, enums (Config, Payable, UserPayment, etc.)
  CbEvents.sol           All events
  CbErrors.sol           All custom revert errors
  CbUtils.sol            Internal helpers: createId, initializeUser, wormhole fee check
  CbPayables.sol         Payable create/close/reopen/updateATAA + cross-chain broadcast
  CbTransactions.sol     pay / payForeignViaCctp / receiveForeignPaymentViaCctp / withdraw
  CbPayloadMessages.sol  ABI encode/decode for PayablePayload (type=1) and PaymentPayload (type=2)
  CbGetters.sol          Read-only wrapper for paginated + bulk state queries (separate deploy)
  circle/                ICircleBridge, IMessageTransmitter, ITokenMinter interfaces

script/
  run.sh                 Wrapper: loads chain env, broadcasts forge script
  env/
    arctestnet.env        Chain-specific addresses and config
    sepolia.env
    megaeth.env
    tokens.json
  DeployChainbills.s.sol
  UpgradeChainbills.s.sol
  SetupWormholeAndCircle.s.sol
  SetupCCTPOnly.s.sol
  SetupWormholeOnly.s.sol
  RegisterForeignChain.s.sol
  RegisterMatchingToken.s.sol
  UpdatePayablesLogic.s.sol
  UpdateTransactionsLogic.s.sol
  AllowPaymentsForToken.s.sol
  ...

test/
  CbSetup.t.sol           Base test setup (fork + deploy helpers)
  CbGovernance.t.sol
  CbPayablesManagement.t.sol
  CbPayablesFunds.t.sol
  CbTransactions (implied)
  CbCrossChain.t.sol
  CbCctpOnly.t.sol
  CbActivities.t.sol
  CbGetters.t.sol
  CbFuzz.t.sol
  mocks/                  MockWormhole, MockCircleBridge, MockCircleTransmitter, MockUSDC, RejectEth
```

## Three Deployed Contracts Per Chain

| Contract                          | Role                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `Chainbills` (UUPS proxy)         | Entry point; governance; delegates to logic contracts                          |
| `CbPayables` (logic)              | createPayable, closePayable, reopenPayable, updateATAA, receivePayableUpdate\* |
| `CbTransactions` (logic)          | pay, payForeignViaCctp, receiveForeignPaymentViaCctp, withdraw                 |
| `CbGetters` (separate, read-only) | Paginated + bulk reads; NOT in proxy                                           |

`CbGetters` is queried by both frontend and relayer — never the main proxy for reads.

## Upgradeability Rules

- `Chainbills.sol` only: use `UpgradeChainbills.s.sol` (UUPS `upgradeToAndCall`). Requires `prev-deploy/` JSON for OZ storage layout validation.
- `CbPayables.sol` or `CbTransactions.sol` only: use `UpdatePayablesLogic` / `UpdateTransactionsLogic`. No proxy upgrade needed — just redeploy logic contract and call `setPayablesLogic(addr)` or `setTransactionsLogic(addr)`.
- After a proxy upgrade that also changes logic: redeploy both logic contracts too.
- Storage layout: `uint256[100] __gap` at bottom of `CbState`. Don't add state variables above the gap.

## Cross-Chain Messaging Patterns

### Chains with both Wormhole + CCTP (Sepolia)

- Payable updates: one Wormhole `publishMessage` covers all registered Wormhole chains.
- Cross-chain payments: `depositForBurn` (CCTP) + `publishMessage` (Wormhole); relayer delivers both.

### Chains with CCTP only (Arc Testnet)

- Payable updates: iterate `registeredCbChainIds`, call `circleTransmitter().sendMessage()` per CCTP chain.
- Cross-chain payments: two CCTP messages — burn message + payload data message. `destinationCaller = address(this)` on both.

### Chains with Wormhole only (MegaETH)

- Payable updates: one Wormhole `publishMessage`.
- Cross-chain payments: not yet available (Circle CCTP not on MegaETH as of May 2026).

## Payload Discriminator

First byte of every cross-chain message body:

- `0x01` = `PayablePayload` (create/close/reopen/updateATAA)
- `0x02` = `PaymentPayload` (cross-chain payment)

`handleReceiveFinalizedMessage` / `handleReceiveUnfinalizedMessage` dispatch on this byte. Type 2 returns `true` immediately (payment recorded earlier in same tx by `receiveForeignPaymentViaCctp`).

## Token Conventions

- Native token (ETH) → represented as `address(this)` in all token fields
- ERC-20 → use token contract address directly
- Cross-chain tokens: `bytes32` Wormhole-normalized (left-padded 20-byte EVM address)
- Token mapping: `forForeignChainMatchingTokenAddresses[cbChainId][foreignToken] → localToken`

## ID Generation

```solidity
keccak256(abi.encodePacked(block.chainid, block.timestamp, entity, salt, count))
```

All IDs are `bytes32`. Entity salt is `EntityType` enum (Payable/Payment/Withdrawal/Activity).

## Running Scripts

```bash
# Preferred — loads env automatically
./script/run.sh <chain> <ScriptName> [<target-chain>] [--dry-run]

# Examples
./script/run.sh arctestnet DeployChainbills
./script/run.sh sepolia RegisterForeignChain arctestnet
./script/run.sh arctestnet UpdatePayablesLogic
TOKEN_NAME=USDC ./script/run.sh sepolia AllowPaymentsForToken

# Compute cbChainId
CAIP2=eip155:11155111 forge script script/ComputeCbChainId.s.sol -vvv
```

Private keys go in `script/env/<chain>.env.local` (gitignored).

## Test Commands

```bash
forge build
forge test
forge test --match-contract CbCrossChain -vvvv   # verbose cross-chain tests
forge fmt
```

Tests are end-to-end style using `ERC1967Proxy`. Mock contracts in `test/mocks/`.

## Deployed Addresses

See `DEPLOYED.md` for all proxy addresses, cbChainIds, Circle domains, Wormhole IDs.
Update `DEPLOYED.md` after every deployment or admin call.
