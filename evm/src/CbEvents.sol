// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CbErrors} from './CbErrors.sol';

/// Stores all emitted events in Chainbills
contract CbEvents is CbErrors {
  /// Emitted for the first time a given address interacts with this contract.
  /// @param wallet The address of the user's wallet.
  /// @param chainCount The cumulative count of users on the chain.
  event InitializedUser(address indexed wallet, uint256 chainCount);

  /// Emitted when a {Payable} with `payableId` is created by `hostWallet` address.
  /// @param payableId The unique identifier of the created payable.
  /// @param hostWallet The address that created and owns the payable.
  /// @param chainCount The cumulative count of payables on the chain.
  /// @param hostCount The cumulative count of payables created by this host.
  event CreatedPayable(bytes32 indexed payableId, address indexed hostWallet, uint256 chainCount, uint256 hostCount);

  /// Emitted when a `payerWallet` pays a {Payable} with `payableId`.
  /// @param payableId The ID of the payable that was paid.
  /// @param payerWallet The address of the user who made the payment.
  /// @param paymentId The unique identifier of the payment.
  /// @param payableChainId The CAIP-2 chain ID of the payable's home chain.
  /// @param chainCount The cumulative count of payments on the chain.
  /// @param payerCount The cumulative count of payments made by this payer.
  event UserPaid(
    bytes32 indexed payableId,
    address indexed payerWallet,
    bytes32 indexed paymentId,
    bytes32 payableChainId,
    uint256 chainCount,
    uint256 payerCount
  );

  /// Emitted when a {Payable} with `payableId` records a new payment by
  /// `payerWallet`.
  /// @param payableId The ID of the payable receiving the payment.
  /// @param payerWallet The Wormhole-normalized address of the payer.
  /// @param paymentId The unique identifier of the payment.
  /// @param payerChainId The CAIP-2 chain ID of the payer's home chain.
  /// @param chainCount The cumulative count of payable payments on the chain.
  /// @param payableCount The cumulative count of payments received by this payable.
  event PayableReceived(
    bytes32 indexed payableId,
    bytes32 indexed payerWallet,
    bytes32 indexed paymentId,
    bytes32 payerChainId,
    uint256 chainCount,
    uint256 payableCount
  );

  /// Emitted when a `hostWallet` makes a {Withdrawal} from a {Payable} with
  /// `payableId`.
  /// @param payableId The ID of the payable being withdrawn from.
  /// @param hostWallet The address of the host performing the withdrawal.
  /// @param withdrawalId The unique identifier of the withdrawal.
  /// @param chainCount The cumulative count of withdrawals on the chain.
  /// @param hostCount The cumulative count of withdrawals by this host.
  /// @param payableCount The cumulative count of withdrawals from this payable.
  event Withdrew(
    bytes32 indexed payableId,
    address indexed hostWallet,
    bytes32 indexed withdrawalId,
    uint256 chainCount,
    uint256 hostCount,
    uint256 payableCount
  );

  /// Emitted when a `hostWallet` closes their {Payable} with `payableId`.
  /// @param payableId The ID of the closed payable.
  /// @param hostWallet The address of the host who closed it.
  event ClosedPayable(bytes32 indexed payableId, address indexed hostWallet);

  /// Emitted when a `hostWallet` re-opens their {Payable} with `payableId`.
  /// @param payableId The ID of the reopened payable.
  /// @param hostWallet The address of the host who reopened it.
  event ReopenedPayable(bytes32 indexed payableId, address indexed hostWallet);

  /// Emitted when a `hostWallet` updates the allowedTokensAndAmounts on their
  /// {Payable} with `payableId`.
  /// @param payableId The ID of the updated payable.
  /// @param hostWallet The address of the host who updated it.
  event UpdatedPayableAllowedTokensAndAmounts(bytes32 indexed payableId, address indexed hostWallet);

  /// Emitted when a `hostWallet` updates the `isAutoWithdraw` status on their
  /// {Payable} with `payableId`.
  /// @param payableId The ID of the updated payable.
  /// @param hostWallet The address of the host who updated it.
  /// @param isAutoWithdraw The new auto-withdraw status.
  event UpdatedPayableAutoWithdrawStatus(bytes32 indexed payableId, address indexed hostWallet, bool isAutoWithdraw);

  /// Emitted when a Wormhole Message is consumed for payable update.
  /// @param payableId The ID of the payable that was updated.
  /// @param cbChainId The CAIP-2 chain ID of the source chain.
  /// @param vaaHash The hash of the consumed Wormhole VAA.
  event ConsumedWormholePayableMessage(bytes32 indexed payableId, bytes32 indexed cbChainId, bytes32 indexed vaaHash);

  /// Emitted when a Wormhole Message is consumed for receiving payments.
  /// @param payableId The ID of the payable that received the payment.
  /// @param cbChainId The CAIP-2 chain ID of the source chain.
  /// @param vaaHash The hash of the consumed Wormhole VAA.
  event ConsumedWormholePaymentMessage(bytes32 indexed payableId, bytes32 indexed cbChainId, bytes32 indexed vaaHash);

  /// Emitted when owner (deployer) updates the `maxWithdrawalFees` of `token`.
  /// @param token The address of the token whose max fees were updated.
  /// @param maxWithdrawalFees The new max withdrawal fees amount.
  event UpdatedMaxWithdrawalFees(address token, uint256 maxWithdrawalFees);

  /// Emitted when owner (deployer) withdraws `amount`s of `token`.
  /// @param token The token address withdrawn.
  /// @param amount The amount withdrawn.
  event OwnerWithdrew(address token, uint256 amount);

  /// Emitted when owner (deployer) registers/updates an emitter contract.
  /// @param cbChainId The CAIP-2 chain ID of the registered contract.
  /// @param emitterAddress The Wormhole-normalized address of the contract.
  event RegisteredForeignContract(bytes32 cbChainId, bytes32 emitterAddress);

  /// Emitted when owner (deployer) registers/updates a foreign token.
  /// @param cbChainId The CAIP-2 chain ID for the foreign token.
  /// @param foreignToken The Wormhole-normalized address of the foreign token.
  /// @param token The local address of the corresponding token.
  event RegisteredMatchingTokenForForeignChain(bytes32 cbChainId, bytes32 foreignToken, address token);

  /// Emitted when owner removes a matching token mapping for a foreign token.
  /// @param cbChainId The CAIP-2 chain ID for the removed mapping.
  /// @param foreignToken The Wormhole-normalized address of the foreign token.
  event UnregisteredMatchingTokenForForeignChain(bytes32 cbChainId, bytes32 foreignToken);

  /// Emitted when owner registers the Circle Domain for a foreign chain.
  /// @param cbChainId The CAIP-2 chain ID.
  /// @param circleDomain The corresponding Circle domain.
  event RegisteredChainCircleDomain(bytes32 indexed cbChainId, uint32 circleDomain);

  /// Emitted when owner registers the Wormhole Chain ID for a foreign chain.
  /// @param cbChainId The CAIP-2 chain ID.
  /// @param wormholeChainId The corresponding Wormhole chain ID.
  event RegisteredChainWormholeId(bytes32 indexed cbChainId, uint16 wormholeChainId);

  /// Emitted when owner (deployer) updates the `payablesLogicContract` address.
  /// @param payablesLogicContract The new address of the payables logic contract.
  event SetPayablesLogic(address payablesLogicContract);

  /// Emitted when owner (deployer) updates the `transactionsLogicContract` address.
  /// @param transactionsLogicContract The new address of the transactions logic contract.
  event SetTransactionsLogic(address transactionsLogicContract);

  /// Emitted when owner (deployer) marks a `token` as supported for payments.
  /// @param token The address of the newly supported token.
  event AllowedPaymentsForToken(address token);

  /// Emitted when owner (deployer) stops payments from happening in the given `token`.
  /// @param token The address of the token that was stopped.
  event StoppedPaymentsForToken(address token);

  /// Emitted when owner (deployer) sets the percentage for withdrawal fees
  /// @param feePercent The new percentage for withdrawal fees.
  event SetWithdrawalFeePercentage(uint16 feePercent);

  /// Emitted when owner (deployer) sets the fee collector address
  /// @param feeCollector The new fee collector address.
  event SetFeeCollectorAddress(address feeCollector);

  /// Emitted when owner (deployer) sets Wormhole and Circle related config
  event SetupWormholeAndCircle();

  /// Emitted when owner sets up Circle CCTP only (no Wormhole) on this chain
  event SetupCCTPOnly();

  /// Emitted when a payable update is broadcast to foreign chains via all available protocols
  /// @param payableId The ID of the payable that was updated.
  /// @param nonce The cross-protocol update deduplication nonce.
  /// @param actionType The type of action performed (e.g., create, close).
  event PayableUpdateBroadcasted(bytes32 indexed payableId, uint64 nonce, uint8 actionType);

  /// Emitted when a payable update is received and applied via Wormhole
  /// @param payableId The ID of the payable that was updated.
  /// @param cbChainId The CAIP-2 chain ID from which the update originated.
  /// @param nonce The cross-protocol update deduplication nonce.
  event ReceivedPayableUpdateViaWormhole(bytes32 indexed payableId, bytes32 indexed cbChainId, uint64 nonce);

  /// Emitted when a payable update is received and applied via Circle CCTP
  /// @param payableId The ID of the payable that was updated.
  /// @param cbChainId The CAIP-2 chain ID from which the update originated.
  /// @param nonce The cross-protocol update deduplication nonce.
  event ReceivedPayableUpdateViaCircle(bytes32 indexed payableId, bytes32 indexed cbChainId, uint64 nonce);

  /// Emitted when a payable update is synced by admin (for chains without a common protocol)
  /// @param payableId The ID of the payable that was synced.
  /// @param cbChainId The CAIP-2 chain ID from which the update originated.
  /// @param nonce The cross-protocol update deduplication nonce.
  event ReceivedPayableUpdateViaAdminSync(bytes32 indexed payableId, bytes32 indexed cbChainId, uint64 nonce, address indexed syncedBy);

  /// Emitted when owner configures the data messaging protocol for a foreign chain
  /// @param cbChainId The CAIP-2 chain ID of the foreign chain.
  /// @param protocol The DataMessagingProtocol identifier.
  event SetChainDataMessagingProtocol(bytes32 indexed cbChainId, uint8 protocol);
}
