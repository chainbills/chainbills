// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {MatchingToken, TokenConfig, TokenDetails, TokenStats} from 'src/types/CbTypes.sol';
import {MockERC20} from '../mocks/MockERC20.sol';
import {PopulatedViewsBase} from './PopulatedViewsBase.sol';

/// Token registry, token totals, and untracked balances after rich two-chain activity.
contract RegistryViewsPopulatedTest is PopulatedViewsBase {
  // ---------------------------------------------------------------------------
  // Token totals
  // ---------------------------------------------------------------------------

  function test_GetTokenStats_Native() public view {
    // Paid: 2 (P1) + 1 (P2) + 0.5 (P3). Withdrawn: 0.5 auto from P3 + 0.5 from P1, 2% each.
    _assertStats(cb.getTokenStats(native), _stats(3.5 ether, 3.5 ether, 1 ether, 0.02 ether, 2.5 ether));
  }

  function test_GetTokenStats_Usdc() public view {
    // Debited from payers: 300 + 50 + 200 same-chain, 78 + 75 burned toward F1.
    // Credited: 300 + 50 + 200 same-chain, 51 minted from chain B.
    // Withdrawn: 200 (fee capped 1.5) + 300 (capped 1.5) + 20 (0.2).
    _assertStats(cb.getTokenStats(address(usdc)), _stats(703e6, 601e6, 520e6, 3.2e6, 81e6));
  }

  function test_GetTokenStats_TransferTaxToken() public view {
    // 10.2 pulled from payer3, 10.098 arrived; 5 withdrawn at 2%.
    _assertStats(cb.getTokenStats(address(tax)), _stats(10.2e18, 10.098e18, 5e18, 0.1e18, 5.098e18));
  }

  function test_GetTokenStats_ChainB() public view {
    // foreignPayer burned 52 toward P2; F1 was credited 75 from chain A.
    _assertStats(chainB.cb.getTokenStats(address(chainB.usdc)), _stats(52e6, 75e6, 0, 0, 75e6));
    _assertStats(chainB.cb.getTokenStats(address(chainB.cb)), _stats(0, 0, 0, 0, 0));
  }

  function test_GetTokenStats_UnknownTokenIsZero() public view {
    _assertStats(cb.getTokenStats(stranger), _stats(0, 0, 0, 0, 0));
  }

  function test_TokenStats_PayableBalanceIsSumOfPayableBalances() public view {
    address[3] memory tokens = [native, address(usdc), address(tax)];
    bytes32[] memory ids = _localPayables();
    for (uint256 t; t < tokens.length; t++) {
      uint256 sum;
      for (uint256 i; i < ids.length; i++) {
        sum += cb.getBalance(ids[i], tokens[t]);
      }
      TokenStats memory stats = cb.getTokenStats(tokens[t]);
      assertEq(stats.totalPayableBalance, sum);
      assertEq(stats.totalPayableReceived - stats.totalWithdrawn, stats.totalPayableBalance);
    }
  }

  function test_TokenStats_TotalsMatchRecords() public view {
    address[3] memory tokens = [native, address(usdc), address(tax)];
    for (uint256 t; t < tokens.length; t++) {
      uint256 paid;
      uint256 received;
      uint256 withdrawn;
      uint256 fees;
      for (uint256 i; i < up.length; i++) {
        if (cb.getUserPayment(up[i]).token == tokens[t]) paid += cb.getUserPayment(up[i]).amount;
      }
      for (uint256 i; i < pp.length; i++) {
        if (cb.getPayablePayment(pp[i]).token == tokens[t]) received += cb.getPayablePayment(pp[i]).amount;
      }
      for (uint256 i; i < wd.length; i++) {
        if (cb.getWithdrawal(wd[i]).token == tokens[t]) {
          withdrawn += cb.getWithdrawal(wd[i]).amount;
          fees += cb.getWithdrawal(wd[i]).fee;
        }
      }
      TokenStats memory stats = cb.getTokenStats(tokens[t]);
      assertEq(stats.totalUserPaid, paid);
      assertEq(stats.totalPayableReceived, received);
      assertEq(stats.totalWithdrawn, withdrawn);
      assertEq(stats.totalWithdrawalFeesCollected, fees);
    }
  }

  function test_TokenStats_DiamondHoldsExactlyTrackedBalances() public view {
    assertEq(address(cb).balance, 2.5 ether);
    assertEq(usdc.balanceOf(address(cb)), 81e6);
    assertEq(tax.balanceOf(address(cb)), 5.098e18);
    assertEq(chainB.usdc.balanceOf(address(chainB.cb)), 75e6);
  }

  function _stats(uint256 paid, uint256 received, uint256 withdrawn, uint256 fees, uint256 balance)
    private
    pure
    returns (TokenStats memory)
  {
    return TokenStats({
      totalUserPaid: paid,
      totalPayableReceived: received,
      totalWithdrawn: withdrawn,
      totalWithdrawalFeesCollected: fees,
      totalPayableBalance: balance
    });
  }

  function _assertStats(TokenStats memory a, TokenStats memory e) private pure {
    assertEq(a.totalUserPaid, e.totalUserPaid, 'totalUserPaid');
    assertEq(a.totalPayableReceived, e.totalPayableReceived, 'totalPayableReceived');
    assertEq(a.totalWithdrawn, e.totalWithdrawn, 'totalWithdrawn');
    assertEq(a.totalWithdrawalFeesCollected, e.totalWithdrawalFeesCollected, 'totalWithdrawalFeesCollected');
    assertEq(a.totalPayableBalance, e.totalPayableBalance, 'totalPayableBalance');
  }

  // ---------------------------------------------------------------------------
  // Untracked balances
  // ---------------------------------------------------------------------------

  function test_GetUntrackedBalance_ZeroWhenFullyTracked() public {
    assertEq(cb.getUntrackedBalance(native), 0);
    assertEq(cb.getUntrackedBalance(address(usdc)), 0);
    assertEq(cb.getUntrackedBalance(address(tax)), 0);
    assertEq(cb.getUntrackedBalance(address(new MockERC20('Other', 'OTH', 18))), 0);
    assertEq(chainB.cb.getUntrackedBalance(address(chainB.usdc)), 0);
    assertEq(chainB.cb.getUntrackedBalance(address(chainB.cb)), 0);
  }

  function test_GetUntrackedBalance_EqualsUsdcDonation() public {
    usdc.mint(stranger, 7e6);
    vm.prank(stranger);
    assertTrue(usdc.transfer(address(cb), 7e6));
    assertEq(cb.getUntrackedBalance(address(usdc)), 7e6);
    // Tracking is unaffected.
    assertEq(cb.getTokenStats(address(usdc)).totalPayableBalance, 81e6);
    assertEq(cb.getUntrackedBalance(native), 0);
  }

  function test_GetUntrackedBalance_EqualsForcedNativeDonation() public {
    // The diamond has no receive function; plain transfers bounce.
    vm.deal(stranger, 1 ether);
    vm.prank(stranger);
    (bool isSuccess,) = address(cb).call{value: 1 ether}('');
    assertFalse(isSuccess);
    assertEq(cb.getUntrackedBalance(native), 0);

    // Native forced in (e.g. by a self-destructing contract) shows up as untracked.
    vm.deal(address(cb), address(cb).balance + 0.3 ether);
    assertEq(cb.getUntrackedBalance(native), 0.3 ether);
    assertEq(cb.getTokenStats(native).totalPayableBalance, 2.5 ether);
  }

  function test_GetUntrackedBalance_EqualsTransferTaxDonationNetOfTax() public {
    tax.mint(stranger, 1e18);
    vm.prank(stranger);
    assertTrue(tax.transfer(address(cb), 1e18));
    assertEq(cb.getUntrackedBalance(address(tax)), 0.99e18);
  }

  function test_GetUntrackedBalance_WholeBalanceOfUnregisteredToken() public {
    MockERC20 other = new MockERC20('Other', 'OTH', 18);
    other.mint(address(cb), 5e18);
    // Never registered, never paid: everything is untracked.
    assertEq(cb.getUntrackedBalance(address(other)), 5e18);
    assertEq(cb.getTokenStats(address(other)).totalPayableBalance, 0);
  }

  function test_GetUntrackedBalance_StableAcrossLaterPaymentsAndWithdrawals() public {
    usdc.mint(address(cb), 7e6);
    vm.deal(address(cb), address(cb).balance + 0.3 ether);

    // More payments, an auto-withdrawal, a host withdrawal, and a cross-chain burn.
    vm.prank(payer);
    cb.pay(p2, address(usdc), 50e6, 50e6);
    vm.prank(payer);
    cb.pay{value: 1 ether}(p3, native, 1 ether, 1 ether);
    vm.prank(host);
    cb.withdraw(p2, address(usdc), 60e6);
    vm.prank(payer);
    cb.payForeignViaCctp(f1, address(usdc), 75e6, 1e6);

    assertEq(cb.getUntrackedBalance(address(usdc)), 7e6);
    assertEq(cb.getUntrackedBalance(native), 0.3 ether);
    assertEq(cb.getTokenStats(address(usdc)).totalPayableBalance, 81e6 + 50e6 - 60e6);
    assertEq(usdc.balanceOf(address(cb)), 81e6 + 50e6 - 60e6 + 7e6);
    assertEq(cb.getTokenStats(native).totalPayableBalance, 2.5 ether);
  }

  function test_RescueUntrackedBalance_MovesOnlyTheDonation() public {
    usdc.mint(address(cb), 7e6);
    vm.prank(owner);
    uint256 rescued = cb.rescueUntrackedBalance(address(usdc), stranger);
    assertEq(rescued, 7e6);
    assertEq(usdc.balanceOf(stranger), 7e6);
    assertEq(cb.getUntrackedBalance(address(usdc)), 0);

    // Every payable balance is still fully backed.
    assertEq(cb.getTokenStats(address(usdc)).totalPayableBalance, 81e6);
    vm.prank(host);
    cb.withdrawAll(p2, address(usdc));
    assertEq(usdc.balanceOf(address(cb)), 0);
    assertEq(cb.getTokenStats(address(usdc)).totalPayableBalance, 0);
    assertEq(cb.getUntrackedBalance(address(usdc)), 0);
  }

  function test_RevertWhen_RescueUntrackedBalance_NothingUntracked() public {
    vm.expectRevert(abi.encodeWithSelector(NothingToRescue.selector, address(usdc)));
    vm.prank(owner);
    cb.rescueUntrackedBalance(address(usdc), stranger);
  }

  // ---------------------------------------------------------------------------
  // Token registry
  // ---------------------------------------------------------------------------

  function test_RegisteredTokens_InRegistrationOrder() public view {
    bytes32[] memory expected = new bytes32[](3);
    expected[0] = _toBytes32(native);
    expected[1] = _toBytes32(address(usdc));
    expected[2] = _toBytes32(address(tax));
    assertEq(cb.getRegisteredTokenCount(), 3);
    for (uint256 i; i < 3; i++) {
      assertEq(_toBytes32(cb.getRegisteredTokenAt(i)), expected[i]);
    }
    _checkAscPages(_registeredTokens, bytes32(0), expected, 'registered tokens');
  }

  function test_GetRegisteredTokenDetails_AlignsWithTokenPages() public view {
    uint256[4] memory limits = [uint256(0), 1, 2, 10];
    for (uint256 offset; offset < 5; offset++) {
      for (uint256 l; l < limits.length; l++) {
        address[] memory tokens = cb.getRegisteredTokens(offset, limits[l]);
        TokenDetails[] memory details = cb.getRegisteredTokenDetails(offset, limits[l]);
        assertEq(details.length, tokens.length);
        for (uint256 i; i < tokens.length; i++) {
          assertEq(details[i].token, tokens[i]);
          assertEq(abi.encode(details[i]), abi.encode(cb.getTokenDetails(tokens[i])));
        }
      }
    }
  }

  function test_GetTokenDetails_CombinesConfigAndStats() public view {
    address[] memory tokens = new address[](4);
    tokens[0] = address(tax);
    tokens[1] = native;
    tokens[2] = stranger;
    tokens[3] = address(usdc);
    TokenDetails[] memory details = cb.getTokenDetailsBulk(tokens);
    assertEq(details.length, 4);
    for (uint256 i; i < tokens.length; i++) {
      assertEq(abi.encode(details[i]), abi.encode(cb.getTokenDetails(tokens[i])));
      assertEq(details[i].token, tokens[i]);
      assertEq(details[i].isRegistered, i != 2);
      assertEq(abi.encode(details[i].config), abi.encode(cb.getTokenConfig(tokens[i])));
      assertEq(abi.encode(details[i].stats), abi.encode(cb.getTokenStats(tokens[i])));
    }

    TokenConfig memory usdcConfig = details[3].config;
    assertTrue(usdcConfig.isSupported);
    assertFalse(usdcConfig.isTransferTaxAllowed);
    assertTrue(usdcConfig.fee.hasFeeBpsOverride);
    assertEq(usdcConfig.fee.feeBps, USDC_FEE_BPS);
    assertTrue(usdcConfig.fee.hasMaxWithdrawalFee);
    assertEq(usdcConfig.fee.maxWithdrawalFee, USDC_FEE_CAP);
    assertTrue(details[0].config.isTransferTaxAllowed);
    assertFalse(details[0].config.fee.hasFeeBpsOverride);
    assertEq(details[0].stats.totalPayableBalance, 5.098e18);
  }

  function test_GetEffectiveWithdrawalFeeBps_PerToken() public view {
    assertEq(cb.getEffectiveWithdrawalFeeBps(native), DEFAULT_FEE_BPS);
    assertEq(cb.getEffectiveWithdrawalFeeBps(address(usdc)), USDC_FEE_BPS);
    assertEq(cb.getEffectiveWithdrawalFeeBps(address(tax)), DEFAULT_FEE_BPS);
    assertEq(chainB.cb.getEffectiveWithdrawalFeeBps(address(chainB.usdc)), DEFAULT_FEE_BPS);
  }

  function test_GetSupportedTokens_DropsStoppedTokenButKeepsItsTotals() public {
    address[] memory supported = cb.getSupportedTokens();
    assertEq(supported.length, 3);
    assertEq(supported[0], native);
    assertEq(supported[1], address(usdc));
    assertEq(supported[2], address(tax));

    vm.prank(owner);
    cb.stopPaymentsForToken(address(usdc));
    supported = cb.getSupportedTokens();
    assertEq(supported.length, 2);
    assertEq(supported[0], native);
    assertEq(supported[1], address(tax));
    assertFalse(cb.isTokenSupported(address(usdc)));
    assertEq(cb.getRegisteredTokenCount(), 3);
    assertEq(cb.getTokenStats(address(usdc)).totalPayableBalance, 81e6);
    assertEq(cb.getTokenStats(address(usdc)).totalUserPaid, 703e6);
  }

  function test_MatchingTokensAndForeignChains_MatchWiring() public view {
    MatchingToken[] memory matches = cb.getMatchingTokens(chainB.cbChainId);
    assertEq(matches.length, 1);
    assertEq(cb.getMatchingTokenCount(chainB.cbChainId), 1);
    assertEq(matches[0].foreignToken, _toBytes32(address(chainB.usdc)));
    assertEq(matches[0].localToken, address(usdc));
    assertEq(cb.getMatchingLocalToken(chainB.cbChainId, _toBytes32(address(chainB.usdc))), address(usdc));
    assertEq(cb.getMatchingForeignToken(address(usdc), chainB.cbChainId), _toBytes32(address(chainB.usdc)));
    assertEq(cb.getMatchingForeignToken(address(tax), chainB.cbChainId), bytes32(0));

    assertEq(cb.getForeignChainCount(), 1);
    assertEq(cb.getForeignChainIdAt(0), chainB.cbChainId);
    assertEq(cb.getForeignChainIds()[0], chainB.cbChainId);
    assertEq(cb.getForeignChains()[0].cbChainId, chainB.cbChainId);
    assertTrue(cb.isForeignChainRegistered(chainB.cbChainId));
    assertEq(cb.getForeignChainIdByWormholeChainId(chainB.wormholeChainId), chainB.cbChainId);
    assertEq(cb.getForeignChainIdByCircleDomain(chainB.circleDomain), chainB.cbChainId);
    assertEq(cb.getForeignChainIdByWormholeChainId(chainA.wormholeChainId), bytes32(0));
    assertEq(chainB.cb.getForeignChainIdByCircleDomain(chainA.circleDomain), chainA.cbChainId);
  }
}
