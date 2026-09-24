# Chainbills EVM — Deployed Parameters

Reference for the values used to configure Chainbills on every EVM chain it is deployed to. Update this file after
every deployment or admin call — `deploys/<chain>.json` (written by `DeployChainbills`) is the source of truth for
contract addresses; this file is the source of truth for the external protocol addresses and IDs that go into
`script/env/<chain>.env`.

> **Sources**: [Wormhole docs](https://wormhole.com/docs/products/reference/contract-addresses/) ·
> [Circle CCTP V2 docs](https://developers.circle.com/stablecoins/docs/evm-cctp-contracts) ·
> [Arc network docs](https://docs.arc.network/arc/references/contract-addresses)

---

## Chain parameters

| Chain        | CAIP-2 String | cbChainId (bytes32)                                                 | Wormhole Chain ID           | Circle Domain |
| ------------ | ------------- | -------------------------------------------------------------------- | ---------------------------- | ------------- |
| Arc Mainnet  | `eip155:5042` | `0xb8aed675f862d651b4a8c85f23a045faa0faaa1d162e6eb15d732231df3dc250` | TODO(owner): not confirmed live on Arc mainnet yet | 26 |

> Compute any cbChainId with:
>
> ```shell
> CAIP2=eip155:5042 ./script/run.sh arcmainnet ComputeCbChainId
> ```

---

## Wormhole contracts

| Chain       | Core Contract        | Wormhole Chain ID | Finality |
| ----------- | --------------------- | ------------------ | -------- |
| Arc Mainnet | TODO(owner): confirm whether Wormhole is live on Arc mainnet, and if so its core bridge address | TODO(owner) | TODO(owner) |

> Wormhole reference: https://wormhole.com/docs/products/reference/contract-addresses/. Until this is filled in,
> leave `WORMHOLE_ADDRESS` empty in `script/env/arcmainnet.env` — `DeployChainbills` and `SetupWormhole` both skip
> Wormhole configuration when it is unset.

---

## Circle CCTP contracts

### Arc Mainnet (Circle Domain: 26)

| Contract            | Address                                       |
| -------------------- | ---------------------------------------------- |
| TokenMessenger       | TODO(owner): Circle TokenMessengerV2 on Arc mainnet |
| MessageTransmitter   | TODO(owner): Circle MessageTransmitterV2 on Arc mainnet (read from TokenMessenger's own wiring; not passed to `SetupCctp` directly) |
| USDC (native, ERC-20 interface) | TODO(owner): USDC address on Arc mainnet |

> On Arc, USDC is the native gas token; the address above is its ERC-20 interface. Circle reference:
> https://docs.arc.network/arc/references/contract-addresses

---

## Chainbills contracts

Filled in from `deploys/arcmainnet.json` after the first deploy — same diamond address on every chain that shares
`CB_SALT` and `OWNER` (see the README's [Deterministic deployment](./README.md#deterministic-deployment)).

| Chain       | Diamond Address |
| ----------- | ---------------- |
| Arc Mainnet | TODO(owner): fill in from `deploys/arcmainnet.json` after deploying |

---

## Cross-chain registration matrix

`RegisterForeignChain` and `RegisterMatchingToken` are **one-sided**: each teaches the chain it runs on about a
foreign chain. Registering a pair of chains against each other needs both scripts run on each side (4 runs total
for a 2-chain setup). No foreign chain pair is registered yet.

| On chain    | Registering | RegisterForeignChain | RegisterMatchingToken |
| ----------- | ------------ | --------------------- | ----------------------- |
| Arc Mainnet | TODO(owner): add a row per foreign chain once one is deployed | ☐ | ☐ |
