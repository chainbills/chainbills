// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {LibPayableStorage} from 'src/storage/LibPayableStorage.sol';
import {CbTestBase} from '../base/CbTestBase.sol';
import {MockERC20} from '../mocks/MockERC20.sol';

contract TooManyBalanceTokensTest is CbTestBase {
  bytes32 internal payableId;

  function setUp() public override {
    super.setUp();
    payableId = _createPayable(chainA, host, _anyToken(), false);
  }

  function test_RevertWhen_Credit_TooManyBalanceTokens() public {
    bytes32 base = LibPayableStorage.STORAGE_SLOT;
    // Field index 3 is the `balanceTokens` mapping.
    bytes32 mappingSlot = bytes32(uint256(base) + 3);
    bytes32 arraySlot = keccak256(abi.encode(payableId, mappingSlot));
    vm.store(address(cb), arraySlot, bytes32(uint256(uint8(type(uint8).max))));

    MockERC20 newToken = new MockERC20('Extra', 'EXT', 6);
    vm.prank(owner);
    cb.allowPaymentsForToken(address(newToken));
    newToken.mint(payer, 1000e6);
    vm.prank(payer);
    newToken.approve(address(cb), type(uint256).max);

    vm.expectRevert(TooManyBalanceTokens.selector);
    vm.prank(payer);
    cb.pay(payableId, address(newToken), 1e6, 1e6);
  }
}
