// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {MAX_BPS} from 'src/types/CbConstants.sol';
import {TokenFeeConfig, WithdrawalQuote} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

/// Fuzz tests for withdrawal fee math against an inline reference model.
///
/// Reference model:
///   effectiveBps = hasOverride ? overrideBps : globalBps
///   rawFee       = (amount * effectiveBps) / MAX_BPS
///   fee          = hasCap && rawFee > cap ? cap : rawFee
///   net          = amount - fee
///   isFeeCapped  = hasCap && rawFee > cap
contract FeeMathFuzzTest is CbTestBase {
  // Use USDC as the test token; it is already registered in setUp.

  /// Fuzz the global fee path (no per-token override, no cap).
  function testFuzz_FeeMath_GlobalFee(uint128 amount) public view {
    // Global fee is DEFAULT_FEE_BPS = 200. No override, no cap by default.
    uint256 rawFee = (uint256(amount) * uint256(DEFAULT_FEE_BPS)) / MAX_BPS;
    WithdrawalQuote memory q = cb.quoteWithdrawalFee(address(usdc), uint256(amount));

    assertEq(q.amount, uint256(amount), 'amount');
    assertEq(q.feeBps, DEFAULT_FEE_BPS, 'feeBps');
    assertEq(q.fee, rawFee, 'fee');
    assertEq(q.net, uint256(amount) - rawFee, 'net');
    assertFalse(q.isFeeCapped, 'not capped');
  }

  /// Fuzz over arbitrary per-token BPS override, no cap.
  function testFuzz_FeeMath_BpsOverride(uint128 amount, uint16 overrideBps) public {
    overrideBps = uint16(bound(overrideBps, 0, MAX_BPS));

    vm.prank(owner);
    cb.setTokenFeeConfig(
      address(usdc),
      TokenFeeConfig({feeBps: overrideBps, hasFeeBpsOverride: true, maxWithdrawalFee: 0, hasMaxWithdrawalFee: false})
    );

    uint256 rawFee = (uint256(amount) * uint256(overrideBps)) / MAX_BPS;
    WithdrawalQuote memory q = cb.quoteWithdrawalFee(address(usdc), uint256(amount));

    assertEq(q.feeBps, overrideBps, 'feeBps');
    assertEq(q.fee, rawFee, 'fee');
    assertEq(q.net, uint256(amount) - rawFee, 'net');
    assertFalse(q.isFeeCapped, 'not capped');
  }

  /// Fuzz the global fee with a cap applied.
  function testFuzz_FeeMath_Cap_GlobalFee(uint128 amount, uint128 cap) public {
    vm.prank(owner);
    cb.setTokenFeeConfig(
      address(usdc),
      TokenFeeConfig({feeBps: 0, hasFeeBpsOverride: false, maxWithdrawalFee: uint256(cap), hasMaxWithdrawalFee: true})
    );

    uint256 rawFee = (uint256(amount) * uint256(DEFAULT_FEE_BPS)) / MAX_BPS;
    bool capped = rawFee > uint256(cap);
    uint256 fee = capped ? uint256(cap) : rawFee;

    WithdrawalQuote memory q = cb.quoteWithdrawalFee(address(usdc), uint256(amount));

    assertEq(q.fee, fee, 'fee');
    assertEq(q.net, uint256(amount) - fee, 'net');
    assertEq(q.isFeeCapped, capped, 'isFeeCapped');
  }

  /// Full parametric fuzz: override BPS + cap, both optional.
  function testFuzz_FeeMath_MatchesReferenceModel(
    uint128 amount,
    bool hasOverride,
    uint16 overrideBps,
    bool hasCap,
    uint128 cap
  ) public {
    overrideBps = uint16(bound(overrideBps, 0, MAX_BPS));

    vm.prank(owner);
    cb.setTokenFeeConfig(
      address(usdc),
      TokenFeeConfig({
        feeBps: hasOverride ? overrideBps : 0,
        hasFeeBpsOverride: hasOverride,
        maxWithdrawalFee: hasCap ? uint256(cap) : 0,
        hasMaxWithdrawalFee: hasCap
      })
    );

    // Reference model.
    uint16 effectiveBps = hasOverride ? overrideBps : DEFAULT_FEE_BPS;
    uint256 rawFee = (uint256(amount) * uint256(effectiveBps)) / MAX_BPS;
    bool capped = hasCap && rawFee > uint256(cap);
    uint256 fee = capped ? uint256(cap) : rawFee;
    uint256 net = uint256(amount) - fee;

    WithdrawalQuote memory q = cb.quoteWithdrawalFee(address(usdc), uint256(amount));

    assertEq(q.amount, uint256(amount), 'amount');
    assertEq(q.feeBps, effectiveBps, 'feeBps');
    assertEq(q.fee, fee, 'fee');
    assertEq(q.net, net, 'net');
    assertEq(q.isFeeCapped, capped, 'isFeeCapped');
  }
}
