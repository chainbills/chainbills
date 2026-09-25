// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {
  ForeignPayableView,
  Payable,
  PayableForeign,
  PayableView,
  TokenAndAmount,
  TokenAndAmountForeign
} from 'src/types/CbTypes.sol';
import {PopulatedViewsBase} from './PopulatedViewsBase.sol';

/// Local and foreign payable views after rich two-chain activity.
contract PayableViewsPopulatedTest is PopulatedViewsBase {
  // ---------------------------------------------------------------------------
  // Local payables: single and bulk reads
  // ---------------------------------------------------------------------------

  function test_GetPayableView_MatchesEachPayable() public view {
    bytes32[] memory ids = _localPayables();
    for (uint256 i; i < ids.length; i++) {
      _assertPayableView(cb.getPayableView(ids[i]), _expectedPayableView(ids[i]));
    }
  }

  function test_GetPayableView_P1ReflectsUpdatedAllowListAndWithdrawals() public view {
    PayableView memory v = cb.getPayableView(p1);
    assertEq(v.info.host, host);
    assertEq(v.info.allowedTokensAndAmountsCount, 1);
    assertEq(v.allowedTokensAndAmounts[0].token, address(usdc));
    assertEq(v.allowedTokensAndAmounts[0].amount, 25e6);
    // 2 native paid, 0.5 withdrawn; 300 USDC paid, all withdrawn (the token stays listed at zero).
    assertEq(v.balances[0].token, native);
    assertEq(v.balances[0].amount, 1.5 ether);
    assertEq(v.balances[1].token, address(usdc));
    assertEq(v.balances[1].amount, 0);
  }

  function test_GetPayableView_P2ClosedThenReopenedIsOpen() public view {
    PayableView memory v = cb.getPayableView(p2);
    assertFalse(v.info.isClosed);
    // Create, two local receipts, close, reopen, withdrawal, cross-chain receipt.
    assertEq(v.info.activitiesCount, 7);
    // 50 local + 51 minted from chain B - 20 withdrawn.
    assertEq(v.balances[1].amount, 81e6);
  }

  function test_GetPayableView_P3AutoWithdrawLeavesZeroBalances() public view {
    PayableView memory v = cb.getPayableView(p3);
    assertTrue(v.info.isAutoWithdraw);
    assertEq(v.info.paymentsCount, 2);
    assertEq(v.info.withdrawalsCount, 2);
    assertEq(v.balances.length, 2);
    assertEq(v.balances[0].amount, 0);
    assertEq(v.balances[1].amount, 0);
  }

  function test_GetPayableView_P4TransferTaxCreditIsWhatArrived() public view {
    PayableView memory v = cb.getPayableView(p4);
    assertTrue(v.info.isClosed);
    assertTrue(v.info.isAutoWithdraw);
    // 10.2 pulled, 1% burned in transit, 5 withdrawn.
    assertEq(v.balances[0].amount, 10.098e18 - 5e18);
  }

  function test_GetPayableViewsBulk_AgreesWithSingleReads() public view {
    bytes32[] memory ids = new bytes32[](6);
    ids[0] = p4;
    ids[1] = p1;
    ids[2] = UNKNOWN_ID;
    ids[3] = p3;
    ids[4] = p1;
    ids[5] = p2;
    PayableView[] memory views = cb.getPayableViewsBulk(ids);
    assertEq(views.length, ids.length);
    for (uint256 i; i < ids.length; i++) {
      _assertPayableView(views[i], cb.getPayableView(ids[i]));
      _assertPayableView(views[i], _expectedPayableView(ids[i]));
    }
    // Foreign payables are not local payables.
    ids = new bytes32[](1);
    ids[0] = f1;
    assertEq(cb.getPayableViewsBulk(ids)[0].info.host, address(0));
  }

  function test_GetPayablesBulk_AgreesWithGetPayable() public view {
    bytes32[] memory ids = new bytes32[](5);
    ids[0] = p2;
    ids[1] = p3;
    ids[2] = UNKNOWN_ID;
    ids[3] = p4;
    ids[4] = p1;
    Payable[] memory payables = cb.getPayablesBulk(ids);
    assertEq(payables.length, ids.length);
    for (uint256 i; i < ids.length; i++) {
      _assertPayable(payables[i], cb.getPayable(ids[i]));
      _assertPayable(payables[i], _expectedPayableView(ids[i]).info);
    }
  }

  function test_GetBalancesAndAllowedTokens_AgreeWithView() public view {
    bytes32[] memory ids = _localPayables();
    for (uint256 i; i < ids.length; i++) {
      PayableView memory expected = _expectedPayableView(ids[i]);
      _assertTokenAmounts(cb.getAllowedTokensAndAmounts(ids[i]), expected.allowedTokensAndAmounts);
      _assertTokenAmounts(cb.getBalances(ids[i]), expected.balances);
      address[] memory tokens = cb.getBalanceTokens(ids[i]);
      assertEq(tokens.length, expected.balances.length);
      assertEq(tokens.length, expected.info.balancesCount);
      for (uint256 j; j < tokens.length; j++) {
        assertEq(tokens[j], expected.balances[j].token);
        assertEq(cb.getBalance(ids[i], tokens[j]), expected.balances[j].amount);
      }
    }
    // A token never credited reads zero.
    assertEq(cb.getBalance(p4, native), 0);
    assertEq(cb.getBalance(p1, address(tax)), 0);
  }

  function test_PayableExistsAndIsPayableHost_PerHost() public view {
    bytes32[] memory ids = _localPayables();
    address[4] memory hosts = [host, host, host2, host3];
    for (uint256 i; i < ids.length; i++) {
      assertTrue(cb.payableExists(ids[i]));
      assertTrue(cb.isPayableHost(ids[i], hosts[i]));
      assertFalse(cb.isPayableHost(ids[i], payer));
      assertFalse(cb.isPayableHost(ids[i], address(0)));
    }
    assertFalse(cb.isPayableHost(p3, host));
    assertFalse(cb.payableExists(f1));
    assertFalse(cb.payableExists(f2));
  }

  // ---------------------------------------------------------------------------
  // Local payables: lists
  // ---------------------------------------------------------------------------

  function test_GetChainPayableIdAt_MatchesCreationOrder() public view {
    bytes32[] memory ids = _localPayables();
    assertEq(cb.getChainPayableCount(), 4);
    for (uint256 i; i < ids.length; i++) {
      assertEq(cb.getChainPayableIdAt(i), ids[i]);
      assertEq(cb.getPayable(ids[i]).chainCount, i + 1);
    }
  }

  function test_RevertWhen_GetChainPayableIdAt_PastEnd() public {
    vm.expectRevert();
    cb.getChainPayableIdAt(4);
  }

  function test_ChainPayables_Paginate() public view {
    _checkPages(_chainPayableIds, _chainPayableIdsDesc, bytes32(0), _localPayables(), 'chain payable ids');
    _checkPages(_chainPayables, _chainPayablesDesc, bytes32(0), _localPayables(), 'chain payables');
  }

  function test_UserPayables_PaginatePerHost() public view {
    bytes32[] memory hostIds = new bytes32[](2);
    hostIds[0] = p1;
    hostIds[1] = p2;
    bytes32[] memory host2Ids = new bytes32[](1);
    host2Ids[0] = p3;
    bytes32[] memory host3Ids = new bytes32[](1);
    host3Ids[0] = p4;

    assertEq(cb.getUserPayableCount(host), 2);
    assertEq(cb.getUserPayableCount(host2), 1);
    assertEq(cb.getUserPayableCount(host3), 1);
    assertEq(cb.getUserPayableCount(payer), 0);
    for (uint256 i; i < hostIds.length; i++) {
      assertEq(cb.getUserPayableIdAt(host, i), hostIds[i]);
      assertEq(cb.getPayable(hostIds[i]).hostCount, i + 1);
    }

    _checkUserPayables(host, hostIds);
    _checkUserPayables(host2, host2Ids);
    _checkUserPayables(host3, host3Ids);
    _checkUserPayables(payer, new bytes32[](0));
    // Chain B hosts have no payables on chain A.
    _checkUserPayables(foreignHost, new bytes32[](0));
  }

  function test_RevertWhen_GetUserPayableIdAt_PastEnd() public {
    vm.expectRevert();
    cb.getUserPayableIdAt(host, 2);
  }

  function _checkUserPayables(address wallet, bytes32[] memory expected) private view {
    _checkPages(_userPayableIds, _userPayableIdsDesc, _toBytes32(wallet), expected, 'user payable ids');
    _checkPages(_userPayables, _userPayablesDesc, _toBytes32(wallet), expected, 'user payables');
  }

  // ---------------------------------------------------------------------------
  // Foreign payables
  // ---------------------------------------------------------------------------

  function test_GetForeignPayableView_MatchesMirroredState() public view {
    _assertForeignPayableView(cb.getForeignPayableView(f1), _expectedForeignPayableView(f1));
    _assertForeignPayableView(cb.getForeignPayableView(f2), _expectedForeignPayableView(f2));
  }

  function test_GetForeignPayableView_F1CarriesUpdateNotCreateState() public view {
    ForeignPayableView memory v = cb.getForeignPayableView(f1);
    // Created with no restriction (nonce 1 over Wormhole) then restricted (nonce 3 over CCTP).
    assertEq(v.info.chainId, chainB.cbChainId);
    assertEq(v.info.lastUpdateNonce, 3);
    assertEq(v.info.allowedTokensAndAmountsCount, 1);
    assertEq(v.allowedTokensAndAmounts[0].token, _toBytes32(address(chainB.usdc)));
    assertEq(v.allowedTokensAndAmounts[0].amount, 75e6);
    // Initiated on chain B one step before it was applied on chain A.
    assertEq(v.info.lastUpdateInitiatedAt + STEP, v.info.lastSyncedAt);
  }

  function test_GetForeignPayableView_F2Closed() public view {
    ForeignPayableView memory v = cb.getForeignPayableView(f2);
    assertTrue(v.info.isClosed);
    assertEq(v.info.lastUpdateNonce, 4);
    // Closing keeps the allowed tokens delivered with the create.
    assertEq(v.allowedTokensAndAmounts[0].amount, 40e6);
  }

  function test_ForeignPayableSingleAndBulkReadsAgree() public view {
    bytes32[] memory ids = new bytes32[](5);
    ids[0] = f2;
    ids[1] = UNKNOWN_ID;
    ids[2] = f1;
    ids[3] = p1;
    ids[4] = f2;
    ForeignPayableView[] memory views = cb.getForeignPayableViewsBulk(ids);
    PayableForeign[] memory infos = cb.getForeignPayablesBulk(ids);
    assertEq(views.length, ids.length);
    assertEq(infos.length, ids.length);
    for (uint256 i; i < ids.length; i++) {
      ForeignPayableView memory expected = _expectedForeignPayableView(ids[i]);
      _assertForeignPayableView(views[i], expected);
      _assertForeignPayableView(views[i], cb.getForeignPayableView(ids[i]));
      _assertForeignPayable(infos[i], expected.info);
      _assertForeignPayable(infos[i], cb.getForeignPayable(ids[i]));
      TokenAndAmountForeign[] memory allowed = cb.getForeignPayableAllowedTokensAndAmounts(ids[i]);
      assertEq(allowed.length, expected.allowedTokensAndAmounts.length);
      for (uint256 j; j < allowed.length; j++) {
        assertEq(allowed[j].token, expected.allowedTokensAndAmounts[j].token);
        assertEq(allowed[j].amount, expected.allowedTokensAndAmounts[j].amount);
      }
    }
  }

  function test_ForeignPayableExists_OnlyForMirroredPayables() public view {
    assertTrue(cb.foreignPayableExists(f1));
    assertTrue(cb.foreignPayableExists(f2));
    assertFalse(cb.foreignPayableExists(p1));
    assertFalse(cb.foreignPayableExists(UNKNOWN_ID));
    assertTrue(chainB.cb.foreignPayableExists(p2));
    assertFalse(chainB.cb.foreignPayableExists(p1));
  }

  function test_ChainForeignPayables_Paginate() public view {
    bytes32[] memory expected = new bytes32[](2);
    expected[0] = f1;
    expected[1] = f2;
    assertEq(cb.getChainForeignPayableCount(), 2);
    assertEq(cb.getChainForeignPayableIdAt(0), f1);
    assertEq(cb.getChainForeignPayableIdAt(1), f2);
    _checkPages(_chainForeignPayableIds, _chainForeignPayableIdsDesc, bytes32(0), expected, 'foreign ids');
    _checkPages(_chainForeignPayables, _chainForeignPayablesDesc, bytes32(0), expected, 'foreign payables');
  }

  function test_RevertWhen_GetChainForeignPayableIdAt_PastEnd() public {
    vm.expectRevert();
    cb.getChainForeignPayableIdAt(2);
  }

  function test_ForeignPayablesByChain_PaginatePerChain() public view {
    bytes32[] memory expected = new bytes32[](2);
    expected[0] = f1;
    expected[1] = f2;
    assertEq(cb.getForeignPayableCountByChain(chainB.cbChainId), 2);
    assertEq(cb.getForeignPayableIdByChainAt(chainB.cbChainId, 0), f1);
    assertEq(cb.getForeignPayableIdByChainAt(chainB.cbChainId, 1), f2);
    _checkPages(
      _foreignPayableIdsByChain, _foreignPayableIdsByChainDesc, chainB.cbChainId, expected, 'foreign ids by chain'
    );
    _checkPages(_foreignPayablesByChain, _foreignPayablesByChainDesc, chainB.cbChainId, expected, 'foreign by chain');

    // Chain A's own ID and an unknown chain index nothing.
    assertEq(cb.getForeignPayableCountByChain(chainA.cbChainId), 0);
    assertEq(cb.getForeignPayableCountByChain(UNKNOWN_CHAIN), 0);
    _checkPages(_foreignPayablesByChain, _foreignPayablesByChainDesc, chainA.cbChainId, new bytes32[](0), 'own chain');
    _checkPages(
      _foreignPayableIdsByChain, _foreignPayableIdsByChainDesc, UNKNOWN_CHAIN, new bytes32[](0), 'unknown chain'
    );
  }

  function test_ForeignPayable_ChainBMirrorsP2Creation() public view {
    ForeignPayableView memory v = chainB.cb.getForeignPayableView(p2);
    assertEq(v.info.chainId, chainA.cbChainId);
    // Only P2's creation (nonce 2) was relayed; its later close and reopen were not.
    assertEq(v.info.lastUpdateNonce, 2);
    assertFalse(v.info.isClosed);
    assertEq(v.info.lastUpdateInitiatedAt, createdAt[p2]);
    assertEq(v.info.lastSyncedAt, p2SyncedOnBAt);
    assertEq(v.allowedTokensAndAmounts.length, 2);
    assertEq(v.allowedTokensAndAmounts[0].token, _toBytes32(native));
    assertEq(v.allowedTokensAndAmounts[0].amount, 1 ether);
    assertEq(v.allowedTokensAndAmounts[1].token, _toBytes32(address(usdc)));
    assertEq(v.allowedTokensAndAmounts[1].amount, 50e6);
    assertEq(chainB.cb.getChainForeignPayableCount(), 1);
    assertEq(chainB.cb.getForeignPayableIdByChainAt(chainA.cbChainId, 0), p2);
  }

  function test_GetPayableView_ChainBHostedF1() public view {
    PayableView memory v = chainB.cb.getPayableView(f1);
    assertEq(v.info.host, foreignHost);
    assertEq(v.info.chainCount, 1);
    assertEq(v.info.paymentsCount, 1);
    assertEq(v.info.withdrawalsCount, 0);
    // Create, update, cross-chain receipt.
    assertEq(v.info.activitiesCount, 3);
    assertFalse(v.info.isClosed);
    TokenAndAmount[] memory balances = v.balances;
    assertEq(balances.length, 1);
    assertEq(balances[0].token, address(chainB.usdc));
    // 78 burned on A; Circle kept the full 3 offered.
    assertEq(balances[0].amount, 75e6);
    assertTrue(chainB.cb.getPayableView(f2).info.isClosed);
  }
}
