// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

/// Emitted for the first time a given address interacts with this contract.
event InitializedUser(address indexed user, uint256 chainCount);

/// Emitted when a {Payable} with `payableId` is created by `host` address.
event CreatedPayable(
  bytes32 indexed payableId,
  address indexed host,
  uint256 chainCount,
  uint256 hostCount
);

/// Emitted when a `host` closes their {Payable} with `payableId`.
event ClosedPayable(bytes32 indexed payableId, address indexed host);

/// Emitted when a `host` re-opens their {Payable} with `payableId`.
event ReopenedPayable(bytes32 indexed payableId, address indexed host);

/// Emitted when a `host` updates the allowedTokensAndAmounts on their
/// {Payable} with `payableId`.
event UpdatedPayableAllowedTokensAndAmounts(
  bytes32 indexed payableId,
  address indexed host
);

/// Emitted when a {Payable} with `payableId` records a new payment by
/// `payer`.
event PayablePaid(
  bytes32 indexed payableId,
  bytes32 indexed payer,
  bytes32 indexed paymentId,
  uint16 payerChainId,
  uint256 chainCount,
  uint256 payableCount
);

/// Emitted when a `payer` pays a {Payable} with `payableId`.
event UserPaid(
  bytes32 indexed payableId,
  address indexed payer,
  bytes32 indexed paymentId,
  uint16 payableChainId,
  uint256 chainCount,
  uint256 payerCount
);

/// Emitted when a `host` makes a {Withdrawal} from a {Payable} with
/// `payableId`.
event Withdrew(
  bytes32 indexed payableId,
  address indexed host,
  bytes32 withdrawalId,
  uint256 chainCount,
  uint256 payableCount,
  uint256 hostCount
);

/// Emitted when owner (deployer) registers/updates an emitter contract.
event RegisteredForeignContract(uint16 chainId, bytes32 emitterAddress);

/// Emitted when owner (deployer) updates the `maxFee` of `token`.
event UpdatedMaxWithdrawalFee(address token, uint256 maxFee);

/// Emitted when owner (deployer) withdraws `amount`s of `token`.
event OwnerWithdrew(address token, uint256 amount);
