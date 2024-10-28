// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

/// Emitted for the first time a given address interacts with this contract.
event InitializedUser(address indexed wallet, uint256 chainCount);

/// Emitted when a {Payable} with `payableId` is created by `hostWallet` address.
event CreatedPayable(
  bytes32 indexed payableId,
  address indexed hostWallet,
  uint256 chainCount,
  uint256 hostCount
);

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
event PayablePaid(
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
event UpdatedPayableAllowedTokensAndAmounts(
  bytes32 indexed payableId, address indexed hostWallet
);

/// Emitted when owner (deployer) updates the `maxWithdrawalFees` of `token`.
event UpdatedMaxWithdrawalFees(address token, uint256 maxWithdrawalFees);

/// Emitted when owner (deployer) withdraws `amount`s of `token`.
event OwnerWithdrew(address token, uint256 amount);

/// Emitted when owner (deployer) registers/updates an emitter contract.
event RegisteredForeignContract(uint16 chainId, bytes32 emitterAddress);
