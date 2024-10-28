use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(allowed_tokens_and_amounts: Vec<TokenAndAmount>)]
/// Context used to create a Payable.
pub struct CreatePayable<'info> {
  #[account(
        init,
        seeds = [
            signer.key().as_ref(),
            Payable::SEED_PREFIX,
            &host.next_payable().to_le_bytes()[..],
        ],
        bump,
        payer = signer,
        space = Payable::space_new(allowed_tokens_and_amounts.len())
    )]
  /// The payable account to create. It houses details about the payable.
  pub payable: Box<Account<'info, Payable>>,

  #[account(
        init,
        seeds = [
            payable.key().as_ref(),
            &chain_stats.chain_id.to_le_bytes()[..],
        ],
        bump,
        payer = signer,
        space = PayablePerChainPaymentsCounter::SPACE
    )]
  /// The payable chain counter account to create. It houses the payments_count
  /// for the payable per chain.
  pub payable_per_chain_payments_counter:
    Box<Account<'info, PayablePerChainPaymentsCounter>>,

  #[account(mut, seeds = [signer.key().to_bytes().as_ref()], bump)]
  /// The user account of the signer that is creating the payable.
  pub host: Box<Account<'info, User>>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX], bump)]
  /// Keeps track of entities on this chain. Its payable_count will be
  /// incremented in this instruction.
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(mut)]
  /// The signer of the transaction.
  pub signer: Signer<'info>,

  /// The system program account.
  pub system_program: Program<'info, System>,
}
