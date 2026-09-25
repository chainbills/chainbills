// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {ICbErrors} from 'src/interfaces/ICbErrors.sol';
import {LibAddressFormat} from 'src/libraries/LibAddressFormat.sol';

/// Wraps the internal library so its reverts surface at cheatcode depth.
contract AddressFormatHarness {
  function toAddress(bytes32 account) external pure returns (address) {
    return LibAddressFormat.toAddress(account);
  }

  function toBytes32(address account) external pure returns (bytes32) {
    return LibAddressFormat.toBytes32(account);
  }
}

contract LibAddressFormatRevertsTest is Test, ICbErrors {
  AddressFormatHarness internal harness;

  function setUp() public {
    harness = new AddressFormatHarness();
  }

  function test() public {}

  function test_ToAddress_RoundTrip() public {
    address value = makeAddr('example');
    assertEq(harness.toAddress(harness.toBytes32(value)), value);
  }

  function test_ToAddress_LowestBitsOnly() public {
    // A 20-byte value with zeroed upper bytes decodes to that address.
    address value = makeAddr('lo');
    bytes32 encoded = bytes32(uint256(uint160(value)));
    assertEq(harness.toAddress(encoded), value);
  }

  function test_RevertWhen_ToAddress_UpperBitsNonZero() public {
    // Any bit above the 160-bit address range triggers the guard.
    bytes32 bad = bytes32(uint256(1) << 160);
    vm.expectRevert(InvalidAddress.selector);
    harness.toAddress(bad);
  }

  function test_RevertWhen_ToAddress_TopByteSet() public {
    bytes32 bad = bytes32(uint256(0xff) << 248);
    vm.expectRevert(InvalidAddress.selector);
    harness.toAddress(bad);
  }
}
