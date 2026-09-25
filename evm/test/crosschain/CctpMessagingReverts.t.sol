// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {CbCctpMessaging} from 'src/libraries/CbCctpMessaging.sol';
import {ICbErrors} from 'src/interfaces/ICbErrors.sol';
import {CCTP_MESSAGE_BODY_OFFSET, CCTP_HOOK_DATA_OFFSET} from 'src/types/CbConstants.sol';
import {CctpBurnMessage, CctpMessageHeader} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

/// Wraps the linked library so its parse guards surface at cheatcode depth.
contract CctpMessagingHarness {
  function parseMessageHeader(bytes memory message) external pure returns (CctpMessageHeader memory) {
    return CbCctpMessaging.parseMessageHeader(message);
  }

  function parseBurnMessage(bytes memory message) external pure returns (CctpBurnMessage memory) {
    return CbCctpMessaging.parseBurnMessage(message);
  }
}

contract CctpMessagingParseRevertsTest is Test, ICbErrors {
  CctpMessagingHarness internal harness;

  function setUp() public {
    harness = new CctpMessagingHarness();
  }

  function test() public {}

  function test_RevertWhen_ParseMessageHeader_TooShort() public {
    bytes memory tooShort = new bytes(CCTP_MESSAGE_BODY_OFFSET - 1);
    vm.expectRevert(abi.encodeWithSelector(InvalidCctpMessageLength.selector, tooShort.length));
    harness.parseMessageHeader(tooShort);
  }

  function test_ParseMessageHeader_ExactLengthSucceeds() public view {
    bytes memory exact = new bytes(CCTP_MESSAGE_BODY_OFFSET);
    harness.parseMessageHeader(exact);
  }

  function test_RevertWhen_ParseBurnMessage_TooShort() public {
    bytes memory tooShort = new bytes(CCTP_MESSAGE_BODY_OFFSET + CCTP_HOOK_DATA_OFFSET - 1);
    vm.expectRevert(abi.encodeWithSelector(InvalidCctpMessageLength.selector, tooShort.length));
    harness.parseBurnMessage(tooShort);
  }
}

/// Reaches the length-guards in `CbCctpMessaging.parseMessageHeader` and `parseBurnMessage` via facet entry points that
/// call them.
contract CctpMessagingRevertsTest is CbTestBase {
  function setUp() public override {
    super.setUp();
    _setUpChainB();
  }

  function test_RevertWhen_ReceivePayableUpdateViaCctp_MessageShorterThanHeader() public {
    bytes memory tooShort = new bytes(CCTP_MESSAGE_BODY_OFFSET - 1);
    bytes memory attestation = abi.encodePacked(keccak256(tooShort));
    vm.expectRevert(abi.encodeWithSelector(InvalidCctpMessageLength.selector, tooShort.length));
    chainB.cb.receivePayableUpdateViaCctp(tooShort, attestation);
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_MessageShorterThanBurnBody() public {
    // A message just long enough for the header but shorter than header + burn body triggers parseBurnMessage's guard.
    uint256 shortLength = CCTP_MESSAGE_BODY_OFFSET + CCTP_HOOK_DATA_OFFSET - 1;
    bytes memory tooShort = new bytes(shortLength);
    bytes memory attestation = abi.encodePacked(keccak256(tooShort));
    vm.expectRevert(abi.encodeWithSelector(InvalidCctpMessageLength.selector, shortLength));
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(tooShort, attestation);
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_HeaderOnlyMessage() public {
    // Exactly a header, no burn body: the message-body offset is reached but the burn body is absent.
    bytes memory headerOnly = new bytes(CCTP_MESSAGE_BODY_OFFSET);
    bytes memory attestation = abi.encodePacked(keccak256(headerOnly));
    vm.expectRevert(abi.encodeWithSelector(InvalidCctpMessageLength.selector, headerOnly.length));
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(headerOnly, attestation);
  }

}
