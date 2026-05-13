// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CbErrors} from './CbErrors.sol';
import {CbState} from './CbState.sol';
import {CbStructs} from './CbStructs.sol';

/// Dedicated getter contract for improved reads from the main Chainbills contract.
contract CbGetters is CbErrors, CbStructs {
  /// Reference to the main Chainbills contract (that inherits CbState)
  CbState public immutable STATE;
  /// Address of the main Chainbills contract
  address public immutable CHAINBILLS_CONTRACT_ADDRESS;

  constructor(address cb_) {
    if (cb_ == address(0)) revert InvalidAddress();
    CHAINBILLS_CONTRACT_ADDRESS = cb_;
    STATE = CbState(cb_);
  }

  error InvalidAddress();

  // ------------------------------------------------------------------------
  // Struct Getters
  // ------------------------------------------------------------------------

  /// @notice Fetches the general configuration of the Chainbills system on this chain.
  /// @return config The Config struct containing system parameters.
  function getConfig() external view returns (Config memory config) {
    (uint8 a, uint16 b, uint16 c, uint32 d, address e, address f, address g, address h, address i, bytes32 j) =
      STATE.config();
    config = Config({
      wormholeFinality: a,
      wormholeChainId: b,
      withdrawalFeePercentage: c,
      circleDomain: d,
      feeCollector: e,
      wormhole: f,
      circleBridge: g,
      circleTokenMinter: h,
      circleTransmitter: i,
      cbChainId: j
    });
  }

  /// @notice Fetches the global statistics for the Chainbills protocol on this chain.
  /// @return stats The ChainStats struct with overall protocol counts.
  function getChainStats() external view returns (ChainStats memory stats) {
    (uint256 a, uint256 b, uint256 c, uint256 d, uint256 e, uint256 f, uint256 g, uint256 h, uint256 i) =
      STATE.chainStats();
    stats = ChainStats({
      usersCount: a,
      payablesCount: b,
      foreignPayablesCount: c,
      userPaymentsCount: d,
      payablePaymentsCount: e,
      withdrawalsCount: f,
      activitiesCount: g,
      publishedWormholeMessagesCount: h,
      consumedWormholeMessagesCount: i
    });
  }

  /// @notice Retrieves details of a specific supported token.
  /// @param token The address of the token.
  /// @return details The TokenDetails struct containing usage and fee info.
  function getTokenDetails(address token) public view returns (TokenDetails memory details) {
    if (token == address(0)) revert InvalidTokenAddress();
    (bool a, address b, uint256 c, uint256 d, uint256 e, uint256 f, uint256 g) = STATE.tokenDetails(token);
    if (b != token) revert InvalidTokenAddress();
    details = TokenDetails({
      isSupported: a,
      token: b,
      maxWithdrawalFees: c,
      totalUserPaid: d,
      totalPayableReceived: e,
      totalWithdrawn: f,
      totalWithdrawalFeesCollected: g
    });
  }

  /// @notice Retrieves a specific activity record by its ID.
  /// @param activityId The unique identifier of the activity.
  /// @return record The ActivityRecord struct.
  function getActivityRecord(bytes32 activityId) public view returns (ActivityRecord memory record) {
    if (activityId == bytes32(0)) revert InvalidActivityId();
    (uint256 a, uint256 b, uint256 c, uint256 d, bytes32 e, ActivityType f) = STATE.activities(activityId);
    if (d == 0) revert InvalidActivityId();
    record = ActivityRecord({chainCount: a, userCount: b, payableCount: c, timestamp: d, entity: e, activityType: f});
  }

  /// @notice Retrieves user information for a given wallet address.
  /// @param wallet The address of the user.
  /// @return user The User struct with their activity counts.
  function getUser(address wallet) public view returns (User memory user) {
    if (wallet == address(0)) revert InvalidWalletAddress();
    (uint256 a, uint256 b, uint256 c, uint256 d, uint256 e) = STATE.users(wallet);
    if (a == 0) revert InvalidWalletAddress();
    user = User({chainCount: a, payablesCount: b, paymentsCount: c, withdrawalsCount: d, activitiesCount: e});
  }

  /// @notice Retrieves a specific payable by its ID.
  /// @param payableId The unique identifier of the payable.
  /// @return p The Payable struct with its configuration and stats.
  function getPayable(bytes32 payableId) public view returns (Payable memory p) {
    if (payableId == bytes32(0)) revert InvalidPayableId();
    (address a, uint256 b, uint256 c, uint256 d, uint256 e, uint256 f, uint256 g, uint8 h, uint8 i, bool j, bool k) =
      STATE.payables(payableId);
    if (a == address(0)) revert InvalidPayableId();
    p = Payable({
      host: a,
      chainCount: b,
      hostCount: c,
      createdAt: d,
      paymentsCount: e,
      withdrawalsCount: f,
      activitiesCount: g,
      allowedTokensAndAmountsCount: h,
      balancesCount: i,
      isClosed: j,
      isAutoWithdraw: k
    });
  }

  /// @notice Retrieves a specific foreign payable by its ID.
  /// @param payableId The unique identifier of the payable.
  /// @return p The PayableForeign struct.
  function getForeignPayable(bytes32 payableId) public view returns (PayableForeign memory p) {
    if (payableId == bytes32(0)) revert InvalidPayableId();
    (bytes32 a, uint8 b, bool c) = STATE.foreignPayables(payableId);
    if (a == bytes32(0)) revert InvalidPayableId();
    p = PayableForeign({chainId: a, allowedTokensAndAmountsCount: b, isClosed: c});
  }

  /// @notice Retrieves a specific payment record made by a user.
  /// @param paymentId The unique identifier of the payment.
  /// @return p The UserPayment struct.
  function getUserPayment(bytes32 paymentId) public view returns (UserPayment memory p) {
    if (paymentId == bytes32(0)) revert InvalidPaymentId();
    (bytes32 a, address b, address c, bytes32 d, uint256 e, uint256 f, uint256 g, uint256 h) =
      STATE.userPayments(paymentId);
    if (b == address(0)) revert InvalidPaymentId();
    p = UserPayment({
      payableId: a, payer: b, token: c, payableChainId: d, chainCount: e, payerCount: f, timestamp: g, amount: h
    });
  }

  /// @notice Retrieves a specific payment record received by a payable.
  /// @param paymentId The unique identifier of the payment.
  /// @return p The PayablePayment struct.
  function getPayablePayment(bytes32 paymentId) public view returns (PayablePayment memory p) {
    if (paymentId == bytes32(0)) revert InvalidPaymentId();
    (bytes32 a, bytes32 b, address c, uint256 d, bytes32 e, uint256 f, uint256 g, uint256 h, uint256 i) =
      STATE.payablePayments(paymentId);
    if (a == bytes32(0)) revert InvalidPaymentId();
    p = PayablePayment({
      payableId: a,
      payer: b,
      token: c,
      chainCount: d,
      payerChainId: e,
      localChainCount: f,
      payableCount: g,
      timestamp: h,
      amount: i
    });
  }

  /// @notice Retrieves a specific withdrawal record.
  /// @param withdrawalId The unique identifier of the withdrawal.
  /// @return w The Withdrawal struct.
  function getWithdrawal(bytes32 withdrawalId) public view returns (Withdrawal memory w) {
    if (withdrawalId == bytes32(0)) revert InvalidWithdrawalId();
    (bytes32 a, address b, address c, uint256 d, uint256 e, uint256 f, uint256 g, uint256 h) =
      STATE.withdrawals(withdrawalId);
    if (b == address(0)) revert InvalidWithdrawalId();
    w = Withdrawal({
      payableId: a, host: b, token: c, chainCount: d, hostCount: e, payableCount: f, timestamp: g, amount: h
    });
  }

  // ------------------------------------------------------------------------
  // Arrays of Structs inside mappings Getters
  // ------------------------------------------------------------------------

  // Note: For mappings returning arrays of structs, we cannot just index the public getter.
  // Wait, if STATE has `payableAllowedTokensAndAmounts(bytes32, uint256)`, it returns (address, uint256).

  /// @notice Fetches all allowed tokens and their amounts for a specific payable.
  /// @param payableId The ID of the payable.
  /// @return items An array of TokenAndAmount structs.
  function getAllowedTokensAndAmounts(bytes32 payableId) external view returns (TokenAndAmount[] memory items) {
    Payable memory p = getPayable(payableId);
    items = new TokenAndAmount[](p.allowedTokensAndAmountsCount);
    for (uint256 i = 0; i < p.allowedTokensAndAmountsCount; i++) {
      (address token, uint256 amount) = STATE.payableAllowedTokensAndAmounts(payableId, i);
      items[i] = TokenAndAmount({token: token, amount: amount});
    }
  }

  /// @notice Fetches the accumulated balances of all tokens for a specific payable.
  /// @param payableId The ID of the payable.
  /// @return items An array of TokenAndAmount structs representing the balances.
  function getBalances(bytes32 payableId) external view returns (TokenAndAmount[] memory items) {
    Payable memory p = getPayable(payableId);
    items = new TokenAndAmount[](p.balancesCount);
    for (uint256 i = 0; i < p.balancesCount; i++) {
      (address token, uint256 amount) = STATE.payableBalances(payableId, i);
      items[i] = TokenAndAmount({token: token, amount: amount});
    }
  }

  /// @notice Fetches allowed tokens and their amounts for a foreign payable.
  /// @param payableId The ID of the foreign payable.
  /// @return items An array of TokenAndAmountForeign structs.
  function getForeignPayableAllowedTokensAndAmounts(bytes32 payableId)
    external
    view
    returns (TokenAndAmountForeign[] memory items)
  {
    PayableForeign memory p = getForeignPayable(payableId);
    items = new TokenAndAmountForeign[](p.allowedTokensAndAmountsCount);
    for (uint256 i = 0; i < p.allowedTokensAndAmountsCount; i++) {
      (bytes32 token, uint64 amount) = STATE.foreignPayableAllowedTokensAndAmounts(payableId, i);
      items[i] = TokenAndAmountForeign({token: token, amount: amount});
    }
  }

  /// @notice Returns the number of payments a payable has received from a specific chain.
  /// @param payableId The ID of the payable.
  /// @param cbChainId The CAIP-2 chain ID of the sending chain.
  /// @return The count of payments.
  function getPayableChainPaymentsCount(bytes32 payableId, bytes32 cbChainId) external view returns (uint256) {
    if (payableId == bytes32(0)) revert InvalidPayableId();
    return STATE.payableChainPaymentsCount(payableId, cbChainId);
  }

  /// @notice Retrieves the local token address that corresponds to a foreign chain's token address.
  /// @param cbChainId The CAIP-2 chain ID of the foreign chain.
  /// @param foreignToken The Wormhole-normalized address of the foreign token.
  /// @return token The corresponding local token address.
  function getForForeignChainMatchingTokenAddress(bytes32 cbChainId, bytes32 foreignToken)
    external
    view
    returns (address token)
  {
    token = STATE.forForeignChainMatchingTokenAddresses(cbChainId, foreignToken);
    if (token == address(0)) revert InvalidChainIdOrForeignToken();
  }

  /// @notice Retrieves the foreign token address that corresponds to a local token on a specific chain.
  /// @param token The address of the local token.
  /// @param cbChainId The CAIP-2 chain ID of the foreign chain.
  /// @return foreignToken The corresponding Wormhole-normalized foreign token address.
  function getForTokenAddressMatchingForeignChainToken(address token, bytes32 cbChainId)
    external
    view
    returns (bytes32 foreignToken)
  {
    foreignToken = STATE.forTokenAddressMatchingForeignChainTokens(token, cbChainId);
    if (foreignToken == bytes32(0)) revert InvalidChainIdOrForeignToken();
  }

  // ------------------------------------------------------------------------
  // Bulk Struct Getters
  // ------------------------------------------------------------------------

  /// @notice Fetches multiple users at once.
  /// @param wallets An array of user wallet addresses.
  /// @return users An array of User structs.
  function getUsersBulk(address[] calldata wallets) external view returns (User[] memory users) {
    users = new User[](wallets.length);
    for (uint256 i = 0; i < wallets.length; i++) {
      users[i] = getUser(wallets[i]);
    }
  }

  /// @notice Fetches multiple payables at once.
  /// @param ids An array of payable IDs.
  /// @return payables An array of Payable structs.
  function getPayablesBulk(bytes32[] calldata ids) external view returns (Payable[] memory payables) {
    payables = new Payable[](ids.length);
    for (uint256 i = 0; i < ids.length; i++) {
      payables[i] = getPayable(ids[i]);
    }
  }

  /// @notice Fetches multiple user payment records at once.
  /// @param ids An array of user payment IDs.
  /// @return payments An array of UserPayment structs.
  function getUserPaymentsBulk(bytes32[] calldata ids) external view returns (UserPayment[] memory payments) {
    payments = new UserPayment[](ids.length);
    for (uint256 i = 0; i < ids.length; i++) {
      payments[i] = getUserPayment(ids[i]);
    }
  }

  /// @notice Fetches multiple payable payment records at once.
  /// @param ids An array of payable payment IDs.
  /// @return payments An array of PayablePayment structs.
  function getPayablePaymentsBulk(bytes32[] calldata ids) external view returns (PayablePayment[] memory payments) {
    payments = new PayablePayment[](ids.length);
    for (uint256 i = 0; i < ids.length; i++) {
      payments[i] = getPayablePayment(ids[i]);
    }
  }

  /// @notice Fetches multiple withdrawal records at once.
  /// @param ids An array of withdrawal IDs.
  /// @return wtdls An array of Withdrawal structs.
  function getWithdrawalsBulk(bytes32[] calldata ids) external view returns (Withdrawal[] memory wtdls) {
    wtdls = new Withdrawal[](ids.length);
    for (uint256 i = 0; i < ids.length; i++) {
      wtdls[i] = getWithdrawal(ids[i]);
    }
  }

  /// @notice Fetches multiple activity records at once.
  /// @param ids An array of activity IDs.
  /// @return records An array of ActivityRecord structs.
  function getActivityRecordsBulk(bytes32[] calldata ids) external view returns (ActivityRecord[] memory records) {
    records = new ActivityRecord[](ids.length);
    for (uint256 i = 0; i < ids.length; i++) {
      records[i] = getActivityRecord(ids[i]);
    }
  }

  // ------------------------------------------------------------------------
  // Internal Paginators
  // ------------------------------------------------------------------------

  /// @notice Internal helper to paginate through a 1D address mapping.
  /// @param array The state mapping to query.
  /// @param total Total items available.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Paged items.
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

  /// @notice Internal helper to paginate through a 1D bytes32 mapping.
  /// @param array The state mapping to query.
  /// @param total Total items available.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Paged items.
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

  /// @notice Internal helper to paginate through a 2D mapping keyed by address.
  /// @param array The state mapping to query.
  /// @param key The address key.
  /// @param total Total items available for the key.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Paged items.
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

  /// @notice Internal helper to paginate through a 2D mapping keyed by bytes32.
  /// @param array The state mapping to query.
  /// @param key The bytes32 key.
  /// @param total Total items available for the key.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Paged items.
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

  /// @notice Internal helper to paginate through a 3D mapping keyed by two bytes32 values.
  /// @param array The state mapping to query.
  /// @param key1 The first bytes32 key.
  /// @param key2 The second bytes32 key.
  /// @param total Total items available for the keys.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Paged items.
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

  /// @notice Internal helper to paginate through a 2D mapping keyed by uint16.
  /// @param array The state mapping to query.
  /// @param key The uint16 key.
  /// @param total Total items available for the key.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Paged items.
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

  /// @notice Paginated getter for all user addresses on this chain.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of user addresses.
  function chainUserAddressesPaginated(uint256 offset, uint256 limit) external view returns (address[] memory items) {
    (uint256 total,,,,,,,,) = STATE.chainStats();
    return _paginateAddressArray(STATE.chainUserAddresses, total, offset, limit);
  }

  /// @notice Paginated getter for all payable IDs on this chain.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of payable IDs.
  function chainPayableIdsPaginated(uint256 offset, uint256 limit) external view returns (bytes32[] memory items) {
    (, uint256 total,,,,,,,) = STATE.chainStats();
    return _paginateBytes32Array(STATE.chainPayableIds, total, offset, limit);
  }

  /// @notice Paginated getter for all foreign payable IDs tracked on this chain.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of foreign payable IDs.
  function chainForeignPayableIdsPaginated(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    (,, uint256 total,,,,,,) = STATE.chainStats();
    return _paginateBytes32Array(STATE.chainForeignPayableIds, total, offset, limit);
  }

  /// @notice Paginated getter for all user payment IDs on this chain.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of user payment IDs.
  function chainUserPaymentIdsPaginated(uint256 offset, uint256 limit) external view returns (bytes32[] memory items) {
    (,,, uint256 total,,,,,) = STATE.chainStats();
    return _paginateBytes32Array(STATE.chainUserPaymentIds, total, offset, limit);
  }

  /// @notice Paginated getter for all payable payment IDs on this chain.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of payable payment IDs.
  function chainPayablePaymentIdsPaginated(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    (,,,, uint256 total,,,,) = STATE.chainStats();
    return _paginateBytes32Array(STATE.chainPayablePaymentIds, total, offset, limit);
  }

  /// @notice Paginated getter for all withdrawal IDs on this chain.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of withdrawal IDs.
  function chainWithdrawalIdsPaginated(uint256 offset, uint256 limit) external view returns (bytes32[] memory items) {
    (,,,,, uint256 total,,,) = STATE.chainStats();
    return _paginateBytes32Array(STATE.chainWithdrawalIds, total, offset, limit);
  }

  /// @notice Paginated getter for all activity IDs on this chain.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of activity IDs.
  function chainActivityIdsPaginated(uint256 offset, uint256 limit) external view returns (bytes32[] memory items) {
    (,,,,,, uint256 total,,) = STATE.chainStats();
    return _paginateBytes32Array(STATE.chainActivityIds, total, offset, limit);
  }

  /// @notice Paginated getter for all consumed Wormhole VAA hashes.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of consumed VAA hashes.
  function consumedWormholeMessagesPaginated(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    (,,,,,,,, uint256 total) = STATE.chainStats();
    return _paginateBytes32Array(STATE.consumedWormholeMessages, total, offset, limit);
  }

  // Note: registeredCbChainIds is dynamic, we don't track its length in chainStats.
  // Actually, there's no explicitly tracked length for registeredCbChainIds in chainStats.
  // Let's implement a loop to count it or just skip it.
  // Wait, if we don't have the total, we can't efficiently paginate.
  // But wait! We can fetch the length via an external try-catch if it's possible or not needed.
  // Actually, in `Chainbills` the `registeredCbChainIds` is an array. We can just leave it out if we don't have length.

  /// @notice Paginated getter for payable IDs created by a specific user.
  /// @param userWallet The address of the user.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of payable IDs.
  function userPayableIdsPaginated(address userWallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = getUser(userWallet).payablesCount;
    return _paginateBytes32ArrayForAddress(STATE.userPayableIds, userWallet, total, offset, limit);
  }

  /// @notice Paginated getter for payment IDs made by a specific user.
  /// @param userWallet The address of the user.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of payment IDs.
  function userPaymentIdsPaginated(address userWallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = getUser(userWallet).paymentsCount;
    return _paginateBytes32ArrayForAddress(STATE.userPaymentIds, userWallet, total, offset, limit);
  }

  /// @notice Paginated getter for activity IDs associated with a specific user.
  /// @param userWallet The address of the user.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of activity IDs.
  function userActivityIdsPaginated(address userWallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = getUser(userWallet).activitiesCount;
    return _paginateBytes32ArrayForAddress(STATE.userActivityIds, userWallet, total, offset, limit);
  }

  /// @notice Paginated getter for withdrawal IDs made by a specific user.
  /// @param userWallet The address of the user.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of withdrawal IDs.
  function userWithdrawalIdsPaginated(address userWallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = getUser(userWallet).withdrawalsCount;
    return _paginateBytes32ArrayForAddress(STATE.userWithdrawalIds, userWallet, total, offset, limit);
  }

  /// @notice Paginated getter for payment IDs received by a specific payable.
  /// @param payableId The ID of the payable.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of payment IDs.
  function payablePaymentIdsPaginated(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = getPayable(payableId).paymentsCount;
    return _paginateBytes32ArrayForBytes32(STATE.payablePaymentIds, payableId, total, offset, limit);
  }

  /// @notice Paginated getter for activity IDs associated with a specific payable.
  /// @param payableId The ID of the payable.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of activity IDs.
  function payableActivityIdsPaginated(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = getPayable(payableId).activitiesCount;
    return _paginateBytes32ArrayForBytes32(STATE.payableActivityIds, payableId, total, offset, limit);
  }

  /// @notice Paginated getter for withdrawal IDs from a specific payable.
  /// @param payableId The ID of the payable.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of withdrawal IDs.
  function payableWithdrawalIdsPaginated(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = getPayable(payableId).withdrawalsCount;
    return _paginateBytes32ArrayForBytes32(STATE.payableWithdrawalIds, payableId, total, offset, limit);
  }

  /// @notice Paginated getter for payment IDs received by a payable from a specific chain.
  /// @param payableId The ID of the payable.
  /// @param cbChainId The CAIP-2 chain ID of the source chain.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of payment IDs.
  function payableChainPaymentIdsPaginated(bytes32 payableId, bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = STATE.payableChainPaymentsCount(payableId, cbChainId);
    return
      _paginateBytes32ArrayForBytes32AndBytes32(
        STATE.payableChainPaymentIds, payableId, cbChainId, total, offset, limit
      );
  }

  /// @notice Paginated getter for consumed Wormhole VAA hashes originating from a specific Wormhole chain ID.
  /// @param wormholeChainId The Wormhole chain ID.
  /// @param offset Pagination offset.
  /// @param limit Maximum number of items to return.
  /// @return items Array of VAA hashes.
  function perChainConsumedWormholeMessagesPaginated(uint16 wormholeChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory items)
  {
    uint256 total = STATE.perChainConsumedWormholeMessagesCount(wormholeChainId);
    return _paginateBytes32ArrayForUint16(STATE.perChainConsumedWormholeMessages, wormholeChainId, total, offset, limit);
  }
}
