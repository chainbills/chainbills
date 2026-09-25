// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {CbPayableSync} from 'src/libraries/CbPayableSync.sol';
import {ICbErrors} from 'src/interfaces/ICbErrors.sol';
import {
  PAYABLE_ACTION_CREATE,
  PAYABLE_ACTION_CLOSE,
  PAYABLE_ACTION_REOPEN,
  PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS,
  PAYABLE_PAYLOAD_TYPE,
  PAYLOAD_VERSION
} from 'src/types/CbConstants.sol';
import {PayablePayload, TokenAndAmountForeign} from 'src/types/CbTypes.sol';

contract CbPayableSyncHarness {
  function applyUpdate(PayablePayload memory payload, bytes32 cbChainId) external {
    CbPayableSync.applyUpdate(payload, cbChainId);
  }
}

contract PayableSyncApplyGapsTest is Test, ICbErrors {
  CbPayableSyncHarness internal harness;
  bytes32 internal constant SRC_CHAIN = keccak256('eip155:1');
  bytes32 internal constant PAYABLE = keccak256('some-payable');

  function setUp() public {
    harness = new CbPayableSyncHarness();
  }

  function test() public {}

  function test_RevertWhen_ApplyUpdate_InvalidActionType() public {
    PayablePayload memory payload = PayablePayload({
      payloadType: PAYABLE_PAYLOAD_TYPE,
      version: PAYLOAD_VERSION,
      actionType: uint8(99),
      payableId: PAYABLE,
      nonce: 1,
      initiatedAt: uint64(block.timestamp),
      isClosed: false,
      allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
    });
    vm.expectRevert(abi.encodeWithSelector(InvalidPayablePayloadActionType.selector, uint8(99)));
    harness.applyUpdate(payload, SRC_CHAIN);
  }

  function test_RevertWhen_ApplyUpdate_TooManyAllowedTokens() public {
    TokenAndAmountForeign[] memory list = new TokenAndAmountForeign[](256);
    for (uint256 i; i < list.length; i++) {
      list[i] = TokenAndAmountForeign(bytes32(uint256(i + 1)), uint64(i));
    }
    PayablePayload memory payload = PayablePayload({
      payloadType: PAYABLE_PAYLOAD_TYPE,
      version: PAYLOAD_VERSION,
      actionType: PAYABLE_ACTION_CREATE,
      payableId: PAYABLE,
      nonce: 1,
      initiatedAt: uint64(block.timestamp),
      isClosed: false,
      allowedTokensAndAmounts: list
    });
    vm.expectRevert(InvalidPayload.selector);
    harness.applyUpdate(payload, SRC_CHAIN);
  }

  function test_ApplyUpdate_CreateBranchStoresIsClosed() public {
    PayablePayload memory payload = PayablePayload({
      payloadType: PAYABLE_PAYLOAD_TYPE,
      version: PAYLOAD_VERSION,
      actionType: PAYABLE_ACTION_CREATE,
      payableId: PAYABLE,
      nonce: 1,
      initiatedAt: uint64(block.timestamp),
      isClosed: true,
      allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
    });
    harness.applyUpdate(payload, SRC_CHAIN);
  }
}
