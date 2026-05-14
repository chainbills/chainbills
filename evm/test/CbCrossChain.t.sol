// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import {Test} from 'forge-std/Test.sol';
import {Chainbills} from 'src/Chainbills.sol';
import {CbGetters} from 'src/CbGetters.sol';
import {CbStructs} from 'src/CbStructs.sol';
import {CbPayables} from 'src/CbPayables.sol';
import {CbTransactions} from 'src/CbTransactions.sol';
import {CbEncodePayablePayload, CbEncodePaymentPayload} from 'src/CbPayloadMessages.sol';
import {IWormhole} from 'wormhole/interfaces/IWormhole.sol';
import {toWormholeFormat} from 'wormhole/Utils.sol';
import {MockWormhole} from './mocks/MockWormhole.sol';
import {MockCircleBridge} from './mocks/MockCircleBridge.sol';
import {MockCircleTransmitter} from './mocks/MockCircleTransmitter.sol';
import {MockCircleTokenMinter} from './mocks/MockCircleTokenMinter.sol';
import {USDC} from './mocks/MockUSDC.sol';

/// Cross-chain tests covering publishPayableDetails (relayer model),
/// receivePayableUpdateViaWormhole, handleReceiveMessage, and
/// receivePayableUpdateViaCircle.
contract CbCrossChainTest is CbStructs, Test {
  using CbEncodePayablePayload for PayablePayload;
  using CbEncodePaymentPayload for PaymentPayload;

  Chainbills chainbills;
  CbGetters cbGetters;
  MockWormhole mockWormhole;
  MockCircleBridge mockCircleBridge;
  MockCircleTransmitter mockCircleTransmitter;
  MockCircleTokenMinter mockCircleTokenMinter;
  USDC usdc;

  address owner = makeAddr('owner');
  address host = makeAddr('host');
  address relayer = makeAddr('relayer');
  address feeCollector = makeAddr('fee-collector');

  uint16 feePercent = 200;
  bytes32 thisCbChainId = keccak256('eip155:1');
  bytes32 foreignCbChainId = keccak256('eip155:2');
  uint16 foreignWormholeChainId = 2;
  uint32 localCircleDomain = 0;
  uint32 foreignCircleDomain = 1;
  uint16 thisWormholeChainId = 2;

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
    mockWormhole = new MockWormhole();

    chainbills.initialize(feeCollector, feePercent);
    chainbills.setPayablesLogic(address(new CbPayables()));
    chainbills.setTransactionsLogic(address(new CbTransactions()));

    chainbills.allowPaymentsForToken(address(usdc));
    chainbills.updateMaxWithdrawalFees(address(usdc), 2e8);

    // Set up Wormhole + Circle.
    chainbills.setupWormholeAndCircle(
      address(mockWormhole), address(mockCircleBridge), thisWormholeChainId, 1, thisCbChainId
    );

    // Register the foreign chain: Wormhole ID, emitter, Circle domain.
    foreignEmitter = toWormholeFormat(makeAddr('foreign-chainbills'));
    chainbills.registerChainWormholeId(foreignCbChainId, foreignWormholeChainId);
    chainbills.registerChainCircleDomain(foreignCbChainId, foreignCircleDomain);
    chainbills.registerForeignContract(foreignCbChainId, foreignEmitter);

    // Register the matching token for cross-chain payments.
    foreignToken = toWormholeFormat(makeAddr('foreign-usdc'));
    chainbills.registerMatchingTokenForForeignChain(foreignCbChainId, foreignToken, address(usdc));

    cbGetters = new CbGetters(address(chainbills));
    vm.stopPrank();
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /// Build an IWormhole.VM suitable for passing to setPresetVM.
  function _buildVm(uint16 emitterChainId_, bytes32 emitterAddress_, bytes memory payload_, bytes32 hash_)
    internal
    pure
    returns (IWormhole.VM memory vm_)
  {
    vm_ = IWormhole.VM({
      version: 1,
      timestamp: 0,
      nonce: 0,
      emitterChainId: emitterChainId_,
      emitterAddress: emitterAddress_,
      sequence: 0,
      consistencyLevel: 0,
      payload: payload_,
      guardianSetIndex: 0,
      signatures: new IWormhole.Signature[](0),
      hash: hash_
    });
  }

  /// Creates a payable and returns its ID.
  function _createPayable() internal returns (bytes32 pid) {
    vm.prank(host);
    (pid,) = chainbills.createPayable(new TokenAndAmount[](0), false);
  }

  /// Encode a PayablePayload for a given action type and nonce.
  function _encodePayload(bytes32 payableId_, uint8 actionType_, uint64 nonce_) internal pure returns (bytes memory) {
    TokenAndAmountForeign[] memory emptyAtaa = new TokenAndAmountForeign[](0);
    bool isClosed = (actionType_ == 2);
    return PayablePayload({
        version: 1,
        actionType: actionType_,
        payableId: payableId_,
        nonce: nonce_,
        isClosed: isClosed,
        allowedTokensAndAmounts: emptyAtaa
      }).encode();
  }

  // -------------------------------------------------------------------------
  // publishPayableDetails — no Wormhole fee (messageFee=0)
  // -------------------------------------------------------------------------

  function testPublishPayableDetailsRevertsOnInvalidPayable() public {
    vm.prank(relayer);
    vm.expectRevert(InvalidPayableId.selector);
    chainbills.publishPayableDetails(bytes32(0));
  }

  function testPublishPayableDetailsRevertsOnNonexistentPayable() public {
    vm.prank(relayer);
    vm.expectRevert(InvalidPayableId.selector);
    chainbills.publishPayableDetails(keccak256('does-not-exist'));
  }

  function testPublishPayableDetailsRelayerCanCallWithZeroFee() public {
    // MockWormhole.messageFee() returns 0 by default.
    bytes32 pid = _createPayable();
    deal(relayer, 1 ether);

    vm.prank(relayer);
    // With fee=0, pass 0 value — should succeed.
    uint64 seq = chainbills.publishPayableDetails{value: 0}(pid);
    // WormholeMock.publishMessage returns 0 sequence.
    assertEq(seq, 0);
  }

  function testPublishPayableDetailsOwnerCanCall() public {
    bytes32 pid = _createPayable();

    // Host is the payable owner — they should also be able to call.
    vm.prank(host);
    chainbills.publishPayableDetails{value: 0}(pid);
  }

  function testPublishPayableDetailsNonOwnerRelayerCanCall() public {
    bytes32 pid = _createPayable();

    // relayer has no ownership relation to the payable.
    vm.prank(relayer);
    chainbills.publishPayableDetails{value: 0}(pid);
  }

  // -------------------------------------------------------------------------
  // publishPayableDetails — Wormhole fee validation
  // -------------------------------------------------------------------------

  function testPublishPayableDetailsInsufficientFeeReverts() public {
    bytes32 pid = _createPayable();
    mockWormhole.setMessageFee(0.01 ether);
    deal(relayer, 1 ether);

    vm.prank(relayer);
    vm.expectRevert(InsufficientWormholeFees.selector);
    chainbills.publishPayableDetails{value: 0.001 ether}(pid);
  }

  function testPublishPayableDetailsIncorrectFeeReverts() public {
    bytes32 pid = _createPayable();
    mockWormhole.setMessageFee(0.01 ether);
    deal(relayer, 1 ether);

    vm.prank(relayer);
    vm.expectRevert(IncorrectWormholeFees.selector);
    chainbills.publishPayableDetails{value: 0.02 ether}(pid);
  }

  function testPublishPayableDetailsExactFeeSucceeds() public {
    bytes32 pid = _createPayable();
    mockWormhole.setMessageFee(0.01 ether);
    deal(relayer, 1 ether);

    vm.prank(relayer);
    chainbills.publishPayableDetails{value: 0.01 ether}(pid);
  }

  function testPublishPayableDetailsEmitsBroadcastEvent() public {
    bytes32 pid = _createPayable();

    vm.prank(relayer);
    vm.expectEmit(true, false, false, false);
    emit PayableUpdateBroadcasted(pid, 0, 0); // check only payableId (indexed)
    chainbills.publishPayableDetails{value: 0}(pid);
  }

  // -------------------------------------------------------------------------
  // receivePayableUpdateViaWormhole
  // -------------------------------------------------------------------------

  function testReceivePayableUpdateViaWormholeRevertsOnInvalidVAA() public {
    // MockWormhole returns valid=false by default → require(valid, reason) reverts.
    vm.expectRevert();
    chainbills.receivePayableUpdateViaWormhole(bytes(''));
  }

  function testReceivePayableUpdateViaWormholeRevertsOnEmitterNotRegistered() public {
    bytes32 foreignPayableId = keccak256('fp');
    bytes memory payload = _encodePayload(foreignPayableId, 1, 1);
    bytes32 vaaHash = keccak256('vaa1');

    // Valid VM but emitter NOT in registeredForeignContracts.
    bytes32 wrongEmitter = toWormholeFormat(makeAddr('wrong'));
    IWormhole.VM memory vm_ = _buildVm(foreignWormholeChainId, wrongEmitter, payload, vaaHash);
    mockWormhole.setPresetVM(vm_, true, '');

    vm.expectRevert(EmitterNotRegistered.selector);
    chainbills.receivePayableUpdateViaWormhole(bytes(''));
  }

  function testReceivePayableUpdateViaWormholeRevertsOnUnknownWormholeChainId() public {
    bytes32 foreignPayableId = keccak256('fp');
    bytes memory payload = _encodePayload(foreignPayableId, 1, 1);

    // Use an emitter chain ID that has not been registered.
    uint16 unknownChainId = 99;
    IWormhole.VM memory vm_ = _buildVm(unknownChainId, foreignEmitter, payload, keccak256('h'));
    mockWormhole.setPresetVM(vm_, true, '');

    vm.expectRevert(EmitterNotRegistered.selector);
    chainbills.receivePayableUpdateViaWormhole(bytes(''));
  }

  function testReceivePayableUpdateViaWormholeRevertsOnReplay() public {
    bytes32 foreignPayableId = keccak256('fp-replay');
    bytes memory payload = _encodePayload(foreignPayableId, 1, 1);
    bytes32 vaaHash = keccak256('vaa-replay');

    IWormhole.VM memory vm_ = _buildVm(foreignWormholeChainId, foreignEmitter, payload, vaaHash);
    mockWormhole.setPresetVM(vm_, true, '');

    // First delivery — succeeds.
    chainbills.receivePayableUpdateViaWormhole(bytes(''));

    // Second delivery with the same hash — replay must revert.
    vm.expectRevert(HasAlreadyConsumedMessage.selector);
    chainbills.receivePayableUpdateViaWormhole(bytes(''));
  }

  function testReceivePayableUpdateViaWormholeRevertsOnStaleNonce() public {
    bytes32 foreignPayableId = keccak256('fp-stale');

    // First deliver nonce=5.
    IWormhole.VM memory vm5 =
      _buildVm(foreignWormholeChainId, foreignEmitter, _encodePayload(foreignPayableId, 1, 5), keccak256('h5'));
    mockWormhole.setPresetVM(vm5, true, '');
    chainbills.receivePayableUpdateViaWormhole(bytes(''));

    // Try to deliver nonce=3 (stale).
    IWormhole.VM memory vm3 =
      _buildVm(foreignWormholeChainId, foreignEmitter, _encodePayload(foreignPayableId, 2, 3), keccak256('h3'));
    mockWormhole.setPresetVM(vm3, true, '');

    vm.expectRevert(StalePayableUpdateNonce.selector);
    chainbills.receivePayableUpdateViaWormhole(bytes(''));
  }

  function testReceivePayableUpdateViaWormholeSuccessCreate() public {
    bytes32 foreignPayableId = keccak256('fp-wh-create');
    bytes memory payload = _encodePayload(foreignPayableId, 1, 1);
    bytes32 vaaHash = keccak256('vaa-create');

    IWormhole.VM memory vm_ = _buildVm(foreignWormholeChainId, foreignEmitter, payload, vaaHash);
    mockWormhole.setPresetVM(vm_, true, '');

    vm.expectEmit(true, true, true, true);
    emit ConsumedWormholePayableMessage(foreignPayableId, foreignCbChainId, vaaHash);
    vm.expectEmit(true, true, false, true);
    emit ReceivedPayableUpdateViaWormhole(foreignPayableId, foreignCbChainId, 1);
    chainbills.receivePayableUpdateViaWormhole(bytes(''));

    PayableForeign memory fp = cbGetters.getForeignPayable(foreignPayableId);
    assertEq(fp.chainId, foreignCbChainId);
    assertFalse(fp.isClosed);
  }

  function testReceivePayableUpdateViaWormholeSuccessClose() public {
    bytes32 foreignPayableId = keccak256('fp-wh-close');

    // Create first.
    IWormhole.VM memory vm1 =
      _buildVm(foreignWormholeChainId, foreignEmitter, _encodePayload(foreignPayableId, 1, 1), keccak256('h1'));
    mockWormhole.setPresetVM(vm1, true, '');
    chainbills.receivePayableUpdateViaWormhole(bytes(''));

    // Close.
    IWormhole.VM memory vm2 =
      _buildVm(foreignWormholeChainId, foreignEmitter, _encodePayload(foreignPayableId, 2, 2), keccak256('h2'));
    mockWormhole.setPresetVM(vm2, true, '');
    chainbills.receivePayableUpdateViaWormhole(bytes(''));

    assertTrue(cbGetters.getForeignPayable(foreignPayableId).isClosed);
  }

  function testReceivePayableUpdateViaWormholeConsumedMessageRecorded() public {
    bytes32 foreignPayableId = keccak256('fp-consumed');
    bytes32 vaaHash = keccak256('vaa-consumed');
    IWormhole.VM memory vm_ =
      _buildVm(foreignWormholeChainId, foreignEmitter, _encodePayload(foreignPayableId, 1, 1), vaaHash);
    mockWormhole.setPresetVM(vm_, true, '');
    chainbills.receivePayableUpdateViaWormhole(bytes(''));

    assertEq(cbGetters.getChainStats().consumedWormholeMessagesCount, 1);
    bytes32[] memory msgs = cbGetters.consumedWormholeMessagesPaginated(0, 10);
    assertEq(msgs.length, 1);
    assertEq(msgs[0], vaaHash);
  }

  // -------------------------------------------------------------------------
  // handleReceiveMessage (Circle CCTP callback)
  // -------------------------------------------------------------------------

  function testHandleReceiveMessageRevertsForNonTransmitter() public {
    bytes memory payload = _encodePayload(keccak256('fp'), 1, 1);
    vm.prank(makeAddr('random'));
    vm.expectRevert(CircleTransmitterOnly.selector);
    chainbills.handleReceiveMessage(foreignCircleDomain, foreignEmitter, payload);
  }

  function testHandleReceiveMessageRevertsOnUnregisteredDomain() public {
    bytes memory payload = _encodePayload(keccak256('fp'), 1, 1);
    // sourceDomain=99 is not registered.
    vm.prank(address(mockCircleTransmitter));
    vm.expectRevert(InvalidCircleDomain.selector);
    chainbills.handleReceiveMessage(99, foreignEmitter, payload);
  }

  function testHandleReceiveMessageRevertsOnSenderMismatch() public {
    bytes memory payload = _encodePayload(keccak256('fp'), 1, 1);
    bytes32 wrongSender = toWormholeFormat(makeAddr('wrong'));
    vm.prank(address(mockCircleTransmitter));
    vm.expectRevert(CircleSenderMismatch.selector);
    chainbills.handleReceiveMessage(foreignCircleDomain, wrongSender, payload);
  }

  function testHandleReceiveMessageRevertsOnStaleNonce() public {
    bytes32 foreignPayableId = keccak256('fp-cctp-stale');

    // Precompute payloads before setting up pranks.
    bytes memory payload5 = _encodePayload(foreignPayableId, 1, 5);
    bytes memory payload4 = _encodePayload(foreignPayableId, 2, 4);

    // Deliver nonce=5 first.
    vm.prank(address(mockCircleTransmitter));
    chainbills.handleReceiveMessage(foreignCircleDomain, foreignEmitter, payload5);

    // Deliver nonce=4 (stale).
    vm.prank(address(mockCircleTransmitter));
    vm.expectRevert(StalePayableUpdateNonce.selector);
    chainbills.handleReceiveMessage(foreignCircleDomain, foreignEmitter, payload4);
  }

  function testHandleReceiveMessageSuccessCreate() public {
    bytes32 foreignPayableId = keccak256('fp-cctp-create');
    bytes memory payload = _encodePayload(foreignPayableId, 1, 1);

    vm.prank(address(mockCircleTransmitter));
    vm.expectEmit(true, true, false, true);
    emit ReceivedPayableUpdateViaCircle(foreignPayableId, foreignCbChainId, 1);
    bool ok = chainbills.handleReceiveMessage(foreignCircleDomain, foreignEmitter, payload);
    assertTrue(ok);

    PayableForeign memory fp = cbGetters.getForeignPayable(foreignPayableId);
    assertEq(fp.chainId, foreignCbChainId);
    assertFalse(fp.isClosed);
  }

  function testHandleReceiveMessageSuccessReopen() public {
    bytes32 foreignPayableId = keccak256('fp-cctp-reopen');

    bytes memory payloadCreate = _encodePayload(foreignPayableId, 1, 1);
    bytes memory payloadClose = _encodePayload(foreignPayableId, 2, 2);
    bytes memory payloadReopen = _encodePayload(foreignPayableId, 3, 3);

    // Create.
    vm.prank(address(mockCircleTransmitter));
    chainbills.handleReceiveMessage(foreignCircleDomain, foreignEmitter, payloadCreate);

    // Close.
    vm.prank(address(mockCircleTransmitter));
    chainbills.handleReceiveMessage(foreignCircleDomain, foreignEmitter, payloadClose);
    assertTrue(cbGetters.getForeignPayable(foreignPayableId).isClosed);

    // Reopen.
    vm.prank(address(mockCircleTransmitter));
    chainbills.handleReceiveMessage(foreignCircleDomain, foreignEmitter, payloadReopen);
    assertFalse(cbGetters.getForeignPayable(foreignPayableId).isClosed);
  }

  function testHandleReceiveMessageNoncePreventsDuplicates() public {
    bytes32 foreignPayableId = keccak256('fp-cctp-dup');

    bytes memory payload10 = _encodePayload(foreignPayableId, 1, 10);
    bytes memory payload10again = _encodePayload(foreignPayableId, 1, 10);

    // First delivery.
    vm.prank(address(mockCircleTransmitter));
    chainbills.handleReceiveMessage(foreignCircleDomain, foreignEmitter, payload10);

    // Same nonce — stale.
    vm.prank(address(mockCircleTransmitter));
    vm.expectRevert(StalePayableUpdateNonce.selector);
    chainbills.handleReceiveMessage(foreignCircleDomain, foreignEmitter, payload10again);
  }

  // -------------------------------------------------------------------------
  // receivePayableUpdateViaCircle
  // -------------------------------------------------------------------------

  function testReceivePayableUpdateViaCircleRevertsWhenReceiveFails() public {
    mockCircleTransmitter.setReceiveSuccess(false);
    vm.expectRevert(CircleMintingFailed.selector);
    chainbills.receivePayableUpdateViaCircle(bytes(''), bytes(''));
  }

  function testReceivePayableUpdateViaCircleSucceedsWhenReceiveReturnsTrue() public {
    // Mock returns true without calling handleReceiveMessage.
    // The function must not revert.
    mockCircleTransmitter.setReceiveSuccess(true);
    chainbills.receivePayableUpdateViaCircle(bytes(''), bytes(''));
  }

  // -------------------------------------------------------------------------
  // Cross-protocol nonce deduplication
  // -------------------------------------------------------------------------

  function testWormholeAndCctpShareNonces() public {
    bytes32 foreignPayableId = keccak256('fp-shared-nonce');

    // Precompute payloads before pranks.
    bytes memory whPayload = _encodePayload(foreignPayableId, 1, 5);
    bytes memory cctpStale = _encodePayload(foreignPayableId, 2, 5);
    bytes memory cctpFresh = _encodePayload(foreignPayableId, 2, 6);

    // Deliver nonce=5 via Wormhole.
    IWormhole.VM memory wormVm = _buildVm(foreignWormholeChainId, foreignEmitter, whPayload, keccak256('h-shared'));
    mockWormhole.setPresetVM(wormVm, true, '');
    chainbills.receivePayableUpdateViaWormhole(bytes(''));

    // Now try to deliver nonce=5 via CCTP — must be rejected as stale.
    vm.prank(address(mockCircleTransmitter));
    vm.expectRevert(StalePayableUpdateNonce.selector);
    chainbills.handleReceiveMessage(foreignCircleDomain, foreignEmitter, cctpStale);

    // Deliver nonce=6 via CCTP — must succeed.
    vm.prank(address(mockCircleTransmitter));
    chainbills.handleReceiveMessage(foreignCircleDomain, foreignEmitter, cctpFresh);
  }

  // -------------------------------------------------------------------------
  // createPayable / closePayable / reopenPayable with Wormhole fees
  // -------------------------------------------------------------------------

  function testCreatePayableWithInsufficientWormholeFeeReverts() public {
    mockWormhole.setMessageFee(0.01 ether);
    deal(host, 1 ether);
    vm.prank(host);
    vm.expectRevert(InsufficientWormholeFees.selector);
    chainbills.createPayable{value: 0.005 ether}(new TokenAndAmount[](0), false);
  }

  function testCreatePayableWithExactWormholeFeeSucceeds() public {
    mockWormhole.setMessageFee(0.01 ether);
    deal(host, 1 ether);
    vm.prank(host);
    (bytes32 pid,) = chainbills.createPayable{value: 0.01 ether}(new TokenAndAmount[](0), false);
    assertTrue(pid != bytes32(0));
  }

  function testClosePayableWithExactWormholeFeeSucceeds() public {
    bytes32 pid = _createPayable();
    mockWormhole.setMessageFee(0.005 ether);
    deal(host, 1 ether);
    vm.prank(host);
    chainbills.closePayable{value: 0.005 ether}(pid);
    assertTrue(cbGetters.getPayable(pid).isClosed);
  }

  function testReopenPayableWithExactWormholeFeeSucceeds() public {
    bytes32 pid = _createPayable();
    uint256 fee = 0.005 ether;
    mockWormhole.setMessageFee(fee);
    deal(host, 1 ether);
    vm.prank(host);
    chainbills.closePayable{value: fee}(pid);
    vm.prank(host);
    chainbills.reopenPayable{value: fee}(pid);
    assertFalse(cbGetters.getPayable(pid).isClosed);
  }

  // -------------------------------------------------------------------------
  // CCTP broadcast path via publishPayableDetails
  // -------------------------------------------------------------------------

  function testPublishPayableDetailsBroadcastsViaCctp() public {
    // Set foreignCbChainId to use CCTP for data messaging.
    vm.prank(owner);
    chainbills.setChainDataMessagingProtocol(foreignCbChainId, 2); // 2 = CCTP

    bytes32 pid = _createPayable();
    vm.prank(relayer);
    // MockCircleTransmitter.sendMessage is a no-op — verify no revert.
    chainbills.publishPayableDetails{value: 0}(pid);
  }

  // -------------------------------------------------------------------------
  // payForeignWithCircle
  // -------------------------------------------------------------------------

  function testPayForeignWithCircleRevertsOnNonexistentForeignPayable() public {
    bytes32 nonExistentId = keccak256('pfc-no-exist');
    address payer = makeAddr('payer-pfc');
    deal(address(usdc), payer, 1e6);
    vm.prank(payer);
    usdc.approve(address(chainbills), 1e6);

    vm.prank(payer);
    vm.expectRevert(InvalidPayableId.selector);
    chainbills.payForeignWithCircle(nonExistentId, address(usdc), 1e6);
  }

  function testPayForeignWithCircleRevertsOnClosedForeignPayable() public {
    bytes32 fpId = keccak256('pfc-closed');
    vm.prank(owner);
    chainbills.adminSyncForeignPayable(fpId, foreignCbChainId, 1, 1, false, new TokenAndAmountForeign[](0));
    vm.prank(owner);
    chainbills.adminSyncForeignPayable(fpId, foreignCbChainId, 2, 2, true, new TokenAndAmountForeign[](0));

    address payer = makeAddr('payer-pfc-closed');
    deal(address(usdc), payer, 1e6);
    vm.prank(payer);
    usdc.approve(address(chainbills), 1e6);

    vm.prank(payer);
    vm.expectRevert(PayableIsClosed.selector);
    chainbills.payForeignWithCircle(fpId, address(usdc), 1e6);
  }

  function testPayForeignWithCircleRevertsOnMatchingTokenNotFound() public {
    bytes32 fpId = keccak256('pfc-ataa-mismatch');
    TokenAndAmountForeign[] memory ataa = new TokenAndAmountForeign[](1);
    ataa[0] = TokenAndAmountForeign({token: foreignToken, amount: 1e6});
    vm.prank(owner);
    chainbills.adminSyncForeignPayable(fpId, foreignCbChainId, 1, 1, false, ataa);

    address payer = makeAddr('payer-ataa');
    deal(address(usdc), payer, 2e6);
    vm.prank(payer);
    usdc.approve(address(chainbills), 2e6);

    vm.prank(payer);
    vm.expectRevert(MatchingTokenAndAmountNotFound.selector);
    chainbills.payForeignWithCircle(fpId, address(usdc), 2e6); // wrong amount
  }

  function testPayForeignWithCircleSuccess() public {
    bytes32 fpId = keccak256('pfc-success');
    vm.prank(owner);
    chainbills.adminSyncForeignPayable(fpId, foreignCbChainId, 1, 1, false, new TokenAndAmountForeign[](0));

    address payer = makeAddr('payer-success');
    deal(address(usdc), payer, 1e6);
    vm.prank(payer);
    usdc.approve(address(chainbills), 1e6);

    vm.prank(payer);
    (bytes32 userPaymentId,) = chainbills.payForeignWithCircle(fpId, address(usdc), 1e6);

    assertTrue(userPaymentId != bytes32(0));
    UserPayment memory up = cbGetters.getUserPayment(userPaymentId);
    assertEq(up.payableId, fpId);
    assertEq(up.payableChainId, foreignCbChainId);
    assertEq(up.token, address(usdc));
    assertEq(up.amount, 1e6);
  }

  function testPayForeignWithCircleWithAtaaMatchSuccess() public {
    bytes32 fpId = keccak256('pfc-ataa-match');
    TokenAndAmountForeign[] memory ataa = new TokenAndAmountForeign[](1);
    ataa[0] = TokenAndAmountForeign({token: foreignToken, amount: 1e6});
    vm.prank(owner);
    chainbills.adminSyncForeignPayable(fpId, foreignCbChainId, 1, 1, false, ataa);

    address payer = makeAddr('payer-ataa-match');
    deal(address(usdc), payer, 1e6);
    vm.prank(payer);
    usdc.approve(address(chainbills), 1e6);

    vm.prank(payer);
    (bytes32 userPaymentId,) = chainbills.payForeignWithCircle(fpId, address(usdc), 1e6);
    assertTrue(userPaymentId != bytes32(0));
  }

  // -------------------------------------------------------------------------
  // receiveForeignPaymentWithCircle helpers
  // -------------------------------------------------------------------------

  function _buildCircleMessage(
    uint32 sourceDomain,
    uint32 targetDomain,
    uint64 nonce,
    bytes32 sender,
    bytes32 recipient
  ) internal pure returns (bytes memory) {
    // Circle message: 4-byte prefix (ignored), then source/target domain, nonce, sender, recipient.
    return abi.encodePacked(uint32(0), sourceDomain, targetDomain, nonce, sender, recipient);
  }

  function _setupPaymentVm(bytes32 localPayableId, uint64 circleNonce, bytes32 vaaHash)
    internal
    returns (bytes memory circleMsg)
  {
    bytes32 payableChainToken = toWormholeFormat(address(usdc));
    bytes memory paymentEncoded = PaymentPayload({
        version: 1,
        payableId: localPayableId,
        payableChainToken: payableChainToken,
        payableChainId: thisCbChainId,
        payer: toWormholeFormat(makeAddr('foreign-payer-rfp')),
        payerChainToken: foreignToken,
        payerChainId: foreignCbChainId,
        amount: 1e6,
        circleNonce: circleNonce
      }).encode();

    IWormhole.VM memory wormVm = _buildVm(foreignWormholeChainId, foreignEmitter, paymentEncoded, vaaHash);
    mockWormhole.setPresetVM(wormVm, true, '');

    // cbChainIdToCircleDomain[thisCbChainId] is 0 by default (never explicitly set).
    circleMsg = _buildCircleMessage(
      foreignCircleDomain, uint32(0), circleNonce, foreignEmitter, toWormholeFormat(address(chainbills))
    );

    bytes32 remoteKey = keccak256(abi.encodePacked(foreignCircleDomain, foreignToken));
    mockCircleTokenMinter.setLocalToken(remoteKey, address(usdc));
  }

  // -------------------------------------------------------------------------
  // receiveForeignPaymentWithCircle
  // -------------------------------------------------------------------------

  function testReceiveForeignPaymentRevertsOnInvalidWormholeVAA() public {
    // Default mock state: valid=false → require(valid, reason) reverts.
    bytes memory circleMsg = _buildCircleMessage(
      foreignCircleDomain, uint32(0), uint64(1), foreignEmitter, toWormholeFormat(address(chainbills))
    );
    vm.expectRevert();
    chainbills.receiveForeignPaymentWithCircle(
      RedeemCirclePaymentParameters({
        wormholeEncoded: bytes(''), circleBridgeMessage: circleMsg, circleAttestation: bytes('')
      })
    );
  }

  function testReceiveForeignPaymentRevertsOnInvalidLocalPayable() public {
    bytes32 noLocalPayable = keccak256('rfp-no-local');
    bytes memory paymentEncoded = PaymentPayload({
        version: 1,
        payableId: noLocalPayable,
        payableChainToken: toWormholeFormat(address(usdc)),
        payableChainId: thisCbChainId,
        payer: toWormholeFormat(makeAddr('fp')),
        payerChainToken: foreignToken,
        payerChainId: foreignCbChainId,
        amount: 1e6,
        circleNonce: 1
      }).encode();

    IWormhole.VM memory wormVm =
      _buildVm(foreignWormholeChainId, foreignEmitter, paymentEncoded, keccak256('rfp-no-local-hash'));
    mockWormhole.setPresetVM(wormVm, true, '');

    bytes memory circleMsg = _buildCircleMessage(
      foreignCircleDomain, uint32(0), uint64(1), foreignEmitter, toWormholeFormat(address(chainbills))
    );

    vm.expectRevert(InvalidPayableId.selector);
    chainbills.receiveForeignPaymentWithCircle(
      RedeemCirclePaymentParameters({
        wormholeEncoded: bytes(''), circleBridgeMessage: circleMsg, circleAttestation: bytes('')
      })
    );
  }

  function testReceiveForeignPaymentRevertsOnCircleSourceDomainMismatch() public {
    vm.prank(host);
    (bytes32 localPayableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    bytes memory paymentEncoded = PaymentPayload({
        version: 1,
        payableId: localPayableId,
        payableChainToken: toWormholeFormat(address(usdc)),
        payableChainId: thisCbChainId,
        payer: toWormholeFormat(makeAddr('fp-src')),
        payerChainToken: foreignToken,
        payerChainId: foreignCbChainId,
        amount: 1e6,
        circleNonce: 1
      }).encode();

    IWormhole.VM memory wormVm =
      _buildVm(foreignWormholeChainId, foreignEmitter, paymentEncoded, keccak256('rfp-src-hash'));
    mockWormhole.setPresetVM(wormVm, true, '');

    // Source domain 99 != cbChainIdToCircleDomain[foreignCbChainId] = foreignCircleDomain = 1.
    bytes memory circleMsg =
      _buildCircleMessage(uint32(99), uint32(0), uint64(1), foreignEmitter, toWormholeFormat(address(chainbills)));

    vm.expectRevert(CircleSourceDomainMismatch.selector);
    chainbills.receiveForeignPaymentWithCircle(
      RedeemCirclePaymentParameters({
        wormholeEncoded: bytes(''), circleBridgeMessage: circleMsg, circleAttestation: bytes('')
      })
    );
  }

  function testReceiveForeignPaymentRevertsOnCircleTargetDomainMismatch() public {
    vm.prank(host);
    (bytes32 localPayableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    bytes memory paymentEncoded = PaymentPayload({
        version: 1,
        payableId: localPayableId,
        payableChainToken: toWormholeFormat(address(usdc)),
        payableChainId: thisCbChainId,
        payer: toWormholeFormat(makeAddr('fp-tgt')),
        payerChainToken: foreignToken,
        payerChainId: foreignCbChainId,
        amount: 1e6,
        circleNonce: 1
      }).encode();

    IWormhole.VM memory wormVm =
      _buildVm(foreignWormholeChainId, foreignEmitter, paymentEncoded, keccak256('rfp-tgt-hash'));
    mockWormhole.setPresetVM(wormVm, true, '');

    // Target domain 99 != cbChainIdToCircleDomain[thisCbChainId] = 0.
    bytes memory circleMsg = _buildCircleMessage(
      foreignCircleDomain, uint32(99), uint64(1), foreignEmitter, toWormholeFormat(address(chainbills))
    );

    vm.expectRevert(CircleTargetDomainMismatch.selector);
    chainbills.receiveForeignPaymentWithCircle(
      RedeemCirclePaymentParameters({
        wormholeEncoded: bytes(''), circleBridgeMessage: circleMsg, circleAttestation: bytes('')
      })
    );
  }

  function testReceiveForeignPaymentRevertsOnCircleNonceMismatch() public {
    vm.prank(host);
    (bytes32 localPayableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    bytes memory paymentEncoded = PaymentPayload({
        version: 1,
        payableId: localPayableId,
        payableChainToken: toWormholeFormat(address(usdc)),
        payableChainId: thisCbChainId,
        payer: toWormholeFormat(makeAddr('fp-nonce')),
        payerChainToken: foreignToken,
        payerChainId: foreignCbChainId,
        amount: 1e6,
        circleNonce: 42
      }).encode();

    IWormhole.VM memory wormVm =
      _buildVm(foreignWormholeChainId, foreignEmitter, paymentEncoded, keccak256('rfp-nonce-hash'));
    mockWormhole.setPresetVM(wormVm, true, '');

    // Circle nonce 99 != payload circleNonce 42.
    bytes memory circleMsg = _buildCircleMessage(
      foreignCircleDomain, uint32(0), uint64(99), foreignEmitter, toWormholeFormat(address(chainbills))
    );

    vm.expectRevert(CircleNonceMismatch.selector);
    chainbills.receiveForeignPaymentWithCircle(
      RedeemCirclePaymentParameters({
        wormholeEncoded: bytes(''), circleBridgeMessage: circleMsg, circleAttestation: bytes('')
      })
    );
  }

  function testReceiveForeignPaymentRevertsOnCircleSenderMismatch() public {
    vm.prank(host);
    (bytes32 localPayableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    bytes memory paymentEncoded = PaymentPayload({
        version: 1,
        payableId: localPayableId,
        payableChainToken: toWormholeFormat(address(usdc)),
        payableChainId: thisCbChainId,
        payer: toWormholeFormat(makeAddr('fp-sender')),
        payerChainToken: foreignToken,
        payerChainId: foreignCbChainId,
        amount: 1e6,
        circleNonce: 1
      }).encode();

    IWormhole.VM memory wormVm =
      _buildVm(foreignWormholeChainId, foreignEmitter, paymentEncoded, keccak256('rfp-sender-hash'));
    mockWormhole.setPresetVM(wormVm, true, '');

    bytes32 wrongSender = toWormholeFormat(makeAddr('wrong-sender'));
    bytes memory circleMsg = _buildCircleMessage(
      foreignCircleDomain, uint32(0), uint64(1), wrongSender, toWormholeFormat(address(chainbills))
    );

    vm.expectRevert(CircleSenderMismatch.selector);
    chainbills.receiveForeignPaymentWithCircle(
      RedeemCirclePaymentParameters({
        wormholeEncoded: bytes(''), circleBridgeMessage: circleMsg, circleAttestation: bytes('')
      })
    );
  }

  function testReceiveForeignPaymentRevertsOnCircleRecipientMismatch() public {
    vm.prank(host);
    (bytes32 localPayableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    bytes memory paymentEncoded = PaymentPayload({
        version: 1,
        payableId: localPayableId,
        payableChainToken: toWormholeFormat(address(usdc)),
        payableChainId: thisCbChainId,
        payer: toWormholeFormat(makeAddr('fp-recip')),
        payerChainToken: foreignToken,
        payerChainId: foreignCbChainId,
        amount: 1e6,
        circleNonce: 1
      }).encode();

    IWormhole.VM memory wormVm =
      _buildVm(foreignWormholeChainId, foreignEmitter, paymentEncoded, keccak256('rfp-recip-hash'));
    mockWormhole.setPresetVM(wormVm, true, '');

    bytes32 wrongRecipient = toWormholeFormat(makeAddr('wrong-recipient'));
    bytes memory circleMsg =
      _buildCircleMessage(foreignCircleDomain, uint32(0), uint64(1), foreignEmitter, wrongRecipient);

    vm.expectRevert(CircleRecipientMismatch.selector);
    chainbills.receiveForeignPaymentWithCircle(
      RedeemCirclePaymentParameters({
        wormholeEncoded: bytes(''), circleBridgeMessage: circleMsg, circleAttestation: bytes('')
      })
    );
  }

  function testReceiveForeignPaymentRevertsOnCircleTokenMismatch() public {
    vm.prank(host);
    (bytes32 localPayableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    bytes memory paymentEncoded = PaymentPayload({
        version: 1,
        payableId: localPayableId,
        payableChainToken: toWormholeFormat(address(usdc)),
        payableChainId: thisCbChainId,
        payer: toWormholeFormat(makeAddr('fp-token')),
        payerChainToken: foreignToken,
        payerChainId: foreignCbChainId,
        amount: 1e6,
        circleNonce: 1
      }).encode();

    IWormhole.VM memory wormVm =
      _buildVm(foreignWormholeChainId, foreignEmitter, paymentEncoded, keccak256('rfp-token-hash'));
    mockWormhole.setPresetVM(wormVm, true, '');

    bytes memory circleMsg = _buildCircleMessage(
      foreignCircleDomain, uint32(0), uint64(1), foreignEmitter, toWormholeFormat(address(chainbills))
    );

    // Token minter returns a different token — mismatch with payload.payableChainToken.
    bytes32 remoteKey = keccak256(abi.encodePacked(foreignCircleDomain, foreignToken));
    mockCircleTokenMinter.setLocalToken(remoteKey, makeAddr('wrong-token'));

    vm.expectRevert(CircleTokenMismatch.selector);
    chainbills.receiveForeignPaymentWithCircle(
      RedeemCirclePaymentParameters({
        wormholeEncoded: bytes(''), circleBridgeMessage: circleMsg, circleAttestation: bytes('')
      })
    );
  }

  function testReceiveForeignPaymentRevertsOnMintingFailed() public {
    vm.prank(host);
    (bytes32 localPayableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    bytes memory circleMsg = _setupPaymentVm(localPayableId, 1, keccak256('rfp-mint-fail-hash'));
    mockCircleTransmitter.setReceiveSuccess(false);

    vm.expectRevert(CircleMintingFailed.selector);
    chainbills.receiveForeignPaymentWithCircle(
      RedeemCirclePaymentParameters({
        wormholeEncoded: bytes(''), circleBridgeMessage: circleMsg, circleAttestation: bytes('')
      })
    );
  }

  function testReceiveForeignPaymentWithCircleSuccess() public {
    vm.prank(host);
    (bytes32 localPayableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    bytes memory circleMsg = _setupPaymentVm(localPayableId, 1, keccak256('rfp-success-hash'));

    vm.expectEmit(true, true, true, true);
    emit ConsumedWormholePaymentMessage(localPayableId, foreignCbChainId, keccak256('rfp-success-hash'));
    bytes32 payablePaymentId = chainbills.receiveForeignPaymentWithCircle(
      RedeemCirclePaymentParameters({
        wormholeEncoded: bytes(''), circleBridgeMessage: circleMsg, circleAttestation: bytes('')
      })
    );

    assertTrue(payablePaymentId != bytes32(0));
    PayablePayment memory pp = cbGetters.getPayablePayment(payablePaymentId);
    assertEq(pp.payableId, localPayableId);
    assertEq(pp.token, address(usdc));
    assertEq(pp.amount, 1e6);
  }

  function testReceiveForeignPaymentWithAutoWithdraw() public {
    vm.prank(host);
    (bytes32 localPayableId,) = chainbills.createPayable(new TokenAndAmount[](0), true);

    // Pre-fund proxy with USDC to simulate what Circle minting would deposit.
    deal(address(usdc), address(chainbills), 1e6);

    bytes memory circleMsg = _setupPaymentVm(localPayableId, 2, keccak256('rfp-autow-hash'));

    chainbills.receiveForeignPaymentWithCircle(
      RedeemCirclePaymentParameters({
        wormholeEncoded: bytes(''), circleBridgeMessage: circleMsg, circleAttestation: bytes('')
      })
    );

    // After auto-withdraw, host should have received funds minus fees.
    assertGt(usdc.balanceOf(host), 0);
  }

  // -------------------------------------------------------------------------
  // perChainConsumedWormholeMessagesPaginated
  // -------------------------------------------------------------------------

  function testPerChainConsumedWormholeMessagesPaginated() public {
    bytes32 hash1 = keccak256('pc-wh-hash-1');
    bytes32 hash2 = keccak256('pc-wh-hash-2');

    IWormhole.VM memory vm1 =
      _buildVm(foreignWormholeChainId, foreignEmitter, _encodePayload(keccak256('pp-wh-1'), 1, 1), hash1);
    mockWormhole.setPresetVM(vm1, true, '');
    chainbills.receivePayableUpdateViaWormhole(bytes(''));

    IWormhole.VM memory vm2 =
      _buildVm(foreignWormholeChainId, foreignEmitter, _encodePayload(keccak256('pp-wh-2'), 1, 1), hash2);
    mockWormhole.setPresetVM(vm2, true, '');
    chainbills.receivePayableUpdateViaWormhole(bytes(''));

    bytes32[] memory msgs = cbGetters.perChainConsumedWormholeMessagesPaginated(foreignWormholeChainId, 0, 10);
    assertEq(msgs.length, 2);
    assertEq(msgs[0], hash1);
    assertEq(msgs[1], hash2);

    bytes32[] memory empty = cbGetters.perChainConsumedWormholeMessagesPaginated(foreignWormholeChainId, 10, 10);
    assertEq(empty.length, 0);

    bytes32[] memory one = cbGetters.perChainConsumedWormholeMessagesPaginated(foreignWormholeChainId, 1, 10);
    assertEq(one.length, 1);
    assertEq(one[0], hash2);
  }
}
