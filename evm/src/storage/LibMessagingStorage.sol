// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CctpPayableUpdateEmission, CctpStats, WormholeStats} from '../types/CbTypes.sol';

/// Replay protection, nonces, and message counters for cross-chain messaging.
/// @dev Append new fields at the end only.
library LibMessagingStorage {
  /// @custom:storage-location erc7201:chainbills.messaging
  struct Layout {
    /// Nonce assigned to the latest outbound payable update.
    uint64 lastPayableUpdateNonce;
    /// Whether a Wormhole message hash was consumed.
    mapping(bytes32 wormholeHash => bool) isWormholeMessageConsumed;
    /// Every consumed Wormhole message hash, in order.
    bytes32[] consumedWormholeMessages;
    /// Consumed Wormhole message hashes per emitter Wormhole chain.
    mapping(uint16 wormholeChainId => bytes32[]) consumedWormholeMessagesByChain;
    /// Consumed CCTP burn nonces per source domain.
    mapping(uint32 sourceDomain => mapping(bytes32 nonce => bool)) isCctpBurnNonceConsumed;
    /// Consumed CCTP data message nonces per source domain.
    mapping(uint32 sourceDomain => mapping(bytes32 nonce => bool)) isCctpDataNonceConsumed;
    /// Consumed payment nonces per payer chain and payer.
    mapping(bytes32 payerChainId => mapping(bytes32 payer => mapping(uint64 nonce => bool))) isPaymentNonceConsumed;
    /// Wormhole counters.
    WormholeStats wormholeStats;
    /// CCTP counters.
    CctpStats cctpStats;
    /// One entry per emitted CCTP payable-update message, in emission order. Length equals
    /// `cctpStats.emittedCctpPayableUpdateMessagesCount`; off-chain relayers walk it via
    /// `getEmittedCctpPayableUpdateMessages(offset, limit)` and fetch each attestation by
    /// `(destChainId, cctpNonce)` or `messageBodyHash`.
    CctpPayableUpdateEmission[] emittedCctpPayableUpdates;
  }

  /// keccak256(abi.encode(uint256(keccak256('chainbills.messaging')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0x4daedf43e753ae99f0444cd1a98f313501943452b221baae32bceb3f4035d700;

  /// Returns the storage pointer.
  /// @return $ Storage pointer.
  function layout() internal pure returns (Layout storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }
}
