// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {CbLedger} from 'src/libraries/CbLedger.sol';
import {LibUserStorage} from 'src/storage/LibUserStorage.sol';
import {User} from 'src/types/CbTypes.sol';

/// Wraps the linked library so its `public` entry compiles down to a real external call.
contract LedgerHarness {
  function initializeUserIfNeeded(address wallet) external {
    CbLedger.initializeUserIfNeeded(wallet);
  }

  function userChainCount(address wallet) external view returns (uint256) {
    return LibUserStorage.layout().users[wallet].chainCount;
  }
}

contract LedgerLibraryEntryTest is Test {
  LedgerHarness internal harness;

  function setUp() public {
    harness = new LedgerHarness();
  }

  function test() public {}

  function test_InitializeUserIfNeeded_AssignsFirstChainCount() public {
    address wallet = makeAddr('wallet');
    assertEq(harness.userChainCount(wallet), 0);
    harness.initializeUserIfNeeded(wallet);
    assertEq(harness.userChainCount(wallet), 1);
  }

  function test_InitializeUserIfNeeded_IdempotentOnSecondCall() public {
    address wallet = makeAddr('wallet');
    harness.initializeUserIfNeeded(wallet);
    harness.initializeUserIfNeeded(wallet);
    assertEq(harness.userChainCount(wallet), 1);
  }
}
