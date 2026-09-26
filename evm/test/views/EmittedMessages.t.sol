// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CctpPayableUpdateEmission, CctpPaymentEmission, WormholePayableUpdateEmission} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';
import {PopulatedViewsBase} from './PopulatedViewsBase.sol';

/// Covers the three paginated on-chain emission getters that off-chain relayers walk instead of
/// scanning event logs:
///   - getEmittedWormholeMessages
///   - getEmittedCctpPayableUpdateMessages
///   - getEmittedCctpPaymentMessages
///
/// Each getter is tested against an empty diamond (three early-return branches: `offset >= length`,
/// `limit == 0`, and both simultaneously) and against the rich two-chain scenario in
/// `PopulatedViewsBase` (first page, mid-page, offset past end, limit larger than remaining, and
/// iterating cursor-style page-by-page).
contract EmittedMessagesEmptyTest is CbTestBase {
  // ---------------------------------------------------------------------------
  // Wormhole
  // ---------------------------------------------------------------------------

  function test_GetEmittedWormholeMessages_EmptyDiamond() public view {
    WormholePayableUpdateEmission[] memory page = cb.getEmittedWormholeMessages(0, 10);
    assertEq(page.length, 0);
  }

  function test_GetEmittedWormholeMessages_EmptyDiamond_OffsetPastEnd() public view {
    WormholePayableUpdateEmission[] memory page = cb.getEmittedWormholeMessages(5, 10);
    assertEq(page.length, 0);
  }

  function test_GetEmittedWormholeMessages_EmptyDiamond_ZeroLimit() public view {
    WormholePayableUpdateEmission[] memory page = cb.getEmittedWormholeMessages(0, 0);
    assertEq(page.length, 0);
  }

  // ---------------------------------------------------------------------------
  // CCTP payable-update
  // ---------------------------------------------------------------------------

  function test_GetEmittedCctpPayableUpdateMessages_EmptyDiamond() public view {
    CctpPayableUpdateEmission[] memory page = cb.getEmittedCctpPayableUpdateMessages(0, 10);
    assertEq(page.length, 0);
  }

  function test_GetEmittedCctpPayableUpdateMessages_EmptyDiamond_OffsetPastEnd() public view {
    CctpPayableUpdateEmission[] memory page = cb.getEmittedCctpPayableUpdateMessages(5, 10);
    assertEq(page.length, 0);
  }

  function test_GetEmittedCctpPayableUpdateMessages_EmptyDiamond_ZeroLimit() public view {
    CctpPayableUpdateEmission[] memory page = cb.getEmittedCctpPayableUpdateMessages(0, 0);
    assertEq(page.length, 0);
  }

  // ---------------------------------------------------------------------------
  // CCTP payment
  // ---------------------------------------------------------------------------

  function test_GetEmittedCctpPaymentMessages_EmptyDiamond() public view {
    CctpPaymentEmission[] memory page = cb.getEmittedCctpPaymentMessages(0, 10);
    assertEq(page.length, 0);
  }

  function test_GetEmittedCctpPaymentMessages_EmptyDiamond_OffsetPastEnd() public view {
    CctpPaymentEmission[] memory page = cb.getEmittedCctpPaymentMessages(5, 10);
    assertEq(page.length, 0);
  }

  function test_GetEmittedCctpPaymentMessages_EmptyDiamond_ZeroLimit() public view {
    CctpPaymentEmission[] memory page = cb.getEmittedCctpPaymentMessages(0, 0);
    assertEq(page.length, 0);
  }
}

