use anchor_lang::prelude::error_code;

#[error_code]
pub enum ChainbillsError {
  #[msg("payable tokens capacity has exceeded")]
  MaxPayableTokensCapacityReached,

  #[msg("payable description maximum characters has exceeded")]
  MaxPayableDescriptionReached,

  #[msg("either allows_free_payments or specify tokens_and_amounts")]
  ImproperPayablesConfiguration,

  #[msg("payable amount must be greater than zero")]
  ZeroAmountSpecified,

  #[msg("payable is currently not accepting payments")]
  PayableIsClosed,

  #[msg("specified payment token and amount is not allowed on this payable")]
  MatchingTokenAndAccountNotFound,

  #[msg("withdraw amount should be less than or equal to balance")]
  InsufficientWithdrawAmount,

  #[msg("no balance found for withdrawal token")]
  NoBalanceForWithdrawalToken,

  #[msg("wrong program data account provided")]
  ProgramDataUnauthorized,

  #[msg("you are not an admin")]
  AdminUnauthorized,

  #[msg("please provide a valid description")]
  EmptyDescriptionProvided,

  #[msg("InvalidWormholeBridge")]
  /// Specified Wormhole bridge data PDA is wrong.
  InvalidWormholeBridge,

  #[msg("InvalidWormholeFeeCollector")]
  /// Specified Wormhole fee collector PDA is wrong.
  InvalidWormholeFeeCollector,

  #[msg("InvalidWormholeEmitter")]
  /// Specified program's emitter PDA is wrong.
  InvalidWormholeEmitter,

  #[msg("InvalidWormholeSequence")]
  /// Specified emitter's sequence PDA is wrong.
  InvalidWormholeSequence,

  #[msg("OwnerOnly")]
  /// Only the program's owner is permitted.
  OwnerOnly,

  #[msg("InvalidForeignContract")]
  /// Specified foreign contract has a bad chain ID or zero address.
  InvalidForeignContract,

  #[msg("InvalidPayloadMessage")]
  /// Deserialized payload message has unexpected payload type.
  InvalidPayloadMessage,

  #[msg("InvalidActionId")]
  /// Provided actionId in vaa.data() doesn't match what called method
  /// expected.
  InvalidActionId,

  #[msg("InvalidCallerAddress")]
  /// Caller address was address zero
  InvalidCallerAddress,

  #[msg("UnauthorizedCallerAddress")]
  /// Caller didn't match in the decoded vaa or caller wasn't the owner_wallet
  /// of the host or payer
  UnauthorizedCallerAddress,

  #[msg("WrongPayablesHostCountProvided")]
  /// provided host_count is not host.next_payable()
  WrongPayablesHostCountProvided,

  #[msg("WrongPaymentPayerCountProvided")]
  /// provided payer_count is not payer.next_payment()
  WrongPaymentPayerCountProvided,

  #[msg("WrongWithdrawalsHostCountProvided")]
  /// provided host_count is not host.next_withdrawal()
  WrongWithdrawalsHostCountProvided,

  #[msg("ZeroBridgeAmount")]
  /// Nothing to transfer if amount is zero.
  ZeroBridgeAmount,

  #[msg("InvalidTokenBridgeConfig")]
  /// Specified Token Bridge config PDA is wrong.
  InvalidTokenBridgeConfig,

  #[msg("InvalidTokenBridgeAuthoritySigner")]
  /// Specified Token Bridge authority signer PDA is wrong.
  InvalidTokenBridgeAuthoritySigner,

  #[msg("InvalidTokenBridgeCustodySigner")]
  /// Specified Token Bridge custody signer PDA is wrong.
  InvalidTokenBridgeCustodySigner,

  #[msg("InvalidTokenBridgeSender")]
  /// Specified Token Bridge sender PDA is wrong.
  InvalidTokenBridgeSender,

  #[msg("InvalidRecipient")]
  /// Specified recipient has a bad chain ID or zero address.
  InvalidRecipient,

  #[msg("InvalidTransferTokenAccount")]
  /// Deserialized token account from Token Bridge's Wormhole message does
  /// not match token account.
  InvalidTransferTokenAccount,

  #[msg("InvalidTransferTokenChain")]
  /// Deserialized token chain is invalid.
  InvalidTransferToChain,

  #[msg("InvalidTransferTokenChain")]
  /// Deserialized recipient chain is invalid.
  InvalidTransferTokenChain,

  #[msg("InvalidTransferToAddress")]
  /// Deserialized recipient must be this program or the redeemer PDA.
  InvalidTransferToAddress,

  #[msg("AlreadyRedeemed")]
  /// Token Bridge program's transfer is already redeemed.
  AlreadyRedeemed,

  #[msg("InvalidTokenBridgeForeignEndpoint")]
  /// Token Bridge program's foreign endpoint disagrees with registered one.
  InvalidTokenBridgeForeignEndpoint,

  #[msg("InvalidTokenBridgeMintAuthority")]
  /// Specified Token Bridge mint authority PDA is wrong.
  InvalidTokenBridgeMintAuthority,

  #[msg("NotMatchingPayableId")]
  /// Specified payableId in input doesn't match payable account.
  NotMatchingPayableId,

  #[msg("NotMatchingTransactionAmount")]
  /// Specified transaction amount in input doesn't match what is been used.
  NotMatchingTransactionAmount,

  #[msg("NotMatchingTransactionToken")]
  /// Specified transaction token in input doesn't match what is been used.
  NotMatchingTransactionToken,
}
