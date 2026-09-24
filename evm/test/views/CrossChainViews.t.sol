// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CbTestBase} from '../base/CbTestBase.sol';

/// Replay-protection and nonce reads. Only the fixture-produced state (chain wiring, no messages relayed yet) is
/// reachable until operation facets can relay messages.
contract CrossChainViewsTest is CbTestBase {
  bytes32 private constant UNKNOWN_HASH = keccak256('unknown-hash');
  bytes32 private constant UNKNOWN_PAYABLE = keccak256('unknown-payable');

  function test_IsWormholeMessageConsumed_FalseWhenUnknown() public view {
    assertFalse(cb.isWormholeMessageConsumed(UNKNOWN_HASH));
  }

  function test_ConsumedWormholeMessages_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getConsumedWormholeMessageCount(), 0);
    assertEq(cb.getConsumedWormholeMessages(0, 10).length, 0);
    assertEq(cb.getConsumedWormholeMessagesDesc(0, 10).length, 0);
  }

  function test_ConsumedWormholeMessagesByChain_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getConsumedWormholeMessageCountByChain(chainA.wormholeChainId), 0);
    assertEq(cb.getConsumedWormholeMessagesByChain(chainA.wormholeChainId, 0, 10).length, 0);
    assertEq(cb.getConsumedWormholeMessagesByChainDesc(chainA.wormholeChainId, 0, 10).length, 0);
  }

  function test_IsCctpBurnNonceConsumed_FalseWhenUnknown() public view {
    assertFalse(cb.isCctpBurnNonceConsumed(0, UNKNOWN_HASH));
  }

  function test_IsCctpDataNonceConsumed_FalseWhenUnknown() public view {
    assertFalse(cb.isCctpDataNonceConsumed(0, UNKNOWN_HASH));
  }

  function test_IsPaymentNonceConsumed_FalseWhenUnknown() public view {
    assertFalse(cb.isPaymentNonceConsumed(chainA.cbChainId, _toBytes32(payer), 1));
  }

  function test_GetForeignPayableUpdateNonce_ZeroWhenUnknown() public view {
    assertEq(cb.getForeignPayableUpdateNonce(UNKNOWN_PAYABLE), 0);
  }

  function test_GetLastPayableUpdateNonce_ZeroOnEmptyDiamond() public view {
    assertEq(cb.getLastPayableUpdateNonce(), 0);
  }

  function test_GetNextPaymentNonce_OneForNewPayer() public view {
    assertEq(cb.getNextPaymentNonce(payer), 1);
  }
}