/// Populated-scenario tests. Chain A after `PopulatedViewsBase` setUp has 8 Wormhole publishes, 8
/// CCTP payable-update emissions, and 2 CCTP payment emissions.
contract EmittedMessagesPopulatedTest is PopulatedViewsBase {
  // ---------------------------------------------------------------------------
  // Wormhole
  // ---------------------------------------------------------------------------

  function test_GetEmittedWormholeMessages_FullPage() public view {
    WormholePayableUpdateEmission[] memory page = cb.getEmittedWormholeMessages(0, 100);
    assertEq(page.length, 8);
    // Every entry carries a distinct Wormhole sequence, monotonically increasing from zero.
    for (uint256 i = 1; i < page.length; i++) {
      assertGt(page[i].wormholeSequence, page[i - 1].wormholeSequence);
    }
  }

  function test_GetEmittedWormholeMessages_FirstPage() public view {
    WormholePayableUpdateEmission[] memory page = cb.getEmittedWormholeMessages(0, 3);
    assertEq(page.length, 3);
  }

  function test_GetEmittedWormholeMessages_MidPage() public view {
    WormholePayableUpdateEmission[] memory page = cb.getEmittedWormholeMessages(3, 3);
    assertEq(page.length, 3);
  }

  function test_GetEmittedWormholeMessages_LimitExceedsRemaining() public view {
    // 8 total, ask for offset=6 limit=10 — returns 2.
    WormholePayableUpdateEmission[] memory page = cb.getEmittedWormholeMessages(6, 10);
    assertEq(page.length, 2);
  }

  function test_GetEmittedWormholeMessages_OffsetPastEnd() public view {
    WormholePayableUpdateEmission[] memory page = cb.getEmittedWormholeMessages(100, 10);
    assertEq(page.length, 0);
  }

  function test_GetEmittedWormholeMessages_ZeroLimit() public view {
    WormholePayableUpdateEmission[] memory page = cb.getEmittedWormholeMessages(0, 0);
    assertEq(page.length, 0);
  }

  function test_GetEmittedWormholeMessages_IteratesCursorStyle() public view {
    // Walk the log the same way an off-chain relayer would.
    uint256 total = cb.getWormholeStats().publishedWormholeMessagesCount;
    uint256 cursor;
    bytes32 lastPayableId;
    while (cursor < total) {
      WormholePayableUpdateEmission[] memory page = cb.getEmittedWormholeMessages(cursor, 3);
      if (page.length == 0) break;
      for (uint256 i; i < page.length; i++) {
        assertGt(uint256(page[i].payableId), 0);
        // Payable ids don't need to be unique across emissions (same payable can be updated many
        // times) but chainbillsNonce is strictly monotonic across the whole log.
        lastPayableId = page[i].payableId;
      }
      cursor += page.length;
    }
    assertEq(cursor, total);
    // Silence the unused-variable warning: touching `lastPayableId` proves the loop ran.
    assertTrue(uint256(lastPayableId) > 0);
  }

  // ---------------------------------------------------------------------------
  // CCTP payable-update
  // ---------------------------------------------------------------------------

  function test_GetEmittedCctpPayableUpdateMessages_FullPage() public view {
    CctpPayableUpdateEmission[] memory page = cb.getEmittedCctpPayableUpdateMessages(0, 100);
    assertEq(page.length, 8);
    for (uint256 i; i < page.length; i++) {
      // Every emission targets chain B (only foreign chain registered).
      assertEq(page[i].destChainId, chainB.cbChainId);
      // hookDataHash equivalent: the body hash is nonzero.
      assertGt(uint256(page[i].messageBodyHash), 0);
    }
  }

  function test_GetEmittedCctpPayableUpdateMessages_FirstPage() public view {
    CctpPayableUpdateEmission[] memory page = cb.getEmittedCctpPayableUpdateMessages(0, 3);
    assertEq(page.length, 3);
  }

  function test_GetEmittedCctpPayableUpdateMessages_LimitExceedsRemaining() public view {
    CctpPayableUpdateEmission[] memory page = cb.getEmittedCctpPayableUpdateMessages(6, 10);
    assertEq(page.length, 2);
  }

  function test_GetEmittedCctpPayableUpdateMessages_OffsetPastEnd() public view {
    CctpPayableUpdateEmission[] memory page = cb.getEmittedCctpPayableUpdateMessages(100, 10);
    assertEq(page.length, 0);
  }

  function test_GetEmittedCctpPayableUpdateMessages_ZeroLimit() public view {
    CctpPayableUpdateEmission[] memory page = cb.getEmittedCctpPayableUpdateMessages(0, 0);
    assertEq(page.length, 0);
  }

  // ---------------------------------------------------------------------------
  // CCTP payment
  // ---------------------------------------------------------------------------

  function test_GetEmittedCctpPaymentMessages_FullPage() public view {
    CctpPaymentEmission[] memory page = cb.getEmittedCctpPaymentMessages(0, 100);
    assertEq(page.length, 2);
    for (uint256 i; i < page.length; i++) {
      // Cross-chain payments in the fixture target f1 on chain B.
      assertEq(page[i].destChainId, chainB.cbChainId);
      assertEq(page[i].payableId, f1);
      // hookDataHash is populated (keccak256 of the encoded payment payload).
      assertGt(uint256(page[i].hookDataHash), 0);
      // User payment id is populated (mirrors an on-chain UserPayment record).
      assertGt(uint256(page[i].userPaymentId), 0);
      // chainbillsNonce is the per-payer payment counter, so it is nonzero here.
      assertGt(page[i].chainbillsNonce, 0);
    }
    // The two emissions have distinct user payment ids and distinct hook data hashes.
    assertTrue(page[0].userPaymentId != page[1].userPaymentId);
    assertTrue(page[0].hookDataHash != page[1].hookDataHash);
  }

  function test_GetEmittedCctpPaymentMessages_FirstPage() public view {
    CctpPaymentEmission[] memory page = cb.getEmittedCctpPaymentMessages(0, 1);
    assertEq(page.length, 1);
    assertEq(page[0].destChainId, chainB.cbChainId);
  }

  function test_GetEmittedCctpPaymentMessages_LimitExceedsRemaining() public view {
    CctpPaymentEmission[] memory page = cb.getEmittedCctpPaymentMessages(1, 10);
    assertEq(page.length, 1);
  }

  function test_GetEmittedCctpPaymentMessages_OffsetPastEnd() public view {
    CctpPaymentEmission[] memory page = cb.getEmittedCctpPaymentMessages(2, 10);
    assertEq(page.length, 0);
  }

  function test_GetEmittedCctpPaymentMessages_OffsetExactlyEnd() public view {
    CctpPaymentEmission[] memory page = cb.getEmittedCctpPaymentMessages(2, 1);
    assertEq(page.length, 0);
  }

  function test_GetEmittedCctpPaymentMessages_ZeroLimit() public view {
    CctpPaymentEmission[] memory page = cb.getEmittedCctpPaymentMessages(0, 0);
    assertEq(page.length, 0);
  }

  function test_GetEmittedCctpPaymentMessages_CountMatchesStats() public view {
    uint256 total = cb.getCctpStats().emittedCctpPaymentMessagesCount;
    CctpPaymentEmission[] memory page = cb.getEmittedCctpPaymentMessages(0, total);
    assertEq(page.length, total);
  }

  function test_GetEmittedCctpPaymentMessages_IteratesCursorStyle() public view {
    uint256 total = cb.getCctpStats().emittedCctpPaymentMessagesCount;
    uint256 cursor;
    while (cursor < total) {
      CctpPaymentEmission[] memory page = cb.getEmittedCctpPaymentMessages(cursor, 1);
      if (page.length == 0) break;
      cursor += page.length;
    }
    assertEq(cursor, total);
  }
}
