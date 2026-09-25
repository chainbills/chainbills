// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {ICbPayableSync} from 'src/interfaces/ICbPayableSync.sol';
import {ICbPayables} from 'src/interfaces/ICbPayables.sol';
import {ICbPayments} from 'src/interfaces/ICbPayments.sol';
import {ICbWithdrawals} from 'src/interfaces/ICbWithdrawals.sol';
import {IChainbills} from 'src/interfaces/IChainbills.sol';
import {
  ALL_FEATURES,
  CCTP_FINALITY_FAST,
  CCTP_FINALITY_FINALIZED,
  FEATURE_AUTO_WITHDRAW,
  FEATURE_CREATE_PAYABLE,
  FEATURE_PAY,
  FEATURE_PAY_FOREIGN,
  FEATURE_PUBLISH_PAYABLE,
  FEATURE_RECEIVE_FOREIGN_PAYMENT,
  FEATURE_RECEIVE_PAYABLE_UPDATE,
  FEATURE_UPDATE_PAYABLE,
  FEATURE_WITHDRAW,
  MAX_BPS,
  PAYABLE_ACTION_CLOSE,
  PAYABLE_ACTION_CREATE,
  PAYABLE_ACTION_REOPEN,
  PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS
} from 'src/types/CbConstants.sol';
import {
  CctpStats,
  ChainStats,
  Payable,
  PayablePayment,
  TokenAndAmount,
  TokenAndAmountForeign,
  TokenFeeConfig,
  TokenStats,
  User,
  Withdrawal
} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';
import {MockTaxToken} from '../mocks/MockTaxToken.sol';

