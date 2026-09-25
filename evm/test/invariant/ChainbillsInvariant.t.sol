// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console2} from 'forge-std/console2.sol';
import {CbTestBase} from '../base/CbTestBase.sol';
import {MockTaxToken} from '../mocks/MockTaxToken.sol';
import {ChainbillsHandler} from './ChainbillsHandler.sol';

/// Stateful invariants over two linked diamonds driven by `ChainbillsHandler`: payments (native, USDC, transfer-tax),
/// cross-chain payments relayed with random finality and executed fee, withdrawals and auto-withdrawals, payable
/// updates relayed over Wormhole and CCTP, replays, donations, rescues, fee changes, and pauses.
contract ChainbillsInvariantTest is CbTestBase {
  ChainbillsHandler internal handler;

  function setUp() public override {
    super.setUp();
    _setUpChainB();

    MockTaxToken taxA = new MockTaxToken(100);
    MockTaxToken taxB = new MockTaxToken(100);
    vm.startPrank(owner);
    chainA.cb.allowPaymentsForToken(address(taxA));
    chainA.cb.setTokenTransferTaxAllowed(address(taxA), true);
    chainB.cb.allowPaymentsForToken(address(taxB));
    chainB.cb.setTokenTransferTaxAllowed(address(taxB), true);
    vm.stopPrank();

    handler = new ChainbillsHandler(chainA, chainB, taxA, taxB, owner, relayer, feeCollector, DEFAULT_FEE_BPS);

    bytes4[] memory selectors = new bytes4[](22);
    selectors[0] = ChainbillsHandler.createPayable.selector;
    selectors[1] = ChainbillsHandler.closeOrReopen.selector;
    selectors[2] = ChainbillsHandler.updateAllowedTokens.selector;
    selectors[3] = ChainbillsHandler.toggleAutoWithdraw.selector;
    selectors[4] = ChainbillsHandler.publishDetails.selector;
    selectors[5] = ChainbillsHandler.pay.selector;
    selectors[6] = ChainbillsHandler.payWithTaxToken.selector;
    selectors[7] = ChainbillsHandler.payForeign.selector;
    selectors[8] = ChainbillsHandler.relayPayment.selector;
    selectors[9] = ChainbillsHandler.replayPayment.selector;
    selectors[10] = ChainbillsHandler.relayUpdates.selector;
    selectors[11] = ChainbillsHandler.replayUpdate.selector;
    selectors[12] = ChainbillsHandler.withdraw.selector;
    selectors[13] = ChainbillsHandler.withdrawAll.selector;
    selectors[14] = ChainbillsHandler.donate.selector;
    selectors[15] = ChainbillsHandler.rescue.selector;
    selectors[16] = ChainbillsHandler.pauseFeature.selector;
    selectors[17] = ChainbillsHandler.unpauseFeature.selector;
    selectors[18] = ChainbillsHandler.toggleGlobalPause.selector;
    selectors[19] = ChainbillsHandler.setFees.selector;
    selectors[20] = ChainbillsHandler.toggleRelayerRestricted.selector;
    // Weight the busiest path: a second pay entry.
    selectors[21] = ChainbillsHandler.pay.selector;
    targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    targetContract(address(handler));
  }

  /// Each diamond holds exactly its tracked payable balances plus the donated (untracked) excess, per token.
  function invariant_Solvency() public view {
    handler.checkSolvency();
  }

  /// Per token and chain: received - withdrawn == totalPayableBalance == sum of every payable's balance, and every
  /// token total equals its independently tracked ghost.
  function invariant_TokenTotalsReconcile() public view {
    handler.checkTokenTotals();
  }

  /// Chain, payable, and user counters equal the lengths of their lists and the ghost counts.
  function invariant_CountersMatchLists() public view {
    handler.checkCounters();
  }

  /// Every payable payment record matches its ghost; cross-chain credits equal minted amounts; each burn is
  /// consumed exactly when it was relayed.
  function invariant_CrossChainPaymentsCreditedOnce() public view {
    handler.checkReceipts();
  }

  /// Every withdrawal fee equals what the fee configuration at that time allowed, and the collector holds them all.
  function invariant_FeesMatchConfiguration() public view {
    handler.checkFees();
  }

  /// Mirrors equal their last delivered update and, once fully relayed, the host's current state.
  function invariant_MirrorsTrackDeliveredUpdates() public view {
    handler.checkMirrors(false);
  }

  /// Messaging counters and pause flags equal the ghosts.
  function invariant_MessagingAndPauseState() public view {
    handler.checkMessagingAndPause();
  }

  /// No action's outcome (success or revert, amounts moved, replay rejection) differed from its prediction.
  function invariant_NoUnexpectedOutcomes() public view {
    handler.checkNoViolations();
  }

  /// After each run, relays everything still pending and requires full convergence and every invariant again.
  function afterInvariant() public {
    handler.settle();
    handler.checkNoViolations();
    handler.checkMirrors(true);
    handler.checkSolvency();
    handler.checkTokenTotals();
    handler.checkCounters();
    handler.checkReceipts();
    handler.checkFees();
    handler.checkMessagingAndPause();
    _logMetrics();
  }

  function _logMetrics() internal view {
    bytes32[22] memory actions = [
      bytes32('createPayable'),
      'closePayable',
      'reopenPayable',
      'updateAllowedTokens',
      'toggleAutoWithdraw',
      'publishDetails',
      'pay',
      'payWithTaxToken',
      'payForeign',
      'relayPayment',
      'replayPayment',
      'relayUpdateWormhole',
      'relayUpdateCctp',
      'relayUpdateAdminSync',
      'replayUpdate',
      'withdraw',
      'withdrawAll',
      'donate',
      'rescue',
      'setFees',
      'pauseFeature',
      'toggleRelayerRestricted'
    ];
    for (uint256 i; i < actions.length; i++) {
      console2.log(string(abi.encodePacked(actions[i])), handler.okCalls(actions[i]), handler.rejectedCalls(actions[i]));
    }
  }
}
