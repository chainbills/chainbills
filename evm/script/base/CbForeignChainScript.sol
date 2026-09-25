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
  /// All env-readable fields for building a `ForeignChainConfig`. Construct directly from tests to bypass env reads.
  struct ForeignChainScriptParams {
    bool hasWormholeChainId;
    uint16 wormholeChainId;
    bool hasCircleDomain;
    uint32 circleDomain;
    bool isCctpUpdateEnabled;
    bool isInboundUpdateEnabled;
    bool isOutboundPaymentEnabled;
    bool isInboundPaymentEnabled;
    uint32 outboundUpdateFinality;
    uint32 outboundPaymentFinality;
    uint32 minInboundUpdateFinality;
    uint32 minInboundPaymentFinality;
    bool hasMaxOutboundCctpFeeBps;
    uint16 maxOutboundCctpFeeBps;
  }

  /// Reads the foreign-chain script env vars into a `ForeignChainScriptParams`. Every switch defaults to `true`;
  /// every finality defaults to `2000` (finalized); the fee cap is unset by default.
  function _readScriptParams() internal view returns (ForeignChainScriptParams memory p) {
    p.hasWormholeChainId = vm.envExists('FOREIGN_WORMHOLE_CHAIN_ID');
    if (p.hasWormholeChainId) p.wormholeChainId = uint16(vm.envUint('FOREIGN_WORMHOLE_CHAIN_ID'));
    p.hasCircleDomain = vm.envExists('FOREIGN_CIRCLE_DOMAIN');
    if (p.hasCircleDomain) p.circleDomain = uint32(vm.envUint('FOREIGN_CIRCLE_DOMAIN'));
    p.isCctpUpdateEnabled = vm.envOr('SWITCH_CCTP_UPDATE', true);
    p.isInboundUpdateEnabled = vm.envOr('SWITCH_INBOUND_UPDATE', true);
    p.isOutboundPaymentEnabled = vm.envOr('SWITCH_OUTBOUND_PAYMENT', true);
    p.isInboundPaymentEnabled = vm.envOr('SWITCH_INBOUND_PAYMENT', true);
    p.outboundUpdateFinality = uint32(vm.envOr('FINALITY_OUTBOUND_UPDATE', uint256(2000)));
    p.outboundPaymentFinality = uint32(vm.envOr('FINALITY_OUTBOUND_PAYMENT', uint256(2000)));
    p.minInboundUpdateFinality = uint32(vm.envOr('FINALITY_MIN_INBOUND_UPDATE', uint256(2000)));
    p.minInboundPaymentFinality = uint32(vm.envOr('FINALITY_MIN_INBOUND_PAYMENT', uint256(2000)));
    p.hasMaxOutboundCctpFeeBps = vm.envExists('MAX_OUTBOUND_CCTP_FEE_BPS');
    if (p.hasMaxOutboundCctpFeeBps) p.maxOutboundCctpFeeBps = uint16(vm.envUint('MAX_OUTBOUND_CCTP_FEE_BPS'));
  }

  /// Builds a `ForeignChainConfig` for `target` from `p`. Every messaging address role defaults to `target`.
  /// No env reads.
  function _buildForeignChainConfig(address target, ForeignChainScriptParams memory p)
    internal
    pure
    returns (ForeignChainConfig memory config)
  {
    bytes32 targetBytes32 = _toBytes32(target);

    config.protocolIds = ForeignChainProtocolIds({
      wormholeChainId: p.wormholeChainId,
      hasWormholeChainId: p.hasWormholeChainId,
      circleDomain: p.circleDomain,
      hasCircleDomain: p.hasCircleDomain
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
      isCctpUpdateEnabled: p.isCctpUpdateEnabled,
      isInboundUpdateEnabled: p.isInboundUpdateEnabled,
      isOutboundPaymentEnabled: p.isOutboundPaymentEnabled,
      isInboundPaymentEnabled: p.isInboundPaymentEnabled
    });

    config.finality = ForeignChainFinality({
      outboundUpdateFinality: p.outboundUpdateFinality,
      outboundPaymentFinality: p.outboundPaymentFinality,
      minInboundUpdateFinality: p.minInboundUpdateFinality,
      minInboundPaymentFinality: p.minInboundPaymentFinality
    });

    config.limits = ForeignChainLimits({
      hasMaxOutboundCctpFeeBps: p.hasMaxOutboundCctpFeeBps,
      maxOutboundCctpFeeBps: p.maxOutboundCctpFeeBps
    });
  }
}
