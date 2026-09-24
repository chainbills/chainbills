// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {
  ForeignChainAddresses,
  ForeignChainConfig,
  ForeignChainFinality,
  ForeignChainLimits,
  ForeignChainProtocolIds,
  ForeignChainSwitches
} from '../types/CbTypes.sol';

/// Foreign chain registration and messaging settings. Every function requires `CHAIN_MANAGER_ROLE`.
interface ICbChainRegistry {
  /// Registers a foreign chain.
  /// @param cbChainId CAIP-2 chain identifier; not zero and not this chain.
  /// @param config Full configuration.
  function registerForeignChain(bytes32 cbChainId, ForeignChainConfig calldata config) external;

  /// Replaces the full configuration of a registered foreign chain.
  /// @param cbChainId CAIP-2 chain identifier.
  /// @param config Full configuration.
  function updateForeignChain(bytes32 cbChainId, ForeignChainConfig calldata config) external;

  /// Unregisters a foreign chain. Mirrored payables and nonces are kept.
  /// @param cbChainId CAIP-2 chain identifier.
  function unregisterForeignChain(bytes32 cbChainId) external;

  /// Sets the Wormhole chain ID and Circle domain of a registered foreign chain.
  /// @param cbChainId CAIP-2 chain identifier.
  /// @param protocolIds New protocol identifiers.
  function setForeignChainProtocolIds(bytes32 cbChainId, ForeignChainProtocolIds calldata protocolIds) external;

  /// Sets the messaging addresses of a registered foreign chain.
  /// @param cbChainId CAIP-2 chain identifier.
  /// @param addresses New addresses.
  function setForeignChainAddresses(bytes32 cbChainId, ForeignChainAddresses calldata addresses) external;

  /// Sets the direction switches of a registered foreign chain.
  /// @param cbChainId CAIP-2 chain identifier.
  /// @param switches New switches.
  function setForeignChainSwitches(bytes32 cbChainId, ForeignChainSwitches calldata switches) external;

  /// Sets the CCTP finality settings of a registered foreign chain.
  /// @param cbChainId CAIP-2 chain identifier.
  /// @param finality New finality settings.
  function setForeignChainFinality(bytes32 cbChainId, ForeignChainFinality calldata finality) external;

  /// Sets the outbound payment limits of a registered foreign chain.
  /// @param cbChainId CAIP-2 chain identifier.
  /// @param limits New limits.
  function setForeignChainLimits(bytes32 cbChainId, ForeignChainLimits calldata limits) external;
}
