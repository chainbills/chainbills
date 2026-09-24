// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {CbPaginationHarness} from './CbPaginationHarness.sol';

/// Exhaustive coverage of `CbPagination`: bounds computation and both array pagers, ascending and descending.
contract CbPaginationTest is Test {
  CbPaginationHarness private harness;

  function setUp() public {
    harness = new CbPaginationHarness();
  }

  // ---------------------------------------------------------------------------
  // ascendingBounds
  // ---------------------------------------------------------------------------

  function test_AscendingBounds_StartsAtOffset() public view {
    (uint256 start, uint256 count) = harness.ascendingBounds(10, 3, 4);
    assertEq(start, 3);
    assertEq(count, 4);
  }

  function test_AscendingBounds_LimitLargerThanRemainder() public view {
    (uint256 start, uint256 count) = harness.ascendingBounds(10, 8, 100);
    assertEq(start, 8);
    assertEq(count, 2);
  }

  function test_AscendingBounds_OffsetAtEnd() public view {
    (uint256 start, uint256 count) = harness.ascendingBounds(10, 10, 5);
    assertEq(start, 0);
    assertEq(count, 0);
  }

  function test_AscendingBounds_OffsetPastEnd() public view {
    (uint256 start, uint256 count) = harness.ascendingBounds(10, 50, 5);
    assertEq(start, 0);
    assertEq(count, 0);
  }

  function test_AscendingBounds_LimitZero() public view {
    (uint256 start, uint256 count) = harness.ascendingBounds(10, 0, 0);
    assertEq(start, 0);
    assertEq(count, 0);
  }

  function test_AscendingBounds_EmptyList() public view {
    (uint256 start, uint256 count) = harness.ascendingBounds(0, 0, 5);
    assertEq(start, 0);
    assertEq(count, 0);
  }

  // ---------------------------------------------------------------------------
  // descendingBounds
  // ---------------------------------------------------------------------------

  function test_DescendingBounds_StartsAtNewest() public view {
    (uint256 first, uint256 count) = harness.descendingBounds(10, 0, 4);
    assertEq(first, 9);
    assertEq(count, 4);
  }

  function test_DescendingBounds_SkipsFromNewest() public view {
    (uint256 first, uint256 count) = harness.descendingBounds(10, 3, 4);
    assertEq(first, 6);
    assertEq(count, 4);
  }

  function test_DescendingBounds_LimitLargerThanRemainder() public view {
    (uint256 first, uint256 count) = harness.descendingBounds(10, 8, 100);
    assertEq(first, 1);
    assertEq(count, 2);
  }

  function test_DescendingBounds_OffsetAtEnd() public view {
    (uint256 first, uint256 count) = harness.descendingBounds(10, 10, 5);
    assertEq(first, 0);
    assertEq(count, 0);
  }

  function test_DescendingBounds_OffsetPastEnd() public view {
    (uint256 first, uint256 count) = harness.descendingBounds(10, 50, 5);
    assertEq(first, 0);
    assertEq(count, 0);
  }

  function test_DescendingBounds_LimitZero() public view {
    (uint256 first, uint256 count) = harness.descendingBounds(10, 0, 0);
    assertEq(first, 0);
    assertEq(count, 0);
  }

  function test_DescendingBounds_EmptyList() public view {
    (uint256 first, uint256 count) = harness.descendingBounds(0, 0, 5);
    assertEq(first, 0);
    assertEq(count, 0);
  }

  // ---------------------------------------------------------------------------
  // bytes32Page / bytes32PageDesc
  // ---------------------------------------------------------------------------

  function test_Bytes32Page_Ascending() public {
    harness.setBytes32Length(5);
    bytes32[] memory page = harness.bytes32Page(1, 2);
    assertEq(page.length, 2);
    assertEq(page[0], bytes32(uint256(2)));
    assertEq(page[1], bytes32(uint256(3)));
  }

  function test_Bytes32Page_OffsetPastEnd() public {
    harness.setBytes32Length(5);
    assertEq(harness.bytes32Page(9, 2).length, 0);
  }

  function test_Bytes32Page_LimitZero() public {
    harness.setBytes32Length(5);
    assertEq(harness.bytes32Page(0, 0).length, 0);
  }

  function test_Bytes32Page_LimitLargerThanList() public {
    harness.setBytes32Length(3);
    bytes32[] memory page = harness.bytes32Page(1, 100);
    assertEq(page.length, 2);
    assertEq(page[0], bytes32(uint256(2)));
    assertEq(page[1], bytes32(uint256(3)));
  }

  function test_Bytes32PageDesc_ListsNewestFirst() public {
    harness.setBytes32Length(5);
    bytes32[] memory page = harness.bytes32PageDesc(0, 2);
    assertEq(page.length, 2);
    assertEq(page[0], bytes32(uint256(5)));
    assertEq(page[1], bytes32(uint256(4)));
  }

  function test_Bytes32PageDesc_SkipsFromNewest() public {
    harness.setBytes32Length(5);
    bytes32[] memory page = harness.bytes32PageDesc(2, 2);
    assertEq(page.length, 2);
    assertEq(page[0], bytes32(uint256(3)));
    assertEq(page[1], bytes32(uint256(2)));
  }

  function test_Bytes32PageDesc_OffsetPastEnd() public {
    harness.setBytes32Length(5);
    assertEq(harness.bytes32PageDesc(9, 2).length, 0);
  }

  function test_Bytes32PageDesc_LimitZero() public {
    harness.setBytes32Length(5);
    assertEq(harness.bytes32PageDesc(0, 0).length, 0);
  }

  function test_Bytes32PageDesc_LimitLargerThanList() public {
    harness.setBytes32Length(3);
    bytes32[] memory page = harness.bytes32PageDesc(1, 100);
    assertEq(page.length, 2);
    assertEq(page[0], bytes32(uint256(2)));
    assertEq(page[1], bytes32(uint256(1)));
  }

  // ---------------------------------------------------------------------------
  // addressPage / addressPageDesc
  // ---------------------------------------------------------------------------

  function test_AddressPage_Ascending() public {
    harness.setAddressLength(5);
    address[] memory page = harness.addressPage(1, 2);
    assertEq(page.length, 2);
    assertEq(page[0], address(uint160(2)));
    assertEq(page[1], address(uint160(3)));
  }

  function test_AddressPage_OffsetPastEnd() public {
    harness.setAddressLength(5);
    assertEq(harness.addressPage(9, 2).length, 0);
  }

  function test_AddressPage_LimitZero() public {
    harness.setAddressLength(5);
    assertEq(harness.addressPage(0, 0).length, 0);
  }

  function test_AddressPage_LimitLargerThanList() public {
    harness.setAddressLength(3);
    address[] memory page = harness.addressPage(1, 100);
    assertEq(page.length, 2);
    assertEq(page[0], address(uint160(2)));
    assertEq(page[1], address(uint160(3)));
  }

  function test_AddressPageDesc_ListsNewestFirst() public {
    harness.setAddressLength(5);
    address[] memory page = harness.addressPageDesc(0, 2);
    assertEq(page.length, 2);
    assertEq(page[0], address(uint160(5)));
    assertEq(page[1], address(uint160(4)));
  }

  function test_AddressPageDesc_OffsetPastEnd() public {
    harness.setAddressLength(5);
    assertEq(harness.addressPageDesc(9, 2).length, 0);
  }

  function test_AddressPageDesc_LimitZero() public {
    harness.setAddressLength(5);
    assertEq(harness.addressPageDesc(0, 0).length, 0);
  }

  function test_AddressPageDesc_LimitLargerThanList() public {
    harness.setAddressLength(3);
    address[] memory page = harness.addressPageDesc(1, 100);
    assertEq(page.length, 2);
    assertEq(page[0], address(uint160(2)));
    assertEq(page[1], address(uint160(1)));
  }

  // ---------------------------------------------------------------------------
  // Fuzzing against a reference implementation
  // ---------------------------------------------------------------------------

  function testFuzz_AscendingBounds_MatchesReference(uint256 length, uint256 offset, uint256 limit) public view {
    length = bound(length, 0, 50);
    offset = bound(offset, 0, 60);
    limit = bound(limit, 0, 60);

    (uint256 start, uint256 count) = harness.ascendingBounds(length, offset, limit);
    (uint256 expectedStart, uint256 expectedCount) = _referenceAscending(length, offset, limit);
    assertEq(start, expectedStart);
    assertEq(count, expectedCount);
  }

  function testFuzz_DescendingBounds_MatchesReference(uint256 length, uint256 offset, uint256 limit) public view {
    length = bound(length, 0, 50);
    offset = bound(offset, 0, 60);
    limit = bound(limit, 0, 60);

    (uint256 first, uint256 count) = harness.descendingBounds(length, offset, limit);
    (uint256 expectedFirst, uint256 expectedCount) = _referenceDescending(length, offset, limit);
    assertEq(first, expectedFirst);
    assertEq(count, expectedCount);
  }

  function testFuzz_Bytes32Page_MatchesReference(uint256 length, uint256 offset, uint256 limit) public {
    length = bound(length, 0, 30);
    offset = bound(offset, 0, 40);
    limit = bound(limit, 0, 40);
    harness.setBytes32Length(length);

    bytes32[] memory page = harness.bytes32Page(offset, limit);
    (uint256 start, uint256 count) = _referenceAscending(length, offset, limit);
    assertEq(page.length, count);
    for (uint256 i; i < count; i++) {
      assertEq(page[i], bytes32(start + i + 1));
    }
  }

  function testFuzz_Bytes32PageDesc_MatchesReference(uint256 length, uint256 offset, uint256 limit) public {
    length = bound(length, 0, 30);
    offset = bound(offset, 0, 40);
    limit = bound(limit, 0, 40);
    harness.setBytes32Length(length);

    bytes32[] memory page = harness.bytes32PageDesc(offset, limit);
    (uint256 first, uint256 count) = _referenceDescending(length, offset, limit);
    assertEq(page.length, count);
    for (uint256 i; i < count; i++) {
      assertEq(page[i], bytes32(first - i + 1));
    }
  }

  function testFuzz_AddressPage_MatchesReference(uint256 length, uint256 offset, uint256 limit) public {
    length = bound(length, 0, 30);
    offset = bound(offset, 0, 40);
    limit = bound(limit, 0, 40);
    harness.setAddressLength(length);

    address[] memory page = harness.addressPage(offset, limit);
    (uint256 start, uint256 count) = _referenceAscending(length, offset, limit);
    assertEq(page.length, count);
    for (uint256 i; i < count; i++) {
      assertEq(page[i], address(uint160(start + i + 1)));
    }
  }

  function testFuzz_AddressPageDesc_MatchesReference(uint256 length, uint256 offset, uint256 limit) public {
    length = bound(length, 0, 30);
    offset = bound(offset, 0, 40);
    limit = bound(limit, 0, 40);
    harness.setAddressLength(length);

    address[] memory page = harness.addressPageDesc(offset, limit);
    (uint256 first, uint256 count) = _referenceDescending(length, offset, limit);
    assertEq(page.length, count);
    for (uint256 i; i < count; i++) {
      assertEq(page[i], address(uint160(first - i + 1)));
    }
  }

  /// Reference ascending-bounds implementation, independent of `CbPagination`.
  function _referenceAscending(uint256 total, uint256 offset, uint256 limit)
    private
    pure
    returns (uint256 start, uint256 count)
  {
    if (offset >= total || limit == 0) return (0, 0);
    start = offset;
    count = total - offset;
    if (count > limit) count = limit;
  }

  /// Reference descending-bounds implementation, independent of `CbPagination`.
  function _referenceDescending(uint256 total, uint256 offset, uint256 limit)
    private
    pure
    returns (uint256 first, uint256 count)
  {
    if (offset >= total || limit == 0) return (0, 0);
    first = total - 1 - offset;
    count = first + 1;
    if (count > limit) count = limit;
  }
}
