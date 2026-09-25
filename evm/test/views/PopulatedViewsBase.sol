// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CCTP_FINALITY_FAST} from 'src/types/CbConstants.sol';
import {
  ActivityRecord,
  ActivityType,
  EntityType,
  ForeignPayableView,
  Payable,
  PayableForeign,
  PayablePayment,
  PayableView,
  TokenAndAmount,
  TokenAndAmountForeign,
  TokenFeeConfig,
  User,
  UserPayment,
  UserView,
  Withdrawal
} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';
import {MockTaxToken} from '../mocks/MockTaxToken.sol';

/// Two-chain fixture with rich, multi-actor activity, shared by the populated view suites.
///
/// Chain A (every step at its own timestamp):
///   1-4   host creates P1 (any token) and P2 (1 native or 50 USDC); host2 creates P3 (any token, auto-withdraw);
///         host3 creates P4 (10 TAX, a 1% transfer-tax token).
///   5-11  payer pays P1 2 native and 300 USDC; payer2 pays P2 1 native and 50 USDC; payer pays P3 200 USDC
///         (auto-withdrawn, fee capped); payer3 pays P4 10 TAX pulling 10.2 (10.098 arrive); payer2 pays P3 0.5
///         native (auto-withdrawn).
///   12-15 host closes and reopens P2, restricts P1 to 25 USDC; host3 turns auto-withdraw on for P4.
///   16-20 host withdraws 0.5 native from P1, all USDC from P1 (fee capped), 20 USDC from P2; host3 withdraws 5 TAX
///         from P4 and closes it.
/// Chain B: foreignHost creates F1 (any token, relayed to A over Wormhole) and F2 (40 USDC, relayed over CCTP),
///   restricts F1 to 75 USDC (relayed over CCTP) and closes F2 (relayed over Wormhole). The other copy of each update
///   is never relayed. P2's creation is relayed from A to B over Wormhole.
/// Cross-chain payments: payer pays F1 75 USDC with a 3 USDC max fee (relayed, Circle takes 3); payer2 pays F1 75
///   USDC with no fee (never relayed); foreignPayer pays P2 50 USDC from B with a 2 USDC max fee (relayed, Circle
///   takes 1, so 51 USDC are credited).
///
/// USDC withdrawals use a 1% override capped at 1.5 USDC; native and TAX use the 2% global fee.
abstract contract PopulatedViewsBase is CbTestBase {
  uint256 internal constant STEP = 60;
  uint256 internal constant TAX_BPS = 100;
  uint16 internal constant USDC_FEE_BPS = 100;
  uint256 internal constant USDC_FEE_CAP = 1.5e6;
  bytes32 internal constant UNKNOWN_ID = keccak256('unknown-id');
  bytes32 internal constant UNKNOWN_CHAIN = keccak256('eip155:999');

  address internal host2 = makeAddr('host-2');
  address internal host3 = makeAddr('host-3');
  address internal payer2 = makeAddr('payer-2');
  address internal payer3 = makeAddr('payer-3');
  address internal foreignHost = makeAddr('foreign-host');
  address internal foreignPayer = makeAddr('foreign-payer');

  MockTaxToken internal tax;

  // Payables hosted on chain A and on chain B.
  bytes32 internal p1;
  bytes32 internal p2;
  bytes32 internal p3;
  bytes32 internal p4;
  bytes32 internal f1;
  bytes32 internal f2;
  mapping(bytes32 payableId => uint256) internal createdAt;

  // Chain A records, in creation order (index 0 is record 1).
  bytes32[] internal up;
  bytes32[] internal pp;
  bytes32[] internal wd;

  // Chain B records.
  bytes32 internal bUserPaymentId;
  bytes32 internal bPayablePaymentId;
  uint256 internal bUserPaidAt;
  uint256 internal bReceivedAt;

  // Sync timestamps.
  uint64 internal f1UpdatedAt;
  uint256 internal f1SyncedAt;
  uint64 internal f2ClosedAt;
  uint256 internal f2SyncedAt;
  uint256 internal p2SyncedOnBAt;

  // Wormhole hashes of chain B's broadcasts (nonce 1..4) and of chain A's P2 creation.
  bytes32[4] internal bVaaHashes;
  bytes32 internal p2CreateVaaHash;

  // CCTP nonces of every message sent by chain B (index 0..4) and of chain A's two payment burns.
  bytes32[5] internal bCctpNonces;
  bytes32 internal relayedBurnNonceA;
  bytes32 internal unrelayedBurnNonceA;

  // Expected activity and user lists on chain A (payment and withdrawal lists are spelled out in the tests).
  bytes32[] internal expActivities;
  mapping(address => bytes32[]) internal expActivitiesOfUser;
  mapping(bytes32 => bytes32[]) internal expActivitiesOfPayable;
  address[] internal expUsers;

  // Expected records on chain A.
  mapping(bytes32 => UserPayment) internal expUserPayment;
  mapping(bytes32 => PayablePayment) internal expPayablePayment;
  mapping(bytes32 => Withdrawal) internal expWithdrawal;
  mapping(bytes32 => ActivityRecord) internal expActivity;

  /// Secondary key of two-key lists (the payer chain of payable-chain payments), read by the page adapters.
  bytes32 internal pageChainKey;

  // Latest same-chain payment, for `_logPayment`.
  address private _lastPayer;
  bytes32 private _lastPayable;
  address private _lastToken;

  function setUp() public virtual override {
    super.setUp();
    _setUpChainB();

    tax = new MockTaxToken(TAX_BPS);
    vm.startPrank(owner);
    cb.allowPaymentsForToken(address(tax));
    cb.setTokenTransferTaxAllowed(address(tax), true);
    cb.setTokenFeeConfig(
      address(usdc),
      TokenFeeConfig({
        hasFeeBpsOverride: true, feeBps: USDC_FEE_BPS, hasMaxWithdrawalFee: true, maxWithdrawalFee: USDC_FEE_CAP
      })
    );
    vm.stopPrank();

    _fundUsdc(chainA, payer, 1_000e6);
    _fundUsdc(chainA, payer2, 1_000e6);
    _fundUsdc(chainB, foreignPayer, 1_000e6);
    tax.mint(payer3, 100e18);
    vm.prank(payer3);
    tax.approve(address(cb), type(uint256).max);
    vm.deal(payer, 10 ether);
    vm.deal(payer2, 10 ether);
    vm.deal(host, 1 ether);
    vm.deal(host3, 1 ether);
    vm.deal(foreignHost, 1 ether);

    _createLocalPayables();
    _payLocalPayables();
    _updateLocalPayables();
    _withdrawLocally();
    _syncForeignPayables();
    _payAcrossChains();
  }

  // ---------------------------------------------------------------------------
  // Scenario
  // ---------------------------------------------------------------------------

  function _createLocalPayables() private {
    _tick();
    p1 = _createPayable(chainA, host, _anyToken(), false);
    createdAt[p1] = _now();
    _logInit(host); // activity 1
    _logActivity(ActivityType.CreatedPayable, p1, host, 2, p1, 1); // activity 2

    _tick();
    p2 = _createPayable(chainA, host, _p2Allowed(), false);
    createdAt[p2] = _now();
    _logActivity(ActivityType.CreatedPayable, p2, host, 3, p2, 1); // activity 3

    _tick();
    p3 = _createPayable(chainA, host2, _anyToken(), true);
    createdAt[p3] = _now();
    _logInit(host2); // activity 4
    _logActivity(ActivityType.CreatedPayable, p3, host2, 2, p3, 1); // activity 5

    _tick();
    p4 = _createPayable(chainA, host3, _only(address(tax), 10e18), false);
    createdAt[p4] = _now();
    _logInit(host3); // activity 6
    _logActivity(ActivityType.CreatedPayable, p4, host3, 2, p4, 1); // activity 7
  }

  function _payLocalPayables() private {
    // payer pays P1 2 native.
    _tick();
    _payLocal(payer, p1, native, 2 ether, 2 ether);
    _logInit(payer); // activity 8
    _logPayment(1, 1, 1, 1, 2 ether, 2 ether, 2 ether); // activities 9-10
    _logActivity(ActivityType.UserPaid, up[0], payer, 2, bytes32(0), 0);
    _logActivity(ActivityType.PayableReceived, pp[0], address(0), 0, p1, 2);

    // payer pays P1 300 USDC.
    _tick();
    _payLocal(payer, p1, address(usdc), 300e6, 300e6);
    _logPayment(2, 2, 2, 2, 300e6, 300e6, 300e6); // activities 11-12
    _logActivity(ActivityType.UserPaid, up[1], payer, 3, bytes32(0), 0);
    _logActivity(ActivityType.PayableReceived, pp[1], address(0), 0, p1, 3);

    // payer2 pays P2 1 native.
    _tick();
    _payLocal(payer2, p2, native, 1 ether, 1 ether);
    _logInit(payer2); // activity 13
    _logPayment(3, 1, 1, 1, 1 ether, 1 ether, 1 ether); // activities 14-15
    _logActivity(ActivityType.UserPaid, up[2], payer2, 2, bytes32(0), 0);
    _logActivity(ActivityType.PayableReceived, pp[2], address(0), 0, p2, 2);

    // payer2 pays P2 50 USDC.
    _tick();
    _payLocal(payer2, p2, address(usdc), 50e6, 50e6);
    _logPayment(4, 2, 2, 2, 50e6, 50e6, 50e6); // activities 16-17
    _logActivity(ActivityType.UserPaid, up[3], payer2, 3, bytes32(0), 0);
    _logActivity(ActivityType.PayableReceived, pp[3], address(0), 0, p2, 3);

    // payer pays P3 200 USDC, auto-withdrawn to host2 with the fee capped at 1.5 USDC (1% would be 2).
    _tick();
    _payLocal(payer, p3, address(usdc), 200e6, 200e6);
    _logPayment(5, 3, 1, 1, 200e6, 200e6, 200e6); // activities 18-19
    _logActivity(ActivityType.UserPaid, up[4], payer, 4, bytes32(0), 0);
    _logActivity(ActivityType.PayableReceived, pp[4], address(0), 0, p3, 2);
    _logWithdrawal(_idOf(host2, EntityType.Withdrawal, 1), p3, host2, address(usdc), 1, 1, 1, 200e6, 1.5e6);
    _logActivity(ActivityType.Withdrew, wd[0], host2, 3, p3, 3); // activity 20

    // payer3 pays P4 10 TAX, pulling 10.2 of which 1% is burned in transit: 10.098 arrive and are credited.
    _tick();
    _payLocal(payer3, p4, address(tax), 10e18, 10.2e18);
    _logInit(payer3); // activity 21
    _logPayment(6, 1, 1, 1, 10e18, 10.2e18, 10.098e18); // activities 22-23
    _logActivity(ActivityType.UserPaid, up[5], payer3, 2, bytes32(0), 0);
    _logActivity(ActivityType.PayableReceived, pp[5], address(0), 0, p4, 2);

    // payer2 pays P3 0.5 native, auto-withdrawn to host2 with the 2% global fee.
    _tick();
    _payLocal(payer2, p3, native, 0.5 ether, 0.5 ether);
    _logPayment(7, 3, 2, 2, 0.5 ether, 0.5 ether, 0.5 ether); // activities 24-25
    _logActivity(ActivityType.UserPaid, up[6], payer2, 4, bytes32(0), 0);
    _logActivity(ActivityType.PayableReceived, pp[6], address(0), 0, p3, 4);
    _logWithdrawal(_idOf(host2, EntityType.Withdrawal, 2), p3, host2, native, 2, 2, 2, 0.5 ether, 0.01 ether);
    _logActivity(ActivityType.Withdrew, wd[1], host2, 4, p3, 5); // activity 26
  }

  function _updateLocalPayables() private {
    uint256 fee = cb.quoteBroadcastFee();

    _tick();
    vm.prank(host);
    cb.closePayable{value: fee}(p2);
    _logActivity(ActivityType.ClosedPayable, p2, host, 4, p2, 4); // activity 27

    _tick();
    vm.prank(host);
    cb.reopenPayable{value: fee}(p2);
    _logActivity(ActivityType.ReopenedPayable, p2, host, 5, p2, 5); // activity 28

    _tick();
    vm.prank(host);
    cb.updatePayableAllowedTokensAndAmounts{value: fee}(p1, _only(address(usdc), 25e6));
    _logActivity(ActivityType.UpdatedPayableAllowedTokensAndAmounts, p1, host, 6, p1, 4); // activity 29

    _tick();
    vm.prank(host3);
    cb.updatePayableAutoWithdraw(p4, true);
    _logActivity(ActivityType.UpdatedPayableAutoWithdrawStatus, p4, host3, 3, p4, 3); // activity 30
  }

  function _withdrawLocally() private {
    bytes32 id;

    _tick();
    vm.prank(host);
    id = cb.withdraw(p1, native, 0.5 ether);
    _logWithdrawal(id, p1, host, native, 3, 1, 1, 0.5 ether, 0.01 ether);
    _logActivity(ActivityType.Withdrew, id, host, 7, p1, 5); // activity 31

    _tick();
    vm.prank(host);
    id = cb.withdrawAll(p1, address(usdc));
    _logWithdrawal(id, p1, host, address(usdc), 4, 2, 2, 300e6, 1.5e6);
    _logActivity(ActivityType.Withdrew, id, host, 8, p1, 6); // activity 32

    _tick();
    vm.prank(host);
    id = cb.withdraw(p2, address(usdc), 20e6);
    _logWithdrawal(id, p2, host, address(usdc), 5, 3, 1, 20e6, 0.2e6);
    _logActivity(ActivityType.Withdrew, id, host, 9, p2, 6); // activity 33

    _tick();
    vm.prank(host3);
    id = cb.withdraw(p4, address(tax), 5e18);
    _logWithdrawal(id, p4, host3, address(tax), 6, 1, 1, 5e18, 0.1e18);
    _logActivity(ActivityType.Withdrew, id, host3, 4, p4, 4); // activity 34

    _tick();
    uint256 fee = cb.quoteBroadcastFee();
    vm.prank(host3);
    cb.closePayable{value: fee}(p4);
    _logActivity(ActivityType.ClosedPayable, p4, host3, 5, p4, 5); // activity 35
  }

  function _syncForeignPayables() private {
    bytes memory message;
    bytes memory attestation;

    // B nonce 1: F1 created, relayed to A over Wormhole.
    _tick();
    f1 = _createPayable(chainB, foreignHost, _anyToken(), false);
    _tick();
    vm.prank(relayer);
    cb.receivePayableUpdateViaWormhole(chainB.wormhole.vaaOf(0));

    // B nonce 2: F2 created, relayed to A over CCTP.
    _tick();
    f2 = _createPayable(chainB, foreignHost, _only(address(chainB.usdc), 40e6), false);
    _tick();
    (message, attestation) = _cctpAt(chainB, 1, CCTP_FINALITY_FAST, 0, false);
    vm.prank(relayer);
    cb.receivePayableUpdateViaCctp(message, attestation);

    // B nonce 3: F1 restricted to 75 USDC, relayed to A over CCTP.
    _tick();
    vm.prank(foreignHost);
    chainB.cb.updatePayableAllowedTokensAndAmounts{value: WORMHOLE_FEE}(f1, _only(address(chainB.usdc), 75e6));
    f1UpdatedAt = uint64(_now());
    _tick();
    (message, attestation) = _cctpAt(chainB, 2, CCTP_FINALITY_FAST, 0, false);
    vm.prank(relayer);
    cb.receivePayableUpdateViaCctp(message, attestation);
    f1SyncedAt = _now();

    // B nonce 4: F2 closed, relayed to A over Wormhole.
    _tick();
    vm.prank(foreignHost);
    chainB.cb.closePayable{value: WORMHOLE_FEE}(f2);
    f2ClosedAt = uint64(_now());
    _tick();
    vm.prank(relayer);
    cb.receivePayableUpdateViaWormhole(chainB.wormhole.vaaOf(3));
    f2SyncedAt = _now();

    // A nonce 2: P2's creation, relayed to B over Wormhole so B can pay it.
    _tick();
    vm.prank(relayer);
    chainB.cb.receivePayableUpdateViaWormhole(chainA.wormhole.vaaOf(1));
    p2SyncedOnBAt = _now();

    for (uint256 i; i < 4; i++) {
      bVaaHashes[i] = keccak256(chainB.wormhole.vaaOf(i));
      bCctpNonces[i] = _cctpNonce(chainB.transmitter.sent(i));
    }
    p2CreateVaaHash = keccak256(chainA.wormhole.vaaOf(1));
  }

  function _payAcrossChains() private {
    bytes memory message;
    bytes memory attestation;

    // payer pays F1 75 USDC offering a 3 USDC fee: 78 USDC leave the payer; Circle keeps 3 on the way to B.
    _tick();
    vm.prank(payer);
    bytes32 id = cb.payForeignViaCctp(f1, address(usdc), 75e6, 3e6);
    _logUserPayment(id, f1, payer, address(usdc), chainB.cbChainId, 8, 4, 75e6, 78e6);
    _logActivity(ActivityType.UserPaid, id, payer, 5, bytes32(0), 0); // activity 36
    relayedBurnNonceA = _cctpNonce(chainA.transmitter.sent(8));
    _tick();
    (message, attestation) = _cctpAt(chainA, 8, CCTP_FINALITY_FAST, 3e6, true);
    vm.prank(relayer);
    bPayablePaymentId = chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
    bReceivedAt = _now();

    // payer2 pays F1 75 USDC with no fee; the burn is never relayed.
    _tick();
    vm.prank(payer2);
    id = cb.payForeignViaCctp(f1, address(usdc), 75e6, 0);
    _logUserPayment(id, f1, payer2, address(usdc), chainB.cbChainId, 9, 4, 75e6, 75e6);
    _logActivity(ActivityType.UserPaid, id, payer2, 5, bytes32(0), 0); // activity 37
    unrelayedBurnNonceA = _cctpNonce(chainA.transmitter.sent(9));

    // foreignPayer pays P2 50 USDC from B offering 2; Circle keeps 1 so 51 USDC are minted to A.
    _tick();
    vm.prank(foreignPayer);
    bUserPaymentId = chainB.cb.payForeignViaCctp(p2, address(chainB.usdc), 50e6, 2e6);
    bUserPaidAt = _now();
    bCctpNonces[4] = _cctpNonce(chainB.transmitter.sent(4));
    _tick();
    (message, attestation) = _cctpAt(chainB, 4, CCTP_FINALITY_FAST, 1e6, true);
    vm.prank(relayer);
    id = cb.receiveForeignPaymentViaCctp(message, attestation);
    _logPayablePayment(
      id, p2, _toBytes32(foreignPayer), address(usdc), 8, chainB.cbChainId, 1, 3, 50e6, 51e6, bUserPaymentId
    );
    _logActivity(ActivityType.PayableReceived, id, address(0), 0, p2, 7); // activity 38
  }

  // ---------------------------------------------------------------------------
  // Scenario helpers
  // ---------------------------------------------------------------------------

  /// Advances time by one step.
  function _tick() internal {
    vm.warp(_now() + STEP);
  }

  /// Returns the current block timestamp through the cheatcode, so the optimizer cannot reuse a read taken before a
  /// `vm.warp`.
  function _now() internal view returns (uint256) {
    return vm.getBlockTimestamp();
  }

  function _p2Allowed() internal view returns (TokenAndAmount[] memory list) {
    list = new TokenAndAmount[](2);
    list[0] = _tokenAmount(native, 1 ether);
    list[1] = _tokenAmount(address(usdc), 50e6);
  }

  /// Pays a chain A payable and stores the returned IDs for `_logPayment`.
  function _payLocal(address payer_, bytes32 payableId, address token, uint256 amount, uint256 maxAmountIn) private {
    uint256 value = token == native ? amount : 0;
    vm.prank(payer_);
    (bytes32 userPaymentId, bytes32 payablePaymentId) = cb.pay{value: value}(payableId, token, amount, maxAmountIn);
    up.push(userPaymentId);
    pp.push(payablePaymentId);
    _lastPayer = payer_;
    _lastPayable = payableId;
    _lastToken = token;
  }

  /// Records the expected receipts of the latest same-chain payment with hand-computed counters.
  function _logPayment(
    uint256 chainCount,
    uint256 payerCount,
    uint256 localChainCount,
    uint256 payableCount,
    uint256 requested,
    uint256 debited,
    uint256 credited
  ) private {
    bytes32 userPaymentId = up[up.length - 1];
    bytes32 payablePaymentId = pp[pp.length - 1];
    _logUserPayment(
      userPaymentId, _lastPayable, _lastPayer, _lastToken, chainA.cbChainId, chainCount, payerCount, requested, debited
    );
    // User payments and payable payments are numbered in lockstep for same-chain payments.
    _logPayablePayment(
      payablePaymentId,
      _lastPayable,
      _toBytes32(_lastPayer),
      _lastToken,
      chainCount,
      chainA.cbChainId,
      localChainCount,
      payableCount,
      requested,
      credited,
      userPaymentId
    );
  }

  function _logUserPayment(
    bytes32 id,
    bytes32 payableId,
    address payer_,
    address token,
    bytes32 payableChainId,
    uint256 chainCount,
    uint256 payerCount,
    uint256 requested,
    uint256 amount
  ) private {
    // Same-chain payments are already in `up` from `_payLocal`.
    if (up.length == 0 || up[up.length - 1] != id) up.push(id);
    expUserPayment[id] = UserPayment({
      payableId: payableId,
      payer: payer_,
      token: token,
      payableChainId: payableChainId,
      chainCount: chainCount,
      payerCount: payerCount,
      timestamp: _now(),
      requestedAmount: requested,
      amount: amount
    });
  }

  function _logPayablePayment(
    bytes32 id,
    bytes32 payableId,
    bytes32 payer_,
    address token,
    uint256 chainCount,
    bytes32 payerChainId,
    uint256 localChainCount,
    uint256 payableCount,
    uint256 requested,
    uint256 amount,
    bytes32 payerPaymentId
  ) private {
    // Same-chain receipts are already in `pp` from `_payLocal`.
    if (pp.length == 0 || pp[pp.length - 1] != id) pp.push(id);
    expPayablePayment[id] = PayablePayment({
      payableId: payableId,
      payer: payer_,
      token: token,
      chainCount: chainCount,
      payerChainId: payerChainId,
      localChainCount: localChainCount,
      payableCount: payableCount,
      timestamp: _now(),
      requestedAmount: requested,
      amount: amount,
      payerPaymentId: payerPaymentId
    });
  }

  function _logWithdrawal(
    bytes32 id,
    bytes32 payableId,
    address host_,
    address token,
    uint256 chainCount,
    uint256 hostCount,
    uint256 payableCount,
    uint256 amount,
    uint256 fee
  ) private {
    wd.push(id);
    expWithdrawal[id] = Withdrawal({
      payableId: payableId,
      host: host_,
      token: token,
      chainCount: chainCount,
      hostCount: hostCount,
      payableCount: payableCount,
      timestamp: _now(),
      amount: amount,
      fee: fee
    });
  }

  /// Records a user's first-interaction activity.
  function _logInit(address wallet) private {
    expUsers.push(wallet);
    _logActivity(ActivityType.InitializedUser, _toBytes32(wallet), wallet, 1, bytes32(0), 0);
  }

  /// Records an activity. Its ID derives from the user and `userCount`, or from the payable and `payableCount` when
  /// no user is involved.
  function _logActivity(
    ActivityType activityType,
    bytes32 entity,
    address user,
    uint256 userCount,
    bytes32 payableId,
    uint256 payableCount
  ) private {
    bytes32 id = user != address(0)
      ? _idOf(user, EntityType.Activity, userCount)
      : _id(payableId, EntityType.Activity, payableCount);
    expActivities.push(id);
    if (user != address(0)) expActivitiesOfUser[user].push(id);
    if (payableId != bytes32(0)) expActivitiesOfPayable[payableId].push(id);
    expActivity[id] = ActivityRecord({
      chainCount: expActivities.length,
      userCount: userCount,
      payableCount: payableCount,
      timestamp: _now(),
      entity: entity,
      activityType: activityType
    });
  }

  /// Independent re-derivation of the protocol's entity ID scheme at the current block.
  function _id(bytes32 entity, EntityType entityType, uint256 count) internal view returns (bytes32) {
    return keccak256(abi.encodePacked(block.chainid, _now(), entity, entityType, count));
  }

  function _idOf(address wallet, EntityType entityType, uint256 count) internal view returns (bytes32) {
    return _id(_toBytes32(wallet), entityType, count);
  }

  /// Reads the nonce of a raw CCTP message (bytes 12..44 of the header).
  function _cctpNonce(bytes memory message) internal pure returns (bytes32 nonce) {
    assembly {
      nonce := mload(add(message, 44))
    }
  }

  // ---------------------------------------------------------------------------
  // Expected entities (hand-computed from the scenario)
  // ---------------------------------------------------------------------------

  function _expectedPayableView(bytes32 id) internal view returns (PayableView memory v) {
    v.payableId = id;
    if (id == p1) {
      v.info = _payableInfo(host, 1, 1, createdAt[p1], 2, 2, 6, 1, 2, false, false);
      v.allowedTokensAndAmounts = _only(address(usdc), 25e6);
      v.balances = new TokenAndAmount[](2);
      v.balances[0] = _tokenAmount(native, 1.5 ether);
      v.balances[1] = _tokenAmount(address(usdc), 0);
    } else if (id == p2) {
      v.info = _payableInfo(host, 2, 2, createdAt[p2], 3, 1, 7, 2, 2, false, false);
      v.allowedTokensAndAmounts = _p2Allowed();
      v.balances = new TokenAndAmount[](2);
      v.balances[0] = _tokenAmount(native, 1 ether);
      v.balances[1] = _tokenAmount(address(usdc), 81e6);
    } else if (id == p3) {
      v.info = _payableInfo(host2, 3, 1, createdAt[p3], 2, 2, 5, 0, 2, false, true);
      v.allowedTokensAndAmounts = new TokenAndAmount[](0);
      v.balances = new TokenAndAmount[](2);
      v.balances[0] = _tokenAmount(address(usdc), 0);
      v.balances[1] = _tokenAmount(native, 0);
    } else if (id == p4) {
      v.info = _payableInfo(host3, 4, 1, createdAt[p4], 1, 1, 5, 1, 1, true, true);
      v.allowedTokensAndAmounts = _only(address(tax), 10e18);
      v.balances = new TokenAndAmount[](1);
      v.balances[0] = _tokenAmount(address(tax), 5.098e18);
    } else {
      v.allowedTokensAndAmounts = new TokenAndAmount[](0);
      v.balances = new TokenAndAmount[](0);
    }
  }

  function _expectedForeignPayableView(bytes32 id) internal view returns (ForeignPayableView memory v) {
    v.payableId = id;
    v.allowedTokensAndAmounts = new TokenAndAmountForeign[](1);
    if (id == f1) {
      v.info = _foreignInfo(chainB.cbChainId, 1, false, 3, f1UpdatedAt, f1SyncedAt);
      v.allowedTokensAndAmounts[0] = _foreignTokenAmount(_toBytes32(address(chainB.usdc)), 75e6);
    } else if (id == f2) {
      v.info = _foreignInfo(chainB.cbChainId, 1, true, 4, f2ClosedAt, f2SyncedAt);
      v.allowedTokensAndAmounts[0] = _foreignTokenAmount(_toBytes32(address(chainB.usdc)), 40e6);
    } else {
      v.allowedTokensAndAmounts = new TokenAndAmountForeign[](0);
    }
  }

  function _expectedUser(address wallet) internal view returns (User memory) {
    if (wallet == host) return _user(1, 2, 0, 3, 9);
    if (wallet == host2) return _user(2, 1, 0, 2, 4);
    if (wallet == host3) return _user(3, 1, 0, 1, 5);
    if (wallet == payer) return _user(4, 0, 4, 0, 5);
    if (wallet == payer2) return _user(5, 0, 4, 0, 5);
    if (wallet == payer3) return _user(6, 0, 1, 0, 2);
    return _user(0, 0, 0, 0, 0);
  }

  function _localPayables() internal view returns (bytes32[] memory ids) {
    ids = new bytes32[](4);
    ids[0] = p1;
    ids[1] = p2;
    ids[2] = p3;
    ids[3] = p4;
  }

  function _allWallets() internal view returns (address[] memory wallets) {
    wallets = new address[](9);
    wallets[0] = host;
    wallets[1] = host2;
    wallets[2] = host3;
    wallets[3] = payer;
    wallets[4] = payer2;
    wallets[5] = payer3;
    wallets[6] = foreignHost;
    wallets[7] = foreignPayer;
    wallets[8] = stranger;
  }

  // ---------------------------------------------------------------------------
  // Struct builders
  // ---------------------------------------------------------------------------

  function _tokenAmount(address token, uint256 amount) internal pure returns (TokenAndAmount memory) {
    return TokenAndAmount({token: token, amount: amount});
  }

  function _foreignTokenAmount(bytes32 token, uint64 amount) internal pure returns (TokenAndAmountForeign memory) {
    return TokenAndAmountForeign({token: token, amount: amount});
  }

  function _user(
    uint256 chainCount,
    uint256 payablesCount,
    uint256 paymentsCount,
    uint256 withdrawalsCount,
    uint256 activitiesCount
  ) internal pure returns (User memory) {
    return User({
      chainCount: chainCount,
      payablesCount: payablesCount,
      paymentsCount: paymentsCount,
      withdrawalsCount: withdrawalsCount,
      activitiesCount: activitiesCount
    });
  }

  /// Builds a payable record; the counters are (chain, host, payments, withdrawals, activities, allowed, balances).
  function _payableInfo(
    address host_,
    uint256 chainCount,
    uint256 hostCount,
    uint256 createdAt_,
    uint256 paymentsCount,
    uint256 withdrawalsCount,
    uint256 activitiesCount,
    uint8 allowedCount,
    uint8 balancesCount,
    bool isClosed,
    bool isAutoWithdraw
  ) internal pure returns (Payable memory) {
    return Payable({
      host: host_,
      chainCount: chainCount,
      hostCount: hostCount,
      createdAt: createdAt_,
      paymentsCount: paymentsCount,
      withdrawalsCount: withdrawalsCount,
      activitiesCount: activitiesCount,
      allowedTokensAndAmountsCount: allowedCount,
      balancesCount: balancesCount,
      isClosed: isClosed,
      isAutoWithdraw: isAutoWithdraw
    });
  }

  function _foreignInfo(
    bytes32 chainId,
    uint8 allowedCount,
    bool isClosed,
    uint64 lastUpdateNonce,
    uint64 lastUpdateInitiatedAt,
    uint256 lastSyncedAt
  ) internal pure returns (PayableForeign memory) {
    return PayableForeign({
      chainId: chainId,
      allowedTokensAndAmountsCount: allowedCount,
      isClosed: isClosed,
      lastUpdateNonce: lastUpdateNonce,
      lastUpdateInitiatedAt: lastUpdateInitiatedAt,
      lastSyncedAt: lastSyncedAt
    });
  }

  // ---------------------------------------------------------------------------
  // Assertions
  // ---------------------------------------------------------------------------

  function _assertIds(bytes32[] memory actual, bytes32[] memory expected, string memory label) internal pure {
    assertEq(actual.length, expected.length, string.concat(label, ': length'));
    for (uint256 i; i < actual.length; i++) {
      assertEq(actual[i], expected[i], string.concat(label, ': entry'));
    }
  }

  function _assertPayableView(PayableView memory a, PayableView memory e) internal pure {
    assertEq(a.payableId, e.payableId, 'payableId');
    _assertPayable(a.info, e.info);
    _assertTokenAmounts(a.allowedTokensAndAmounts, e.allowedTokensAndAmounts);
    _assertTokenAmounts(a.balances, e.balances);
  }

  function _assertPayable(Payable memory a, Payable memory e) internal pure {
    assertEq(a.host, e.host, 'host');
    assertEq(a.chainCount, e.chainCount, 'chainCount');
    assertEq(a.hostCount, e.hostCount, 'hostCount');
    assertEq(a.createdAt, e.createdAt, 'createdAt');
    assertEq(a.paymentsCount, e.paymentsCount, 'paymentsCount');
    assertEq(a.withdrawalsCount, e.withdrawalsCount, 'withdrawalsCount');
    assertEq(a.activitiesCount, e.activitiesCount, 'activitiesCount');
    assertEq(a.allowedTokensAndAmountsCount, e.allowedTokensAndAmountsCount, 'allowedTokensAndAmountsCount');
    assertEq(a.balancesCount, e.balancesCount, 'balancesCount');
    assertEq(a.isClosed, e.isClosed, 'isClosed');
    assertEq(a.isAutoWithdraw, e.isAutoWithdraw, 'isAutoWithdraw');
  }

  function _assertTokenAmounts(TokenAndAmount[] memory a, TokenAndAmount[] memory e) internal pure {
    assertEq(a.length, e.length, 'token list length');
    for (uint256 i; i < a.length; i++) {
      assertEq(a[i].token, e[i].token, 'token');
      assertEq(a[i].amount, e[i].amount, 'amount');
    }
  }

  function _assertForeignPayableView(ForeignPayableView memory a, ForeignPayableView memory e) internal pure {
    assertEq(a.payableId, e.payableId, 'payableId');
    _assertForeignPayable(a.info, e.info);
    assertEq(a.allowedTokensAndAmounts.length, e.allowedTokensAndAmounts.length, 'foreign allowed length');
    for (uint256 i; i < a.allowedTokensAndAmounts.length; i++) {
      assertEq(a.allowedTokensAndAmounts[i].token, e.allowedTokensAndAmounts[i].token, 'foreign token');
      assertEq(a.allowedTokensAndAmounts[i].amount, e.allowedTokensAndAmounts[i].amount, 'foreign amount');
    }
  }

  function _assertForeignPayable(PayableForeign memory a, PayableForeign memory e) internal pure {
    assertEq(a.chainId, e.chainId, 'chainId');
    assertEq(a.allowedTokensAndAmountsCount, e.allowedTokensAndAmountsCount, 'allowedTokensAndAmountsCount');
    assertEq(a.isClosed, e.isClosed, 'isClosed');
    assertEq(a.lastUpdateNonce, e.lastUpdateNonce, 'lastUpdateNonce');
    assertEq(a.lastUpdateInitiatedAt, e.lastUpdateInitiatedAt, 'lastUpdateInitiatedAt');
    assertEq(a.lastSyncedAt, e.lastSyncedAt, 'lastSyncedAt');
  }

  function _assertUser(User memory a, User memory e) internal pure {
    assertEq(a.chainCount, e.chainCount, 'user chainCount');
    assertEq(a.payablesCount, e.payablesCount, 'user payablesCount');
    assertEq(a.paymentsCount, e.paymentsCount, 'user paymentsCount');
    assertEq(a.withdrawalsCount, e.withdrawalsCount, 'user withdrawalsCount');
    assertEq(a.activitiesCount, e.activitiesCount, 'user activitiesCount');
  }

  function _assertUserPayment(UserPayment memory a, UserPayment memory e) internal pure {
    assertEq(a.payableId, e.payableId, 'payableId');
    assertEq(a.payer, e.payer, 'payer');
    assertEq(a.token, e.token, 'token');
    assertEq(a.payableChainId, e.payableChainId, 'payableChainId');
    assertEq(a.chainCount, e.chainCount, 'chainCount');
    assertEq(a.payerCount, e.payerCount, 'payerCount');
    assertEq(a.timestamp, e.timestamp, 'timestamp');
    assertEq(a.requestedAmount, e.requestedAmount, 'requestedAmount');
    assertEq(a.amount, e.amount, 'amount');
  }

  function _assertPayablePayment(PayablePayment memory a, PayablePayment memory e) internal pure {
    assertEq(a.payableId, e.payableId, 'payableId');
    assertEq(a.payer, e.payer, 'payer');
    assertEq(a.token, e.token, 'token');
    assertEq(a.chainCount, e.chainCount, 'chainCount');
    assertEq(a.payerChainId, e.payerChainId, 'payerChainId');
    assertEq(a.localChainCount, e.localChainCount, 'localChainCount');
    assertEq(a.payableCount, e.payableCount, 'payableCount');
    assertEq(a.timestamp, e.timestamp, 'timestamp');
    assertEq(a.requestedAmount, e.requestedAmount, 'requestedAmount');
    assertEq(a.amount, e.amount, 'amount');
    assertEq(a.payerPaymentId, e.payerPaymentId, 'payerPaymentId');
  }

  function _assertWithdrawal(Withdrawal memory a, Withdrawal memory e) internal pure {
    assertEq(a.payableId, e.payableId, 'payableId');
    assertEq(a.host, e.host, 'host');
    assertEq(a.token, e.token, 'token');
    assertEq(a.chainCount, e.chainCount, 'chainCount');
    assertEq(a.hostCount, e.hostCount, 'hostCount');
    assertEq(a.payableCount, e.payableCount, 'payableCount');
    assertEq(a.timestamp, e.timestamp, 'timestamp');
    assertEq(a.amount, e.amount, 'amount');
    assertEq(a.fee, e.fee, 'fee');
  }

  function _assertActivity(ActivityRecord memory a, ActivityRecord memory e) internal pure {
    assertEq(a.chainCount, e.chainCount, 'chainCount');
    assertEq(a.userCount, e.userCount, 'userCount');
    assertEq(a.payableCount, e.payableCount, 'payableCount');
    assertEq(a.timestamp, e.timestamp, 'timestamp');
    assertEq(a.entity, e.entity, 'entity');
    assertEq(uint8(a.activityType), uint8(e.activityType), 'activityType');
  }

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------

  /// Returns the page `[offset, offset + limit)` of `list`, clamped; empty when `offset` is past the end or `limit` is
  /// zero. This is the specification every paginated view is checked against.
  function _page(bytes32[] memory list, uint256 offset, uint256 limit) internal pure returns (bytes32[] memory page) {
    uint256 n = list.length;
    if (offset >= n || limit == 0) return new bytes32[](0);
    uint256 count = limit > n - offset ? n - offset : limit;
    page = new bytes32[](count);
    for (uint256 i; i < count; i++) {
      page[i] = list[offset + i];
    }
  }

  function _reversed(bytes32[] memory list) internal pure returns (bytes32[] memory out) {
    out = new bytes32[](list.length);
    for (uint256 i; i < list.length; i++) {
      out[i] = list[list.length - 1 - i];
    }
  }

  /// Checks an ascending and a descending paginated view of the same list against `expected` (oldest first).
  function _checkPages(
    function(bytes32, uint256, uint256) internal view returns (bytes32[] memory) asc,
    function(bytes32, uint256, uint256) internal view returns (bytes32[] memory) desc,
    bytes32 key,
    bytes32[] memory expected,
    string memory label
  ) internal view {
    _checkAscPages(asc, key, expected, string.concat(label, ' asc'));
    _checkAscPages(desc, key, _reversed(expected), string.concat(label, ' desc'));
  }

  /// Checks one paginated view against `expected` in the order the view returns entries: probes of first, middle,
  /// last-partial, past-the-end, and zero-limit pages, then full walks with several page sizes.
  function _checkAscPages(
    function(bytes32, uint256, uint256) internal view returns (bytes32[] memory) fetch,
    bytes32 key,
    bytes32[] memory expected,
    string memory label
  ) internal view {
    uint256 n = expected.length;
    uint256 max = type(uint256).max;
    uint256[7] memory offsets = [0, 1, n / 2, n == 0 ? 0 : n - 1, n, n + 1, max];
    uint256[8] memory limits = [0, 1, 2, 3, n == 0 ? 0 : n - 1, n, n + 1, max];
    for (uint256 i; i < offsets.length; i++) {
      for (uint256 j; j < limits.length; j++) {
        _assertIds(fetch(key, offsets[i], limits[j]), _page(expected, offsets[i], limits[j]), label);
      }
    }

    uint256[4] memory sizes = [uint256(1), 2, 3, 5];
    for (uint256 s; s < sizes.length; s++) {
      bytes32[] memory walked = new bytes32[](n);
      uint256 offset;
      while (offset < n) {
        bytes32[] memory page = fetch(key, offset, sizes[s]);
        uint256 remaining = n - offset;
        assertEq(page.length, remaining < sizes[s] ? remaining : sizes[s], string.concat(label, ': page length'));
        for (uint256 k; k < page.length; k++) {
          walked[offset + k] = page[k];
        }
        offset += sizes[s];
      }
      assertEq(fetch(key, offset, sizes[s]).length, 0, string.concat(label, ': page after the walk'));
      _assertIds(walked, expected, string.concat(label, ': walk'));
    }
  }

  function _toBytes32List(address[] memory list) internal pure returns (bytes32[] memory out) {
    out = new bytes32[](list.length);
    for (uint256 i; i < list.length; i++) {
      out[i] = _toBytes32(list[i]);
    }
  }

  function _keyAddress(bytes32 key) internal pure returns (address) {
    return address(uint160(uint256(key)));
  }

  // ---------------------------------------------------------------------------
  // Page adapters: ID pages, and entity pages reduced to IDs after checking every entity against its single read
  // and its hand-computed expectation.
  // ---------------------------------------------------------------------------

  // Local payables.

  function _chainPayableIds(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getChainPayableIds(o, l);
  }

  function _chainPayableIdsDesc(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getChainPayableIdsDesc(o, l);
  }

  function _chainPayables(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return _payableViewIds(cb.getChainPayables(o, l));
  }

  function _chainPayablesDesc(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return _payableViewIds(cb.getChainPayablesDesc(o, l));
  }

  function _userPayableIds(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getUserPayableIds(_keyAddress(k), o, l);
  }

  function _userPayableIdsDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getUserPayableIdsDesc(_keyAddress(k), o, l);
  }

  function _userPayables(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return _payableViewIds(cb.getUserPayables(_keyAddress(k), o, l));
  }

  function _userPayablesDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return _payableViewIds(cb.getUserPayablesDesc(_keyAddress(k), o, l));
  }

  function _payableViewIds(PayableView[] memory views) private view returns (bytes32[] memory ids) {
    ids = new bytes32[](views.length);
    for (uint256 i; i < views.length; i++) {
      ids[i] = views[i].payableId;
      _assertPayableView(views[i], cb.getPayableView(ids[i]));
      _assertPayableView(views[i], _expectedPayableView(ids[i]));
    }
  }

  // Foreign payables.

  function _chainForeignPayableIds(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getChainForeignPayableIds(o, l);
  }

  function _chainForeignPayableIdsDesc(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getChainForeignPayableIdsDesc(o, l);
  }

  function _chainForeignPayables(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return _foreignViewIds(cb.getChainForeignPayables(o, l));
  }

  function _chainForeignPayablesDesc(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return _foreignViewIds(cb.getChainForeignPayablesDesc(o, l));
  }

  function _foreignPayableIdsByChain(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getForeignPayableIdsByChain(k, o, l);
  }

  function _foreignPayableIdsByChainDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getForeignPayableIdsByChainDesc(k, o, l);
  }

  function _foreignPayablesByChain(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return _foreignViewIds(cb.getForeignPayablesByChain(k, o, l));
  }

  function _foreignPayablesByChainDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return _foreignViewIds(cb.getForeignPayablesByChainDesc(k, o, l));
  }

  function _foreignViewIds(ForeignPayableView[] memory views) private view returns (bytes32[] memory ids) {
    ids = new bytes32[](views.length);
    for (uint256 i; i < views.length; i++) {
      ids[i] = views[i].payableId;
      _assertForeignPayableView(views[i], cb.getForeignPayableView(ids[i]));
      _assertForeignPayableView(views[i], _expectedForeignPayableView(ids[i]));
    }
  }

  // User payments.

  function _chainUserPaymentIds(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getChainUserPaymentIds(o, l);
  }

  function _chainUserPaymentIdsDesc(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getChainUserPaymentIdsDesc(o, l);
  }

  function _chainUserPayments(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    UserPayment[] memory items;
    (ids, items) = cb.getChainUserPayments(o, l);
    _checkUserPayments(ids, items);
  }

  function _chainUserPaymentsDesc(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    UserPayment[] memory items;
    (ids, items) = cb.getChainUserPaymentsDesc(o, l);
    _checkUserPayments(ids, items);
  }

  function _userPaymentIds(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getUserPaymentIds(_keyAddress(k), o, l);
  }

  function _userPaymentIdsDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getUserPaymentIdsDesc(_keyAddress(k), o, l);
  }

  function _userPayments(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    UserPayment[] memory items;
    (ids, items) = cb.getUserPayments(_keyAddress(k), o, l);
    _checkUserPayments(ids, items);
  }

  function _userPaymentsDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    UserPayment[] memory items;
    (ids, items) = cb.getUserPaymentsDesc(_keyAddress(k), o, l);
    _checkUserPayments(ids, items);
  }

  function _checkUserPayments(bytes32[] memory ids, UserPayment[] memory items) private view {
    assertEq(items.length, ids.length, 'user payment items length');
    for (uint256 i; i < ids.length; i++) {
      _assertUserPayment(items[i], cb.getUserPayment(ids[i]));
      _assertUserPayment(items[i], expUserPayment[ids[i]]);
    }
  }

  // Payable payments.

  function _chainPayablePaymentIds(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getChainPayablePaymentIds(o, l);
  }

  function _chainPayablePaymentIdsDesc(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getChainPayablePaymentIdsDesc(o, l);
  }

  function _chainPayablePayments(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    PayablePayment[] memory items;
    (ids, items) = cb.getChainPayablePayments(o, l);
    _checkPayablePayments(ids, items);
  }

  function _chainPayablePaymentsDesc(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    PayablePayment[] memory items;
    (ids, items) = cb.getChainPayablePaymentsDesc(o, l);
    _checkPayablePayments(ids, items);
  }

  function _payablePaymentIds(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getPayablePaymentIds(k, o, l);
  }

  function _payablePaymentIdsDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getPayablePaymentIdsDesc(k, o, l);
  }

  function _payablePayments(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    PayablePayment[] memory items;
    (ids, items) = cb.getPayablePayments(k, o, l);
    _checkPayablePayments(ids, items);
  }

  function _payablePaymentsDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    PayablePayment[] memory items;
    (ids, items) = cb.getPayablePaymentsDesc(k, o, l);
    _checkPayablePayments(ids, items);
  }

  function _payableChainPaymentIds(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getPayableChainPaymentIds(k, pageChainKey, o, l);
  }

  function _payableChainPaymentIdsDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getPayableChainPaymentIdsDesc(k, pageChainKey, o, l);
  }

  function _payableChainPayments(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    PayablePayment[] memory items;
    (ids, items) = cb.getPayableChainPayments(k, pageChainKey, o, l);
    _checkPayablePayments(ids, items);
  }

  function _payableChainPaymentsDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    PayablePayment[] memory items;
    (ids, items) = cb.getPayableChainPaymentsDesc(k, pageChainKey, o, l);
    _checkPayablePayments(ids, items);
  }

  function _checkPayablePayments(bytes32[] memory ids, PayablePayment[] memory items) private view {
    assertEq(items.length, ids.length, 'payable payment items length');
    for (uint256 i; i < ids.length; i++) {
      _assertPayablePayment(items[i], cb.getPayablePayment(ids[i]));
      _assertPayablePayment(items[i], expPayablePayment[ids[i]]);
    }
  }

  // Withdrawals.

  function _chainWithdrawalIds(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getChainWithdrawalIds(o, l);
  }

  function _chainWithdrawalIdsDesc(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getChainWithdrawalIdsDesc(o, l);
  }

  function _chainWithdrawals(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    Withdrawal[] memory items;
    (ids, items) = cb.getChainWithdrawals(o, l);
    _checkWithdrawals(ids, items);
  }

  function _chainWithdrawalsDesc(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    Withdrawal[] memory items;
    (ids, items) = cb.getChainWithdrawalsDesc(o, l);
    _checkWithdrawals(ids, items);
  }

  function _userWithdrawalIds(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getUserWithdrawalIds(_keyAddress(k), o, l);
  }

  function _userWithdrawalIdsDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getUserWithdrawalIdsDesc(_keyAddress(k), o, l);
  }

  function _userWithdrawals(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    Withdrawal[] memory items;
    (ids, items) = cb.getUserWithdrawals(_keyAddress(k), o, l);
    _checkWithdrawals(ids, items);
  }

  function _userWithdrawalsDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    Withdrawal[] memory items;
    (ids, items) = cb.getUserWithdrawalsDesc(_keyAddress(k), o, l);
    _checkWithdrawals(ids, items);
  }

  function _payableWithdrawalIds(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getPayableWithdrawalIds(k, o, l);
  }

  function _payableWithdrawalIdsDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getPayableWithdrawalIdsDesc(k, o, l);
  }

  function _payableWithdrawals(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    Withdrawal[] memory items;
    (ids, items) = cb.getPayableWithdrawals(k, o, l);
    _checkWithdrawals(ids, items);
  }

  function _payableWithdrawalsDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    Withdrawal[] memory items;
    (ids, items) = cb.getPayableWithdrawalsDesc(k, o, l);
    _checkWithdrawals(ids, items);
  }

  function _checkWithdrawals(bytes32[] memory ids, Withdrawal[] memory items) private view {
    assertEq(items.length, ids.length, 'withdrawal items length');
    for (uint256 i; i < ids.length; i++) {
      _assertWithdrawal(items[i], cb.getWithdrawal(ids[i]));
      _assertWithdrawal(items[i], expWithdrawal[ids[i]]);
    }
  }

  // Activities.

  function _chainActivityIds(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getChainActivityIds(o, l);
  }

  function _chainActivityIdsDesc(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getChainActivityIdsDesc(o, l);
  }

  function _chainActivities(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    ActivityRecord[] memory items;
    (ids, items) = cb.getChainActivities(o, l);
    _checkActivities(ids, items);
  }

  function _chainActivitiesDesc(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    ActivityRecord[] memory items;
    (ids, items) = cb.getChainActivitiesDesc(o, l);
    _checkActivities(ids, items);
  }

  function _userActivityIds(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getUserActivityIds(_keyAddress(k), o, l);
  }

  function _userActivityIdsDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getUserActivityIdsDesc(_keyAddress(k), o, l);
  }

  function _userActivities(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    ActivityRecord[] memory items;
    (ids, items) = cb.getUserActivities(_keyAddress(k), o, l);
    _checkActivities(ids, items);
  }

  function _userActivitiesDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    ActivityRecord[] memory items;
    (ids, items) = cb.getUserActivitiesDesc(_keyAddress(k), o, l);
    _checkActivities(ids, items);
  }

  function _payableActivityIds(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getPayableActivityIds(k, o, l);
  }

  function _payableActivityIdsDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getPayableActivityIdsDesc(k, o, l);
  }

  function _payableActivities(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    ActivityRecord[] memory items;
    (ids, items) = cb.getPayableActivities(k, o, l);
    _checkActivities(ids, items);
  }

  function _payableActivitiesDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory ids) {
    ActivityRecord[] memory items;
    (ids, items) = cb.getPayableActivitiesDesc(k, o, l);
    _checkActivities(ids, items);
  }

  function _checkActivities(bytes32[] memory ids, ActivityRecord[] memory items) internal view {
    assertEq(items.length, ids.length, 'activity items length');
    for (uint256 i; i < ids.length; i++) {
      _assertActivity(items[i], cb.getActivity(ids[i]));
      _assertActivity(items[i], expActivity[ids[i]]);
    }
  }

  // Users.

  function _chainUserAddresses(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return _toBytes32List(cb.getChainUserAddresses(o, l));
  }

  function _chainUserAddressesDesc(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return _toBytes32List(cb.getChainUserAddressesDesc(o, l));
  }

  function _chainUsers(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return _userViewIds(cb.getChainUsers(o, l));
  }

  function _chainUsersDesc(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return _userViewIds(cb.getChainUsersDesc(o, l));
  }

  function _userViewIds(UserView[] memory views) private view returns (bytes32[] memory ids) {
    ids = new bytes32[](views.length);
    for (uint256 i; i < views.length; i++) {
      ids[i] = _toBytes32(views[i].wallet);
      _assertUser(views[i].info, cb.getUser(views[i].wallet));
      _assertUser(views[i].info, _expectedUser(views[i].wallet));
    }
  }

  // Consumed Wormhole messages.

  function _consumedVaas(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getConsumedWormholeMessages(o, l);
  }

  function _consumedVaasDesc(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getConsumedWormholeMessagesDesc(o, l);
  }

  function _consumedVaasByChain(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getConsumedWormholeMessagesByChain(uint16(uint256(k)), o, l);
  }

  function _consumedVaasByChainDesc(bytes32 k, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return cb.getConsumedWormholeMessagesByChainDesc(uint16(uint256(k)), o, l);
  }

  // Registered tokens (ascending only).

  function _registeredTokens(bytes32, uint256 o, uint256 l) internal view returns (bytes32[] memory) {
    return _toBytes32List(cb.getRegisteredTokens(o, l));
  }
}
