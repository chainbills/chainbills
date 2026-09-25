// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CbTestBase} from '../base/CbTestBase.sol';

/// Reaches `LibRelayGuard.enforceWormholeEnabled` via a receive path when Wormhole is disabled.
contract RelayGuardRevertsTest is CbTestBase {
  function setUp() public override {
    super.setUp();
    _setUpChainB();
  }

  function test_RevertWhen_ReceiveViaWormhole_WormholeDisabled() public {
    // Have chain A publish a message while Wormhole is still enabled on both sides.
    vm.deal(host, WORMHOLE_FEE);
    vm.prank(host);
    chainA.cb.createPayable{value: WORMHOLE_FEE}(_anyToken(), false);
    bytes memory vaa = _lastVaa(chainA);

    // Disable Wormhole on chain B; submitting the VAA now hits the guard before verification.
    vm.prank(owner);
    chainB.cb.setWormholeEnabled(false);

    vm.expectRevert(WormholeNotEnabled.selector);
    chainB.cb.receivePayableUpdateViaWormhole(vaa);
  }
}
