// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Protocol-wide settings and messaging wiring of this chain.
/// @dev Append new fields at the end only.
library LibConfigStorage {
  /// @custom:storage-location erc7201:chainbills.config
  struct Layout {
    /// Whether the diamond initializer ran.
    bool isInitialized;
    /// CAIP-2 chain identifier of this chain.
    bytes32 cbChainId;
    /// Recipient of withdrawal fees.
    address feeCollector;
    /// Default withdrawal fee in basis points.
    uint16 withdrawalFeeBps;
    /// Maximum number of allowed tokens and amounts per local payable.
    uint8 maxAllowedTokensAndAmounts;
    /// Only `RELAYER_ROLE` holders may submit inbound messages.
    bool isRelayerRestricted;
    /// Only the host or a `RELAYER_ROLE` holder may republish a payable.
    bool isPublishPayableRestricted;
    /// Wormhole core bridge.
    address wormhole;
    /// Wormhole chain ID of this chain.
    uint16 wormholeChainId;
    /// Wormhole consistency level for published messages.
    uint8 wormholeFinality;
    /// Whether Wormhole is active.
    bool isWormholeEnabled;
    /// Circle TokenMessengerV2.
    address cctpTokenMessenger;
    /// Circle MessageTransmitterV2.
    address cctpMessageTransmitter;
    /// Circle TokenMinterV2.
    address cctpTokenMinter;
    /// Circle domain of this chain.
    uint32 cctpDomain;
    /// Whether CCTP is active.
    bool isCctpEnabled;
  }

  /// keccak256(abi.encode(uint256(keccak256('chainbills.config')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0x785d66e247857a97c4df3932620650ce564d9f4b7a78f6410325e95c449fad00;

  /// Returns the storage pointer.
  /// @return $ Storage pointer.
  function layout() internal pure returns (Layout storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }
}
