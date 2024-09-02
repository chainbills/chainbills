use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::{
  associated_token::AssociatedToken,
  token::{Mint, Token, TokenAccount},
};


#[derive(Accounts)]
#[instruction(token: Pubkey)]
/// Context used to update the max withdrawal fee. Houses required accounts for
/// updating the max withdrawal fee.
pub struct UpdateMaxWithdrawalFee<'info> {
  #[account(init_if_needed, payer = owner, seeds = [MaxFeeDetails::SEED_PREFIX, &token.key().as_ref()], bump, space = MaxFeeDetails::SPACE)]
  /// Account that stores the max withdrawal fee details.
  pub max_withdrawal_fee_details: Box<Account<'info, MaxFeeDetails>>,

  #[account(
        init_if_needed,
        associated_token::mint = mint,
        associated_token::authority = chain_stats,
        payer = owner,
    )]
  /// Initialize the chain token account for storing payments of the token mint
  /// if it doesn't exist.
  pub chain_token_account: Box<Account<'info, TokenAccount>>,

  /// Chainbills' fee collector account. Not verifying it is correct
  /// in the constraints inorder to bypass the stack offset error. However, the
  /// check is carried out inside the instruction.
  pub fee_collector: SystemAccount<'info>,

  #[account(
        init_if_needed,
        associated_token::mint = mint,
        associated_token::authority = fee_collector,
        payer = owner,
    )]
  /// Initialize the fees token account for storing payments of the token mint
  /// if it doesn't exist.
  pub fees_token_account: Box<Account<'info, TokenAccount>>,

  #[account(seeds = [Config::SEED_PREFIX], bump)]
  /// Config Account that stores important constant addresses that are used 
  /// across program instructions.
  pub config: AccountLoader<'info, Config>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX], bump)]
  /// Keeps track of entities on this chain. Would be used for initializing
  /// the chain_token_account for the token whose max_withdrawl_fee is being
  /// set/updated.
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(constraint = mint.key() == token)]
  /// The token mint whose max withdrawal fee is being set/updated.
  pub mint: Box<Account<'info, Mint>>,

  #[account(mut)]
  /// Signer for this instruction. Should be the account that holds
  /// the upgrade authority of this program. Not verifying its owner status
  /// in the constraints inorder to bypass the stack offset error. However, the
  /// check is carried out inside the instruction.
  pub owner: Signer<'info>,

  /// Associated Token Program.
  pub associated_token_program: Program<'info, AssociatedToken>,

  /// Token Program.
  pub token_program: Program<'info, Token>,

  /// System Program.
  pub system_program: Program<'info, System>,
}
