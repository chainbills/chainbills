# Chainbills - EVM

Chainbills is a cross-chain payment gateway that allows anyone (hosts) to receive any amount of cryptocurrency from everybody (payers), powered by [Wormhole](https://wormhole.com) and [Circle CCTP](https://www.circle.com/cross-chain-transfer-protocol). Chainbills deducts 2% from all withdrawals for fees and maintenance.

This subdirectory contains the development environment used for building the smart contracts that work in Ethereum Virtual Machine (EVM) compatible networks.

Chainbills uses EVM best practices to write, document, and test the contract in [Solidity](https://soliditylang.org/). The logic flows and data structures are in sync with the [Solana](../solana/) and [CosmWasm](../cosmwasm/) contracts. Multiple data structures with carefully chosen properties and types power the contract to serve its features.

For more about Chainbills' features and how things work overall, check the [top-level README](../README.md).

To understand the data structures and architecture of Chainbills' contracts, check the [ARCHITECTURE doc](../ARCHITECTURE.md).

Here you will find engineering specifics that apply to this EVM contract.

## Table of Contents

- [Native and ERC20 Tokens](#native-and-erc20-tokens)
- [Invalid Inputs](#invalid-inputs)
- [Modularity](#modularity)
- [Creating IDs](#creating-ids)
- [Upgradeability](#upgradeability)
- [`delegatecall`](#delegatecall)
- [State Getters and Pagination](#state-getters-and-pagination)
- [Tests](#tests)
- [About Foundry](#about-foundry)
- [Script Runner](#script-runner)
- [Deployed Parameters](#deployed-parameters)

## Native and ERC20 Tokens

Chainbills supports both native tokens (e.g., ETH) and ERC20 tokens (e.g., USDC) when recording data and handling funds.

Native Tokens don't have an address in EVM, but we use the address of the contract itself to represent them. For ERC20, we use their token contract addresses directly.

For example, when _recording_ a withdrawal, if the involved token was the chain's native token, we would use the address of the Chainbills contract on that chain, otherwise we would of course use the ERC20 token's contract address.

It is the same for every other time we need to record token details, like stating that a token is currently supported, setting its maximum withdrawal fees, specifying a payable's allowed tokens and amounts, and so on. Basically, any time we need to store a token address, we use the address of the Chainbills contract itself for native tokens.

When handling funds (payments and withdrawals), we use the appropriate call and checks based on the token type (native or ERC20) as mentioned above.

When a user makes a payment in native tokens, we confirm that the sent `msg.value` matches what we expect. For ERC20 tokens, we use the `transferFrom` function of the token contract to move the tokens from the payer to the host. The user should have approved the transfer beforehand.

```solidity
if (token == address(this)) {
  if (msg.value < amount) revert InsufficientPaymentValue();
  if (msg.value > amount) revert IncorrectPaymentValue();
} else {
  IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
}
```

When a user makes a withdrawal in native tokens, we use the `call` function to send the funds to the host. For ERC20 tokens, we use the `transfer` function of the token contract to move the tokens from the Chainbills contract to the host.

```solidity
if (token == address(this)) {
  (bool isWtdlSuccess,) = payable(_payable.host).call{value: amtDue}('');
  if (!isWtdlSuccess) revert UnsuccessfulWithdrawal();
} else {
  IERC20(token).safeTransfer(_payable.host, amtDue);
}
```

## Invalid Inputs

When users interact with the contract, we need to ensure that they provide valid inputs. The checks performed depends on the contract method that was called.

For example, when a user is creating a payable or making payments, we make the following checks:

```solidity
if (token == address(0)) revert InvalidTokenAddress();
if (!tokenDetails[token].isSupported) revert UnsupportedToken();
if (amount == 0) revert ZeroAmountSpecified();
```

In addition, we leverage Solidity's default empty/zero values for checking invalid inputs. For any given struct, if its core properties are empty or zero, we can assume that the struct is not initialized.

For example, to know if a payable is valid, we can check if its `host` address is not address zero. We can apply the same thing for user, token, payments, withdrawal details, and any other structs.

```solidity
if (payableId == bytes32(0)) revert InvalidPayableId();
if (payables[payableId].host == address(0)) revert InvalidPayableId();
if (userPayments[paymentId].payer == address(0)) revert InvalidPaymentId();
if (withdrawals[withdrawalId].host == address(0)) {
  revert InvalidWithdrawalId();
}
if (wallet == address(0) || users[wallet].chainCount == 0) {
  revert InvalidWalletAddress();
}
```

## Modularity

The Chainbills contract in EVM is split into multiple files to improve readability and maintainability. Each file contains a specific set of functionalities and altogether they form the complete Chainbills contract. They are all in the [`src`](./src/) directory and are as follows:

- **`CbErrors.sol`**: Contains all the custom errors used in the contract used in `revert` statements across all other files.
- **`CbEvents.sol`**: Contains all the events emitted by different files and functions in the contract.
- **`CbStructs.sol`**: Contains all the structs and enum used accross contract files.
- **`CbState.sol`**: Contains all the top-level state variables (mappings and arrays) used in the contract.
- **`CbGetters.sol`**: A dedicated, read-only contract that wraps the main Chainbills contract to provide safe, paginated, and bulk getters for all state variables.
- **`CbUtils.sol`**: Contains _internal_ utility functions used across multiple files like `createId`, `initializeUserIfNeedBe`, etc. It extends `CbState` to access state variables.
- **`CbPayables.sol`**: Contains all the functions related to payables (creating and updating). It extends `CbUtils` to access utility functions and state variables.
- **`CbTransactions.sol`**: Contains all the functions related to transactions (payments and withdrawals). It also extends `CbUtils` to access utility functions and state variables.
- **`Chainbills.sol`**: The main contract that uses all the other files. It extends multiple [OpenZeppelin](https://www.openzeppelin.com/) contracts for security and upgradeability. It also extends `CbUtils` to access utility functions and state variables. It links payables and transactions logic using `delegatecall` as described below.

## Creating IDs

Every entity or data structure in the contract (payables, payments, withdrawals, activities, etc.) is assigned a unique ID. These IDs are of the type `bytes32` and are created using the _internal_ `createId` function. The IDs are created by hashing the relevant seed data using the `keccak256` hashing algorithm. Relevant seed data includes:

- the native chain ID,
- current timestamp,
- reference entity (like user address or payable ID),
- salt (target entity like withdrawal or activity), and
- nth count of the new entity that will use the ID.

```solidity
function createId(bytes32 entity, EntityType salt, uint256 count) internal view returns (bytes32) {
  return keccak256(abi.encodePacked(block.chainid, block.timestamp, entity, salt, count));
}
```

## Upgradeability

EVM contracts by default are immutable. By design this was good for security, but it also meant that contracts could not get new features or bug fixes. The concept of proxies solve these problem.

Chainbills uses [OpenZeppelin (OZ) Upgrades](https://docs.openzeppelin.com/upgrades) (which uses proxies) to be upgradeable. Specifically, we use the latest [Universal Upgradeable Proxy Standard (UUPS) proxy](https://docs.openzeppelin.com/contracts/5.x/api/proxy) variant from OpenZeppelin. This variant is built with the [ERC1967 EIP standard](https://eips.ethereum.org/EIPS/eip-1967) in mind to handle storage slots collisions.

Overall, we don't need to do much ourselves directly for upgrading. We just have to extend the `UUPSUpgradeable` contract and declare the `_authorizeUpgrade` function in the main Chainbills contract. Also, we are using OZ's tooling in [the `scripts` directory](./scripts/) to deploy and upgrade the Chainbills contract in EVM.

When writing tests, we bare the above in mind when creating the `Chainbills` contract. We deploy the contract in the test's `setUp` function as follows:

```solidity
chainbills = Chainbills(payable(address(new ERC1967Proxy(address(new Chainbills()), ''))));
```

## `delegatecall`

In the EVM, a smart contract can call another with either `call`, `delegatecall`, or `staticcall`. The difference between them is how the context of the call is handled.

[`delegatecall`](https://docs.soliditylang.org/en/latest/introduction-to-smart-contracts.html#delegatecall-and-libraries) is a low-level function that allows a contract to call another contract while preserving the context of the calling contract. This means that the called contract can modify the state of the calling contract. This is what OZ proxies use to delegate calls to the implementation contract. As such, during an upgrade, we simply change the implementation (or logic) contract and maintain the state of the proxy contract.

Chainbills contains is a big contract and it exceeded the 24kb limit for a single contract. The bulk of logic are in the `CbPayables` and `CbTransactions` files. To keep the main Chainbills contract within range, we use `delegatecall` for public functions and forward them to the functions in these files. That way the appropriate logic is run for the same state. We also forward reverts and results to the original caller. For example:

```solidity
function createPayable(TokenAndAmount[] calldata, /* allowedTokensAndAmounts */ bool /* isAutoWithdraw */ )
  public
  payable
  nonReentrant
  returns (bytes32 payableId, uint64 wormholeMessageSequence)
{
  (bool success, bytes memory result) = payablesLogic.delegatecall(msg.data);
  if (!success) {
    assembly {
      revert(add(result, 32), mload(result))
    }
  } else {
    return abi.decode(result, (bytes32, uint64));
  }
}

function pay(bytes32, /* payableId */ address, /* token */ uint256 /* amount */ )
  public
  payable
  nonReentrant
  returns (bytes32 userPaymentId, bytes32 payablePaymentId)
{
  (bool success, bytes memory result) = transactionsLogic.delegatecall(msg.data);
  if (!success) {
    assembly {
      revert(add(result, 32), mload(result))
    }
  } else {
    return abi.decode(result, (bytes32, bytes32));
  }
}
```

Notwithstanding, the main Chainbills contract declares its governance methods (`onlyOnwer`) by itself.

Luckily, if there is an update to the internal flow of CbPayables or CbTransactions, we can redeploy new variants and set the new addresses as the logic handlers in the main Chainbills contract without upgrading Chainbills itself. Of course, only the deployer / owner wallet of Chainbills can do the upgrade.

## State Getters and Pagination

To maintain the main Chainbills contract within the EVM 24kb limit, all complex state retrieval and array pagination logic are offloaded to a standalone contract: `CbGetters.sol`.

Instead of bloating the main contract with dozens of struct-returning getters or `for`-loop pagination methods, `CbGetters` acts as a read-only wrapper. It takes the main `Chainbills` contract address in its constructor, casts it to `CbState`, and reads directly from the public state mappings and arrays.

**Key features of `CbGetters`:**

- **Paginated Arrays**: Exposes paginated endpoints for all global arrays (e.g., `chainActivityIdsPaginated(offset, limit)`) and mapped arrays (e.g., `payableActivityIdsPaginated(payableId, offset, limit)`).
- **Safe Slicing**: Implements internal pagination helpers that safely slice storage arrays to prevent "Out of Gas" or out-of-bounds errors when fetching massive lists.
- **Bulk Struct Fetching**: Allows clients to fetch multiple structs in a single RPC call by passing an array of IDs (e.g., `getPayablesBulk(bytes32[] ids)`).

When building frontends or writing tests that need to inspect the contract's state, you should interact with the `CbGetters` contract rather than calling the main `Chainbills` contract directly.

## Tests

The tests for the EVM contract are in the [`test`](./test/) directory. The tests are written in Solidity and use the [Forge](https://book.getfoundry.sh/forge/) testing framework. They are organized in an end-to-end fashion, that is in the context of a user, a payable, activities, or governance.

## About Foundry

This EVM Environment was generated with and uses [Foundry](https://book.getfoundry.sh/).

Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

Following are commands to use within this Foundry environment

```shell
# Build the contract(s)
$ forge build

# Run the tests
$ forge test

# Format the code
$ forge fmt

# Deploy the Contract
$ forge script script/DeployChainbills.s.sol --chain $CHAIN --rpc-url $RPC_URL --broadcast -vvv

# --- Post-deploy: chain setup (run once per chain) ---

# Set up Wormhole + Circle CCTP (most EVM chains)
$ forge script script/SetupWormholeAndCircle.s.sol --chain $CHAIN --rpc-url $RPC_URL --broadcast -vvvv

# Or, for chains without Wormhole (CCTP-only)
$ forge script script/SetupCCTPOnly.s.sol --chain $CHAIN --rpc-url $RPC_URL --broadcast -vvvv

# --- Cross-chain registration (run per foreign chain pair) ---

# Register a foreign peer chain (Circle domain + Wormhole ID + contract address)
$ forge script script/RegisterForeignChain.s.sol --chain $CHAIN --rpc-url $RPC_URL --broadcast -vvvv

# Register matching token addresses across chains (e.g. USDC ↔ USDC)
$ forge script script/RegisterMatchingToken.s.sol --chain $CHAIN --rpc-url $RPC_URL --broadcast -vvvv

# --- Token / fee configuration ---

$ forge script script/AllowPaymentsForToken.s.sol --chain $CHAIN --rpc-url $RPC_URL --broadcast -vvvv
$ forge script script/UpdateMaxWithdrawalFees.s.sol --chain $CHAIN --rpc-url $RPC_URL --broadcast -vvvv

# --- Utility (no --broadcast needed) ---

# Compute the cbChainId for a CAIP-2 string
$ CAIP2=eip155:11155111 forge script script/ComputeCbChainId.s.sol -vvv

# More info on the commands
$ forge --help
$ anvil --help
$ cast --help
```

## Script Runner

Instead of manually exporting env vars and copying addresses before every `forge script` call, use the provided runner:

```shell
# Syntax
$ ./script/run.sh <chain> <ScriptName> [<target-chain>] [--dry-run]
```

The runner loads `script/env/<chain>.env`, which has all known protocol addresses and chain-specific configurations.

### 1. Environment Setup

Each chain has its own `.env` file in `script/env/`. **Private keys and sensitive overrides should go in `<chain>.env.local` (gitignored).**

```shell
# Example: One-time setup for Sepolia
$ cp .env.sample script/env/sepolia.env.local
# Edit script/env/sepolia.env.local to add PRIVATE_KEY and ETHERSCAN_API_KEY
```

### 2. Compulsory Deployment Config

For `DeployChainbills`, the following must be set in your chain's `.env` or `.env.local`:

- `FEE_COLLECTOR`: The address that receives protocol fees.
- `FEE_PERCENT`: Fee in basis points (e.g., `200` for 2%).

### 3. Auto-Verification

The runner supports automatic contract verification. Set these in your chain's `.env`:

- `VERIFY=true`: Enables verification on broadcast.
- `VERIFIER`: `etherscan` or `blockscout`.
- `VERIFIER_URL`: Required for `blockscout` (e.g., `https://testnet.arcscan.app/api/`).
- `ETHERSCAN_API_KEY`: Required for `etherscan` (put this in `.env.local`).

### 4. Examples

```shell
# Deploy and auto-verify on Arc Testnet
$ ./script/run.sh arctestnet DeployChainbills

# Post-deploy setup
$ ./script/run.sh arctestnet     SetupCCTPOnly
$ ./script/run.sh sepolia SetupWormholeAndCircle

# Cross-chain registration — pass the target chain as a 3rd argument.
# run.sh derives all FOREIGN_* variables automatically from that chain's env file.
# Both directions must be run (each chain teaches itself about the other).

$ ./script/run.sh sepolia RegisterForeignChain  arctestnet      # Sepolia learns about Arc
$ ./script/run.sh arctestnet    RegisterForeignChain  sepolia  # Arc learns about Sepolia
$ ./script/run.sh sepolia RegisterMatchingToken arctestnet      # "Arc USDC → my Sepolia USDC"
$ ./script/run.sh arctestnet    RegisterMatchingToken sepolia  # "Sepolia USDC → my Arc USDC"

# Adding a new chain? For each existing chain <c>, run 4 commands:
# $ ./script/run.sh <c>       RegisterForeignChain  <new>
# $ ./script/run.sh <c>       RegisterMatchingToken <new>
# $ ./script/run.sh <new>     RegisterForeignChain  <c>
# $ ./script/run.sh <new>     RegisterMatchingToken <c>

# Token & Admin config
$ TOKEN_NAME=USDC ./script/run.sh sepolia AllowPaymentsForToken
$ TOKEN_NAME=USDC ./script/run.sh sepolia StopPaymentsForToken

# Grant Admin role
$ ./script/run.sh arctestnet GrantAdminRole

# Unregister cross-chain token mapping
$ TOKEN_NAME=USDC ./script/run.sh sepolia UnregisterMatchingToken arctestnet

# Compute cbChainId (no PRIVATE_KEY needed, no broadcast)
$ ./script/run.sh megaeth ComputeCbChainId

# Dry-run any script without broadcasting
$ ./script/run.sh sepolia RegisterForeignChain arctestnet --dry-run
```

Before running a script, open the matching `script/env/<chain>.env` and fill in any blank fields (e.g., `CB_ADDRESS`, `FOREIGN_CB_ADDRESS`, `CB_CHAIN_ID` after you compute it). Each field has a comment explaining what it is.

```shell
# Build the contract(s)
$ forge build

# Run the tests
$ forge test

# Format the code
$ forge fmt

# More info on the Foundry toolchain
$ forge --help
$ anvil --help
$ cast --help
```

## Deployed Parameters

All deployed contract addresses, cbChainIds, Circle domains, and Wormhole IDs are tracked in [DEPLOYED.md](./DEPLOYED.md). Update that file after every deployment or admin setup call.
