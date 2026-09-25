// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {MAX_BPS} from 'src/types/CbConstants.sol';
import {FEE_MANAGER_ROLE, TOKEN_MANAGER_ROLE} from 'src/types/CbRoles.sol';
import {TokenFeeConfig, TokenPaymentLimits} from 'src/types/CbTypes.sol';
import {MockERC20} from '../mocks/MockERC20.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

contract TokenRegistryTest is CbTestBase {
  MockERC20 internal token;
  bytes32 internal foreignToken = bytes32(uint256(uint160(makeAddr('foreign-token'))));
  bytes32 internal otherForeignToken = bytes32(uint256(uint160(makeAddr('other-foreign-token'))));

  function setUp() public override {
    super.setUp();
    token = new MockERC20('Token', 'TKN', 18);
    _setUpChainB();
  }

  // ---------------------------------------------------------------------------
  // Support toggles
  // ---------------------------------------------------------------------------

  function test_AllowPaymentsForToken_EmitsAllowed() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit TokenPaymentsAllowed(address(token));
    vm.prank(owner);
    cb.allowPaymentsForToken(address(token));
  }

  function test_StopPaymentsForToken_EmitsStopped() public {
    vm.startPrank(owner);
    cb.allowPaymentsForToken(address(token));
    vm.expectEmit(true, true, true, true, address(cb));
    emit TokenPaymentsStopped(address(token));
    cb.stopPaymentsForToken(address(token));
    vm.stopPrank();
  }

  function test_RevertWhen_AllowPaymentsForToken_ZeroAddress() public {
    vm.expectRevert(InvalidTokenAddress.selector);
    vm.prank(owner);
    cb.allowPaymentsForToken(address(0));
  }

  function test_RevertWhen_TokenSupportToggles_CallerLacksTokenManagerRole() public {
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, TOKEN_MANAGER_ROLE));
    vm.prank(stranger);
    cb.allowPaymentsForToken(address(token));
  }

  function test_SetTokenTransferTaxAllowed_EmitsAndUpdates() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit TokenTransferTaxAllowanceUpdated(address(token), true);
    vm.prank(owner);
    cb.setTokenTransferTaxAllowed(address(token), true);
  }

  // ---------------------------------------------------------------------------
  // Payment limits
  // ---------------------------------------------------------------------------

  function test_SetTokenPaymentLimits_EmitsAndUpdates() public {
    TokenPaymentLimits memory limits = TokenPaymentLimits(true, 10, true, 1000);
    vm.expectEmit(true, true, true, true, address(cb));
    emit TokenPaymentLimitsUpdated(address(token), limits);
    vm.prank(owner);
    cb.setTokenPaymentLimits(address(token), limits);
  }

  function test_RevertWhen_SetTokenPaymentLimits_MinAboveMax() public {
    TokenPaymentLimits memory limits = TokenPaymentLimits(true, 1000, true, 10);
    vm.expectRevert(InvalidPaymentLimits.selector);
    vm.prank(owner);
    cb.setTokenPaymentLimits(address(token), limits);
  }

  // ---------------------------------------------------------------------------
  // Fee configuration
  // ---------------------------------------------------------------------------

  function test_SetTokenFeeConfig_EmitsAndUpdates() public {
    TokenFeeConfig memory fee = TokenFeeConfig(true, 300, true, 500);
    vm.expectEmit(true, true, true, true, address(cb));
    emit TokenFeeConfigUpdated(address(token), fee);
    vm.prank(owner);
    cb.setTokenFeeConfig(address(token), fee);
  }

  function test_RevertWhen_SetTokenFeeConfig_TooHigh() public {
    TokenFeeConfig memory fee = TokenFeeConfig(true, MAX_BPS + 1, false, 0);
    vm.expectRevert(abi.encodeWithSelector(InvalidFeeBps.selector, MAX_BPS + 1));
    vm.prank(owner);
    cb.setTokenFeeConfig(address(token), fee);
  }

  function test_SetTokenFeeBps_OverridesGlobal() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit TokenFeeConfigUpdated(address(token), TokenFeeConfig(true, 50, false, 0));
    vm.prank(owner);
    cb.setTokenFeeBps(address(token), 50);
  }

  function test_RevertWhen_SetTokenFeeBps_TooHigh() public {
    vm.expectRevert(abi.encodeWithSelector(InvalidFeeBps.selector, MAX_BPS + 1));
    vm.prank(owner);
    cb.setTokenFeeBps(address(token), MAX_BPS + 1);
  }

  function test_ClearTokenFeeBps_RemovesOverride() public {
    vm.startPrank(owner);
    cb.setTokenFeeBps(address(token), 50);
    vm.expectEmit(true, true, true, true, address(cb));
    emit TokenFeeConfigUpdated(address(token), TokenFeeConfig(false, 0, false, 0));
    cb.clearTokenFeeBps(address(token));
    vm.stopPrank();
  }

  function test_SetTokenMaxWithdrawalFee_Caps() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit TokenFeeConfigUpdated(address(token), TokenFeeConfig(false, 0, true, 777));
    vm.prank(owner);
    cb.setTokenMaxWithdrawalFee(address(token), 777);
  }

  function test_ClearTokenMaxWithdrawalFee_RemovesCap() public {
    vm.startPrank(owner);
    cb.setTokenMaxWithdrawalFee(address(token), 777);
    vm.expectEmit(true, true, true, true, address(cb));
    emit TokenFeeConfigUpdated(address(token), TokenFeeConfig(false, 0, false, 0));
    cb.clearTokenMaxWithdrawalFee(address(token));
    vm.stopPrank();
  }

  function test_RevertWhen_FeeSetters_CallerLacksFeeManagerRole() public {
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, FEE_MANAGER_ROLE));
    vm.prank(stranger);
    cb.setTokenFeeBps(address(token), 50);
  }

  // ---------------------------------------------------------------------------
  // Matching tokens
  // ---------------------------------------------------------------------------

  function test_RegisterMatchingToken_EmitsRegistered() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit MatchingTokenRegistered(chainB.cbChainId, foreignToken, address(token));
    vm.prank(owner);
    cb.registerMatchingToken(chainB.cbChainId, foreignToken, address(token));
  }

  function test_RevertWhen_RegisterMatchingToken_UnregisteredChain() public {
    // forge-lint: disable-next-line(unsafe-typecast)
    vm.expectRevert(abi.encodeWithSelector(ForeignChainNotRegistered.selector, bytes32('nope')));
    vm.prank(owner);
    // forge-lint: disable-next-line(unsafe-typecast)
    cb.registerMatchingToken(bytes32('nope'), foreignToken, address(token));
  }

  function test_RevertWhen_RegisterMatchingToken_ZeroForeignToken() public {
    vm.expectRevert(InvalidForeignToken.selector);
    vm.prank(owner);
    cb.registerMatchingToken(chainB.cbChainId, bytes32(0), address(token));
  }

  function test_RevertWhen_RegisterMatchingToken_ZeroLocalToken() public {
    vm.expectRevert(InvalidTokenAddress.selector);
    vm.prank(owner);
    cb.registerMatchingToken(chainB.cbChainId, foreignToken, address(0));
  }

  function test_RegisterMatchingToken_ReplacesPreviousMatchOneToOne() public {
    MockERC20 otherToken = new MockERC20('Other', 'OTH', 18);
    vm.startPrank(owner);
    cb.registerMatchingToken(chainB.cbChainId, foreignToken, address(token));

    // Rematching the same foreign token to a different local token unregisters the old local match.
    vm.expectEmit(true, true, true, true, address(cb));
    emit MatchingTokenUnregistered(chainB.cbChainId, foreignToken, address(token));
    vm.expectEmit(true, true, true, true, address(cb));
    emit MatchingTokenRegistered(chainB.cbChainId, foreignToken, address(otherToken));
    cb.registerMatchingToken(chainB.cbChainId, foreignToken, address(otherToken));

    // Rematching the same local token to a different foreign token unregisters the old foreign match.
    vm.expectEmit(true, true, true, true, address(cb));
    emit MatchingTokenUnregistered(chainB.cbChainId, foreignToken, address(otherToken));
    vm.expectEmit(true, true, true, true, address(cb));
    emit MatchingTokenRegistered(chainB.cbChainId, otherForeignToken, address(otherToken));
    cb.registerMatchingToken(chainB.cbChainId, otherForeignToken, address(otherToken));
    vm.stopPrank();
  }

  function test_UnregisterMatchingToken_EmitsUnregistered() public {
    vm.startPrank(owner);
    cb.registerMatchingToken(chainB.cbChainId, foreignToken, address(token));
    vm.expectEmit(true, true, true, true, address(cb));
    emit MatchingTokenUnregistered(chainB.cbChainId, foreignToken, address(token));
    cb.unregisterMatchingToken(chainB.cbChainId, foreignToken);
    vm.stopPrank();
  }

  function test_RevertWhen_UnregisterMatchingToken_NotFound() public {
    vm.expectRevert(abi.encodeWithSelector(MatchingTokenNotFound.selector, chainB.cbChainId, foreignToken));
    vm.prank(owner);
    cb.unregisterMatchingToken(chainB.cbChainId, foreignToken);
  }

  function test_RevertWhen_MatchingTokenSetters_CallerLacksTokenManagerRole() public {
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, TOKEN_MANAGER_ROLE));
    vm.prank(stranger);
    cb.registerMatchingToken(chainB.cbChainId, foreignToken, address(token));
  }
}
