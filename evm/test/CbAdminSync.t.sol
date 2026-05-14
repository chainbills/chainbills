// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IAccessControl} from '@openzeppelin/contracts/access/IAccessControl.sol';
import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import {SafeCast} from '@openzeppelin/contracts/utils/math/SafeCast.sol';
import {Test} from 'forge-std/Test.sol';
import {Chainbills} from 'src/Chainbills.sol';
import {CbGetters} from 'src/CbGetters.sol';
import {CbStructs} from 'src/CbStructs.sol';
import {CbPayables} from 'src/CbPayables.sol';
import {CbTransactions} from 'src/CbTransactions.sol';

contract CbAdminSyncTest is CbStructs, Test {
  Chainbills chainbills;
  CbGetters cbGetters;

  address owner = makeAddr('owner');
  address admin = makeAddr('admin');
  address nonAdmin = makeAddr('non-admin');

  uint16 feePercent = 200;
  address feeCollector = makeAddr('fee-collector');

  bytes32 foreignCbChainId = keccak256('eip155:2');
  bytes32 payableId = keccak256('test-payable-id');

  // Blank Test Function to exclude this Test contract itself from test coverage reports.
  function test() public {}

  function setUp() public {
    vm.startPrank(owner);
    chainbills = Chainbills(payable(address(new ERC1967Proxy(address(new Chainbills()), ''))));
    chainbills.initialize(feeCollector, feePercent);
    chainbills.setPayablesLogic(address(new CbPayables()));
    chainbills.setTransactionsLogic(address(new CbTransactions()));
    chainbills.grantAdminRole(admin);
    cbGetters = new CbGetters(address(chainbills));
    vm.stopPrank();
  }

  // ------------------------------------------------------------------------
  // Access control
  // ------------------------------------------------------------------------

  function testAdminSyncRevertsForNonAdmin() public {
    bytes32 adminRole = chainbills.ADMIN_ROLE();
    vm.prank(nonAdmin);
    vm.expectRevert(
      abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, nonAdmin, adminRole)
    );
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 1, 1, false, new TokenAndAmountForeign[](0));
  }

  function testAdminSyncRoleGrantedAllowsCall() public {
    // Admin was granted in setUp — just verify it succeeds.
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 1, 1, false, new TokenAndAmountForeign[](0));
  }

  function testAdminSyncRoleRevokedPreventsCall() public {
    vm.prank(owner);
    chainbills.revokeAdminRole(admin);

    bytes32 adminRole = chainbills.ADMIN_ROLE();
    vm.prank(admin);
    vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, admin, adminRole));
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 1, 1, false, new TokenAndAmountForeign[](0));
  }

  // Owner always has ADMIN_ROLE (granted in initialize).
  function testOwnerHasAdminRoleAndCanSync() public {
    vm.prank(owner);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 1, 1, false, new TokenAndAmountForeign[](0));
  }

  // ------------------------------------------------------------------------
  // Input validation
  // ------------------------------------------------------------------------

  function testAdminSyncZeroPayableIdReverts() public {
    vm.prank(admin);
    vm.expectRevert(InvalidPayableId.selector);
    chainbills.adminSyncForeignPayable(bytes32(0), foreignCbChainId, 1, 1, false, new TokenAndAmountForeign[](0));
  }

  function testAdminSyncZeroChainIdReverts() public {
    vm.prank(admin);
    vm.expectRevert(InvalidChainId.selector);
    chainbills.adminSyncForeignPayable(payableId, bytes32(0), 1, 1, false, new TokenAndAmountForeign[](0));
  }

  function testAdminSyncInvalidActionType0Reverts() public {
    vm.prank(admin);
    vm.expectRevert(InvalidPayablePayloadActionType.selector);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 1, 0, false, new TokenAndAmountForeign[](0));
  }

  function testAdminSyncInvalidActionType5Reverts() public {
    vm.prank(admin);
    vm.expectRevert(InvalidPayablePayloadActionType.selector);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 1, 5, false, new TokenAndAmountForeign[](0));
  }

  // ------------------------------------------------------------------------
  // Nonce ordering
  // ------------------------------------------------------------------------

  function testAdminSyncStaleNonceEqualReverts() public {
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 5, 1, false, new TokenAndAmountForeign[](0));

    vm.prank(admin);
    vm.expectRevert(StalePayableUpdateNonce.selector);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 5, 1, false, new TokenAndAmountForeign[](0));
  }

  function testAdminSyncStaleNonceLowerReverts() public {
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 5, 1, false, new TokenAndAmountForeign[](0));

    vm.prank(admin);
    vm.expectRevert(StalePayableUpdateNonce.selector);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 4, 1, false, new TokenAndAmountForeign[](0));
  }

  function testAdminSyncIncreasingNonceSucceeds() public {
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 1, 1, false, new TokenAndAmountForeign[](0));

    vm.prank(admin);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 2, 2, true, new TokenAndAmountForeign[](0));

    vm.prank(admin);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 3, 3, false, new TokenAndAmountForeign[](0));
  }

  // ------------------------------------------------------------------------
  // Action type 1 — Create / snapshot
  // ------------------------------------------------------------------------

  function testAdminSyncActionType1CreatesForeignPayable() public {
    TokenAndAmountForeign[] memory ataa = new TokenAndAmountForeign[](2);
    ataa[0] = TokenAndAmountForeign({token: bytes32(uint256(1)), amount: 100e6});
    ataa[1] = TokenAndAmountForeign({token: bytes32(uint256(2)), amount: 200e6});

    vm.prank(admin);
    vm.expectEmit(true, true, true, true);
    emit ReceivedPayableUpdateViaAdminSync(payableId, foreignCbChainId, 1);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 1, 1, false, ataa);

    PayableForeign memory fp = cbGetters.getForeignPayable(payableId);
    assertEq(fp.chainId, foreignCbChainId);
    assertEq(fp.allowedTokensAndAmountsCount, 2);
    assertFalse(fp.isClosed);
  }

  function testAdminSyncActionType1IncrementsChainStats() public {
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 1, 1, false, new TokenAndAmountForeign[](0));

    assertEq(cbGetters.getChainStats().foreignPayablesCount, 1);

    // Second message for the same payableId must not double-count.
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 2, 2, true, new TokenAndAmountForeign[](0));

    assertEq(cbGetters.getChainStats().foreignPayablesCount, 1);
  }

  function testAdminSyncActionType1StoresAtaa() public {
    TokenAndAmountForeign[] memory ataa = new TokenAndAmountForeign[](1);
    ataa[0] = TokenAndAmountForeign({token: bytes32(uint256(7)), amount: 777e6});

    vm.prank(admin);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 1, 1, false, ataa);

    TokenAndAmountForeign[] memory stored = cbGetters.getForeignPayableAllowedTokensAndAmounts(payableId);
    assertEq(stored.length, 1);
    assertEq(stored[0].token, bytes32(uint256(7)));
    assertEq(stored[0].amount, 777e6);
  }

  // ------------------------------------------------------------------------
  // Action type 2 — Close
  // ------------------------------------------------------------------------

  function testAdminSyncActionType2ClosesForeignPayable() public {
    // Create first.
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 1, 1, false, new TokenAndAmountForeign[](0));

    vm.prank(admin);
    vm.expectEmit(true, true, true, true);
    emit ReceivedPayableUpdateViaAdminSync(payableId, foreignCbChainId, 2);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 2, 2, true, new TokenAndAmountForeign[](0));

    assertTrue(cbGetters.getForeignPayable(payableId).isClosed);
  }

  // ------------------------------------------------------------------------
  // Action type 3 — Reopen
  // ------------------------------------------------------------------------

  function testAdminSyncActionType3ReopensClosedForeignPayable() public {
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 1, 1, false, new TokenAndAmountForeign[](0));
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 2, 2, true, new TokenAndAmountForeign[](0));

    vm.prank(admin);
    vm.expectEmit(true, true, true, true);
    emit ReceivedPayableUpdateViaAdminSync(payableId, foreignCbChainId, 3);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 3, 3, false, new TokenAndAmountForeign[](0));

    assertFalse(cbGetters.getForeignPayable(payableId).isClosed);
  }

  // ------------------------------------------------------------------------
  // Action type 4 — Update ATAA
  // ------------------------------------------------------------------------

  function testAdminSyncActionType4UpdatesAtaa() public {
    // Start with 1 entry.
    TokenAndAmountForeign[] memory ataa1 = new TokenAndAmountForeign[](1);
    ataa1[0] = TokenAndAmountForeign({token: bytes32(uint256(1)), amount: 100e6});
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 1, 1, false, ataa1);

    // Update to 2 entries with different tokens.
    TokenAndAmountForeign[] memory ataa2 = new TokenAndAmountForeign[](2);
    ataa2[0] = TokenAndAmountForeign({token: bytes32(uint256(3)), amount: 300e6});
    ataa2[1] = TokenAndAmountForeign({token: bytes32(uint256(4)), amount: 400e6});

    vm.prank(admin);
    vm.expectEmit(true, true, true, true);
    emit ReceivedPayableUpdateViaAdminSync(payableId, foreignCbChainId, 2);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 2, 4, false, ataa2);

    PayableForeign memory fp = cbGetters.getForeignPayable(payableId);
    assertEq(fp.allowedTokensAndAmountsCount, 2);

    TokenAndAmountForeign[] memory stored = cbGetters.getForeignPayableAllowedTokensAndAmounts(payableId);
    assertEq(stored[0].token, bytes32(uint256(3)));
    assertEq(stored[1].token, bytes32(uint256(4)));
  }

  function testAdminSyncActionType4ReplacesAtaaCompletely() public {
    // Start with 3 entries.
    TokenAndAmountForeign[] memory ataa3 = new TokenAndAmountForeign[](3);
    for (uint256 i = 0; i < 3; i++) {
      ataa3[i] = TokenAndAmountForeign({token: bytes32(i + 1), amount: SafeCast.toUint64(i + 1) * 1e6});
    }
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 1, 1, false, ataa3);
    assertEq(cbGetters.getForeignPayable(payableId).allowedTokensAndAmountsCount, 3);

    // Collapse to empty.
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(payableId, foreignCbChainId, 2, 4, false, new TokenAndAmountForeign[](0));
    assertEq(cbGetters.getForeignPayable(payableId).allowedTokensAndAmountsCount, 0);
  }
}
