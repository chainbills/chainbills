// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {ReentrancyGuardHarness} from './ReentrancyGuardHarness.sol';

contract ReentrancyGuardTest is Test {
  ReentrancyGuardHarness internal harness;

  function setUp() public {
    harness = new ReentrancyGuardHarness();
  }

  function test() public {}

  function test_IsEntered_FalseBeforeEntering() public view {
    assertFalse(harness.isEntered());
  }

  function test_IsEntered_TrueDuringGuardedExecution() public {
    (bool before_, bool during_, bool after_) = harness.isEnteredAcrossEnterAndExit();
    assertFalse(before_);
    assertTrue(during_);
    assertFalse(after_);
  }
}
