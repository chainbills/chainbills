// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Protocol-wide settings and messaging wiring.
interface ICbConfig {
  /// Sets the recipient of withdrawal fees. Caller must hold `FEE_MANAGER_ROLE`.
  /// @param feeCollector New fee collector.
  function setFeeCollector(address feeCollector) external;

  /// Sets the default withdrawal fee. Caller must hold `FEE_MANAGER_ROLE`.
  /// @param feeBps Fee in basis points, at most 10_000.
  function setWithdrawalFeeBps(uint16 feeBps) external;

  /// Sets the maximum number of allowed tokens and amounts per payable. Caller must hold `CONFIG_MANAGER_ROLE`.
  /// @param maxAllowedTokensAndAmounts New maximum, at least 1.
  function setMaxAllowedTokensAndAmounts(uint8 maxAllowedTokensAndAmounts) external;

  /// Restricts or opens inbound message submission. Caller must hold `CONFIG_MANAGER_ROLE`.
  /// @param isRelayerRestricted True to require `RELAYER_ROLE`.
  function setRelayerRestricted(bool isRelayerRestricted) external;

  /// Restricts or opens payable republishing. Caller must hold `CONFIG_MANAGER_ROLE`.
  /// @param isPublishPayableRestricted True to require the host or `RELAYER_ROLE`.
  function setPublishPayableRestricted(bool isPublishPayableRestricted) external;

  /// Wires Wormhole and enables it. Caller must hold `CONFIG_MANAGER_ROLE`.
  /// @param wormhole Wormhole core bridge on this chain.
  /// @param wormholeChainId Wormhole chain ID of this chain; must equal the bridge's `chainId()`.
  /// @param finality Consistency level for published messages.
  function setupWormhole(address wormhole, uint16 wormholeChainId, uint8 finality) external;

  /// Enables or disables Wormhole. Caller must hold `CONFIG_MANAGER_ROLE`.
  /// @param isEnabled New state.
  function setWormholeEnabled(bool isEnabled) external;

  /// Sets the consistency level for published Wormhole messages. Caller must hold `CONFIG_MANAGER_ROLE`.
  /// @param finality New consistency level.
  function setWormholeFinality(uint8 finality) external;

  /// Wires CCTP V2 from `tokenMessenger` and enables it. Transmitter, minter, and domain are read from Circle.
  /// Caller must hold `CONFIG_MANAGER_ROLE`.
  /// @param tokenMessenger Circle TokenMessengerV2 on this chain.
  function setupCctp(address tokenMessenger) external;

  /// Enables or disables CCTP. Caller must hold `CONFIG_MANAGER_ROLE`.
  /// @param isEnabled New state.
  function setCctpEnabled(bool isEnabled) external;
}
