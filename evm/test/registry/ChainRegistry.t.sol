// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CCTP_FINALITY_FAST, CCTP_FINALITY_FINALIZED, MAX_BPS} from 'src/types/CbConstants.sol';
import {CHAIN_MANAGER_ROLE} from 'src/types/CbRoles.sol';
import {
  ForeignChainAddresses,
  ForeignChainConfig,
  ForeignChainFinality,
  ForeignChainLimits,
  ForeignChainProtocolIds,
  ForeignChainSwitches
} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

contract ChainRegistryTest is CbTestBase {
  bytes32 internal chainX = keccak256('eip155:100');
  bytes32 internal chainY = keccak256('eip155:101');
  bytes32 internal remoteAddr = bytes32(uint256(uint160(makeAddr('remote-diamond'))));

  /// A minimal config with only Wormhole wired.
  function _wormholeOnlyConfig(uint16 wormholeChainId) internal view returns (ForeignChainConfig memory config) {
    config.protocolIds = ForeignChainProtocolIds(wormholeChainId, true, 0, false);
    config.addresses.wormholeEmitter = remoteAddr;
  }

  /// A minimal config with only CCTP wired, valid finality.
  function _cctpOnlyConfig(uint32 circleDomain) internal view returns (ForeignChainConfig memory config) {
    config.protocolIds = ForeignChainProtocolIds(0, false, circleDomain, true);
    config.addresses = ForeignChainAddresses({
      wormholeEmitter: bytes32(0),
      cctpMessageSender: remoteAddr,
      cctpBurnSender: remoteAddr,
      cctpRecipient: remoteAddr,
      cctpMintRecipient: remoteAddr,
      cctpDestinationCaller: remoteAddr
    });
    config.finality = ForeignChainFinality({
      outboundUpdateFinality: CCTP_FINALITY_FAST,
      outboundPaymentFinality: CCTP_FINALITY_FAST,
      minInboundUpdateFinality: CCTP_FINALITY_FAST,
      minInboundPaymentFinality: CCTP_FINALITY_FAST
    });
  }

  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------

  function test_RegisterForeignChain_EmitsRegisteredAndSections() public {
    ForeignChainConfig memory config = _wormholeOnlyConfig(9);
    vm.expectEmit(true, true, true, true, address(cb));
    emit ForeignChainRegistered(chainX);
    vm.expectEmit(true, true, true, true, address(cb));
    emit ForeignChainProtocolIdsUpdated(chainX, config.protocolIds);
    vm.prank(owner);
    cb.registerForeignChain(chainX, config);
  }

  function test_RevertWhen_RegisterForeignChain_ZeroChainId() public {
    vm.expectRevert(InvalidChainId.selector);
    vm.prank(owner);
    cb.registerForeignChain(bytes32(0), _wormholeOnlyConfig(9));
  }

  function test_RevertWhen_RegisterForeignChain_IsOwnChain() public {
    vm.expectRevert(InvalidChainId.selector);
    vm.prank(owner);
    cb.registerForeignChain(chainA.cbChainId, _wormholeOnlyConfig(9));
  }

  function test_RevertWhen_RegisterForeignChain_AlreadyRegistered() public {
    vm.startPrank(owner);
    cb.registerForeignChain(chainX, _wormholeOnlyConfig(9));
    vm.expectRevert(abi.encodeWithSelector(ForeignChainAlreadyRegistered.selector, chainX));
    cb.registerForeignChain(chainX, _wormholeOnlyConfig(10));
    vm.stopPrank();
  }

  function test_RevertWhen_RegisterForeignChain_CallerLacksChainManagerRole() public {
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, CHAIN_MANAGER_ROLE));
    vm.prank(stranger);
    cb.registerForeignChain(chainX, _wormholeOnlyConfig(9));
  }

  function test_RevertWhen_RegisterForeignChain_WormholeChainIdZero() public {
    ForeignChainConfig memory config = _wormholeOnlyConfig(0);
    vm.expectRevert(InvalidChainId.selector);
    vm.prank(owner);
    cb.registerForeignChain(chainX, config);
  }

  function test_RevertWhen_RegisterForeignChain_WormholeChainIdTaken() public {
    vm.startPrank(owner);
    cb.registerForeignChain(chainX, _wormholeOnlyConfig(9));
    vm.expectRevert(abi.encodeWithSelector(WormholeChainIdTaken.selector, uint16(9), chainX));
    cb.registerForeignChain(chainY, _wormholeOnlyConfig(9));
    vm.stopPrank();
  }

  function test_RevertWhen_RegisterForeignChain_MissingWormholeEmitter() public {
    ForeignChainConfig memory config;
    config.protocolIds = ForeignChainProtocolIds(9, true, 0, false);
    vm.expectRevert(InvalidForeignChainAddress.selector);
    vm.prank(owner);
    cb.registerForeignChain(chainX, config);
  }

  function test_RevertWhen_RegisterForeignChain_CircleDomainTaken() public {
    vm.startPrank(owner);
    cb.registerForeignChain(chainX, _cctpOnlyConfig(5));
    vm.expectRevert(abi.encodeWithSelector(CircleDomainTaken.selector, uint32(5), chainX));
    cb.registerForeignChain(chainY, _cctpOnlyConfig(5));
    vm.stopPrank();
  }

  function test_RevertWhen_RegisterForeignChain_MissingCctpAddress() public {
    ForeignChainConfig memory config = _cctpOnlyConfig(5);
    config.addresses.cctpBurnSender = bytes32(0);
    vm.expectRevert(InvalidForeignChainAddress.selector);
    vm.prank(owner);
    cb.registerForeignChain(chainX, config);
  }

  function test_RevertWhen_RegisterForeignChain_CctpSwitchWithoutDomain() public {
    ForeignChainConfig memory config = _wormholeOnlyConfig(9);
    config.switches.isOutboundPaymentEnabled = true;
    vm.expectRevert(InvalidForeignChainAddress.selector);
    vm.prank(owner);
    cb.registerForeignChain(chainX, config);
  }

  function test_RevertWhen_RegisterForeignChain_InboundUpdatesWithoutProtocol() public {
    ForeignChainConfig memory config;
    config.switches.isInboundUpdateEnabled = true;
    vm.expectRevert(InvalidForeignChainAddress.selector);
    vm.prank(owner);
    cb.registerForeignChain(chainX, config);
  }

  function test_RevertWhen_RegisterForeignChain_FeeBpsTooHigh() public {
    ForeignChainConfig memory config = _wormholeOnlyConfig(9);
    config.limits = ForeignChainLimits({hasMaxOutboundCctpFeeBps: true, maxOutboundCctpFeeBps: MAX_BPS + 1});
    vm.expectRevert(abi.encodeWithSelector(InvalidFeeBps.selector, MAX_BPS + 1));
    vm.prank(owner);
    cb.registerForeignChain(chainX, config);
  }

  function test_RevertWhen_RegisterForeignChain_InvalidOutboundUpdateFinality() public {
    ForeignChainConfig memory config = _cctpOnlyConfig(5);
    config.finality.outboundUpdateFinality = 1500;
    vm.expectRevert(abi.encodeWithSelector(InvalidFinalityThreshold.selector, uint32(1500)));
    vm.prank(owner);
    cb.registerForeignChain(chainX, config);
  }

  function test_RevertWhen_RegisterForeignChain_InvalidOutboundPaymentFinality() public {
    ForeignChainConfig memory config = _cctpOnlyConfig(5);
    config.finality.outboundPaymentFinality = 1;
    vm.expectRevert(abi.encodeWithSelector(InvalidFinalityThreshold.selector, uint32(1)));
    vm.prank(owner);
    cb.registerForeignChain(chainX, config);
  }

  function test_RevertWhen_RegisterForeignChain_InboundUpdateFinalityTooHigh() public {
    ForeignChainConfig memory config = _cctpOnlyConfig(5);
    config.finality.minInboundUpdateFinality = CCTP_FINALITY_FINALIZED + 1;
    vm.expectRevert(abi.encodeWithSelector(InvalidFinalityThreshold.selector, CCTP_FINALITY_FINALIZED + 1));
    vm.prank(owner);
    cb.registerForeignChain(chainX, config);
  }

  function test_RevertWhen_RegisterForeignChain_InboundPaymentFinalityTooHigh() public {
    ForeignChainConfig memory config = _cctpOnlyConfig(5);
    config.finality.minInboundPaymentFinality = CCTP_FINALITY_FINALIZED + 1;
    vm.expectRevert(abi.encodeWithSelector(InvalidFinalityThreshold.selector, CCTP_FINALITY_FINALIZED + 1));
    vm.prank(owner);
    cb.registerForeignChain(chainX, config);
  }

  // ---------------------------------------------------------------------------
  // Update / unregister / re-register
  // ---------------------------------------------------------------------------

  function test_UpdateForeignChain_ReplacesConfiguration() public {
    vm.startPrank(owner);
    cb.registerForeignChain(chainX, _wormholeOnlyConfig(9));
    ForeignChainConfig memory updated = _cctpOnlyConfig(5);
    vm.expectEmit(true, true, true, true, address(cb));
    emit ForeignChainProtocolIdsUpdated(chainX, updated.protocolIds);
    cb.updateForeignChain(chainX, updated);
    vm.stopPrank();
  }

  function test_RevertWhen_UpdateForeignChain_NotRegistered() public {
    vm.expectRevert(abi.encodeWithSelector(ForeignChainNotRegistered.selector, chainX));
    vm.prank(owner);
    cb.updateForeignChain(chainX, _wormholeOnlyConfig(9));
  }

  function test_UnregisterForeignChain_EmitsAndAllowsReRegistration() public {
    vm.startPrank(owner);
    cb.registerForeignChain(chainX, _wormholeOnlyConfig(9));
    vm.expectEmit(true, true, true, true, address(cb));
    emit ForeignChainUnregistered(chainX);
    cb.unregisterForeignChain(chainX);

    // The Wormhole chain ID is free again, even for a different foreign chain.
    cb.registerForeignChain(chainY, _wormholeOnlyConfig(9));
    vm.stopPrank();
  }

  function test_RevertWhen_UnregisterForeignChain_NotRegistered() public {
    vm.expectRevert(abi.encodeWithSelector(ForeignChainNotRegistered.selector, chainX));
    vm.prank(owner);
    cb.unregisterForeignChain(chainX);
  }

  // ---------------------------------------------------------------------------
  // Partial setters and reverse lookups
  // ---------------------------------------------------------------------------

  function test_SetForeignChainProtocolIds_MovesReverseLookup() public {
    vm.startPrank(owner);
    cb.registerForeignChain(chainX, _wormholeOnlyConfig(9));
    ForeignChainProtocolIds memory moved = ForeignChainProtocolIds(11, true, 0, false);
    vm.expectEmit(true, true, true, true, address(cb));
    emit ForeignChainProtocolIdsUpdated(chainX, moved);
    cb.setForeignChainProtocolIds(chainX, moved);

    // Wormhole chain ID 9 is now free.
    cb.registerForeignChain(chainY, _wormholeOnlyConfig(9));
    vm.stopPrank();
  }

  function test_SetForeignChainAddresses_UpdatesAndEmits() public {
    vm.startPrank(owner);
    cb.registerForeignChain(chainX, _wormholeOnlyConfig(9));
    ForeignChainAddresses memory addresses;
    addresses.wormholeEmitter = bytes32(uint256(uint160(makeAddr('new-emitter'))));
    vm.expectEmit(true, true, true, true, address(cb));
    emit ForeignChainAddressesUpdated(chainX, addresses);
    cb.setForeignChainAddresses(chainX, addresses);
    vm.stopPrank();
  }

  function test_SetForeignChainSwitches_UpdatesAndEmits() public {
    vm.startPrank(owner);
    cb.registerForeignChain(chainX, _cctpOnlyConfig(5));
    ForeignChainSwitches memory switches = ForeignChainSwitches({
      isCctpUpdateEnabled: true,
      isInboundUpdateEnabled: false,
      isOutboundPaymentEnabled: false,
      isInboundPaymentEnabled: false
    });
    vm.expectEmit(true, true, true, true, address(cb));
    emit ForeignChainSwitchesUpdated(chainX, switches);
    cb.setForeignChainSwitches(chainX, switches);
    vm.stopPrank();
  }

  function test_SetForeignChainFinality_UpdatesAndEmits() public {
    vm.startPrank(owner);
    cb.registerForeignChain(chainX, _cctpOnlyConfig(5));
    ForeignChainFinality memory finality = ForeignChainFinality({
      outboundUpdateFinality: CCTP_FINALITY_FINALIZED,
      outboundPaymentFinality: CCTP_FINALITY_FINALIZED,
      minInboundUpdateFinality: CCTP_FINALITY_FINALIZED,
      minInboundPaymentFinality: CCTP_FINALITY_FINALIZED
    });
    vm.expectEmit(true, true, true, true, address(cb));
    emit ForeignChainFinalityUpdated(chainX, finality);
    cb.setForeignChainFinality(chainX, finality);
    vm.stopPrank();
  }

  function test_SetForeignChainLimits_UpdatesAndEmits() public {
    vm.startPrank(owner);
    cb.registerForeignChain(chainX, _wormholeOnlyConfig(9));
    ForeignChainLimits memory limits = ForeignChainLimits({hasMaxOutboundCctpFeeBps: true, maxOutboundCctpFeeBps: 100});
    vm.expectEmit(true, true, true, true, address(cb));
    emit ForeignChainLimitsUpdated(chainX, limits);
    cb.setForeignChainLimits(chainX, limits);
    vm.stopPrank();
  }

  function test_RevertWhen_PartialSetters_NotRegistered() public {
    vm.expectRevert(abi.encodeWithSelector(ForeignChainNotRegistered.selector, chainX));
    vm.prank(owner);
    cb.setForeignChainSwitches(chainX, ForeignChainSwitches(false, false, false, false));
  }

  function test_RevertWhen_PartialSetters_CallerLacksChainManagerRole() public {
    vm.startPrank(owner);
    cb.registerForeignChain(chainX, _wormholeOnlyConfig(9));
    vm.stopPrank();
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, CHAIN_MANAGER_ROLE));
    vm.prank(stranger);
    cb.setForeignChainLimits(chainX, ForeignChainLimits(false, 0));
  }
}
