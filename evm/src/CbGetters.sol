// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import './CbErrors.sol';
import './CbState.sol';
import './CbStructs.sol';

/// Dedicated getter contract for improved reads from the main Chainbills contract.
contract CbGetters is CbErrors, CbStructs {
  /// Reference to the main Chainbills contract (that inherits CbState)
  CbState public immutable state;
  /// Address of the main Chainbills contract
  address public immutable cb;

  constructor(address cb_) {
    if (cb_ == address(0)) revert InvalidAddress();
    cb = cb_;
    state = CbState(cb_);
  }

  error InvalidAddress();

  // ------------------------------------------------------------------------
  // Struct Getters
  // ------------------------------------------------------------------------

  function getConfig() external view returns (Config memory config) {
    (uint8 a, uint16 b, uint16 c, uint32 d, address e, address f, address g, address h, address i, bytes32 j) =
      state.config();
    config = Config(a, b, c, d, e, f, g, h, i, j);
  }

  function getChainStats() external view returns (ChainStats memory stats) {
    (uint256 a, uint256 b, uint256 c, uint256 d, uint256 e, uint256 f, uint256 g, uint256 h, uint256 i) =
      state.chainStats();
    stats = ChainStats(a, b, c, d, e, f, g, h, i);
  }

  function getTokenDetails(address token) public view returns (TokenDetails memory details) {
    if (token == address(0)) revert InvalidTokenAddress();
    (bool a, address b, uint256 c, uint256 d, uint256 e, uint256 f, uint256 g) = state.tokenDetails(token);
    if (b != token) revert InvalidTokenAddress();
    details = TokenDetails(a, b, c, d, e, f, g);
  }

  function getActivityRecord(bytes32 activityId) public view returns (ActivityRecord memory record) {
    if (activityId == bytes32(0)) revert InvalidActivityId();
    (uint256 a, uint256 b, uint256 c, uint256 d, bytes32 e, ActivityType f) = state.activities(activityId);
    if (d == 0) revert InvalidActivityId();
    record = ActivityRecord(a, b, c, d, e, f);
  }

  function getUser(address wallet) public view returns (User memory user) {
    if (wallet == address(0)) revert InvalidWalletAddress();
    (uint256 a, uint256 b, uint256 c, uint256 d, uint256 e) = state.users(wallet);
    if (a == 0) revert InvalidWalletAddress();
    user = User(a, b, c, d, e);
  }

  function getPayable(bytes32 payableId) public view returns (Payable memory p) {
    if (payableId == bytes32(0)) revert InvalidPayableId();
    (address a, uint256 b, uint256 c, uint256 d, uint256 e, uint256 f, uint256 g, uint8 h, uint8 i, bool j, bool k) =
      state.payables(payableId);
    if (a == address(0)) revert InvalidPayableId();
    p = Payable(a, b, c, d, e, f, g, h, i, j, k);
  }

  function getForeignPayable(bytes32 payableId) public view returns (PayableForeign memory p) {
    if (payableId == bytes32(0)) revert InvalidPayableId();
    (bytes32 a, uint8 b, bool c) = state.foreignPayables(payableId);
    if (a == bytes32(0)) revert InvalidPayableId();
    p = PayableForeign(a, b, c);
  }

  function getUserPayment(bytes32 paymentId) public view returns (UserPayment memory p) {
    if (paymentId == bytes32(0)) revert InvalidPaymentId();
    (bytes32 a, address b, address c, bytes32 d, uint256 e, uint256 f, uint256 g, uint256 h) =
      state.userPayments(paymentId);
    if (b == address(0)) revert InvalidPaymentId();
    p = UserPayment(a, b, c, d, e, f, g, h);
  }

  function getPayablePayment(bytes32 paymentId) public view returns (PayablePayment memory p) {
    if (paymentId == bytes32(0)) revert InvalidPaymentId();
    (bytes32 a, bytes32 b, address c, uint256 d, bytes32 e, uint256 f, uint256 g, uint256 h, uint256 i) =
      state.payablePayments(paymentId);
    if (a == bytes32(0)) revert InvalidPaymentId();
    p = PayablePayment(a, b, c, d, e, f, g, h, i);
  }

  function getWithdrawal(bytes32 withdrawalId) public view returns (Withdrawal memory w) {
    if (withdrawalId == bytes32(0)) revert InvalidWithdrawalId();
    (bytes32 a, address b, address c, uint256 d, uint256 e, uint256 f, uint256 g, uint256 h) =
      state.withdrawals(withdrawalId);
    if (b == address(0)) revert InvalidWithdrawalId();
    w = Withdrawal(a, b, c, d, e, f, g, h);
  }

  // ------------------------------------------------------------------------
  // Arrays of Structs inside mappings Getters
  // ------------------------------------------------------------------------

  // Note: For mappings returning arrays of structs, we cannot just index the public getter.
  // Wait, if state has `payableAllowedTokensAndAmounts(bytes32, uint256)`, it returns (address, uint256).

  function getAllowedTokensAndAmounts(bytes32 payableId) external view returns (TokenAndAmount[] memory items) {
    Payable memory p = getPayable(payableId);
    items = new TokenAndAmount[](p.allowedTokensAndAmountsCount);
    for (uint256 i = 0; i < p.allowedTokensAndAmountsCount; i++) {
      (address token, uint256 amount) = state.payableAllowedTokensAndAmounts(payableId, i);
      items[i] = TokenAndAmount(token, amount);
    }
  }

  function getBalances(bytes32 payableId) external view returns (TokenAndAmount[] memory items) {
    Payable memory p = getPayable(payableId);
    items = new TokenAndAmount[](p.balancesCount);
    for (uint256 i = 0; i < p.balancesCount; i++) {
      (address token, uint256 amount) = state.payableBalances(payableId, i);
      items[i] = TokenAndAmount(token, amount);
    }
  }

  function getForeignPayableAllowedTokensAndAmounts(bytes32 payableId)
    external
    view
    returns (TokenAndAmountForeign[] memory items)
  {
    PayableForeign memory p = getForeignPayable(payableId);
    items = new TokenAndAmountForeign[](p.allowedTokensAndAmountsCount);
    for (uint256 i = 0; i < p.allowedTokensAndAmountsCount; i++) {
      (bytes32 token, uint64 amount) = state.foreignPayableAllowedTokensAndAmounts(payableId, i);
      items[i] = TokenAndAmountForeign(token, amount);
    }
  }

  function getPayableChainPaymentsCount(bytes32 payableId, bytes32 cbChainId) external view returns (uint256) {
    if (payableId == bytes32(0)) revert InvalidPayableId();
    return state.payableChainPaymentsCount(payableId, cbChainId);
  }

  function getForForeignChainMatchingTokenAddress(bytes32 cbChainId, bytes32 foreignToken)
    external
    view
    returns (address token)
  {
    token = state.forForeignChainMatchingTokenAddresses(cbChainId, foreignToken);
    if (token == address(0)) revert InvalidChainIdOrForeignToken();
  }

  function getForTokenAddressMatchingForeignChainToken(address token, bytes32 cbChainId)
    external
    view
    returns (bytes32 foreignToken)
  {
    foreignToken = state.forTokenAddressMatchingForeignChainTokens(token, cbChainId);
    if (foreignToken == bytes32(0)) revert InvalidChainIdOrForeignToken();
  }

  // ------------------------------------------------------------------------
  // Bulk Struct Getters
  // ------------------------------------------------------------------------

  function getUsersBulk(address[] calldata wallets) external view returns (User[] memory users) {
    users = new User[](wallets.length);
    for (uint256 i = 0; i < wallets.length; i++) {
      users[i] = getUser(wallets[i]);
    }
  }

  function getPayablesBulk(bytes32[] calldata ids) external view returns (Payable[] memory payables) {
    payables = new Payable[](ids.length);
    for (uint256 i = 0; i < ids.length; i++) {
      payables[i] = getPayable(ids[i]);
    }
  }

  function getUserPaymentsBulk(bytes32[] calldata ids) external view returns (UserPayment[] memory payments) {
    payments = new UserPayment[](ids.length);
    for (uint256 i = 0; i < ids.length; i++) {
      payments[i] = getUserPayment(ids[i]);
    }
  }

  function getPayablePaymentsBulk(bytes32[] calldata ids) external view returns (PayablePayment[] memory payments) {
    payments = new PayablePayment[](ids.length);
    for (uint256 i = 0; i < ids.length; i++) {
      payments[i] = getPayablePayment(ids[i]);
    }
  }

  function getWithdrawalsBulk(bytes32[] calldata ids) external view returns (Withdrawal[] memory wtdls) {
    wtdls = new Withdrawal[](ids.length);
    for (uint256 i = 0; i < ids.length; i++) {
      wtdls[i] = getWithdrawal(ids[i]);
    }
  }

  function getActivityRecordsBulk(bytes32[] calldata ids) external view returns (ActivityRecord[] memory records) {
    records = new ActivityRecord[](ids.length);
    for (uint256 i = 0; i < ids.length; i++) {
      records[i] = getActivityRecord(ids[i]);
    }
  }

  // ------------------------------------------------------------------------
  // Internal Paginators
  // ------------------------------------------------------------------------

  function _paginateAddressArray(
    function(uint256) external view returns (address) array,
    uint256 total,
    uint256 offset,
    uint256 limit
  ) internal view returns (address[] memory items) {
    if (offset >= total) return new address[](0);
    uint256 end = offset + limit > total ? total : offset + limit;
    uint256 length = end - offset;
    items = new address[](length);
    for (uint256 i = 0; i < length; i += 1) {
      items[i] = array(offset + i);
    }
  }

  function _paginateBytes32Array(
    function(uint256) external view returns (bytes32) array,
    uint256 total,
    uint256 offset,
    uint256 limit
  ) internal view returns (bytes32[] memory items) {
    if (offset >= total) return new bytes32[](0);
    uint256 end = offset + limit > total ? total : offset + limit;
    uint256 length = end - offset;
    items = new bytes32[](length);
    for (uint256 i = 0; i < length; i += 1) {
      items[i] = array(offset + i);
    }
  }

  function _paginateBytes32ArrayForAddress(
    function(address, uint256) external view returns (bytes32) array,
    address key,
    uint256 total,
    uint256 offset,
    uint256 limit
  ) internal view returns (bytes32[] memory items) {
    if (offset >= total) return new bytes32[](0);
    uint256 end = offset + limit > total ? total : offset + limit;
    uint256 length = end - offset;
    items = new bytes32[](length);
    for (uint256 i = 0; i < length; i += 1) {
      items[i] = array(key, offset + i);
    }
  }

  function _paginateBytes32ArrayForBytes32(
    function(bytes32, uint256) external view returns (bytes32) array,
    bytes32 key,
    uint256 total,
    uint256 offset,
    uint256 limit
  ) internal view returns (bytes32[] memory items) {
    if (offset >= total) return new bytes32[](0);
    uint256 end = offset + limit > total ? total : offset + limit;
    uint256 length = end - offset;
    items = new bytes32[](length);
    for (uint256 i = 0; i < length; i += 1) {
      items[i] = array(key, offset + i);
    }
  }

  function _paginateBytes32ArrayForBytes32AndBytes32(
    function(bytes32, bytes32, uint256) external view returns (bytes32) array,
    bytes32 key1,
    bytes32 key2,
    uint256 total,
    uint256 offset,
    uint256 limit
  ) internal view returns (bytes32[] memory items) {
    if (offset >= total) return new bytes32[](0);
    uint256 end = offset + limit > total ? total : offset + limit;
    uint256 length = end - offset;
    items = new bytes32[](length);
    for (uint256 i = 0; i < length; i += 1) {
      items[i] = array(key1, key2, offset + i);
    }
  }

  function _paginateBytes32ArrayForUint16(
    function(uint16, uint256) external view returns (bytes32) array,
    uint16 key,
    uint256 total,
    uint256 offset,
    uint256 limit
  ) internal view returns (bytes32[] memory items) {
    if (offset >= total) return new bytes32[](0);
    uint256 end = offset + limit > total ? total : offset + limit;
    uint256 length = end - offset;
    items = new bytes32[](length);
    for (uint256 i = 0; i < length; i += 1) {
      items[i] = array(key, offset + i);
    }
  }

  // ------------------------------------------------------------------------
  // Paginated Getters
  // ------------------------------------------------------------------------

  function chainUserAddressesPaginated(uint256 offset, uint256 limit) external view returns (address[] memory items) {
    (uint256 total,,,,,,,,) = state.chainStats();
    return _paginateAddressArray(state.chainUserAddresses, total, offset, limit);
  }

  function chainPayableIdsPaginated(uint256 offset, uint256 limit) external view returns (bytes32[] memory items) {
    (,uint256 total,,,,,,,) = state.chainStats();
    return _paginateBytes32Array(state.chainPayableIds, total, offset, limit);
  }

  function chainForeignPayableIdsPaginated(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    (,,uint256 total,,,,,,) = state.chainStats();
    return _paginateBytes32Array(state.chainForeignPayableIds, total, offset, limit);
  }

  function chainUserPaymentIdsPaginated(uint256 offset, uint256 limit) external view returns (bytes32[] memory items) {
    (,,,uint256 total,,,,,) = state.chainStats();
    return _paginateBytes32Array(state.chainUserPaymentIds, total, offset, limit);
  }

  function chainPayablePaymentIdsPaginated(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    (,,,,uint256 total,,,,) = state.chainStats();
    return _paginateBytes32Array(state.chainPayablePaymentIds, total, offset, limit);
  }

  function chainWithdrawalIdsPaginated(uint256 offset, uint256 limit) external view returns (bytes32[] memory items) {
    (,,,,,uint256 total,,,) = state.chainStats();
    return _paginateBytes32Array(state.chainWithdrawalIds, total, offset, limit);
  }

  function chainActivityIdsPaginated(uint256 offset, uint256 limit) external view returns (bytes32[] memory items) {
    (,,,,,,uint256 total,,) = state.chainStats();
    return _paginateBytes32Array(state.chainActivityIds, total, offset, limit);
  }

  function consumedWormholeMessagesPaginated(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    (,,,,,,,,uint256 total) = state.chainStats();
    return _paginateBytes32Array(state.consumedWormholeMessages, total, offset, limit);
  }

  // Note: registeredCbChainIds is dynamic, we don't track its length in chainStats.
  // Actually, there's no explicitly tracked length for registeredCbChainIds in chainStats.
  // Let's implement a loop to count it or just skip it.
  // Wait, if we don't have the total, we can't efficiently paginate.
  // But wait! We can fetch the length via an external try-catch if it's possible or not needed.
  // Actually, in `Chainbills` the `registeredCbChainIds` is an array. We can just leave it out if we don't have length.

  function userPayableIdsPaginated(address userWallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = getUser(userWallet).payablesCount;
    return _paginateBytes32ArrayForAddress(state.userPayableIds, userWallet, total, offset, limit);
  }

  function userPaymentIdsPaginated(address userWallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = getUser(userWallet).paymentsCount;
    return _paginateBytes32ArrayForAddress(state.userPaymentIds, userWallet, total, offset, limit);
  }

  function userActivityIdsPaginated(address userWallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = getUser(userWallet).activitiesCount;
    return _paginateBytes32ArrayForAddress(state.userActivityIds, userWallet, total, offset, limit);
  }

  function userWithdrawalIdsPaginated(address userWallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = getUser(userWallet).withdrawalsCount;
    return _paginateBytes32ArrayForAddress(state.userWithdrawalIds, userWallet, total, offset, limit);
  }

  function payablePaymentIdsPaginated(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = getPayable(payableId).paymentsCount;
    return _paginateBytes32ArrayForBytes32(state.payablePaymentIds, payableId, total, offset, limit);
  }

  function payableActivityIdsPaginated(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = getPayable(payableId).activitiesCount;
    return _paginateBytes32ArrayForBytes32(state.payableActivityIds, payableId, total, offset, limit);
  }

  function payableWithdrawalIdsPaginated(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = getPayable(payableId).withdrawalsCount;
    return _paginateBytes32ArrayForBytes32(state.payableWithdrawalIds, payableId, total, offset, limit);
  }

  function payableChainPaymentIdsPaginated(bytes32 payableId, bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = state.payableChainPaymentsCount(payableId, cbChainId);
    return
      _paginateBytes32ArrayForBytes32AndBytes32(
        state.payableChainPaymentIds, payableId, cbChainId, total, offset, limit
      );
  }

  function perChainConsumedWormholeMessagesPaginated(uint16 wormholeChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = state.perChainConsumedWormholeMessagesCount(wormholeChainId);
    return _paginateBytes32ArrayForUint16(state.perChainConsumedWormholeMessages, wormholeChainId, total, offset, limit);
  }
}
