// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

// Administers every other role. Granted to the initial owner at initialization.
bytes32 constant DEFAULT_ADMIN_ROLE = 0x00;

// Manages protocol-wide settings: Wormhole and CCTP wiring, payable limits, relay and publish policies.
bytes32 constant CONFIG_MANAGER_ROLE = keccak256('CONFIG_MANAGER_ROLE');

// Registers, updates, and unregisters foreign chains and their messaging settings.
bytes32 constant CHAIN_MANAGER_ROLE = keccak256('CHAIN_MANAGER_ROLE');

// Allows and stops tokens, sets payment limits and transfer-tax policy, and maps matching foreign tokens.
bytes32 constant TOKEN_MANAGER_ROLE = keccak256('TOKEN_MANAGER_ROLE');

// Sets the fee collector, the global withdrawal fee, and per-token fee overrides and caps.
bytes32 constant FEE_MANAGER_ROLE = keccak256('FEE_MANAGER_ROLE');

// Pauses the protocol globally or per feature.
bytes32 constant PAUSER_ROLE = keccak256('PAUSER_ROLE');

// Lifts a global or per-feature pause.
bytes32 constant UNPAUSER_ROLE = keccak256('UNPAUSER_ROLE');

// Submits inbound cross-chain messages when relaying is restricted.
bytes32 constant RELAYER_ROLE = keccak256('RELAYER_ROLE');

// Applies foreign payable state directly when no shared messaging protocol links two chains.
bytes32 constant PAYABLE_SYNC_ROLE = keccak256('PAYABLE_SYNC_ROLE');

// Moves token balances the diamond holds above the sum of all payable balances.
bytes32 constant RESCUER_ROLE = keccak256('RESCUER_ROLE');
