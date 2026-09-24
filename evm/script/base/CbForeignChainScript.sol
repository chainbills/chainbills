// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CbAdminScript} from './CbAdminScript.sol';
import {
  ForeignChainAddresses,
  ForeignChainConfig,
  ForeignChainFinality,
  ForeignChainLimits,
  ForeignChainProtocolIds,
  ForeignChainSwitches
} from '../../src/types/CbTypes.sol';

/// Shared config building for `RegisterForeignChain` and `UpdateForeignChain`.
abstract contract CbForeignChainScript is CbAdminScript {
  /// Builds a `ForeignChainConfig` for the foreign chain whose diamond is `target`. Every messaging address role
  /// defaults to `target`, since the target diamond plays every one of those roles for messages it sends and
  /// receives. Switches default to enabling every direction; finality defaults to `2000` (finalized) both ways;
  /// the outbound CCTP fee cap is left unset. Every default is overridable through env.
  ///
  /// Env read: `FOREIGN_WORMHOLE_CHAIN_ID`, `FOREIGN_CIRCLE_DOMAIN` (each enables the corresponding protocol when
  /// present), `SWITCH_CCTP_UPDATE`, `SWITCH_INBOUND_UPDATE`, `SWITCH_OUTBOUND_PAYMENT`, `SWITCH_INBOUND_PAYMENT`
  /// (bool, default true), `FINALITY_OUTBOUND_UPDATE`, `FINALITY_OUTBOUND_PAYMENT`, `FINALITY_MIN_INBOUND_UPDATE`,
  /// `FINALITY_MIN_INBOUND_PAYMENT` (uint32, default `2000`), `MAX_OUTBOUND_CCTP_FEE_BPS` (uint16, unset by
  /// default).
  function _buildForeignChainConfig(address target) internal view returns (ForeignChainConfig memory config) {
    bytes32 targetBytes32 = _toBytes32(target);

    bool hasWormhole = vm.envExists('FOREIGN_WORMHOLE_CHAIN_ID');
    bool hasCircle = vm.envExists('FOREIGN_CIRCLE_DOMAIN');
    config.protocolIds = ForeignChainProtocolIds({
      wormholeChainId: hasWormhole ? uint16(vm.envUint('FOREIGN_WORMHOLE_CHAIN_ID')) : 0,
      hasWormholeChainId: hasWormhole,
      circleDomain: hasCircle ? uint32(vm.envUint('FOREIGN_CIRCLE_DOMAIN')) : 0,
      hasCircleDomain: hasCircle
    });

    config.addresses = ForeignChainAddresses({
      wormholeEmitter: targetBytes32,
      cctpMessageSender: targetBytes32,
      cctpBurnSender: targetBytes32,
      cctpRecipient: targetBytes32,
      cctpMintRecipient: targetBytes32,
      cctpDestinationCaller: targetBytes32
    });

    config.switches = ForeignChainSwitches({
      isCctpUpdateEnabled: vm.envOr('SWITCH_CCTP_UPDATE', true),
      isInboundUpdateEnabled: vm.envOr('SWITCH_INBOUND_UPDATE', true),
      isOutboundPaymentEnabled: vm.envOr('SWITCH_OUTBOUND_PAYMENT', true),
      isInboundPaymentEnabled: vm.envOr('SWITCH_INBOUND_PAYMENT', true)
    });

    config.finality = ForeignChainFinality({
      outboundUpdateFinality: uint32(vm.envOr('FINALITY_OUTBOUND_UPDATE', uint256(2000))),
      outboundPaymentFinality: uint32(vm.envOr('FINALITY_OUTBOUND_PAYMENT', uint256(2000))),
      minInboundUpdateFinality: uint32(vm.envOr('FINALITY_MIN_INBOUND_UPDATE', uint256(2000))),
      minInboundPaymentFinality: uint32(vm.envOr('FINALITY_MIN_INBOUND_PAYMENT', uint256(2000)))
    });

    bool hasFeeCap = vm.envExists('MAX_OUTBOUND_CCTP_FEE_BPS');
    config.limits = ForeignChainLimits({
      hasMaxOutboundCctpFeeBps: hasFeeCap,
      maxOutboundCctpFeeBps: hasFeeCap ? uint16(vm.envUint('MAX_OUTBOUND_CCTP_FEE_BPS')) : 0
    });
  }
}
