// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CbTestBase} from '../base/CbTestBase.sol';

contract PauseRevertsTest is CbTestBase {
  function test_RevertWhen_PauseWhileAlreadyPaused() public {
    vm.startPrank(owner);
    cb.pause();
    vm.expectRevert(EnforcedPause.selector);
    cb.pause();
    vm.stopPrank();
  }

  function test_RevertWhen_UnpauseWhileNotPaused() public {
    vm.expectRevert(ExpectedPause.selector);
    vm.prank(owner);
    cb.unpause();
  }
}
