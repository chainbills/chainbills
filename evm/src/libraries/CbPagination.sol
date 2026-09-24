// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Pagination over storage arrays. Linked library shared by every view facet.
/// @dev Ascending pages start at index `offset`. Descending pages start `offset` entries back from the newest entry
/// and list newest first. Out-of-range offsets and zero limits return empty arrays.
library CbPagination {
  /// Returns `[start, start + count)` of an ascending page over `total` entries.
  /// @param total List length.
  /// @param offset Zero-based offset.
  /// @param limit Maximum entries.
  /// @return start First index.
  /// @return count Number of entries.
  function ascendingBounds(uint256 total, uint256 offset, uint256 limit)
    public
    pure
    returns (uint256 start, uint256 count)
  {
    if (offset >= total || limit == 0) return (0, 0);
    start = offset;
    count = total - offset;
    if (count > limit) count = limit;
  }

  /// Returns the first (newest) index and count of a descending page over `total` entries.
  /// @param total List length.
  /// @param offset Entries to skip from the newest.
  /// @param limit Maximum entries.
  /// @return first Index of the first (newest) returned entry.
  /// @return count Number of entries; indexes run from `first` down to `first - count + 1`.
  function descendingBounds(uint256 total, uint256 offset, uint256 limit)
    public
    pure
    returns (uint256 first, uint256 count)
  {
    if (offset >= total || limit == 0) return (0, 0);
    first = total - 1 - offset;
    count = first + 1;
    if (count > limit) count = limit;
  }

  /// Returns an ascending page of `list`.
  /// @param list Storage array.
  /// @param offset Zero-based offset.
  /// @param limit Maximum entries.
  /// @return page Entries.
  function bytes32Page(bytes32[] storage list, uint256 offset, uint256 limit)
    public
    view
    returns (bytes32[] memory page)
  {
    (uint256 start, uint256 count) = ascendingBounds(list.length, offset, limit);
    page = new bytes32[](count);
    for (uint256 i; i < count; i++) {
      page[i] = list[start + i];
    }
  }

  /// Returns a descending page of `list`.
  /// @param list Storage array.
  /// @param offset Entries to skip from the newest.
  /// @param limit Maximum entries.
  /// @return page Entries, newest first.
  function bytes32PageDesc(bytes32[] storage list, uint256 offset, uint256 limit)
    public
    view
    returns (bytes32[] memory page)
  {
    (uint256 first, uint256 count) = descendingBounds(list.length, offset, limit);
    page = new bytes32[](count);
    for (uint256 i; i < count; i++) {
      page[i] = list[first - i];
    }
  }

  /// Returns an ascending page of `list`.
  /// @param list Storage array.
  /// @param offset Zero-based offset.
  /// @param limit Maximum entries.
  /// @return page Entries.
  function addressPage(address[] storage list, uint256 offset, uint256 limit)
    public
    view
    returns (address[] memory page)
  {
    (uint256 start, uint256 count) = ascendingBounds(list.length, offset, limit);
    page = new address[](count);
    for (uint256 i; i < count; i++) {
      page[i] = list[start + i];
    }
  }

  /// Returns a descending page of `list`.
  /// @param list Storage array.
  /// @param offset Entries to skip from the newest.
  /// @param limit Maximum entries.
  /// @return page Entries, newest first.
  function addressPageDesc(address[] storage list, uint256 offset, uint256 limit)
    public
    view
    returns (address[] memory page)
  {
    (uint256 first, uint256 count) = descendingBounds(list.length, offset, limit);
    page = new address[](count);
    for (uint256 i; i < count; i++) {
      page[i] = list[first - i];
    }
  }
}
