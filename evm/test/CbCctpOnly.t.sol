// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import {Test} from 'forge-std/Test.sol';
import {Chainbills} from 'src/Chainbills.sol';
import {CbGetters} from 'src/CbGetters.sol';
import {CbStructs} from 'src/CbStructs.sol';
import {CbPayables} from 'src/CbPayables.sol';
import {CbTransactions} from 'src/CbTransactions.sol';
import {toWormholeFormat} from 'wormhole/Utils.sol';
import {MockCircleBridge} from './mocks/MockCircleBridge.sol';
import {MockCircleTransmitter} from './mocks/MockCircleTransmitter.sol';
import {MockCircleTokenMinter} from './mocks/MockCircleTokenMinter.sol';
import {USDC} from './mocks/MockUSDC.sol';

/// Tests for CCTP-only chains (no Wormhole).
/// Covers the hasWormhole()==false branches in payable management operations
/// and the CCTP-only send path in payForeignWithCircle.
contract CbCctpOnlyTest is CbStructs, Test {
  Chainbills chainbills;
  CbGetters cbGetters;
  MockCircleBridge mockCircleBridge;
  MockCircleTransmitter mockCircleTransmitter;
  MockCircleTokenMinter mockCircleTokenMinter;
  USDC usdc;

  address owner = makeAddr('owner');
  address host = makeAddr('host');
  address payer = makeAddr('payer');
  address feeCollector = makeAddr('fee-collector');

  uint16 feePercent = 200;
  bytes32 thisCbChainId = keccak256('eip155:42161'); // Arbitrum (CCTP-only example)
  bytes32 foreignCbChainId = keccak256('eip155:8453'); // Base
  uint32 localCircleDomain = 3; // Arbitrum Circle domain
  uint32 foreignCircleDomain = 6; // Base Circle domain

  bytes32 foreignEmitter;
  bytes32 foreignToken;

  // Blank Test Function to exclude this Test contract itself from test coverage reports.
  function test() public {}

  function setUp() public {
    vm.startPrank(owner);
    chainbills = Chainbills(payable(address(new ERC1967Proxy(address(new Chainbills()), ''))));
    usdc = new USDC();

    mockCircleTokenMinter = new MockCircleTokenMinter();
    mockCircleTransmitter = new MockCircleTransmitter(localCircleDomain);
    mockCircleBridge = new MockCircleBridge(address(mockCircleTransmitter), address(mockCircleTokenMinter));

    chainbills.initialize(feeCollector, feePercent);
    chainbills.setPayablesLogic(address(new CbPayables()));
    chainbills.setTransactionsLogic(address(new CbTransactions()));

    chainbills.allowPaymentsForToken(address(usdc));
    chainbills.updateMaxWithdrawalFees(address(usdc), 2e8);

    // CCTP-only setup — no Wormhole.
    chainbills.setupCctpOnly(address(mockCircleBridge), thisCbChainId);

    // Register the foreign chain for CCTP-only data messaging.
    foreignEmitter = toWormholeFormat(makeAddr('foreign-chainbills'));
    chainbills.registerChainCircleDomain(foreignCbChainId, foreignCircleDomain);
    chainbills.registerForeignContract(foreignCbChainId, foreignEmitter);
    chainbills.setChainDataMessagingProtocol(foreignCbChainId, 2); // CCTP

    // Register matching token so payForeignWithCircle can resolve the foreign token.
    foreignToken = toWormholeFormat(makeAddr('foreign-usdc'));
    chainbills.registerMatchingTokenForForeignChain(foreignCbChainId, foreignToken, address(usdc));

    cbGetters = new CbGetters(address(chainbills));
    vm.stopPrank();
  }

  // -------------------------------------------------------------------------
  // Payable management — no Wormhole fee required
  // -------------------------------------------------------------------------

  function testCreatePayableNoWormholeFee() public {
    // hasWormhole() == false → _ensureWormholeFees() not called → value:0 succeeds.
    vm.prank(host);
    (bytes32 payableId, uint64 seq) = chainbills.createPayable(new TokenAndAmount[](0), false);

    assertTrue(payableId != bytes32(0));
    assertEq(seq, 0); // no Wormhole sequence
  }

  function testClosePayableNoWormholeFee() public {
    vm.prank(host);
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    vm.prank(host);
    uint64 seq = chainbills.closePayable(payableId);

    assertEq(seq, 0);
    Payable memory p = cbGetters.getPayable(payableId);
    assertTrue(p.isClosed);
  }

  function testReopenPayableNoWormholeFee() public {
    vm.prank(host);
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    vm.prank(host);
    chainbills.closePayable(payableId);

    vm.prank(host);
    uint64 seq = chainbills.reopenPayable(payableId);

    assertEq(seq, 0);
    Payable memory p = cbGetters.getPayable(payableId);
    assertFalse(p.isClosed);
  }

  function testUpdateAtaaNoWormholeFee() public {
    vm.prank(host);
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    TokenAndAmount[] memory newAtaa = new TokenAndAmount[](1);
    newAtaa[0] = TokenAndAmount({token: address(usdc), amount: 5e6});

    vm.prank(host);
    uint64 seq = chainbills.updatePayableAllowedTokensAndAmounts(payableId, newAtaa);

    assertEq(seq, 0);
    TokenAndAmount memory recorded = cbGetters.getAllowedTokensAndAmounts(payableId)[0];
    assertEq(recorded.token, address(usdc));
    assertEq(recorded.amount, 5e6);
  }

  function testPublishPayableDetailsNoWormholeFee() public {
    vm.prank(host);
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    // publishPayableDetails with value:0 must succeed when no Wormhole configured.
    vm.prank(host);
    uint64 seq = chainbills.publishPayableDetails(payableId);

    assertEq(seq, 0);
  }

  // -------------------------------------------------------------------------
  // payForeignWithCircle — CCTP-only send path (no Wormhole publishMessage)
  // -------------------------------------------------------------------------

  function testPayForeignWithCircleSendsViaCircle() public {
    // Create a foreign payable on the CCTP-only foreign chain.
    bytes32 fpId = keccak256('cctp-only-foreign-payable');
    vm.prank(owner);
    chainbills.adminSyncForeignPayable(fpId, foreignCbChainId, 1, 1, false, new TokenAndAmountForeign[](0));

    // Fund and approve payer.
    deal(address(usdc), payer, 1e6);
    vm.prank(payer);
    usdc.approve(address(chainbills), 1e6);

    // payForeignWithCircle: hasWormhole()==false → circleTransmitter().sendMessage() branch.
    // MockCircleTransmitter.sendMessage is a no-op so this just verifies no revert.
    vm.prank(payer);
    (bytes32 userPaymentId, uint64 seq) = chainbills.payForeignWithCircle(fpId, address(usdc), 1e6);

    assertEq(seq, 0); // no Wormhole sequence returned
    assertTrue(userPaymentId != bytes32(0));
    // Verify payment was recorded on the payer side.
    assertEq(cbGetters.getUser(payer).paymentsCount, 1);
  }
}
