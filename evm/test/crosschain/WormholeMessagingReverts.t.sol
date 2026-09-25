// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CbTestBase} from '../base/CbTestBase.sol';

contract WormholeMessagingRevertsTest is CbTestBase {
  function setUp() public override {
    super.setUp();
    _setUpChainB();
  }

  function test_RevertWhen_VerifyAndConsume_InvalidVaa() public {
    // Configure the mock bridge on chain B to reject VAAs; a payload that would otherwise verify surfaces the reason.
    chainB.wormhole.setRejectingVaas(true, 'guardian-signature-invalid');

    // Have chain A publish a real message so we have a VAA to submit.
    vm.deal(host, WORMHOLE_FEE);
    vm.prank(host);
    chainA.cb.createPayable{value: WORMHOLE_FEE}(_anyToken(), false);
    bytes memory vaa = _lastVaa(chainA);

    vm.expectRevert(abi.encodeWithSelector(InvalidWormholeMessage.selector, 'guardian-signature-invalid'));
    chainB.cb.receivePayableUpdateViaWormhole(vaa);
  }
}
