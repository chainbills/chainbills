// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ChainbillsDiamondInit} from 'src/ChainbillsDiamondInit.sol';
import {IChainbills} from 'src/interfaces/IChainbills.sol';
import {MAX_BPS} from 'src/types/CbConstants.sol';
import {CONFIG_MANAGER_ROLE, FEE_MANAGER_ROLE} from 'src/types/CbRoles.sol';
import {CbDeployer} from '../base/CbDeployer.sol';
import {CbTestBase} from '../base/CbTestBase.sol';
import {MockMessageTransmitterV2, MockTokenMessengerV2, MockTokenMinterV2} from '../mocks/MockCctp.sol';
import {MockWormhole} from '../mocks/MockWormhole.sol';

contract ConfigTest is CbTestBase {
  address internal newFeeCollector = makeAddr('new-fee-collector');

  /// Deploys a diamond with neither Wormhole nor CCTP wired.
  function _deployUnconfigured() internal returns (IChainbills fresh) {
    vm.startPrank(owner);
    fresh = CbDeployer.deploy(
      owner,
      ChainbillsDiamondInit.InitParams({
        cbChainId: keccak256('eip155:99'),
        admin: owner,
        feeCollector: feeCollector,
        withdrawalFeeBps: DEFAULT_FEE_BPS,
        maxAllowedTokensAndAmounts: DEFAULT_MAX_ALLOWED_TOKENS_AND_AMOUNTS
      })
    );
    vm.stopPrank();
  }

  // ---------------------------------------------------------------------------
  // Fee collector and withdrawal fee
  // ---------------------------------------------------------------------------

  function test_SetFeeCollector_UpdatesAndEmits() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit FeeCollectorUpdated(newFeeCollector);
    vm.prank(owner);
    cb.setFeeCollector(newFeeCollector);
  }

  function test_RevertWhen_SetFeeCollector_Zero() public {
    vm.expectRevert(InvalidFeeCollector.selector);
    vm.prank(owner);
    cb.setFeeCollector(address(0));
  }

  function test_RevertWhen_SetFeeCollector_CallerLacksFeeManagerRole() public {
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, FEE_MANAGER_ROLE));
    vm.prank(stranger);
    cb.setFeeCollector(newFeeCollector);
  }

  function test_SetWithdrawalFeeBps_UpdatesAndEmits() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit WithdrawalFeeBpsUpdated(500);
    vm.prank(owner);
    cb.setWithdrawalFeeBps(500);
  }

  function test_RevertWhen_SetWithdrawalFeeBps_TooHigh() public {
    vm.expectRevert(abi.encodeWithSelector(InvalidFeeBps.selector, MAX_BPS + 1));
    vm.prank(owner);
    cb.setWithdrawalFeeBps(MAX_BPS + 1);
  }

  // ---------------------------------------------------------------------------
  // Payable limits and policy switches
  // ---------------------------------------------------------------------------

  function test_SetMaxAllowedTokensAndAmounts_UpdatesAndEmits() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit MaxAllowedTokensAndAmountsUpdated(5);
    vm.prank(owner);
    cb.setMaxAllowedTokensAndAmounts(5);
  }

  function test_RevertWhen_SetMaxAllowedTokensAndAmounts_Zero() public {
    vm.expectRevert(InvalidMaxAllowedTokensAndAmounts.selector);
    vm.prank(owner);
    cb.setMaxAllowedTokensAndAmounts(0);
  }

  function test_RevertWhen_SetMaxAllowedTokensAndAmounts_CallerLacksConfigManagerRole() public {
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, CONFIG_MANAGER_ROLE));
    vm.prank(stranger);
    cb.setMaxAllowedTokensAndAmounts(5);
  }

  function test_SetRelayerRestricted_UpdatesAndEmits() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit RelayerRestrictionUpdated(true);
    vm.prank(owner);
    cb.setRelayerRestricted(true);
  }

  function test_SetPublishPayableRestricted_UpdatesAndEmits() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit PublishPayableRestrictionUpdated(true);
    vm.prank(owner);
    cb.setPublishPayableRestricted(true);
  }

  // ---------------------------------------------------------------------------
  // Wormhole
  // ---------------------------------------------------------------------------

  function test_SetupWormhole_ConfiguresAndEnables() public {
    MockWormhole freshWormhole = new MockWormhole(9);
    vm.expectEmit(true, true, true, true, address(cb));
    emit WormholeConfigured(address(freshWormhole), 9, 3);
    vm.expectEmit(true, true, true, true, address(cb));
    emit WormholeEnabledUpdated(true);
    vm.prank(owner);
    cb.setupWormhole(address(freshWormhole), 9, 3);
  }

  function test_RevertWhen_SetupWormhole_ChainIdMismatch() public {
    MockWormhole freshWormhole = new MockWormhole(9);
    vm.expectRevert(InvalidWormholeConfig.selector);
    vm.prank(owner);
    cb.setupWormhole(address(freshWormhole), 42, 3);
  }

  function test_RevertWhen_SetupWormhole_NoCode() public {
    vm.expectRevert(InvalidWormholeConfig.selector);
    vm.prank(owner);
    cb.setupWormhole(address(0xdead), 2, 1);
  }

  function test_RevertWhen_SetupWormhole_ZeroFinality() public {
    MockWormhole freshWormhole = new MockWormhole(9);
    vm.expectRevert(InvalidWormholeConfig.selector);
    vm.prank(owner);
    cb.setupWormhole(address(freshWormhole), 9, 0);
  }

  function test_SetWormholeEnabled_TogglesAndEmits() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit WormholeEnabledUpdated(false);
    vm.prank(owner);
    cb.setWormholeEnabled(false);
  }

  function test_RevertWhen_SetWormholeEnabled_NotConfigured() public {
    // A fresh chain with no Wormhole wired cannot be enabled.
    IChainbills fresh = _deployUnconfigured();
    vm.expectRevert(WormholeNotEnabled.selector);
    vm.prank(owner);
    fresh.setWormholeEnabled(true);
  }

  function test_SetWormholeFinality_UpdatesAndEmits() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit WormholeFinalityUpdated(7);
    vm.prank(owner);
    cb.setWormholeFinality(7);
  }

  function test_RevertWhen_SetWormholeFinality_Zero() public {
    vm.expectRevert(InvalidWormholeConfig.selector);
    vm.prank(owner);
    cb.setWormholeFinality(0);
  }

  // ---------------------------------------------------------------------------
  // CCTP
  // ---------------------------------------------------------------------------

  function test_SetupCctp_ConfiguresAndEnables() public {
    MockMessageTransmitterV2 transmitter = new MockMessageTransmitterV2(5);
    MockTokenMinterV2 minter = new MockTokenMinterV2();
    MockTokenMessengerV2 messenger = new MockTokenMessengerV2(transmitter, minter);
    transmitter.setTokenMessenger(address(messenger));

    vm.expectEmit(true, true, true, true, address(cb));
    emit CctpConfigured(address(messenger), address(transmitter), address(minter), 5);
    vm.expectEmit(true, true, true, true, address(cb));
    emit CctpEnabledUpdated(true);
    vm.prank(owner);
    cb.setupCctp(address(messenger));
  }

  function test_RevertWhen_SetupCctp_NoCode() public {
    vm.expectRevert(InvalidCctpConfig.selector);
    vm.prank(owner);
    cb.setupCctp(address(0xdead));
  }

  function test_SetCctpEnabled_TogglesAndEmits() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit CctpEnabledUpdated(false);
    vm.prank(owner);
    cb.setCctpEnabled(false);
  }

  function test_RevertWhen_SetCctpEnabled_NotConfigured() public {
    IChainbills fresh = _deployUnconfigured();
    vm.expectRevert(CctpNotEnabled.selector);
    vm.prank(owner);
    fresh.setCctpEnabled(true);
  }

  function test_RevertWhen_ConfigSetters_CallerLacksConfigManagerRole() public {
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, CONFIG_MANAGER_ROLE));
    vm.prank(stranger);
    cb.setRelayerRestricted(true);
  }
}
