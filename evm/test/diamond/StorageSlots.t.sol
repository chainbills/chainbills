// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {LibAccessControl} from 'src/access/LibAccessControl.sol';
import {LibActivityStorage} from 'src/storage/LibActivityStorage.sol';
import {LibChainRegistryStorage} from 'src/storage/LibChainRegistryStorage.sol';
import {LibConfigStorage} from 'src/storage/LibConfigStorage.sol';
import {LibDiamond} from 'src/diamond/LibDiamond.sol';
import {LibForeignPayableStorage} from 'src/storage/LibForeignPayableStorage.sol';
import {LibMessagingStorage} from 'src/storage/LibMessagingStorage.sol';
import {LibOwnership} from 'src/access/LibOwnership.sol';
import {LibPause} from 'src/access/LibPause.sol';
import {LibPayableStorage} from 'src/storage/LibPayableStorage.sol';
import {LibPaymentStorage} from 'src/storage/LibPaymentStorage.sol';
import {LibReentrancyGuard} from 'src/access/LibReentrancyGuard.sol';
import {LibStatsStorage} from 'src/storage/LibStatsStorage.sol';
import {LibTokenRegistryStorage} from 'src/storage/LibTokenRegistryStorage.sol';
import {LibUserStorage} from 'src/storage/LibUserStorage.sol';
import {LibWithdrawalStorage} from 'src/storage/LibWithdrawalStorage.sol';

/// Locks every storage slot constant to its ERC-7201 namespace id.
contract StorageSlotsTest is Test {
  function test_LibDiamondSlotMatchesNamespace() public pure {
    assertEq(LibDiamond.STORAGE_SLOT, _slot('chainbills.diamond'));
  }

  function test_LibOwnershipSlotMatchesNamespace() public pure {
    assertEq(LibOwnership.STORAGE_SLOT, _slot('chainbills.ownership'));
  }

  function test_LibAccessControlSlotMatchesNamespace() public pure {
    assertEq(LibAccessControl.STORAGE_SLOT, _slot('chainbills.access'));
  }

  function test_LibPauseSlotMatchesNamespace() public pure {
    assertEq(LibPause.STORAGE_SLOT, _slot('chainbills.pause'));
  }

  function test_LibReentrancyGuardSlotMatchesNamespace() public pure {
    assertEq(LibReentrancyGuard.TRANSIENT_SLOT, _slot('chainbills.reentrancy'));
  }

  function test_LibConfigStorageSlotMatchesNamespace() public pure {
    assertEq(LibConfigStorage.STORAGE_SLOT, _slot('chainbills.config'));
  }

  function test_LibChainRegistryStorageSlotMatchesNamespace() public pure {
    assertEq(LibChainRegistryStorage.STORAGE_SLOT, _slot('chainbills.chains'));
  }

  function test_LibTokenRegistryStorageSlotMatchesNamespace() public pure {
    assertEq(LibTokenRegistryStorage.STORAGE_SLOT, _slot('chainbills.tokens'));
  }

  function test_LibUserStorageSlotMatchesNamespace() public pure {
    assertEq(LibUserStorage.STORAGE_SLOT, _slot('chainbills.users'));
  }

  function test_LibPayableStorageSlotMatchesNamespace() public pure {
    assertEq(LibPayableStorage.STORAGE_SLOT, _slot('chainbills.payables'));
  }

  function test_LibForeignPayableStorageSlotMatchesNamespace() public pure {
    assertEq(LibForeignPayableStorage.STORAGE_SLOT, _slot('chainbills.foreign.payables'));
  }

  function test_LibPaymentStorageSlotMatchesNamespace() public pure {
    assertEq(LibPaymentStorage.STORAGE_SLOT, _slot('chainbills.payments'));
  }

  function test_LibWithdrawalStorageSlotMatchesNamespace() public pure {
    assertEq(LibWithdrawalStorage.STORAGE_SLOT, _slot('chainbills.withdrawals'));
  }

  function test_LibActivityStorageSlotMatchesNamespace() public pure {
    assertEq(LibActivityStorage.STORAGE_SLOT, _slot('chainbills.activities'));
  }

  function test_LibMessagingStorageSlotMatchesNamespace() public pure {
    assertEq(LibMessagingStorage.STORAGE_SLOT, _slot('chainbills.messaging'));
  }

  function test_LibStatsStorageSlotMatchesNamespace() public pure {
    assertEq(LibStatsStorage.STORAGE_SLOT, _slot('chainbills.stats'));
  }

  /// ERC-7201 slot of `id`.
  function _slot(string memory id) private pure returns (bytes32) {
    return keccak256(abi.encode(uint256(keccak256(bytes(id))) - 1)) & ~bytes32(uint256(0xff));
  }
}