/// Stateful fuzzing handler driving two linked Chainbills diamonds (chain 0 = A, chain 1 = B).
/// @dev Every action warps time forward first: `LibCbIds.createId` hashes `block.chainid` and `block.timestamp`, and
/// both simulated chains share one `block.chainid`, so two creations in the same second could collide across chains.
/// Every action predicts from ghost state whether the diamond call must succeed and records a violation when the
/// outcome differs; expected reverts never touch ghost state. Money and counter ghosts are compared against the
/// diamonds by the `check*` functions, which the invariant suite calls after every action.
contract ChainbillsHandler is Test {
  // ---------------------------------------------------------------------------
  // Ghost records
  // ---------------------------------------------------------------------------

  /// Expected state of a payable (on its host chain) and of its mirror (on the other chain).
  struct PayableGhost {
    uint8 chain;
    address host;
    bool isClosed;
    bool isAutoWithdraw;
    uint256 paymentsCount;
    uint256 withdrawalsCount;
    uint256 activitiesCount;
    uint64 lastNonce;
    bool isMirrored;
    bool mirrorIsClosed;
    uint64 mirrorNonce;
  }

  /// One payable update broadcast (one Wormhole message plus one CCTP data message to the other chain).
  struct UpdateMsg {
    bytes32 payableId;
    uint64 nonce;
    uint8 actionType;
    uint256 vaaIndex;
    uint256 cctpIndex;
    bool isClosed;
  }

  /// One cross-chain payment burn.
  struct PaymentMsg {
    uint8 src;
    bytes32 payableId;
    address payer;
    uint256 amount;
    uint256 maxFee;
    uint256 cctpIndex;
    bool isDelivered;
  }

  /// Expected payable payment record, in chain order.
  struct ExpectedReceipt {
    bytes32 payableId;
    address token;
    uint256 requestedAmount;
    uint256 amount;
    bytes32 payerChainId;
  }

  /// Expected withdrawal record, in chain order.
  struct ExpectedWithdrawal {
    bytes32 payableId;
    address token;
    uint256 amount;
    uint256 fee;
  }

  /// Expected chain-wide counters and settings.
  struct ChainGhost {
    uint256 users;
    uint256 payables;
    uint256 foreignPayables;
    uint256 userPayments;
    uint256 payablePayments;
    uint256 withdrawals;
    uint256 activities;
    uint64 lastNonce;
    uint256 burnsSent;
    uint256 paymentsReceived;
    uint256 cctpUpdatesSent;
    uint256 cctpUpdatesReceived;
    uint256 wormholePublished;
    uint256 wormholeConsumed;
    uint256 crossChainCredited;
    uint256 circleFees;
    bool isPaused;
    bool isRelayerRestricted;
    uint256 pausedFeatures;
    uint16 feeBps;
  }

  /// Expected per-token totals and fee settings on one chain.
  struct TokenGhost {
    uint256 userPaid;
    uint256 received;
    uint256 withdrawn;
    uint256 balance;
    uint256 fees;
    uint256 collectorReceived;
    uint256 untracked;
    uint256 rescued;
    bool hasFeeOverride;
    uint16 feeBps;
    bool hasCap;
    uint256 cap;
  }

  /// Expected per-user counters on one chain.
  struct UserGhost {
    bool isInitialized;
    uint256 payables;
    uint256 payments;
    uint256 withdrawals;
    uint256 activities;
  }

  uint256 internal constant NATIVE = 0;
  uint256 internal constant USDC = 1;
  uint256 internal constant TAX = 2;
  uint256 internal constant TOKENS = 3;
  uint256 internal constant ACTORS = 4;
  uint256 internal constant TAX_BPS = 100;
  uint256 internal constant WORMHOLE_FEE = 0.001 ether;
  uint256 internal constant MAX_NATIVE_AMOUNT = 10 ether;
  uint256 internal constant MAX_USDC_AMOUNT = 1e12;
  uint256 internal constant MAX_TAX_AMOUNT = 1e19;
  uint256 internal constant MAX_TRACKED_PAYABLES = 12;
  uint8 internal constant VIA_WORMHOLE = 0;
  uint8 internal constant VIA_CCTP = 1;
  uint8 internal constant VIA_ADMIN_SYNC = 2;
  uint8 internal constant PICK_OPEN = 0;
  uint8 internal constant PICK_TAX = 1;
  uint8 internal constant PICK_FOREIGN = 2;
  uint8 internal constant PICK_FUNDED = 3;

  // ---------------------------------------------------------------------------
  // Fixture
  // ---------------------------------------------------------------------------

  CbTestBase.SimChain[2] internal chains;
  MockTaxToken[2] public taxTokens;
  address[TOKENS][2] public tokens;
  address[ACTORS] public actors;
  address public admin;
  address public relayer;
  address public feeCollector;
  address[2] public rescueSinks;
  address public strangerRelayer;
  address public circleFeeRecipient;

  // ---------------------------------------------------------------------------
  // Ghost state
  // ---------------------------------------------------------------------------

  ChainGhost[2] internal chainGhosts;
  mapping(uint256 chain => mapping(uint256 tokenIndex => TokenGhost)) internal tokenGhosts;
  mapping(uint256 chain => mapping(address wallet => UserGhost)) internal userGhosts;

  bytes32[][2] internal payableIds;
  mapping(bytes32 payableId => PayableGhost) internal payableGhosts;
  mapping(bytes32 payableId => TokenAndAmount[]) internal allowedOf;
  mapping(bytes32 payableId => TokenAndAmount[]) internal mirrorAllowedOf;
  mapping(bytes32 payableId => mapping(uint256 tokenIndex => uint256)) internal balanceOf;

  UpdateMsg[][2] internal updates;
  mapping(uint256 chain => mapping(uint256 index => TokenAndAmount[])) internal updateAllowed;
  uint256[2] internal nextUpdateToDeliver;

  PaymentMsg[] internal payments;
  mapping(uint256 index => bytes) internal deliveredPaymentMessage;
  uint256[] internal pendingPayments;
  uint256[] internal deliveredPayments;

  ExpectedReceipt[][2] internal receipts;
  ExpectedWithdrawal[][2] internal withdrawalRecords;

  uint256 public violations;
  string public firstViolation;
  bytes public firstViolationData;

  /// Successful calls per action, for run metrics.
  mapping(bytes32 action => uint256) public okCalls;
  /// Correctly rejected calls per action, for run metrics.
  mapping(bytes32 action => uint256) public rejectedCalls;

  constructor(
    CbTestBase.SimChain memory a,
    CbTestBase.SimChain memory b,
    MockTaxToken taxA,
    MockTaxToken taxB,
    address admin_,
    address relayer_,
    address feeCollector_,
    uint16 initialFeeBps
  ) {
    chains[0] = a;
    chains[1] = b;
    taxTokens[0] = taxA;
    taxTokens[1] = taxB;
    admin = admin_;
    relayer = relayer_;
    feeCollector = feeCollector_;
    circleFeeRecipient = a.messenger.feeRecipient();
    rescueSinks[0] = makeAddr('rescue-sink-a');
    rescueSinks[1] = makeAddr('rescue-sink-b');
    strangerRelayer = makeAddr('stranger-relayer');
    for (uint256 i; i < ACTORS; i++) {
      actors[i] = makeAddr(string.concat('actor-', vm.toString(i)));
    }
    for (uint8 c; c < 2; c++) {
      tokens[c][NATIVE] = address(chains[c].cb);
      tokens[c][USDC] = address(chains[c].usdc);
      tokens[c][TAX] = address(taxTokens[c]);
      chainGhosts[c].feeBps = initialFeeBps;
      for (uint256 i; i < ACTORS; i++) {
        vm.startPrank(actors[i]);
        chains[c].usdc.approve(address(chains[c].cb), type(uint256).max);
        taxTokens[c].approve(address(chains[c].cb), type(uint256).max);
        vm.stopPrank();
      }
    }
  }

  // ===========================================================================
  // Actions: payables
  // ===========================================================================

  /// Creates a payable on a random chain with a random host, allowed list, and auto-withdraw flag.
  function createPayable(uint256 chainSeed, uint256 hostSeed, uint256 listSeed, bool isAutoWithdraw) external {
    _tick();
    uint8 c = _chainOf(chainSeed);
    if (payableIds[c].length >= MAX_TRACKED_PAYABLES) return;
    address host = actors[_bound(hostSeed, 0, ACTORS - 1)];
    TokenAndAmount[] memory list = _randomList(c, listSeed);
    bool isExpected = !_isPaused(c, FEATURE_CREATE_PAYABLE);

    (uint256 vaaBefore, uint256 cctpBefore) = _messageCounts(c);
    (bool ok, bytes memory ret) =
      _call(c, host, WORMHOLE_FEE, abi.encodeCall(ICbPayables.createPayable, (list, isAutoWithdraw)));
    if (!_expect(isExpected, ok, 'createPayable', ret)) return;

    (bytes32 payableId,) = abi.decode(ret, (bytes32, uint64));
    if (payableGhosts[payableId].host != address(0) || payableId == bytes32(0)) {
      _violate('createPayable: payable ID collides with a known payable', ret);
      return;
    }

    _initUser(c, host);
    UserGhost storage user = userGhosts[c][host];
    user.payables++;
    user.activities++;
    chainGhosts[c].payables++;
    chainGhosts[c].activities++;

    payableIds[c].push(payableId);
    PayableGhost storage p = payableGhosts[payableId];
    p.chain = c;
    p.host = host;
    p.isAutoWithdraw = isAutoWithdraw;
    p.activitiesCount = 1;
    for (uint256 i; i < list.length; i++) {
      allowedOf[payableId].push(list[i]);
    }
    _recordBroadcast(c, payableId, PAYABLE_ACTION_CREATE, false, vaaBefore, cctpBefore, 0);
    _checkMessageCounts(c, vaaBefore, cctpBefore, 1, 'createPayable');
  }

  /// Closes an open payable or reopens a closed one; sometimes from a non-host or in the wrong direction.
  function closeOrReopen(uint256 chainSeed, uint256 payableSeed, uint256 callerSeed, uint256 modeSeed) external {
    _tick();
    uint8 c = _chainOf(chainSeed);
    (bool found, bytes32 payableId) = _pickPayable(c, payableSeed);
    if (!found) return;
    PayableGhost storage p = payableGhosts[payableId];

    // One call in eight comes from a random actor; one in eight tries the wrong direction.
    address caller = callerSeed % 8 == 0 ? actors[_bound(callerSeed >> 8, 0, ACTORS - 1)] : p.host;
    bool isWrongWay = modeSeed % 8 == 0;
    bool isClosing = isWrongWay ? p.isClosed : !p.isClosed;
    bool isExpected = !_isPaused(c, FEATURE_UPDATE_PAYABLE) && caller == p.host && !isWrongWay;

    (uint256 vaaBefore, uint256 cctpBefore) = _messageCounts(c);
    bytes memory data = isClosing
      ? abi.encodeCall(ICbPayables.closePayable, (payableId))
      : abi.encodeCall(ICbPayables.reopenPayable, (payableId));
    (bool ok, bytes memory ret) = _call(c, caller, WORMHOLE_FEE, data);
    if (!_expect(isExpected, ok, isClosing ? bytes32('closePayable') : bytes32('reopenPayable'), ret)) return;

    p.isClosed = isClosing;
    _recordHostActivity(c, payableId);
    _recordBroadcast(
      c, payableId, isClosing ? PAYABLE_ACTION_CLOSE : PAYABLE_ACTION_REOPEN, isClosing, vaaBefore, cctpBefore, 0
    );
    _checkMessageCounts(c, vaaBefore, cctpBefore, 1, 'closeOrReopen');
  }

  /// Replaces a payable's allowed tokens and amounts with a random list.
  function updateAllowedTokens(uint256 chainSeed, uint256 payableSeed, uint256 listSeed) external {
    _tick();
    uint8 c = _chainOf(chainSeed);
    (bool found, bytes32 payableId) = _pickPayable(c, payableSeed);
    if (!found) return;
    PayableGhost storage p = payableGhosts[payableId];
    TokenAndAmount[] memory list = _randomList(c, listSeed);
    bool isExpected = !_isPaused(c, FEATURE_UPDATE_PAYABLE);

    (uint256 vaaBefore, uint256 cctpBefore) = _messageCounts(c);
    (bool ok, bytes memory ret) = _call(
      c, p.host, WORMHOLE_FEE, abi.encodeCall(ICbPayables.updatePayableAllowedTokensAndAmounts, (payableId, list))
    );
    if (!_expect(isExpected, ok, 'updateAllowedTokens', ret)) return;

    delete allowedOf[payableId];
    for (uint256 i; i < list.length; i++) {
      allowedOf[payableId].push(list[i]);
    }
    _recordHostActivity(c, payableId);
    _recordBroadcast(
      c, payableId, PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS, p.isClosed, vaaBefore, cctpBefore, 0
    );
    _checkMessageCounts(c, vaaBefore, cctpBefore, 1, 'updateAllowedTokens');
  }

  /// Flips a payable's auto-withdraw flag.
  function toggleAutoWithdraw(uint256 chainSeed, uint256 payableSeed) external {
    _tick();
    uint8 c = _chainOf(chainSeed);
    (bool found, bytes32 payableId) = _pickPayable(c, payableSeed);
    if (!found) return;
    PayableGhost storage p = payableGhosts[payableId];
    bool isExpected = !_isPaused(c, FEATURE_UPDATE_PAYABLE);

    (bool ok, bytes memory ret) =
      _call(c, p.host, 0, abi.encodeCall(ICbPayables.updatePayableAutoWithdraw, (payableId, !p.isAutoWithdraw)));
    if (!_expect(isExpected, ok, 'toggleAutoWithdraw', ret)) return;

    p.isAutoWithdraw = !p.isAutoWithdraw;
    _recordHostActivity(c, payableId);
  }

  /// Republishes a payable's details (a snapshot, then a close when the payable is closed) from a random actor.
  function publishDetails(uint256 chainSeed, uint256 payableSeed, uint256 callerSeed) external {
    _tick();
    uint8 c = _chainOf(chainSeed);
    (bool found, bytes32 payableId) = _pickPayable(c, payableSeed);
    if (!found) return;
    PayableGhost storage p = payableGhosts[payableId];
    address caller = actors[_bound(callerSeed, 0, ACTORS - 1)];
    uint256 count = p.isClosed ? 2 : 1;
    bool isExpected = !_isPaused(c, FEATURE_PUBLISH_PAYABLE);

    (uint256 vaaBefore, uint256 cctpBefore) = _messageCounts(c);
    (bool ok, bytes memory ret) =
      _call(c, caller, WORMHOLE_FEE * count, abi.encodeCall(ICbPayables.publishPayableDetails, (payableId)));
    if (!_expect(isExpected, ok, 'publishDetails', ret)) return;

    // The snapshot restates the allowed list but, on the wire, always reads as open.
    _recordBroadcast(c, payableId, PAYABLE_ACTION_CREATE, false, vaaBefore, cctpBefore, 0);
    if (p.isClosed) _recordBroadcast(c, payableId, PAYABLE_ACTION_CLOSE, true, vaaBefore, cctpBefore, 1);
    _checkMessageCounts(c, vaaBefore, cctpBefore, count, 'publishDetails');
  }

  // ===========================================================================
  // Actions: same-chain payments
  // ===========================================================================

  /// Pays a local payable in native, USDC, or the transfer-tax token (with just enough buffer for the tax).
  function pay(uint256 chainSeed, uint256 payableSeed, uint256 payerSeed, uint256 tokenSeed, uint256 amountSeed)
    external
  {
    _tick();
    uint8 c = _chainOf(chainSeed);
    (bool found, bytes32 payableId) = _pickPayableFor(c, payableSeed, PICK_OPEN);
    if (!found) return;
    address payer = actors[_bound(payerSeed, 0, ACTORS - 1)];
    (uint256 ti, uint256 amount, bool isListed) = _pickPayment(c, payableId, tokenSeed, amountSeed);
    uint256 maxAmountIn = ti == TAX ? amount + amount / 99 + 1 : amount;
    _pay(c, payableId, payer, ti, amount, maxAmountIn, isListed, 'pay');
  }

  /// Pays with the transfer-tax token using a random buffer, which is sometimes too small to cover the tax.
  function payWithTaxToken(
    uint256 chainSeed,
    uint256 payableSeed,
    uint256 payerSeed,
    uint256 amountSeed,
    uint256 bufferSeed
  ) external {
    _tick();
    uint8 c = _chainOf(chainSeed);
    (bool found, bytes32 payableId) = _pickPayableFor(c, payableSeed, PICK_TAX);
    if (!found) return;
    address payer = actors[_bound(payerSeed, 0, ACTORS - 1)];

    // Prefer a listed tax-token entry; otherwise any amount (which only an any-token payable accepts).
    uint256 amount = _bound(amountSeed, 1, MAX_TAX_AMOUNT);
    bool isListed = allowedOf[payableId].length == 0;
    TokenAndAmount[] storage allowed = allowedOf[payableId];
    for (uint256 i; i < allowed.length; i++) {
      uint256 j = (amountSeed % allowed.length + i) % allowed.length;
      if (allowed[j].token == tokens[c][TAX]) {
        amount = allowed[j].amount;
        isListed = true;
        break;
      }
    }
    uint256 maxAmountIn = amount + _bound(bufferSeed, 0, amount / 50 + 1);
    _pay(c, payableId, payer, TAX, amount, maxAmountIn, isListed, 'payWithTaxToken');
  }

  // ===========================================================================
  // Actions: cross-chain payments
  // ===========================================================================

  /// Burns USDC on a random source chain to pay a payable hosted on the other chain.
  function payForeign(uint256 srcSeed, uint256 payableSeed, uint256 payerSeed, uint256 amountSeed, uint256 feeSeed)
    external
  {
    _tick();
    uint8 s = _chainOf(srcSeed);
    uint8 d = 1 - s;
    (bool found, bytes32 payableId) = _pickPayableFor(d, payableSeed, PICK_FOREIGN);
    if (!found) return;
    PayableGhost storage p = payableGhosts[payableId];
    address payer = actors[_bound(payerSeed, 0, ACTORS - 1)];

    // Pick a listed destination-USDC amount when the mirror restricts tokens.
    uint256 amount = _bound(amountSeed, 1, MAX_USDC_AMOUNT);
    bool isListed = mirrorAllowedOf[payableId].length == 0;
    TokenAndAmount[] storage allowed = mirrorAllowedOf[payableId];
    for (uint256 i; i < allowed.length; i++) {
      uint256 j = (amountSeed % allowed.length + i) % allowed.length;
      if (allowed[j].token == tokens[d][USDC]) {
        amount = allowed[j].amount;
        isListed = true;
        break;
      }
    }
    uint256 maxFee = _bound(feeSeed, 0, amount);
    bool isExpected = !_isPaused(s, FEATURE_PAY_FOREIGN) && p.isMirrored && !p.mirrorIsClosed && isListed;
    _crossCheckCanPayForeign(s, payableId, amount, maxFee, isExpected);

    chains[s].usdc.mint(payer, amount + maxFee);
    (bool ok, bytes memory ret) =
      _call(s, payer, 0, abi.encodeCall(ICbPayments.payForeignViaCctp, (payableId, tokens[s][USDC], amount, maxFee)));
    if (!_expect(isExpected, ok, 'payForeign', ret)) return;

    _recordUserPayment(s, payer, USDC, amount + maxFee);
    chainGhosts[s].burnsSent++;
    payments.push(
      PaymentMsg({
        src: s,
        payableId: payableId,
        payer: payer,
        amount: amount,
        maxFee: maxFee,
        cctpIndex: chains[s].transmitter.sentCount() - 1,
        isDelivered: false
      })
    );
    pendingPayments.push(payments.length - 1);
  }

  /// Relays a pending payment burn with a random attested finality and a random executed fee up to the max fee.
  function relayPayment(uint256 indexSeed, uint256 finalitySeed, uint256 feeSeed) external {
    _tick();
    if (pendingPayments.length == 0) return;
    uint256 slot = _bound(indexSeed, 0, pendingPayments.length - 1);
    uint32 finality = uint32(_bound(finalitySeed, 500, 2500));
    _relayPayment(slot, finality, feeSeed, _relayCaller(finalitySeed));
  }

  /// Resubmits an already relayed payment, as sent, re-attested, or under a fresh CCTP nonce; it must never succeed.
  function replayPayment(uint256 indexSeed, uint256 variantSeed) external {
    _tick();
    if (deliveredPayments.length == 0) return;
    uint256 index = deliveredPayments[_bound(indexSeed, 0, deliveredPayments.length - 1)];
    PaymentMsg storage m = payments[index];
    uint8 d = 1 - m.src;
    bytes memory message = deliveredPaymentMessage[index];
    bytes memory attestation;
    uint256 variant = variantSeed % 3;
    if (variant == 0) {
      attestation = abi.encodePacked(keccak256(message));
    } else if (variant == 1) {
      (message, attestation) =
        chains[m.src].transmitter.attest(chains[m.src].transmitter.sent(m.cctpIndex), CCTP_FINALITY_FINALIZED, 0, true);
    } else {
      // A different physical message (fresh header nonce) carrying the same payment payload.
      bytes32 freshNonce = keccak256(abi.encode('replay', variantSeed));
      assembly {
        mstore(add(add(message, 32), 12), freshNonce)
      }
      attestation = abi.encodePacked(keccak256(message));
    }

    uint256 balanceBefore = chains[d].usdc.balanceOf(address(chains[d].cb));
    (bool ok, bytes memory ret) =
      _call(d, relayer, 0, abi.encodeCall(ICbPayments.receiveForeignPaymentViaCctp, (message, attestation)));
    _expect(false, ok, 'replayPayment', ret);
    if (chains[d].usdc.balanceOf(address(chains[d].cb)) != balanceBefore) {
      _violate('replayPayment: balance changed', '');
    }
  }

  // ===========================================================================
  // Actions: payable update relaying
  // ===========================================================================

  /// Relays the next one to three pending updates of a chain, in order, each over Wormhole or CCTP.
  function relayUpdates(uint256 srcSeed, uint256 countSeed, uint256 viaSeed, uint256 finalitySeed) external {
    _tick();
    uint8 s = _chainOf(srcSeed);
    uint256 count = _bound(countSeed, 1, 3);
    for (uint256 k; k < count; k++) {
      if (nextUpdateToDeliver[s] >= updates[s].length) return;
      // Wormhole four times in eight, CCTP three, admin sync one.
      uint256 route = (viaSeed >> (3 * k)) % 8;
      uint8 via = route < 4 ? VIA_WORMHOLE : route < 7 ? VIA_CCTP : VIA_ADMIN_SYNC;
      uint32 finality = uint32(_bound(uint256(keccak256(abi.encode(finalitySeed, k))), 500, 2000));
      if (!_relayNextUpdate(s, via, finality, _relayCaller(finalitySeed))) return;
    }
  }

  /// Redelivers an already applied update over Wormhole, CCTP, or admin sync; it must never succeed.
  function replayUpdate(uint256 srcSeed, uint256 indexSeed, uint256 viaSeed) external {
    _tick();
    uint8 s = _chainOf(srcSeed);
    uint8 d = 1 - s;
    if (nextUpdateToDeliver[s] == 0) return;
    uint256 index = _bound(indexSeed, 0, nextUpdateToDeliver[s] - 1);
    bytes32 payableId = updates[s][index].payableId;
    uint64 nonceBefore = chains[d].cb.getForeignPayableUpdateNonce(payableId);

    (bool ok, bytes memory ret) = _deliverUpdate(s, index, uint8(viaSeed % 3), CCTP_FINALITY_FINALIZED, relayer);
    _expect(false, ok, 'replayUpdate', ret);
    if (chains[d].cb.getForeignPayableUpdateNonce(payableId) != nonceBefore) {
      _violate('replayUpdate: mirror nonce changed', '');
    }
  }

  // ===========================================================================
  // Actions: withdrawals
  // ===========================================================================

  /// Withdraws a random amount (up to the balance) of a random token from a payable, as its host.
  function withdraw(uint256 chainSeed, uint256 payableSeed, uint256 tokenSeed, uint256 amountSeed) external {
    _tick();
    uint8 c = _chainOf(chainSeed);
    (bool found, bytes32 payableId) = _pickPayableFor(c, payableSeed, PICK_FUNDED);
    if (!found) return;
    uint256 ti = _pickBalanceToken(payableId, tokenSeed);
    uint256 balance = balanceOf[payableId][ti];
    // An empty balance still gets a one-unit attempt, which must revert.
    uint256 amount = balance == 0 ? 1 : _bound(amountSeed, 1, balance);
    _withdraw(c, payableId, ti, amount, false);
  }

  /// Withdraws the full balance of a random token from a payable, as its host.
  function withdrawAll(uint256 chainSeed, uint256 payableSeed, uint256 tokenSeed) external {
    _tick();
    uint8 c = _chainOf(chainSeed);
    (bool found, bytes32 payableId) = _pickPayableFor(c, payableSeed, PICK_FUNDED);
    if (!found) return;
    uint256 ti = _pickBalanceToken(payableId, tokenSeed);
    _withdraw(c, payableId, ti, balanceOf[payableId][ti], true);
  }

  /// Sends tokens or native straight to a diamond, outside any payment.
  function donate(uint256 chainSeed, uint256 tokenSeed, uint256 amountSeed) external {
    _tick();
    uint8 c = _chainOf(chainSeed);
    uint256 ti = _bound(tokenSeed, 0, TOKENS - 1);
    address diamond = address(chains[c].cb);
    uint256 amount;
    if (ti == NATIVE) {
      amount = _bound(amountSeed, 1, MAX_NATIVE_AMOUNT);
      vm.deal(diamond, diamond.balance + amount);
    } else if (ti == USDC) {
      amount = _bound(amountSeed, 1, MAX_USDC_AMOUNT);
      chains[c].usdc.mint(diamond, amount);
    } else {
      amount = _bound(amountSeed, 1, MAX_TAX_AMOUNT);
      taxTokens[c].mint(diamond, amount);
    }
    tokenGhosts[c][ti].untracked += amount;
    okCalls['donate']++;
  }

  /// Rescues the untracked balance of a token; it must move exactly the donated excess.
  function rescue(uint256 chainSeed, uint256 tokenSeed) external {
    _tick();
    uint8 c = _chainOf(chainSeed);
    uint256 ti = _bound(tokenSeed, 0, TOKENS - 1);
    TokenGhost storage t = tokenGhosts[c][ti];
    address sink = rescueSinks[c];
    uint256 sinkBefore = _balanceOf(c, ti, sink);
    bool isExpected = t.untracked > 0;

    (bool ok, bytes memory ret) =
      _call(c, admin, 0, abi.encodeCall(ICbWithdrawals.rescueUntrackedBalance, (tokens[c][ti], sink)));
    if (!_expect(isExpected, ok, 'rescue', ret)) return;

    uint256 rescued = abi.decode(ret, (uint256));
    if (rescued != t.untracked) _violate('rescue: amount differs from the untracked excess', ret);
    uint256 expectedArrival = ti == TAX ? rescued - _taxOf(rescued) : rescued;
    if (_balanceOf(c, ti, sink) - sinkBefore != expectedArrival) _violate('rescue: sink received wrong amount', '');
    t.rescued += rescued;
    t.untracked = 0;
  }

  // ===========================================================================
  // Actions: admin
  // ===========================================================================

  /// Pauses one feature on a chain, keeping at most two features paused so runs stay productive.
  function pauseFeature(uint256 chainSeed, uint256 featureSeed) external {
    _tick();
    uint8 c = _chainOf(chainSeed);
    uint256 paused = chainGhosts[c].pausedFeatures;
    if (paused != 0 && paused & (paused - 1) != 0) return;
    uint256 feature = 1 << _bound(featureSeed, 0, 8);
    vm.prank(admin);
    chains[c].cb.pauseFeatures(feature);
    chainGhosts[c].pausedFeatures |= feature;
    okCalls['pauseFeature']++;
  }

  /// Unpauses one currently paused feature on a chain.
  function unpauseFeature(uint256 chainSeed, uint256 featureSeed) external {
    _tick();
    uint8 c = _chainOf(chainSeed);
    uint256 paused = chainGhosts[c].pausedFeatures;
    if (paused == 0) return;
    uint256 feature;
    for (uint256 i; i < 9; i++) {
      uint256 candidate = 1 << ((featureSeed % 9 + i) % 9);
      if (paused & candidate != 0) {
        feature = candidate;
        break;
      }
    }
    vm.prank(admin);
    chains[c].cb.unpauseFeatures(feature);
    chainGhosts[c].pausedFeatures &= ~feature;
    okCalls['unpauseFeature']++;
  }

  /// Lifts the global pause of a chain, or (one call in three) engages it.
  function toggleGlobalPause(uint256 chainSeed, uint256 modeSeed) external {
    _tick();
    uint8 c = _chainOf(chainSeed);
    if (!chainGhosts[c].isPaused && modeSeed % 3 != 0) return;
    vm.prank(admin);
    if (chainGhosts[c].isPaused) chains[c].cb.unpause();
    else chains[c].cb.pause();
    chainGhosts[c].isPaused = !chainGhosts[c].isPaused;
    okCalls['toggleGlobalPause']++;
  }

  /// Toggles whether inbound messages require the relayer role on a chain.
  function toggleRelayerRestricted(uint256 chainSeed) external {
    _tick();
    uint8 c = _chainOf(chainSeed);
    bool isRestricted = !chainGhosts[c].isRelayerRestricted;
    vm.prank(admin);
    chains[c].cb.setRelayerRestricted(isRestricted);
    chainGhosts[c].isRelayerRestricted = isRestricted;
    okCalls['toggleRelayerRestricted']++;
  }

  /// Changes the global fee, or a token's fee override or cap.
  function setFees(uint256 chainSeed, uint256 tokenSeed, uint256 modeSeed, uint256 bpsSeed, uint256 capSeed) external {
    _tick();
    uint8 c = _chainOf(chainSeed);
    uint256 ti = _bound(tokenSeed, 0, TOKENS - 1);
    address token = tokens[c][ti];
    TokenGhost storage t = tokenGhosts[c][ti];
    // Mostly small fees, sometimes anything up to 100%.
    uint16 bps = uint16(bpsSeed % 4 == 0 ? _bound(bpsSeed >> 2, 0, MAX_BPS) : _bound(bpsSeed >> 2, 0, 500));
    uint256 mode = modeSeed % 4;
    vm.startPrank(admin);
    if (mode == 0) {
      chains[c].cb.setWithdrawalFeeBps(bps);
      chainGhosts[c].feeBps = bps;
    } else if (mode == 1) {
      bool hasCap = capSeed % 2 == 0;
      uint256 cap = _bound(capSeed >> 1, 0, _maxAmount(ti) / 1000);
      chains[c].cb
        .setTokenFeeConfig(
          token,
          TokenFeeConfig({hasFeeBpsOverride: true, feeBps: bps, hasMaxWithdrawalFee: hasCap, maxWithdrawalFee: cap})
        );
      t.hasFeeOverride = true;
      t.feeBps = bps;
      t.hasCap = hasCap;
      t.cap = hasCap ? cap : 0;
    } else if (mode == 2) {
      chains[c].cb.clearTokenFeeBps(token);
      t.hasFeeOverride = false;
      t.feeBps = 0;
    } else {
      chains[c].cb.clearTokenMaxWithdrawalFee(token);
      t.hasCap = false;
      t.cap = 0;
    }
    vm.stopPrank();
    okCalls['setFees']++;
  }

  // ===========================================================================
  // Settlement
  // ===========================================================================

  /// Unpauses both chains and relays every pending update and payment, so every mirror must converge.
  function settle() external {
    for (uint8 c; c < 2; c++) {
      vm.startPrank(admin);
      if (chainGhosts[c].isPaused) chains[c].cb.unpause();
      if (chainGhosts[c].pausedFeatures != 0) chains[c].cb.unpauseFeatures(ALL_FEATURES);
      vm.stopPrank();
      chainGhosts[c].isPaused = false;
      chainGhosts[c].pausedFeatures = 0;
    }
    // Alternate protocols; a failed delivery is already a violation, so stop there.
    for (uint8 s; s < 2; s++) {
      while (nextUpdateToDeliver[s] < updates[s].length) {
        uint8 via = nextUpdateToDeliver[s] % 2 == 0 ? VIA_WORMHOLE : VIA_CCTP;
        if (!_relayNextUpdate(s, via, CCTP_FINALITY_FINALIZED, relayer)) return;
      }
    }
    while (pendingPayments.length > 0) {
      uint256 feeSeed = uint256(keccak256(abi.encode(payments.length, pendingPayments.length)));
      if (!_relayPayment(pendingPayments.length - 1, CCTP_FINALITY_FAST, feeSeed, relayer)) return;
    }
  }

  // ===========================================================================
  // Checks (called by the invariant suite)
  // ===========================================================================

  /// Diamond balances cover tracked balances exactly plus the known untracked excess, and token totals reconcile.
  function checkSolvency() external view {
    for (uint8 c; c < 2; c++) {
      IChainbills cb = chains[c].cb;
      for (uint256 ti; ti < TOKENS; ti++) {
        address token = tokens[c][ti];
        TokenGhost storage t = tokenGhosts[c][ti];
        uint256 held = _balanceOf(c, ti, address(cb));
        uint256 tracked = cb.getTokenStats(token).totalPayableBalance;
        assertGe(held, tracked, 'diamond holds less than tracked payable balances');
        assertEq(held, tracked + t.untracked, 'diamond balance != tracked + untracked');
        assertEq(cb.getUntrackedBalance(token), t.untracked, 'untracked balance view');
      }
    }
  }

  /// `totalPayableReceived - totalWithdrawn == totalPayableBalance == sum of payable balances`, per chain and token.
  function checkTokenTotals() external view {
    for (uint8 c; c < 2; c++) {
      IChainbills cb = chains[c].cb;
      for (uint256 ti; ti < TOKENS; ti++) {
        address token = tokens[c][ti];
        TokenGhost storage t = tokenGhosts[c][ti];
        (uint256 userPaid, uint256 received, uint256 withdrawn, uint256 fees, uint256 balance) = _stats(cb, token);
        assertEq(received - withdrawn, balance, 'received - withdrawn != balance');
        assertEq(received, t.received, 'totalPayableReceived');
        assertEq(withdrawn, t.withdrawn, 'totalWithdrawn');
        assertEq(balance, t.balance, 'totalPayableBalance');
        assertEq(fees, t.fees, 'totalWithdrawalFeesCollected');
        assertEq(userPaid, t.userPaid, 'totalUserPaid');

        uint256 sum;
        uint256 count = cb.getChainPayableCount();
        for (uint256 i; i < count; i++) {
          bytes32 payableId = cb.getChainPayableIdAt(i);
          uint256 payableBalance = cb.getBalance(payableId, token);
          assertEq(payableBalance, balanceOf[payableId][ti], 'payable balance');
          sum += payableBalance;
        }
        assertEq(sum, balance, 'sum of payable balances != totalPayableBalance');
      }
    }
  }

  /// Chain counters equal list lengths and ghosts, for the chain, every payable, and every actor.
  function checkCounters() external view {
    for (uint8 c; c < 2; c++) {
      IChainbills cb = chains[c].cb;
      ChainGhost storage g = chainGhosts[c];
      _checkChainStats(cb, g);

      for (uint256 i; i < payableIds[c].length; i++) {
        _checkPayableCounters(c, payableIds[c][i]);
      }
      for (uint256 i; i < ACTORS; i++) {
        _checkUserCounters(c, actors[i]);
      }
    }
  }

  /// Every payable payment record matches its ghost; cross-chain credits equal minted amounts, delivered once.
  function checkReceipts() external view {
    for (uint8 c; c < 2; c++) {
      IChainbills cb = chains[c].cb;
      ExpectedReceipt[] storage expected = receipts[c];
      assertEq(cb.getChainPayablePaymentCount(), expected.length, 'payable payment records');
      uint256 crossChainSum;
      for (uint256 i; i < expected.length; i++) {
        bytes32 paymentId = cb.getChainPayablePaymentIdAt(i);
        (bytes32 payableId, address token, bytes32 payerChainId, uint256 requested, uint256 amount) =
          _receiptFields(cb, paymentId);
        assertEq(payableId, expected[i].payableId, 'receipt payable');
        assertEq(token, expected[i].token, 'receipt token');
        assertEq(requested, expected[i].requestedAmount, 'receipt requested amount');
        assertEq(amount, expected[i].amount, 'receipt credited amount');
        assertEq(payerChainId, expected[i].payerChainId, 'receipt payer chain');
        if (payerChainId != chains[c].cbChainId) crossChainSum += amount;
      }
      assertEq(crossChainSum, chainGhosts[c].crossChainCredited, 'cross-chain credited != minted');
      assertEq(chains[c].usdc.balanceOf(circleFeeRecipient), chainGhosts[c].circleFees, 'Circle fees != executed fees');
    }
    for (uint256 i; i < payments.length; i++) {
      PaymentMsg storage m = payments[i];
      uint8 d = 1 - m.src;
      bytes32 burnNonce = _cctpNonce(chains[m.src].transmitter.sent(m.cctpIndex));
      assertEq(
        chains[d].cb.isCctpBurnNonceConsumed(chains[m.src].circleDomain, burnNonce),
        m.isDelivered,
        'burn nonce consumed flag'
      );
    }
  }

  /// Every withdrawal charged exactly the fee its configuration allowed, and the collector received all fees.
  function checkFees() external view {
    for (uint8 c; c < 2; c++) {
      IChainbills cb = chains[c].cb;
      ExpectedWithdrawal[] storage expected = withdrawalRecords[c];
      assertEq(cb.getChainWithdrawalCount(), expected.length, 'withdrawal records');
      for (uint256 i; i < expected.length; i++) {
        (bytes32 payableId, address token, uint256 amount, uint256 fee) =
          _withdrawalFields(cb, cb.getChainWithdrawalIdAt(i));
        assertEq(payableId, expected[i].payableId, 'withdrawal payable');
        assertEq(token, expected[i].token, 'withdrawal token');
        assertEq(amount, expected[i].amount, 'withdrawal amount');
        assertEq(fee, expected[i].fee, 'withdrawal fee != configured fee');
        assertLe(fee, amount, 'fee above amount');
      }
      for (uint256 ti = USDC; ti < TOKENS; ti++) {
        assertEq(_balanceOf(c, ti, feeCollector), tokenGhosts[c][ti].collectorReceived, 'fee collector token balance');
      }
    }
    // Both simulated chains pay native fees to the same collector account.
    assertEq(
      feeCollector.balance,
      tokenGhosts[0][NATIVE].collectorReceived + tokenGhosts[1][NATIVE].collectorReceived,
      'fee collector native balance'
    );
  }

  /// Every mirror matches the last update delivered to it; fully relayed mirrors match the host's current state.
  function checkMirrors(bool isFullySettled) external view {
    for (uint8 c; c < 2; c++) {
      IChainbills home = chains[c].cb;
      IChainbills away = chains[1 - c].cb;
      assertEq(home.getLastPayableUpdateNonce(), chainGhosts[c].lastNonce, 'last payable update nonce');
      if (isFullySettled) assertEq(nextUpdateToDeliver[c], updates[c].length, 'settle left updates pending');
      for (uint256 i; i < payableIds[c].length; i++) {
        bytes32 payableId = payableIds[c][i];
        PayableGhost storage p = payableGhosts[payableId];
        assertEq(home.getPayable(payableId).isClosed, p.isClosed, 'host closed status');
        assertEq(home.getPayable(payableId).isAutoWithdraw, p.isAutoWithdraw, 'host auto-withdraw');
        _assertSameList(home.getAllowedTokensAndAmounts(payableId), allowedOf[payableId], 'host allowed list');

        assertEq(away.foreignPayableExists(payableId), p.isMirrored, 'mirror existence');
        if (!p.isMirrored) continue;
        assertEq(away.getForeignPayable(payableId).chainId, chains[c].cbChainId, 'mirror bound chain');
        assertEq(away.getForeignPayable(payableId).isClosed, p.mirrorIsClosed, 'mirror closed status');
        assertEq(away.getForeignPayableUpdateNonce(payableId), p.mirrorNonce, 'mirror nonce');
        _assertSameForeignList(
          away.getForeignPayableAllowedTokensAndAmounts(payableId), mirrorAllowedOf[payableId], 'mirror allowed list'
        );

        // Converged: once the latest broadcast is delivered, the mirror equals the host state.
        if (p.mirrorNonce == p.lastNonce) {
          assertEq(p.mirrorIsClosed, p.isClosed, 'relayed mirror closed status != host');
          _assertSameForeignList(
            away.getForeignPayableAllowedTokensAndAmounts(payableId),
            allowedOf[payableId],
            'relayed mirror list != host'
          );
        } else {
          assertTrue(!isFullySettled, 'settled mirror behind host');
        }
      }
    }
  }

  /// Messaging counters and pause flags match the ghosts.
  function checkMessagingAndPause() external view {
    for (uint8 c; c < 2; c++) {
      IChainbills cb = chains[c].cb;
      ChainGhost storage g = chainGhosts[c];
      (uint256 burns, uint256 updatesSent, uint256 received, uint256 updatesReceived) = _cctpStats(cb);
      assertEq(burns, g.burnsSent, 'CCTP payment messages emitted');
      assertEq(updatesSent, g.cctpUpdatesSent, 'CCTP update messages emitted');
      assertEq(received, g.paymentsReceived, 'CCTP payment messages received');
      assertEq(updatesReceived, g.cctpUpdatesReceived, 'CCTP update messages received');
      assertEq(cb.getWormholeStats().publishedWormholeMessagesCount, g.wormholePublished, 'Wormhole published');
      assertEq(cb.getWormholeStats().consumedWormholeMessagesCount, g.wormholeConsumed, 'Wormhole consumed');
      assertEq(cb.getConsumedWormholeMessageCount(), g.wormholeConsumed, 'consumed Wormhole list');
      assertEq(cb.paused(), g.isPaused, 'global pause');
      assertEq(cb.pausedFeatures(), g.pausedFeatures, 'paused features');
      assertEq(cb.getProtocolConfig().isRelayerRestricted, g.isRelayerRestricted, 'relayer restriction');
      assertEq(cb.getProtocolConfig().withdrawalFeeBps, g.feeBps, 'global withdrawal fee');
    }
  }

  /// No action observed an outcome that differed from its prediction.
  function checkNoViolations() external view {
    assertEq(violations, 0, firstViolation);
  }

  // ===========================================================================
  // Internal: action bodies
  // ===========================================================================

  function _pay(
    uint8 c,
    bytes32 payableId,
    address payer,
    uint256 ti,
    uint256 amount,
    uint256 maxAmountIn,
    bool isListed,
    bytes32 action
  ) internal {
    PayableGhost storage p = payableGhosts[payableId];
    uint256 received = ti == TAX ? maxAmountIn - _taxOf(maxAmountIn) : maxAmountIn;
    bool isChecksOk = !_isPaused(c, FEATURE_PAY) && !p.isClosed && isListed;
    bool isExpected = isChecksOk && received >= amount;
    _crossCheckCanPay(c, payableId, tokens[c][ti], amount, isChecksOk);

    uint256 value;
    if (ti == NATIVE) value = amount;
    else if (ti == USDC) chains[c].usdc.mint(payer, maxAmountIn);
    else taxTokens[c].mint(payer, maxAmountIn);

    (bool ok, bytes memory ret) =
      _call(c, payer, value, abi.encodeCall(ICbPayments.pay, (payableId, tokens[c][ti], amount, maxAmountIn)));
    if (!_expect(isExpected, ok, action, ret)) return;

    _recordUserPayment(c, payer, ti, maxAmountIn);
    _recordPayablePayment(c, payableId, ti, amount, received, chains[c].cbChainId);
  }

  /// Relays pending payment `slot`; returns whether it was credited.
  function _relayPayment(uint256 slot, uint32 finality, uint256 feeSeed, address caller) internal returns (bool) {
    uint256 index = pendingPayments[slot];
    PaymentMsg storage m = payments[index];
    uint8 d = 1 - m.src;
    uint256 feeExecuted = _bound(feeSeed, 0, m.maxFee);
    (bytes memory message, bytes memory attestation) =
      chains[m.src].transmitter.attest(chains[m.src].transmitter.sent(m.cctpIndex), finality, feeExecuted, true);
    bool isExpected = !_isPaused(d, FEATURE_RECEIVE_FOREIGN_PAYMENT) && finality >= CCTP_FINALITY_FAST
      && _isPermittedRelayer(d, caller);

    (bool ok, bytes memory ret) =
      _call(d, caller, 0, abi.encodeCall(ICbPayments.receiveForeignPaymentViaCctp, (message, attestation)));
    if (!_expect(isExpected, ok, 'relayPayment', ret)) return false;

    uint256 minted = m.amount + m.maxFee - feeExecuted;
    m.isDelivered = true;
    deliveredPaymentMessage[index] = message;
    pendingPayments[slot] = pendingPayments[pendingPayments.length - 1];
    pendingPayments.pop();
    deliveredPayments.push(index);
    chainGhosts[d].paymentsReceived++;
    chainGhosts[d].crossChainCredited += minted;
    chainGhosts[d].circleFees += feeExecuted;
    _recordPayablePayment(d, m.payableId, USDC, m.amount, minted, chains[m.src].cbChainId);
    return true;
  }

  /// Delivers the next pending update of chain `s`; returns whether it was applied.
  /// Delivers the next pending update of chain `s` over `via`; returns whether it was applied.
  function _relayNextUpdate(uint8 s, uint8 via, uint32 finality, address caller) internal returns (bool) {
    uint8 d = 1 - s;
    uint256 index = nextUpdateToDeliver[s];
    UpdateMsg storage u = updates[s][index];
    bool isExpected = !_isPaused(d, FEATURE_RECEIVE_PAYABLE_UPDATE) && _isPermittedRelayer(d, caller);

    (bool ok, bytes memory ret) = _deliverUpdate(s, index, via, finality, caller);
    if (via == VIA_WORMHOLE) {
      if (!_expect(isExpected, ok, 'relayUpdateWormhole', ret)) return false;
      chainGhosts[d].wormholeConsumed++;
    } else if (via == VIA_CCTP) {
      if (!_expect(isExpected && finality >= CCTP_FINALITY_FAST, ok, 'relayUpdateCctp', ret)) return false;
      chainGhosts[d].cctpUpdatesReceived++;
    } else if (!_expect(true, ok, 'relayUpdateAdminSync', ret)) {
      // Admin sync is neither pause-gated nor relayer-gated.
      return false;
    }

    // Apply the broadcast snapshot to the mirror ghost.
    PayableGhost storage p = payableGhosts[u.payableId];
    if (!p.isMirrored) {
      p.isMirrored = true;
      chainGhosts[d].foreignPayables++;
    }
    p.mirrorIsClosed = u.isClosed;
    p.mirrorNonce = u.nonce;
    delete mirrorAllowedOf[u.payableId];
    TokenAndAmount[] storage snapshot = updateAllowed[s][index];
    for (uint256 i; i < snapshot.length; i++) {
      mirrorAllowedOf[u.payableId].push(snapshot[i]);
    }
    nextUpdateToDeliver[s]++;
    return true;
  }

  /// Submits update `index` of chain `s` to the other chain over Wormhole, CCTP, or admin sync.
  function _deliverUpdate(uint8 s, uint256 index, uint8 via, uint32 finality, address caller)
    internal
    returns (bool ok, bytes memory ret)
  {
    uint8 d = 1 - s;
    UpdateMsg storage u = updates[s][index];
    if (via == VIA_WORMHOLE) {
      bytes memory vaa = chains[s].wormhole.vaaOf(u.vaaIndex);
      return _call(d, caller, 0, abi.encodeCall(ICbPayableSync.receivePayableUpdateViaWormhole, (vaa)));
    }
    if (via == VIA_CCTP) {
      (bytes memory message, bytes memory attestation) =
        chains[s].transmitter.attest(chains[s].transmitter.sent(u.cctpIndex), finality, 0, false);
      return _call(d, caller, 0, abi.encodeCall(ICbPayableSync.receivePayableUpdateViaCctp, (message, attestation)));
    }
    TokenAndAmount[] storage snapshot = updateAllowed[s][index];
    TokenAndAmountForeign[] memory list = new TokenAndAmountForeign[](snapshot.length);
    for (uint256 i; i < snapshot.length; i++) {
      list[i] = TokenAndAmountForeign(bytes32(uint256(uint160(snapshot[i].token))), uint64(snapshot[i].amount));
    }
    bytes memory data = abi.encodeCall(
      ICbPayableSync.adminSyncForeignPayable,
      (u.payableId, chains[s].cbChainId, u.nonce, uint64(vm.getBlockTimestamp()), u.actionType, u.isClosed, list)
    );
    return _call(d, admin, 0, data);
  }

  /// Relays come from the relayer, or (one call in four) from an account without the relayer role.
  function _relayCaller(uint256 seed) internal view returns (address) {
    return (seed >> 200) % 4 == 0 ? strangerRelayer : relayer;
  }

  function _isPermittedRelayer(uint8 c, address caller) internal view returns (bool) {
    return !chainGhosts[c].isRelayerRestricted || caller == relayer;
  }

  function _withdraw(uint8 c, bytes32 payableId, uint256 ti, uint256 amount, bool isAll) internal {
    PayableGhost storage p = payableGhosts[payableId];
    address token = tokens[c][ti];
    bool isExpected = !_isPaused(c, FEATURE_WITHDRAW) && amount > 0 && amount <= balanceOf[payableId][ti];
    if (!isAll) _crossCheckCanWithdraw(c, payableId, p.host, token, amount, isExpected);

    uint256 hostBefore = _balanceOf(c, ti, p.host);
    (bool ok, bytes memory ret) = _call(
      c,
      p.host,
      0,
      isAll
        ? abi.encodeCall(ICbWithdrawals.withdrawAll, (payableId, token))
        : abi.encodeCall(ICbWithdrawals.withdraw, (payableId, token, amount))
    );
    if (!_expect(isExpected, ok, isAll ? bytes32('withdrawAll') : bytes32('withdraw'), ret)) return;

    uint256 fee = _recordWithdrawal(c, payableId, ti, amount);
    uint256 net = amount - fee;
    uint256 expectedArrival = ti == TAX ? net - _taxOf(net) : net;
    if (_balanceOf(c, ti, p.host) - hostBefore != expectedArrival) {
      _violate('withdraw: host received wrong net amount', '');
    }
  }

  // ===========================================================================
  // Internal: ghost bookkeeping
  // ===========================================================================

  function _initUser(uint8 c, address wallet) internal {
    UserGhost storage user = userGhosts[c][wallet];
    if (user.isInitialized) return;
    user.isInitialized = true;
    user.activities = 1;
    chainGhosts[c].users++;
    chainGhosts[c].activities++;
  }

  function _recordHostActivity(uint8 c, bytes32 payableId) internal {
    PayableGhost storage p = payableGhosts[payableId];
    p.activitiesCount++;
    userGhosts[c][p.host].activities++;
    chainGhosts[c].activities++;
  }

  function _recordUserPayment(uint8 c, address payer, uint256 ti, uint256 debited) internal {
    _initUser(c, payer);
    UserGhost storage user = userGhosts[c][payer];
    user.payments++;
    user.activities++;
    chainGhosts[c].userPayments++;
    chainGhosts[c].activities++;
    tokenGhosts[c][ti].userPaid += debited;
  }

  function _recordPayablePayment(
    uint8 c,
    bytes32 payableId,
    uint256 ti,
    uint256 requested,
    uint256 credited,
    bytes32 payerChainId
  ) internal {
    PayableGhost storage p = payableGhosts[payableId];
    p.paymentsCount++;
    p.activitiesCount++;
    chainGhosts[c].payablePayments++;
    chainGhosts[c].activities++;
    balanceOf[payableId][ti] += credited;
    TokenGhost storage t = tokenGhosts[c][ti];
    t.received += credited;
    t.balance += credited;
    receipts[c].push(
      ExpectedReceipt({
        payableId: payableId,
        token: tokens[c][ti],
        requestedAmount: requested,
        amount: credited,
        payerChainId: payerChainId
      })
    );
    // Auto-withdrawal of everything just credited, unless the feature is paused.
    if (p.isAutoWithdraw && !_isPaused(c, FEATURE_AUTO_WITHDRAW)) _recordWithdrawal(c, payableId, ti, credited);
  }

  function _recordWithdrawal(uint8 c, bytes32 payableId, uint256 ti, uint256 amount) internal returns (uint256 fee) {
    PayableGhost storage p = payableGhosts[payableId];
    fee = _expectedFee(c, ti, amount);
    p.withdrawalsCount++;
    p.activitiesCount++;
    UserGhost storage host = userGhosts[c][p.host];
    host.withdrawals++;
    host.activities++;
    chainGhosts[c].withdrawals++;
    chainGhosts[c].activities++;
    balanceOf[payableId][ti] -= amount;
    TokenGhost storage t = tokenGhosts[c][ti];
    t.withdrawn += amount;
    t.balance -= amount;
    t.fees += fee;
    t.collectorReceived += ti == TAX ? fee - _taxOf(fee) : fee;
    withdrawalRecords[c].push(
      ExpectedWithdrawal({payableId: payableId, token: tokens[c][ti], amount: amount, fee: fee})
    );
  }

  /// Records the broadcast at position `offset` of the last host action on chain `c`.
  function _recordBroadcast(
    uint8 c,
    bytes32 payableId,
    uint8 actionType,
    bool isClosed,
    uint256 vaaBefore,
    uint256 cctpBefore,
    uint256 offset
  ) internal {
    ChainGhost storage g = chainGhosts[c];
    g.lastNonce++;
    g.wormholePublished++;
    g.cctpUpdatesSent++;
    payableGhosts[payableId].lastNonce = g.lastNonce;
    updates[c].push(
      UpdateMsg({
        payableId: payableId,
        nonce: g.lastNonce,
        actionType: actionType,
        vaaIndex: vaaBefore + offset,
        cctpIndex: cctpBefore + offset,
        isClosed: isClosed
      })
    );
    TokenAndAmount[] storage snapshot = updateAllowed[c][updates[c].length - 1];
    TokenAndAmount[] storage current = allowedOf[payableId];
    for (uint256 i; i < current.length; i++) {
      snapshot.push(current[i]);
    }
  }

  // ===========================================================================
  // Internal: helpers
  // ===========================================================================

  /// Advances time and block number so every action runs at a fresh timestamp.
  function _tick() internal {
    vm.warp(vm.getBlockTimestamp() + 13);
    vm.roll(vm.getBlockNumber() + 1);
  }

  function _chainOf(uint256 seed) internal pure returns (uint8) {
    return uint8(seed % 2);
  }

  function _pickPayable(uint8 c, uint256 seed) internal view returns (bool, bytes32) {
    uint256 length = payableIds[c].length;
    if (length == 0) return (false, bytes32(0));
    return (true, payableIds[c][_bound(seed, 0, length - 1)]);
  }

  /// Picks a payable hosted on chain `c`, preferring (seven calls in eight) one eligible for `purpose`, so that most
  /// calls succeed while the rest still exercise the rejection paths.
  function _pickPayableFor(uint8 c, uint256 seed, uint8 purpose) internal view returns (bool, bytes32) {
    uint256 length = payableIds[c].length;
    if (length == 0) return (false, bytes32(0));
    uint256 start = seed % length;
    if ((seed >> 128) % 8 != 0) {
      for (uint256 i; i < length; i++) {
        bytes32 candidate = payableIds[c][(start + i) % length];
        if (_isEligible(c, candidate, purpose)) return (true, candidate);
      }
    }
    return (true, payableIds[c][start]);
  }

  function _isEligible(uint8 c, bytes32 payableId, uint8 purpose) internal view returns (bool) {
    PayableGhost storage p = payableGhosts[payableId];
    if (purpose == PICK_OPEN) return !p.isClosed;
    if (purpose == PICK_TAX) {
      return !p.isClosed && (allowedOf[payableId].length == 0 || _hasToken(allowedOf[payableId], tokens[c][TAX]));
    }
    if (purpose == PICK_FOREIGN) {
      return p.isMirrored && !p.mirrorIsClosed
        && (mirrorAllowedOf[payableId].length == 0 || _hasToken(mirrorAllowedOf[payableId], tokens[c][USDC]));
    }
    return balanceOf[payableId][NATIVE] + balanceOf[payableId][USDC] + balanceOf[payableId][TAX] > 0;
  }

  function _hasToken(TokenAndAmount[] storage list, address token) internal view returns (bool) {
    for (uint256 i; i < list.length; i++) {
      if (list[i].token == token) return true;
    }
    return false;
  }

  /// Picks a token index, preferring (seven calls in eight) one the payable holds a balance of.
  function _pickBalanceToken(bytes32 payableId, uint256 seed) internal view returns (uint256) {
    uint256 start = seed % TOKENS;
    if ((seed >> 128) % 8 != 0) {
      for (uint256 i; i < TOKENS; i++) {
        if (balanceOf[payableId][(start + i) % TOKENS] > 0) return (start + i) % TOKENS;
      }
    }
    return start;
  }

  /// Picks a token and amount for a same-chain payment: a listed entry when the payable restricts tokens (one call
  /// in eight deliberately off by one), otherwise a random token and amount.
  function _pickPayment(uint8 c, bytes32 payableId, uint256 tokenSeed, uint256 amountSeed)
    internal
    view
    returns (uint256 ti, uint256 amount, bool isListed)
  {
    TokenAndAmount[] storage allowed = allowedOf[payableId];
    if (allowed.length == 0) {
      ti = _bound(tokenSeed, 0, TOKENS - 1);
      return (ti, _bound(amountSeed, 1, _maxAmount(ti)), true);
    }
    TokenAndAmount storage entry = allowed[_bound(tokenSeed, 0, allowed.length - 1)];
    ti = _tokenIndex(c, entry.token);
    amount = entry.amount;
    isListed = true;
    if (amountSeed % 8 == 0) {
      amount += 1;
      isListed = _isListed(allowed, entry.token, amount);
    }
  }

  function _isListed(TokenAndAmount[] storage allowed, address token, uint256 amount) internal view returns (bool) {
    for (uint256 i; i < allowed.length; i++) {
      if (allowed[i].token == token && allowed[i].amount == amount) return true;
    }
    return false;
  }

  /// Returns a valid allowed-tokens list of zero to three distinct entries.
  function _randomList(uint8 c, uint256 seed) internal view returns (TokenAndAmount[] memory list) {
    uint256 length = seed % 4;
    list = new TokenAndAmount[](length);
    for (uint256 i; i < length; i++) {
      uint256 entropy = uint256(keccak256(abi.encode(seed, i)));
      uint256 ti = entropy % TOKENS;
      // Small amounts make repeated entries likely, which exercises duplicate-free generation.
      uint256 amount = (entropy >> 8) % 4 == 0 ? _bound(entropy >> 16, 1, 5) : _bound(entropy >> 16, 1, _maxAmount(ti));
      for (uint256 j; j < i; j++) {
        if (list[j].token == tokens[c][ti] && list[j].amount == amount) amount++;
      }
      list[i] = TokenAndAmount(tokens[c][ti], amount);
    }
  }

  function _tokenIndex(uint8 c, address token) internal view returns (uint256) {
    for (uint256 ti; ti < TOKENS; ti++) {
      if (tokens[c][ti] == token) return ti;
    }
    revert('unknown token');
  }

  function _maxAmount(uint256 ti) internal pure returns (uint256) {
    if (ti == NATIVE) return MAX_NATIVE_AMOUNT;
    if (ti == USDC) return MAX_USDC_AMOUNT;
    return MAX_TAX_AMOUNT;
  }

  function _taxOf(uint256 amount) internal pure returns (uint256) {
    return (amount * TAX_BPS) / 10_000;
  }

  function _expectedFee(uint8 c, uint256 ti, uint256 amount) internal view returns (uint256 fee) {
    TokenGhost storage t = tokenGhosts[c][ti];
    uint256 bps = t.hasFeeOverride ? t.feeBps : chainGhosts[c].feeBps;
    fee = (amount * bps) / MAX_BPS;
    if (t.hasCap && fee > t.cap) fee = t.cap;
  }

  function _isPaused(uint8 c, uint256 feature) internal view returns (bool) {
    return chainGhosts[c].isPaused || chainGhosts[c].pausedFeatures & feature != 0;
  }

  function _balanceOf(uint8 c, uint256 ti, address account) internal view returns (uint256) {
    if (ti == NATIVE) return account.balance;
    if (ti == USDC) return chains[c].usdc.balanceOf(account);
    return taxTokens[c].balanceOf(account);
  }

  function _messageCounts(uint8 c) internal view returns (uint256 vaas, uint256 cctp) {
    return (chains[c].wormhole.publishedCount(), chains[c].transmitter.sentCount());
  }

  function _checkMessageCounts(uint8 c, uint256 vaaBefore, uint256 cctpBefore, uint256 count, string memory action)
    internal
  {
    (uint256 vaas, uint256 cctp) = _messageCounts(c);
    if (vaas != vaaBefore + count || cctp != cctpBefore + count) {
      _violate(string.concat(action, ': unexpected number of broadcast messages'), '');
    }
  }

  function _call(uint8 c, address from, uint256 value, bytes memory data) internal returns (bool ok, bytes memory ret) {
    // A pranked call's value comes from the pranked account.
    if (value > 0) vm.deal(from, from.balance + value);
    vm.prank(from);
    (ok, ret) = address(chains[c].cb).call{value: value}(data);
  }

  /// Records a violation when the outcome differs from the prediction; returns whether the call succeeded.
  function _expect(bool isExpected, bool ok, bytes32 action, bytes memory ret) internal returns (bool) {
    if (ok && isExpected) okCalls[action]++;
    else if (!ok && !isExpected) rejectedCalls[action]++;
    else if (ok) _violate(string.concat(_str(action), ': succeeded but was expected to revert'), ret);
    else _violate(string.concat(_str(action), ': reverted but was expected to succeed'), ret);
    return ok;
  }

  function _violate(string memory reason, bytes memory data) internal {
    if (violations == 0) {
      firstViolation = reason;
      firstViolationData = data;
    }
    violations++;
  }

  function _str(bytes32 value) internal pure returns (string memory) {
    uint256 length;
    while (length < 32 && value[length] != 0) {
      length++;
    }
    bytes memory out = new bytes(length);
    for (uint256 i; i < length; i++) {
      out[i] = value[i];
    }
    return string(out);
  }

  // Pre-flight views must agree with the handler's prediction of the diamond's own checks.

  function _crossCheckCanPay(uint8 c, bytes32 payableId, address token, uint256 amount, bool isExpected) internal {
    (bool can,) = chains[c].cb.canPay(payableId, token, amount);
    if (can != isExpected) _violate('canPay disagrees with prediction', '');
  }

  function _crossCheckCanPayForeign(uint8 s, bytes32 payableId, uint256 amount, uint256 maxFee, bool isExpected)
    internal
  {
    (bool can,) = chains[s].cb.canPayForeign(payableId, tokens[s][USDC], amount, maxFee);
    if (can != isExpected) _violate('canPayForeign disagrees with prediction', '');
  }

  function _crossCheckCanWithdraw(
    uint8 c,
    bytes32 payableId,
    address caller,
    address token,
    uint256 amount,
    bool isExpected
  ) internal {
    (bool can,) = chains[c].cb.canWithdraw(payableId, caller, token, amount);
    if (can != isExpected) _violate('canWithdraw disagrees with prediction', '');
  }

  // ===========================================================================
  // Internal: check helpers
  // ===========================================================================

  function _checkChainStats(IChainbills cb, ChainGhost storage g) internal view {
    (
      uint256 users,
      uint256 payables,
      uint256 foreignPayables,
      uint256 userPayments,
      uint256 payablePayments,
      uint256 withdrawals,
      uint256 activities
    ) = _chainStats(cb);
    assertEq(users, cb.getChainUserCount(), 'usersCount != user list');
    assertEq(payables, cb.getChainPayableCount(), 'payablesCount != payable list');
    assertEq(foreignPayables, cb.getChainForeignPayableCount(), 'foreignPayablesCount != foreign list');
    assertEq(userPayments, cb.getChainUserPaymentCount(), 'userPaymentsCount != user payment list');
    assertEq(payablePayments, cb.getChainPayablePaymentCount(), 'payablePaymentsCount != payable payment list');
    assertEq(withdrawals, cb.getChainWithdrawalCount(), 'withdrawalsCount != withdrawal list');
    assertEq(activities, cb.getChainActivityCount(), 'activitiesCount != activity list');

    assertEq(users, g.users, 'usersCount ghost');
    assertEq(payables, g.payables, 'payablesCount ghost');
    assertEq(foreignPayables, g.foreignPayables, 'foreignPayablesCount ghost');
    assertEq(userPayments, g.userPayments, 'userPaymentsCount ghost');
    assertEq(payablePayments, g.payablePayments, 'payablePaymentsCount ghost');
    assertEq(withdrawals, g.withdrawals, 'withdrawalsCount ghost');
    assertEq(activities, g.activities, 'activitiesCount ghost');
  }

  function _checkPayableCounters(uint8 c, bytes32 payableId) internal view {
    IChainbills cb = chains[c].cb;
    PayableGhost storage p = payableGhosts[payableId];
    (
      uint256 paymentsCount,
      uint256 withdrawalsCount,
      uint256 activitiesCount,
      uint8 balancesCount,
      uint8 allowedCount
    ) = _payableCounts(cb, payableId);
    assertEq(paymentsCount, cb.getPayablePaymentCount(payableId), 'payable paymentsCount != list');
    assertEq(withdrawalsCount, cb.getPayableWithdrawalCount(payableId), 'payable withdrawalsCount != list');
    assertEq(activitiesCount, cb.getPayableActivityCount(payableId), 'payable activitiesCount != list');
    assertEq(balancesCount, cb.getBalanceTokens(payableId).length, 'payable balancesCount != list');
    assertEq(allowedCount, cb.getAllowedTokensAndAmounts(payableId).length, 'payable allowed count != list');
    assertEq(
      paymentsCount,
      cb.getPayableChainPaymentCount(payableId, chains[0].cbChainId)
        + cb.getPayableChainPaymentCount(payableId, chains[1].cbChainId),
      'payable paymentsCount != per-chain lists'
    );
    assertEq(paymentsCount, p.paymentsCount, 'payable paymentsCount ghost');
    assertEq(withdrawalsCount, p.withdrawalsCount, 'payable withdrawalsCount ghost');
    assertEq(activitiesCount, p.activitiesCount, 'payable activitiesCount ghost');
  }

  function _checkUserCounters(uint8 c, address wallet) internal view {
    IChainbills cb = chains[c].cb;
    UserGhost storage u = userGhosts[c][wallet];
    (uint256 payablesCount, uint256 paymentsCount, uint256 withdrawalsCount, uint256 activitiesCount) =
      _userCounts(cb, wallet);
    assertEq(cb.isUserInitialized(wallet), u.isInitialized, 'user initialized');
    assertEq(payablesCount, cb.getUserPayableCount(wallet), 'user payablesCount != list');
    assertEq(paymentsCount, cb.getUserPaymentCount(wallet), 'user paymentsCount != list');
    assertEq(withdrawalsCount, cb.getUserWithdrawalCount(wallet), 'user withdrawalsCount != list');
    assertEq(activitiesCount, cb.getUserActivityCount(wallet), 'user activitiesCount != list');
    assertEq(payablesCount, u.payables, 'user payablesCount ghost');
    assertEq(paymentsCount, u.payments, 'user paymentsCount ghost');
    assertEq(withdrawalsCount, u.withdrawals, 'user withdrawalsCount ghost');
    assertEq(activitiesCount, u.activities, 'user activitiesCount ghost');
  }

  function _assertSameList(TokenAndAmount[] memory actual, TokenAndAmount[] storage expected, string memory what)
    internal
    view
  {
    assertEq(actual.length, expected.length, what);
    for (uint256 i; i < actual.length; i++) {
      assertEq(actual[i].token, expected[i].token, what);
      assertEq(actual[i].amount, expected[i].amount, what);
    }
  }

  function _assertSameForeignList(
    TokenAndAmountForeign[] memory actual,
    TokenAndAmount[] storage expected,
    string memory what
  ) internal view {
    assertEq(actual.length, expected.length, what);
    for (uint256 i; i < actual.length; i++) {
      assertEq(actual[i].token, bytes32(uint256(uint160(expected[i].token))), what);
      assertEq(uint256(actual[i].amount), expected[i].amount, what);
    }
  }

  // Struct readers (keep stack usage low in the checks).

  function _stats(IChainbills cb, address token)
    internal
    view
    returns (uint256 userPaid, uint256 received, uint256 withdrawn, uint256 fees, uint256 balance)
  {
    TokenStats memory s = cb.getTokenStats(token);
    return
      (s.totalUserPaid, s.totalPayableReceived, s.totalWithdrawn, s.totalWithdrawalFeesCollected, s.totalPayableBalance);
  }

  function _chainStats(IChainbills cb)
    internal
    view
    returns (
      uint256 users,
      uint256 payables,
      uint256 foreignPayables,
      uint256 userPayments,
      uint256 payablePayments,
      uint256 withdrawals,
      uint256 activities
    )
  {
    ChainStats memory s = cb.getChainStats();
    return (
      s.usersCount,
      s.payablesCount,
      s.foreignPayablesCount,
      s.userPaymentsCount,
      s.payablePaymentsCount,
      s.withdrawalsCount,
      s.activitiesCount
    );
  }

  function _payableCounts(IChainbills cb, bytes32 payableId)
    internal
    view
    returns (
      uint256 paymentsCount,
      uint256 withdrawalsCount,
      uint256 activitiesCount,
      uint8 balancesCount,
      uint8 allowedCount
    )
  {
    Payable memory p = cb.getPayable(payableId);
    return (p.paymentsCount, p.withdrawalsCount, p.activitiesCount, p.balancesCount, p.allowedTokensAndAmountsCount);
  }

  function _userCounts(IChainbills cb, address wallet)
    internal
    view
    returns (uint256 payablesCount, uint256 paymentsCount, uint256 withdrawalsCount, uint256 activitiesCount)
  {
    User memory u = cb.getUser(wallet);
    return (u.payablesCount, u.paymentsCount, u.withdrawalsCount, u.activitiesCount);
  }

  function _receiptFields(IChainbills cb, bytes32 paymentId)
    internal
    view
    returns (bytes32 payableId, address token, bytes32 payerChainId, uint256 requested, uint256 amount)
  {
    PayablePayment memory r = cb.getPayablePayment(paymentId);
    return (r.payableId, r.token, r.payerChainId, r.requestedAmount, r.amount);
  }

  function _withdrawalFields(IChainbills cb, bytes32 withdrawalId)
    internal
    view
    returns (bytes32 payableId, address token, uint256 amount, uint256 fee)
  {
    Withdrawal memory w = cb.getWithdrawal(withdrawalId);
    return (w.payableId, w.token, w.amount, w.fee);
  }

  function _cctpStats(IChainbills cb)
    internal
    view
    returns (uint256 paymentsSent, uint256 updatesSent, uint256 paymentsReceived, uint256 updatesReceived)
  {
    CctpStats memory s = cb.getCctpStats();
    return (
      s.emittedCctpPaymentMessagesCount,
      s.emittedCctpPayableUpdateMessagesCount,
      s.receivedCctpPaymentMessagesCount,
      s.receivedCctpPayableUpdateMessagesCount
    );
  }

  /// Returns the 32-byte header nonce of a CCTP V2 message.
  function _cctpNonce(bytes memory message) internal pure returns (bytes32 nonce) {
    assembly {
      nonce := mload(add(add(message, 32), 12))
    }
  }
}
