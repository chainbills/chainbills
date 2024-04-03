use anchor_lang::prelude::*;

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
}
