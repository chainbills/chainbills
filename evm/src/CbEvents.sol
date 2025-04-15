// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import './CbErrors.sol';

/// Stores all emitted events in Chainbills
contract CbEvents is CbErrors {
  /// Emitted for the first time a given address interacts with this contract.
  event InitializedUser(address indexed wallet, uint256 chainCount);

  /// Emitted when a {Payable} with `payableId` is created by `hostWallet` address.
  event CreatedPayable(bytes32 indexed payableId, address indexed hostWallet, uint256 chainCount, uint256 hostCount);

  /// Emitted when a `payerWallet` pays a {Payable} with `payableId`.
  event UserPaid(
    bytes32 indexed payableId,
    address indexed payerWallet,
    bytes32 indexed paymentId,
    uint16 payableChainId,
    uint256 chainCount,
    uint256 payerCount
  );

  /// Emitted when a {Payable} with `payableId` records a new payment by
  /// `payerWallet`.
  event PayableReceived(
    bytes32 indexed payableId,
    bytes32 indexed payerWallet,
    bytes32 indexed paymentId,
    uint16 payerChainId,
    uint256 chainCount,
    uint256 payableCount
  );

  /// Emitted when a `hostWallet` makes a {Withdrawal} from a {Payable} with
  /// `payableId`.
  event Withdrew(
    bytes32 indexed payableId,
    address indexed hostWallet,
    bytes32 indexed withdrawalId,
    uint256 chainCount,
    uint256 hostCount,
    uint256 payableCount
  );

  /// Emitted when a `hostWallet` closes their {Payable} with `payableId`.
  event ClosedPayable(bytes32 indexed payableId, address indexed hostWallet);

  /// Emitted when a `hostWallet` re-opens their {Payable} with `payableId`.
  event ReopenedPayable(bytes32 indexed payableId, address indexed hostWallet);

  /// Emitted when a `hostWallet` updates the allowedTokensAndAmounts on their
  /// {Payable} with `payableId`.
  event UpdatedPayableAllowedTokensAndAmounts(bytes32 indexed payableId, address indexed hostWallet);

  /// Emitted when a `hostWallet` updates the `isAutoWithdraw` status on their
  /// {Payable} with `payableId`.
  event UpdatedPayableAutoWithdrawStatus(bytes32 indexed payableId, address indexed hostWallet, bool isAutoWithdraw);

  /// Emitted when a Wormhole Message is consumed for payable update.
  event ConsumedWormholePayableMessage(bytes32 indexed payableId, uint16 indexed chainId, bytes32 indexed vaaHash);

  /// Emitted when a Wormhole Message is consumed for receiving payments.
  event ConsumedWormholePaymentMessage(bytes32 indexed payableId, uint16 indexed chainId, bytes32 indexed vaaHash);

  /// Emitted when owner (deployer) updates the `maxWithdrawalFees` of `token`.
  event UpdatedMaxWithdrawalFees(address token, uint256 maxWithdrawalFees);

  /// Emitted when owner (deployer) withdraws `amount`s of `token`.
  event OwnerWithdrew(address token, uint256 amount);

  /// Emitted when owner (deployer) registers/updates an emitter contract.
  event RegisteredForeignContract(uint16 chainId, bytes32 emitterAddress);

  /// Emitted when owner (deployer) registers/updates a foreign token.
  event RegisteredMatchingTokenForForeignChain(uint16 chainId, bytes32 foreignToken, address token);

  /// Emitted when owner (deployer) registers/updates a Circle Domain to Wormhole
  /// Chain ID.
  event RegisteredCircleDomainToWormholeChainId(uint32 circleDomain, uint16 chainId);

  /// Emitted when owner (deployer) updates the `payablesLogicContract` address.
  event SetPayablesLogic(address payablesLogicContract);

  /// Emitted when owner (deployer) updates the `transactionsLogicContract` address.
  event SetTransactionsLogic(address transactionsLogicContract);

  /// Emitted when owner (deployer) marks a `token` as supported for payments.
  event AllowedPaymentsForToken(address token);

  /// Emitted when owner (deployer) stops payments from happening in the given `token`.
  event StoppedPaymentsForToken(address token);

  /// Emitted when owner (deployer) sets the percentage for withdrawal fees
  event SetWithdrawalFeePercentage(uint16 feePercent);

  /// Emitted when owner (deployer) sets the fee collector address
  event SetFeeCollectorAddress(address feeCollector);

  /// Emitted when owner (deployer) sets Wormhole and Circle related config
  event SetupWormholeAndCircle();
}
