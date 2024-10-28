use crate::{
  error::ChainbillsError,
  state::{Payable, TokenAndAmount, User},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdatePayable<'info> {
  #[account(mut, constraint = payable.host == *signer.key @ ChainbillsError::NotYourPayable)]
  pub payable: Box<Account<'info, Payable>>,

  #[account(seeds = [signer.key().as_ref()], bump)]
  pub host: Box<Account<'info, User>>,

  #[account(mut)]
  pub signer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(allowed_tokens_and_amounts: Vec<TokenAndAmount>)]
pub struct UpdatePayableAllowedTokensAndAmounts<'info> {
  // Allowing realloc::zero to be true if in case the allowed tokens and 
  // amounts vec's len is lower than the previous one. This will allow the
  // program to refresh zeroing out discarded space as needed.
  #[account(mut, constraint = payable.host == *signer.key @ ChainbillsError::NotYourPayable, realloc = payable.space_update_ataa(allowed_tokens_and_amounts.len()), realloc::payer = signer, realloc::zero = true)]
  pub payable: Box<Account<'info, Payable>>,

  #[account(seeds = [signer.key().as_ref()], bump)]
  pub host: Box<Account<'info, User>>,

  #[account(mut)]
  pub signer: Signer<'info>,

  pub system_program: Program<'info, System>,
}
