# Chainbills EVM — Deployed Parameters

This file is the reference for every value used during contract setup across all deployed EVM chains. Update it after each deployment or admin call.

> **Sources**: [Wormhole docs](https://wormhole.com/docs/products/reference/contract-addresses/) · [Circle CCTP V2 docs](https://developers.circle.com/stablecoins/docs/evm-cctp-contracts) · [Arc network docs](https://docs.arc.network/arc/references/contract-addresses)

---

## Chain Parameters

| Chain            | CAIP-2 String     | cbChainId (bytes32)                                                | Wormhole Chain ID       | Circle Domain           |
| ---------------- | ----------------- | ------------------------------------------------------------------ | ----------------------- | ----------------------- |
| MegaETH Mainnet  | `eip155:4326`     | _(run ComputeCbChainId)_                                           | 64                      | — (CCTP not on MegaETH) |
| Arc Testnet      | `eip155:5042002`  | 0xfcfa255b5b1c8e2b9672ea5d7a51e54c78ecbf0f0e87607e8b86ec2cfd25d4fd | — (Wormhole not on Arc) | 10                      |
| Ethereum Sepolia | `eip155:11155111` | 0xafa90c317deacd3d68f330a30f96e4fa7736e35e8d1426b2e1b2c04bce1c2fb7 | 10002                   | 0                       |

> Compute any cbChainId with:
>
> ```shell
> CAIP2=eip155:11155111 forge script script/ComputeCbChainId.s.sol -vvv
> ```

> **Note on MegaETH**: Circle CCTP is not deployed on MegaETH mainnet as of May 2026. Chainbills on MegaETH can only do same-chain payments in the meantime. Monitor [Circle's supported chains](https://developers.circle.com/stablecoins/docs/cctp-supported-blockchains) for updates.

---

## Wormhole Contracts

| Chain            | Core Contract                                | Wormhole Chain ID           | Finality  |
| ---------------- | -------------------------------------------- | --------------------------- | --------- |
| MegaETH Mainnet  | `0x3D5c2c2BEA15Af5D45F084834c535628C48c42A4` | _(verify in Wormhole docs)_ | Finalized |
| Ethereum Sepolia | `0xD0fb39f5a3361F21457653cB70F9D0C9bD86B66B` | `10002`                     | Finalized |
| Arc Testnet      | — (not deployed)                             | —                           | —         |

> Wormhole reference: https://wormhole.com/docs/products/reference/contract-addresses/

---

## Circle CCTP Contracts

> Circle CCTP V2 is deployed on Sepolia and Arc Testnet. It is **not** deployed on MegaETH mainnet.

### Ethereum Sepolia (Circle Domain: 0)

| Contract                | Address                                      |
| ----------------------- | -------------------------------------------- |
| TokenMessenger (V2)     | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` |
| MessageTransmitter (V2) | `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` |
| USDC                    | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |

### Arc Testnet (Circle Domain: 10)

| Contract                        | Address                                      |
| ------------------------------- | -------------------------------------------- |
| TokenMessenger                  | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| MessageTransmitter              | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` |
| USDC (native, ERC-20 interface) | `0x3600000000000000000000000000000000000000` |

> On Arc, USDC is the native gas token. The address above is the ERC-20 interface (6 decimals).
> Circle reference: https://docs.arc.network/arc/references/contract-addresses

---

## Chainbills Contracts

| Chain            | Proxy Address                                |
| ---------------- | -------------------------------------------- |
| Ethereum Sepolia | _(fill after deploy)_                        |
| Arc Testnet      | `0x92e67Bfe49466b18ccDF2A3A28B234AB68374c60` |
| MegaETH Mainnet  | _(fill after deploy)_                        |

---

## Cross-Chain Registration Matrix

Both `RegisterForeignChain` and `RegisterMatchingToken` are **one-sided**: they teach the current chain about a foreign chain. This means you must run both scripts on each chain in the pair (4 runs total for a 2-chain setup).

The only viable cross-chain pair right now is **Arc Testnet ↔ Ethereum Sepolia** (both have CCTP).
MegaETH mainnet cannot participate in cross-chain payments until Circle deploys CCTP there.

| On chain         | Registering        | RegisterForeignChain | RegisterMatchingToken |
| ---------------- | ------------------ | -------------------- | --------------------- |
| Arc Testnet      | → Ethereum Sepolia | ☐                    | ☐                     |
| Ethereum Sepolia | → Arc Testnet      | ☐                    | ☐                     |
