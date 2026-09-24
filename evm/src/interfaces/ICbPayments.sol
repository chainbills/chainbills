// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Same-chain and cross-chain payments.
interface ICbPayments {
  /// Pays a payable hosted on this chain.
  /// @param payableId Payable ID.
  /// @param token Token address, or the diamond address for the native token.
  /// @param amount Price of the payment, matched against the payable's allowed tokens and amounts.
  /// @param maxAmountIn Most the diamond may pull from the payer; above `amount` only for tokens that allow transfer
  /// taxes. The payable is credited with everything that arrives, which must be at least `amount`.
  /// @return userPaymentId ID of the payer's receipt.
  /// @return payablePaymentId ID of the payable's receipt.
  /// @dev For the native token `msg.value`, `maxAmountIn`, and `amount` must all be equal. For ERC-20 tokens
  /// `msg.value` must be zero.
  function pay(bytes32 payableId, address token, uint256 amount, uint256 maxAmountIn)
    external
    payable
    returns (bytes32 userPaymentId, bytes32 payablePaymentId);

  /// Pays a payable hosted on a foreign chain by burning `amount + maxFee` through CCTP V2 with the payment payload as
  /// hook data.
  /// @param payableId Foreign payable ID.
  /// @param token Local CCTP token whose match on the payable's chain is accepted by the payable.
  /// @param amount Price of the payment.
  /// @param maxFee Largest fee Circle may take; pulled from the payer on top of `amount`.
  /// @return userPaymentId ID of the payer's receipt.
  function payForeignViaCctp(bytes32 payableId, address token, uint256 amount, uint256 maxFee)
    external
    returns (bytes32 userPaymentId);

  /// Mints a CCTP burn sent to this chain and credits the payment payload in its hook data to the payable.
  /// @param burnMessage CCTP V2 burn message.
  /// @param attestation Circle attestation.
  /// @return payablePaymentId ID of the payable's receipt.
  /// @dev Requires `RELAYER_ROLE` while relaying is restricted.
  function receiveForeignPaymentViaCctp(bytes calldata burnMessage, bytes calldata attestation)
    external
    returns (bytes32 payablePaymentId);
}
