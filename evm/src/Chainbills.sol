// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import 'wormhole/Utils.sol';

import './CbGovernance.sol';
import './CbPayload.sol';
import './CbState.sol';

error InvalidFeeCollector();
error InvalidWormholeAddress();
error InvalidWormholeFinality();
error MaxPayableTokensCapacityReached();
error EmitterNotRegistered();
error NotYourPayable();
error PayableIsAlreadyClosed();
error PayableIsNotClosed();
error PayableIsClosed();
error MatchingTokenAndAmountNotFound();
error InsufficientPaymentValue();
error IncorrectPaymentValue();
error UnsuccessfulPayment();
error InsufficientWithdrawAmount();
error NoBalanceForWithdrawalToken();
error UnsuccessfulWithdrawal();

/// A Cross-Chain Payment Gateway.
contract Chainbills is CbGovernance, CbPayload {
  fallback() external payable {}

  receive() external payable {}

  /// Sets up this smart contract when it is deployed. Sets the feeCollector,
  /// wormhole, chainId, and wormholeFinality variables.
  constructor(
    address feeCollector_,
    address wormhole_,
    uint16 chainId_,
    uint8 wormholeFinality_
  ) {
    if (feeCollector_ == address(0)) revert InvalidFeeCollector();
    else if (wormhole_ == address(0)) revert InvalidWormholeAddress();
    else if (chainId_ == 0) revert InvalidWormholeChainId();
    else if (wormholeFinality_ == 0) revert InvalidWormholeFinality();

    feeCollector = feeCollector_;
    wormhole = wormhole_;
    chainId = chainId_;
    wormholeFinality = wormholeFinality_;
    chainStats = ChainStats(0, 0, 0, 0);
  }

  /// Initializes a User if need be.
  /// @param wallet The address of the user.
  function initializeUserIfNeedBe(address wallet) internal {
    // Check if the user has not yet been initialized, if yes, initialize.
    if (users[wallet].chainCount == 0) {
      chainStats.usersCount++;
      users[wallet].chainCount = chainStats.usersCount;
      emit InitializedUser(wallet, chainStats.usersCount);
    }
  }

  /// Returns a hash that should be used for entity IDs.
  function createId(
    address wallet,
    uint256 count
  ) internal view returns (bytes32) {
    return
      keccak256(
        abi.encodePacked(block.chainid, chainId, block.timestamp, wallet, count)
      );
  }

  /// Create a Payable.
  /// @param allowedTokensAndAmounts The accepted tokens (and their amounts) on
  /// the payable. If empty, then the payable will accept payments in any token.
  /// @return payableId The ID of the newly created payable.
  function createPayable(
    TokenAndAmount[] calldata allowedTokensAndAmounts
  ) public returns (bytes32 payableId) {
    /* CHECKS */
    // Ensure that the number of specified acceptable tokens (and their amounts)
    // for payments don't exceed the set maximum.
    if (allowedTokensAndAmounts.length > MAX_PAYABLES_TOKENS) {
      revert MaxPayableTokensCapacityReached();
    }

    for (uint8 i = 0; i < allowedTokensAndAmounts.length; i++) {
      // Ensure tokens are valid and are supported. Basically if a token's max
      // fees is not set, then it isn't supported
      address token = allowedTokensAndAmounts[i].token;
      if (token == address(0) || maxFeesPerToken[token] == 0) {
        revert InvalidTokenAddress();
      }
      // Ensure that the specified amount is greater than zero.
      if (allowedTokensAndAmounts[i].amount == 0) revert ZeroAmountSpecified();
    }

    /* STATE CHANGES */
    // Increment the chain stats for payablesCount
    chainStats.payablesCount++;

    // Increment payablesCount on the host (address) creating this payable.
    initializeUserIfNeedBe(msg.sender);
    users[msg.sender].payablesCount++;

    // Create the payable.
    payableId = createId(msg.sender, users[msg.sender].payablesCount);
    userPayableIds[msg.sender].push(payableId);
    payableAllowedTokensAndAmounts[payableId] = allowedTokensAndAmounts;
    Payable storage _payable = payables[payableId];
    _payable.chainCount = chainStats.payablesCount;
    _payable.host = msg.sender;
    _payable.hostCount = users[msg.sender].payablesCount;
    _payable.allowedTokensAndAmountsCount = uint8(
      allowedTokensAndAmounts.length
    );
    _payable.createdAt = block.timestamp;

    // Emit Event.
    emit CreatedPayable(
      payableId,
      msg.sender,
      _payable.chainCount,
      _payable.hostCount
    );
  }

  /// Stop a payable from accepting payments. Should be called only by the host
  /// (address) that owns the payable.
  /// @param payableId The ID of the payable to close.
  function closePayable(bytes32 payableId) public {
    Payable storage _payable = payables[payableId];
    if (_payable.host != msg.sender) revert NotYourPayable();
    if (_payable.isClosed) revert PayableIsAlreadyClosed();
    _payable.isClosed = true;
    emit ClosedPayable(payableId, msg.sender);
  }

  /// Allow a closed payable to continue accepting payments. Should be called
  /// only by the host (address) that owns the payable.
  /// @param payableId The ID of the payable to re-open.
  function reopenPayable(bytes32 payableId) public {
    Payable storage _payable = payables[payableId];
    if (_payable.host != msg.sender) revert NotYourPayable();
    if (!_payable.isClosed) revert PayableIsNotClosed();
    _payable.isClosed = false;
    emit ReopenedPayable(payableId, msg.sender);
  }

  /// Allows a payable's host to update the payable's allowedTokensAndAmounts.
  /// @param payableId The ID of the payable to update.
  /// @param allowedTokensAndAmounts The new tokens and amounts array.
  function updatePayableAllowedTokensAndAmounts(
    bytes32 payableId,
    TokenAndAmount[] calldata allowedTokensAndAmounts
  ) public {
    /* CHECKS */
    // Ensure that the caller owns the payable.
    Payable storage _payable = payables[payableId];
    if (_payable.host != msg.sender) revert NotYourPayable();

    // Ensure that the number of specified acceptable tokens (and their amounts)
    // for payments don't exceed the set maximum.
    if (allowedTokensAndAmounts.length > MAX_PAYABLES_TOKENS) {
      revert MaxPayableTokensCapacityReached();
    }

    for (uint8 i = 0; i < allowedTokensAndAmounts.length; i++) {
      // Ensure tokens are valid and are supported. Basically if a token's max
      // fees is not set, then it isn't supported
      address token = allowedTokensAndAmounts[i].token;
      if (token == address(0) || maxFeesPerToken[token] == 0) {
        revert InvalidTokenAddress();
      }
      // Ensure that the specified amount is greater than zero.
      if (allowedTokensAndAmounts[i].amount == 0) revert ZeroAmountSpecified();
    }

    /* STATE CHANGES */
    // Update the payable's allowedTokensAndAmounts
    payableAllowedTokensAndAmounts[payableId] = allowedTokensAndAmounts;
    _payable.allowedTokensAndAmountsCount = uint8(
      allowedTokensAndAmounts.length
    );

    // Emit Event.
    emit UpdatedPayableAllowedTokensAndAmounts(payableId, msg.sender);
  }

  /// Transfers the amount of tokens from a payer to a payable.
  /// @param payableId The ID of the payable to pay into.
  /// @param token The Wormhole-normalized address of the token been paid.
  /// @param amount The Wormhole-normalized (with 8 decimals) amount of the
  /// token.
  function pay(
    bytes32 payableId,
    address token,
    uint256 amount
  ) public payable nonReentrant returns (bytes32 paymentId) {
    /* CHECKS */
    // Ensure that the token is valid and is supported. Basically if a token's
    // max fees is not set, then it isn't supported.
    if (token == address(0) || maxFeesPerToken[token] == 0) {
      revert InvalidTokenAddress();
    }

    // Ensure that amount is greater than zero
    if (amount == 0) revert ZeroAmountSpecified();

    // Ensure that the payable exists and it is not closed
    Payable storage _payable = payables[payableId];
    if (_payable.host == address(0)) revert InvalidPayableId();
    if (_payable.isClosed) revert PayableIsClosed();

    // Ensure that the payable can still accept new tokens, if this
    // payable allows any token
    uint8 aTAALength = _payable.allowedTokensAndAmountsCount;
    if (aTAALength == 0 && _payable.balancesCount >= MAX_PAYABLES_TOKENS) {
      for (uint8 i = 0; i < aTAALength; i++) {
        if (payableAllowedTokensAndAmounts[payableId][i].token == token) break;
        if (i == aTAALength - 1) revert MaxPayableTokensCapacityReached();
      }
    }

    // Ensure that the specified token to be transferred is an allowed token
    // for this payable, if this payable doesn't allow any token outside those
    // it specified
    if (aTAALength > 0) {
      for (uint8 i = 0; i < aTAALength; i++) {
        if (
          payableAllowedTokensAndAmounts[payableId][i].token == token &&
          payableAllowedTokensAndAmounts[payableId][i].amount == amount
        ) break;
        if (i == aTAALength - 1) revert MatchingTokenAndAmountNotFound();
      }
    }

    /* TRANSFER */
    if (token == address(this)) {
      if (msg.value < amount) revert InsufficientPaymentValue();
      if (msg.value > amount) revert IncorrectPaymentValue();
    } else {
      if (!IERC20(token).transferFrom(msg.sender, address(this), amount)) {
        revert UnsuccessfulPayment();
      }
    }

    /* STATE CHANGES */
    // Increment the chainStats for paymentsCount.
    chainStats.paymentsCount++;

    // Increment paymentsCount in the payer that just paid.
    initializeUserIfNeedBe(msg.sender);
    users[msg.sender].paymentsCount++;

    // Increment global and local-chain paymentsCount on involved payable.
    _payable.paymentsCount++;
    payableChainPaymentsCount[payableId][chainId]++;

    // Update payable's balances to add this token and its amount.
    bool wasMatchingBalanceUpdated = false;
    for (uint8 i = 0; i < _payable.balancesCount; i++) {
      if (payableBalances[payableId][i].token == token) {
        payableBalances[payableId][i].amount += amount;
        wasMatchingBalanceUpdated = true;
        break;
      }
    }
    if (!wasMatchingBalanceUpdated) {
      payableBalances[payableId].push(TokenAndAmount(token, amount));
      _payable.balancesCount++;
    }

    // Record payment details of payable.
    paymentId = createId(msg.sender, users[msg.sender].paymentsCount);
    payablePaymentIds[payableId].push(paymentId);
    payableChainPaymentIds[payableId][chainId].push(paymentId);
    payablePaymentDetails[paymentId] = TokenAndAmount(token, amount);
    payablePayments[paymentId] = PayablePayment({
      payableId: payableId,
      payer: toWormholeFormat(msg.sender),
      payerChainId: chainId,
      localChainCount: payableChainPaymentsCount[payableId][chainId],
      payableCount: _payable.paymentsCount,
      payerCount: users[msg.sender].paymentsCount,
      timestamp: block.timestamp
    });

    // Record payment details of user.
    userPaymentIds[msg.sender].push(paymentId);
    userPaymentDetails[paymentId] = TokenAndAmount(token, amount);
    userPayments[paymentId] = UserPayment({
      payableId: payableId,
      payer: msg.sender,
      payableChainId: chainId,
      chainCount: chainStats.paymentsCount,
      payerCount: users[msg.sender].paymentsCount,
      payableCount: _payable.paymentsCount,
      timestamp: block.timestamp
    });

    // Emit Events.
    emit PayablePaid(
      payableId,
      toWormholeFormat(msg.sender),
      paymentId,
      chainId,
      payableChainPaymentsCount[payableId][chainId],
      _payable.paymentsCount
    );
    emit UserPaid(
      payableId,
      msg.sender,
      paymentId,
      chainId,
      chainStats.paymentsCount,
      users[msg.sender].paymentsCount
    );
  }

  /// Transfers the amount of tokens from a payable to the owner host.
  /// @param payableId The ID of the Payable to withdraw from.
  /// @param token The Wormhole-normalized address of the token been withdrawn.
  /// @param amount The Wormhole-normalized (with 8 decimals) amount of the
  /// token.
  function withdraw(
    bytes32 payableId,
    address token,
    uint256 amount
  ) public payable nonReentrant returns (bytes32 withdrawalId) {
    /* CHECKS */
    // Ensure that the payable exists and that the caller owns the payable.
    Payable storage _payable = payables[payableId];
    if (_payable.host == address(0)) revert InvalidPayableId();
    if (_payable.host != msg.sender) revert NotYourPayable();

    // Ensure that the amount to be withdrawn is not zero.
    if (amount == 0) revert ZeroAmountSpecified();

    // - Ensure that this payable has enough of the provided amount in its balance.
    // - Ensure that the specified token for withdrawal exists in the
    //   payable's balances.
    if (_payable.balancesCount == 0) revert NoBalanceForWithdrawalToken();
    for (uint8 i = 0; i < _payable.balancesCount; i++) {
      if (payableBalances[payableId][i].token == token) {
        if (payableBalances[payableId][i].amount < amount) {
          revert InsufficientWithdrawAmount();
        } else {
          break;
        }
      }
      if (i == _payable.balancesCount - 1) {
        revert NoBalanceForWithdrawalToken();
      }
    }

    /* TRANSFER */
    // Prepare withdraw amounts and fees
    uint256 percent = (amount * WITHDRAWAL_FEE_PERCENTAGE) / 100;
    uint256 maxFee = maxFeesPerToken[token];
    uint256 fee = percent > maxFee ? maxFee : percent;
    uint256 amtDue = amount - fee;

    // Transfer the amount minus fees to the owner.
    bool isSuccess = false;
    if (token == address(this)) {
      (isSuccess, ) = payable(msg.sender).call{value: amtDue}('');
    } else {
      isSuccess = IERC20(token).transfer(msg.sender, amtDue);
    }
    if (!isSuccess) revert UnsuccessfulWithdrawal();

    // Transfer the fees to the fees collector.
    if (token == address(this)) {
      (payable(feeCollector).call{value: fee}(''));
    } else {
      IERC20(token).transfer(feeCollector, fee);
    }

    /* STATE CHANGES */
    // Increment the chainStats for withdrawalsCount.
    chainStats.withdrawalsCount++;

    // Increment withdrawalsCount in the host that just withdrew.
    users[msg.sender].withdrawalsCount++;

    // Increment withdrawalsCount on involved payable.
    _payable.withdrawalsCount++;

    // Deduct the balances on the involved payable.
    for (uint8 i = 0; i < _payable.balancesCount; i++) {
      if (payableBalances[payableId][i].token == token) {
        payableBalances[payableId][i].amount -= amount;
        break;
      }
    }

    // Initialize the withdrawal.
    withdrawalId = createId(msg.sender, users[msg.sender].withdrawalsCount);
    userWithdrawalIds[msg.sender].push(withdrawalId);
    payableWithdrawalIds[payableId].push(withdrawalId);
    withdrawalDetails[withdrawalId] = TokenAndAmount(token, amount);
    withdrawals[withdrawalId] = Withdrawal({
      payableId: payableId,
      host: msg.sender,
      chainCount: chainStats.withdrawalsCount,
      hostCount: users[msg.sender].withdrawalsCount,
      payableCount: _payable.withdrawalsCount,
      timestamp: block.timestamp
    });

    // Emit Event.
    emit Withdrew(
      payableId,
      msg.sender,
      withdrawalId,
      chainStats.withdrawalsCount,
      users[msg.sender].withdrawalsCount,
      _payable.withdrawalsCount
    );
  }
}
