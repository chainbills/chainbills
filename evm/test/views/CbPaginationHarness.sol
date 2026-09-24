// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CbPagination} from 'src/libraries/CbPagination.sol';

/// Exposes `CbPagination` over storage arrays it owns, for exhaustive testing of the library.
contract CbPaginationHarness {
  bytes32[] private _bytes32List;
  address[] private _addressList;

  /// Replaces the `bytes32` list with `length` sequential, non-zero entries.
  function setBytes32Length(uint256 length) external {
    delete _bytes32List;
    for (uint256 i; i < length; i++) {
      _bytes32List.push(bytes32(i + 1));
    }
  }

  /// Replaces the address list with `length` sequential, non-zero entries.
  function setAddressLength(uint256 length) external {
    delete _addressList;
    for (uint256 i; i < length; i++) {
      _addressList.push(address(uint160(i + 1)));
    }
  }

  function bytes32ListLength() external view returns (uint256) {
    return _bytes32List.length;
  }

  function addressListLength() external view returns (uint256) {
    return _addressList.length;
  }

  function bytes32Page(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32Page(_bytes32List, offset, limit);
  }

  function bytes32PageDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32PageDesc(_bytes32List, offset, limit);
  }

  function addressPage(uint256 offset, uint256 limit) external view returns (address[] memory) {
    return CbPagination.addressPage(_addressList, offset, limit);
  }

  function addressPageDesc(uint256 offset, uint256 limit) external view returns (address[] memory) {
    return CbPagination.addressPageDesc(_addressList, offset, limit);
  }

  function ascendingBounds(uint256 total, uint256 offset, uint256 limit) external pure returns (uint256, uint256) {
    return CbPagination.ascendingBounds(total, offset, limit);
  }

  function descendingBounds(uint256 total, uint256 offset, uint256 limit) external pure returns (uint256, uint256) {
    return CbPagination.descendingBounds(total, offset, limit);
  }
}
