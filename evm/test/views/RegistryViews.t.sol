// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {
  ForeignChain,
  MatchingToken,
  TokenConfig,
  TokenDetails,
  TokenFeeConfig,
  TokenPaymentLimits
} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

contract RegistryViewsTest is CbTestBase {
  address private constant UNKNOWN_TOKEN = address(0xBEEF);
  bytes32 private constant UNKNOWN_CHAIN = keccak256('eip155:999');

  // ---------------------------------------------------------------------------
  // Foreign chains, empty diamond
  // ---------------------------------------------------------------------------

  function test_IsForeignChainRegistered_FalseWhenUnknown() public view {
    assertFalse(cb.isForeignChainRegistered(UNKNOWN_CHAIN));
  }

  function test_GetForeignChain_ZeroWhenUnknown() public view {
    ForeignChain memory chain = cb.getForeignChain(UNKNOWN_CHAIN);
    assertEq(chain.cbChainId, bytes32(0));
    assertFalse(chain.isRegistered);
  }

  function test_GetForeignChainCount_ZeroOnEmptyDiamond() public view {
    assertEq(cb.getForeignChainCount(), 0);
  }

  function test_GetForeignChainIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getForeignChainIdAt(0);
  }

  function test_GetForeignChainIds_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getForeignChainIds().length, 0);
  }

  function test_GetForeignChains_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getForeignChains().length, 0);
  }

  function test_GetForeignChainIdByWormholeChainId_ZeroWhenUnmapped() public view {
    assertEq(cb.getForeignChainIdByWormholeChainId(999), bytes32(0));
  }

  function test_GetForeignChainIdByCircleDomain_ZeroWhenUnmapped() public view {
    assertEq(cb.getForeignChainIdByCircleDomain(999), bytes32(0));
  }

  // ---------------------------------------------------------------------------
  // Foreign chains, registered
  // ---------------------------------------------------------------------------

  function test_ForeignChain_RegisteredViaChainB() public {
    _setUpChainB();

    assertTrue(cb.isForeignChainRegistered(chainB.cbChainId));
    assertEq(cb.getForeignChainCount(), 1);
    assertEq(cb.getForeignChainIdAt(0), chainB.cbChainId);
    assertEq(cb.getForeignChainIds().length, 1);
    assertEq(cb.getForeignChainIds()[0], chainB.cbChainId);
    assertEq(cb.getForeignChains().length, 1);
    assertEq(cb.getForeignChains()[0].cbChainId, chainB.cbChainId);
    assertEq(cb.getForeignChainIdByWormholeChainId(chainB.wormholeChainId), chainB.cbChainId);
    assertEq(cb.getForeignChainIdByCircleDomain(chainB.circleDomain), chainB.cbChainId);
  }

  function test_GetForeignChain_KeptAfterUnregistration() public {
    _setUpChainB();
    vm.prank(owner);
    cb.unregisterForeignChain(chainB.cbChainId);

    ForeignChain memory chain = cb.getForeignChain(chainB.cbChainId);
    assertEq(chain.cbChainId, chainB.cbChainId);
    assertFalse(chain.isRegistered);
    assertFalse(cb.isForeignChainRegistered(chainB.cbChainId));
    // The set no longer lists it, but the record survives.
    assertEq(cb.getForeignChainCount(), 0);
  }

  // ---------------------------------------------------------------------------
  // Tokens, empty diamond
  // ---------------------------------------------------------------------------

  function test_GetTokenDetails_UnregisteredToken() public view {
    TokenDetails memory details = cb.getTokenDetails(UNKNOWN_TOKEN);
    assertEq(details.token, UNKNOWN_TOKEN);
    assertFalse(details.isRegistered);
    assertFalse(details.config.isSupported);
  }

  function test_IsTokenSupported_FalseWhenUnregistered() public view {
    assertFalse(cb.isTokenSupported(UNKNOWN_TOKEN));
  }

  function test_GetRegisteredTokenIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getRegisteredTokenAt(100);
  }

  // ---------------------------------------------------------------------------
  // Tokens, registered from `setUp` (native + USDC)
  // ---------------------------------------------------------------------------

  function test_GetRegisteredTokenCount() public view {
    assertEq(cb.getRegisteredTokenCount(), 2);
  }

  function test_IsTokenSupported_TrueForAllowedTokens() public view {
    assertTrue(cb.isTokenSupported(native));
    assertTrue(cb.isTokenSupported(address(usdc)));
  }

  function test_GetTokenDetails_RegisteredToken() public view {
    TokenDetails memory details = cb.getTokenDetails(address(usdc));
    assertEq(details.token, address(usdc));
    assertTrue(details.isRegistered);
    assertTrue(details.config.isSupported);
  }

  function test_GetTokenDetailsBulk() public view {
    address[] memory tokens = new address[](2);
    tokens[0] = native;
    tokens[1] = address(usdc);
    TokenDetails[] memory details = cb.getTokenDetailsBulk(tokens);
    assertEq(details.length, 2);
    assertEq(details[0].token, native);
    assertEq(details[1].token, address(usdc));
  }

  function test_GetRegisteredTokens_PagesAscending() public view {
    address[] memory page = cb.getRegisteredTokens(0, 1);
    assertEq(page.length, 1);
  }

  function test_GetRegisteredTokens_OffsetPastEndIsEmpty() public view {
    assertEq(cb.getRegisteredTokens(100, 5).length, 0);
  }

  function test_GetRegisteredTokenDetails_PagesAscending() public view {
    TokenDetails[] memory page = cb.getRegisteredTokenDetails(0, 10);
    assertEq(page.length, 2);
  }

  function test_GetSupportedTokens_ListsBothAllowedTokens() public view {
    address[] memory tokens = cb.getSupportedTokens();
    assertEq(tokens.length, 2);
  }

  function test_GetSupportedTokens_ExcludesStoppedToken() public {
    vm.prank(owner);
    cb.stopPaymentsForToken(address(usdc));
    address[] memory tokens = cb.getSupportedTokens();
    assertEq(tokens.length, 1);
    assertEq(tokens[0], native);
  }

  // ---------------------------------------------------------------------------
  // Effective withdrawal fee bps
  // ---------------------------------------------------------------------------

  function test_GetEffectiveWithdrawalFeeBps_GlobalWhenNoOverride() public view {
    assertEq(cb.getEffectiveWithdrawalFeeBps(address(usdc)), DEFAULT_FEE_BPS);
  }

  function test_GetEffectiveWithdrawalFeeBps_UsesOverride() public {
    vm.prank(owner);
    cb.setTokenFeeBps(address(usdc), 500);
    assertEq(cb.getEffectiveWithdrawalFeeBps(address(usdc)), 500);
  }

  function test_GetEffectiveWithdrawalFeeBps_OverrideCanBeZero() public {
    vm.prank(owner);
    cb.setTokenFeeBps(address(usdc), 0);
    assertEq(cb.getEffectiveWithdrawalFeeBps(address(usdc)), 0);
  }

  function test_GetEffectiveWithdrawalFeeBps_FallsBackAfterClear() public {
    vm.startPrank(owner);
    cb.setTokenFeeBps(address(usdc), 500);
    cb.clearTokenFeeBps(address(usdc));
    vm.stopPrank();
    assertEq(cb.getEffectiveWithdrawalFeeBps(address(usdc)), DEFAULT_FEE_BPS);
  }

  // ---------------------------------------------------------------------------
  // Matching tokens
  // ---------------------------------------------------------------------------

  function test_MatchingTokens_EmptyBeforeChainB() public view {
    assertEq(cb.getMatchingTokenCount(UNKNOWN_CHAIN), 0);
    assertEq(cb.getMatchingTokens(UNKNOWN_CHAIN).length, 0);
    assertEq(cb.getMatchingLocalToken(UNKNOWN_CHAIN, bytes32(uint256(1))), address(0));
    assertEq(cb.getMatchingForeignToken(address(usdc), UNKNOWN_CHAIN), bytes32(0));
  }

  function test_MatchingTokens_RegisteredViaChainBLink() public {
    _setUpChainB();
    bytes32 foreignUsdc = _toBytes32(address(chainB.usdc));

    assertEq(cb.getMatchingTokenCount(chainB.cbChainId), 1);
    assertEq(cb.getMatchingLocalToken(chainB.cbChainId, foreignUsdc), address(usdc));
    assertEq(cb.getMatchingForeignToken(address(usdc), chainB.cbChainId), foreignUsdc);

    MatchingToken[] memory matches = cb.getMatchingTokens(chainB.cbChainId);
    assertEq(matches.length, 1);
    assertEq(matches[0].foreignToken, foreignUsdc);
    assertEq(matches[0].localToken, address(usdc));
  }
}
