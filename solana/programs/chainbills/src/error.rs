use anchor_lang::prelude::*;

#[error_code]
pub enum ChainbillsError {
    #[msg("payable tokens capacity has exceeded")]
    MaxPayableTokensCapacityReached,

    #[msg("payable description maximum characters has exceeded")]
    MaxPayableDescriptionReached,

    #[msg("either accept allows_any_token or specify tokens_and_amounts or both")]
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
}
