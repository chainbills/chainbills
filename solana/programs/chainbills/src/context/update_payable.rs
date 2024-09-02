use crate::{error::ChainbillsError, state::{Payable, User}};
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
