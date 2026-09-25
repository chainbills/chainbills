# Chainbills EVM — Deployed Parameters

Reference for the values used to configure Chainbills on every EVM chain it is deployed to. Update this file after
every deployment or admin call — `deploys/<chain>.json` (written by `DeployChainbills`) is the source of truth for
contract addresses; this file is the source of truth for the external protocol addresses and IDs that go into
`script/env/<chain>.env`.

> **Sources**: [Wormhole docs](https://wormhole.com/docs/reference/contract-addresses/) ·
> [Circle CCTP V2 docs](https://developers.circle.com/cctp/evm-smart-contracts) ·
> [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses) ·
> [Arc network docs](https://docs.arc.io/arc/references/contract-addresses)

---

## Chain parameters

| Chain          | CAIP-2 String       | cbChainId (bytes32)                                                   | Wormhole Chain ID | Circle Domain |
| -------------- | ------------------- | ----------------------------------------------------------------------- | ------------------ | ------------- |
| Arc Mainnet    | `eip155:5042`       | `0xb8aed675f862d651b4a8c85f23a045faa0faaa1d162e6eb15d732231df3dc250`   | not confirmed live | 26 |
| Arc Testnet    | `eip155:5042002`    | `0xfcfa255b5b1c8e2b9672ea5d7a51e54c78ecbf0f0e87607e8b86ec2cfd25d4fd`   | not available      | 26 |
| Base Sepolia   | `eip155:84532`      | `0x8a9a9c58b754a98f1ff302a7ead652cfd23eb36a5791767b5d185067dd9481c2`   | 10004              | 6  |
| Base Mainnet   | `eip155:8453`       | `0x43b48883ef7be0f98fe7f98fafb2187e42caab4063697b32816f95e09d69b3ec`   | 30                 | 6  |

> Compute any cbChainId with (example for Arc Testnet):
>
> ```shell
> CAIP2=eip155:5042002 ./script/run.sh arctestnet ComputeCbChainId
> ```

---

## Wormhole contracts

| Chain         | Core Contract                                | Wormhole Chain ID | Finality |
| ------------- | --------------------------------------------- | ------------------ | -------- |
| Arc Mainnet   | not confirmed live on Arc mainnet             | not confirmed      | n/a      |
| Arc Testnet   | not available on Arc testnet                  | not available      | n/a      |
| Base Sepolia  | `0x79A1027a6A159502049F10906D333EC57E95F083` | 10004              | 1        |
| Base Mainnet  | TODO(owner): confirm from Wormhole docs       | 30                 | 1        |

> Wormhole reference: https://wormhole.com/docs/reference/contract-addresses/. Leave `WORMHOLE_ADDRESS` empty in
> any chain's env file to skip Wormhole configuration at deploy time.

---

## Circle CCTP contracts

All testnet chains share the same CCTP V2 contract addresses — Circle deploys them to the same addresses on every
supported chain. Source: https://developers.circle.com/cctp/evm-smart-contracts

| Chain         | Domain | TokenMessengerV2                               | MessageTransmitterV2                           | USDC                                           |
| ------------- | ------ | ----------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| Arc Mainnet   | 26     | TODO(owner): confirm from Arc docs              | TODO(owner)                                     | TODO(owner): ERC-20 interface of native USDC    |
| Arc Testnet   | 26     | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`   | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275`   | `0x3600000000000000000000000000000000000000`   |
| Base Sepolia  | 6      | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`   | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275`   | `0x036CbD53842c5426634e7929541eC2318f3dCF7e`   |
| Base Mainnet  | 6      | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d`   | TODO(owner): confirm from Circle docs           | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`   |

> On Arc, USDC is the native gas token; the address listed is its ERC-20 interface.
> `MessageTransmitterV2` is not passed to `SetupCctp` directly — it is read from the TokenMessenger's own wiring.

---

## Chainbills contracts

Filled in from `deploys/<chain>.json` after each deploy — same `CB_SALT` and `OWNER` produce the same diamond
address on every chain.

| Chain         | Diamond Address |
| ------------- | ---------------- |
| Arc Mainnet   | TODO(owner): fill in from `deploys/arcmainnet.json` after deploying |
| Arc Testnet   | TODO(owner): fill in from `deploys/arctestnet.json` after deploying |
| Base Sepolia  | TODO(owner): fill in from `deploys/basesepolia.json` after deploying |
| Base Mainnet  | TODO(owner): fill in from `deploys/base.json` after deploying |

---

## Cross-chain registration matrix

`RegisterForeignChain` and `RegisterMatchingToken` are **one-sided**: each teaches the chain it runs on about a
foreign chain. Registering a pair of chains against each other needs both scripts run on each side (4 runs total
for a 2-chain setup). No foreign chain pair is registered yet.

| On chain      | Registering   | RegisterForeignChain | RegisterMatchingToken |
| ------------- | ------------- | --------------------- | ----------------------- |
| Arc Testnet   | Base Sepolia  | TODO(owner)           | TODO(owner)             |
| Base Sepolia  | Arc Testnet   | TODO(owner)           | TODO(owner)             |
| Arc Mainnet   | Base Mainnet  | TODO(owner)           | TODO(owner)             |
| Base Mainnet  | Arc Mainnet   | TODO(owner)           | TODO(owner)             |
