//! `pay_foreign_via_cctp` — cross-chain outbound payment: Solana → EVM.
//!
//! Burns USDC via Circle CCTP + publishes `PaymentPayload` via Wormhole shim
//! (if dest chain supports Wormhole) or via CCTP `sendMessage` (CCTP-only
//! dest). Mirrors EVM `payForeignViaCctp`: after CCTP burn, dispatches payload
//! message through Wormhole if `config.has_wormhole &&
//! chain_registry.has_wormhole`, else CCTP.
//!
//! ## `remaining_accounts` layout (Option B — active path only)
//!
//! The path (Wormhole or CCTP-only) is determined by
//! `config.has_wormhole && chain_registry.has_wormhole`. Pass only the
//! accounts for the active path; the other set is ignored.
//!
//! ### Wormhole path (16 accounts)
//! ```text
//! [0..7]   deposit_for_burn accounts (burn USDC — see cpi::cctp module)
//! [8..15]  post_message accounts (Wormhole shim — see cpi::wormhole module)
//! ```
//!
//! ### CCTP-only path (10 accounts)
//! ```text
//! [0..7]   deposit_for_burn accounts (burn USDC)
//! [8]      message_sent_event_data_payload — new Keypair (signer)
//! [9]      sender_program — Chainbills program ID (executable, read-only)
//! ```
//! For send_message: mt_state reused from [0], mt_program reused from [6].

use anchor_lang::prelude::*;
use anchor_spl::{
  associated_token::AssociatedToken,
  token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
  },
};

use crate::{
  constants::*,
  errors::ChainbillsError,
  events::{UserInitialized, UserPaid},
  payload::encode::{encode_payment_payload, PaymentPayload},
  state::{
    ActivityRecord, ActivityType, ChainRegistry, Config, ForeignPayable,
    SenderAuthority, Stats, UserActivityPointer, UserPayment, UserRecord,
  },
  utils::{get_current_timestamp, normalize_pubkey},
};

/// Accounts for the `pay_foreign_via_cctp` instruction.
#[derive(Accounts)]
#[instruction(foreign_payable_id: [u8; 32], dest_cb_chain_id: [u8; 32])]
pub struct PayForeignViaCctp<'info> {
  /// The payer making the cross-chain payment. Must sign. Pays for new PDAs.
  #[account(mut)]
  pub payer: Signer<'info>,

  /// UserRecord for the payer. Created on first interaction.
  #[account(
        init_if_needed,
        payer = payer,
        space = UserRecord::SPACE,
        seeds = [UserRecord::SEED_PREFIX, payer.key().as_ref()],
        bump,
    )]
  pub user_record: Box<Account<'info, UserRecord>>,

  /// The foreign payable to pay into. Must exist and not be closed.
  #[account(
        seeds = [ForeignPayable::SEED_PREFIX, &foreign_payable_id],
        bump,
        constraint = !foreign_payable.is_closed @ ChainbillsError::ForeignPayableClosed,
    )]
  pub foreign_payable: Box<Account<'info, ForeignPayable>>,

  /// Config — provides cb_chain_id (payer chain) and has_wormhole/has_cctp
  /// flags.
  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: Box<Account<'info, Config>>,

  /// Stats — counters incremented here.
  #[account(mut, seeds = [Stats::SEED_PREFIX], bump)]
  pub stats: Box<Account<'info, Stats>>,

  /// Destination chain registry — validates has_cctp and provides
  /// circle_domain.
  #[account(
        seeds = [ChainRegistry::SEED_PREFIX, &dest_cb_chain_id],
        bump,
        constraint = chain_registry.has_cctp @ ChainbillsError::ChainHasNoProtocol,
    )]
  pub chain_registry: Box<Account<'info, ChainRegistry>>,

  /// USDC mint — the only token supported for cross-chain payments via CCTP.
  pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,

  /// Payer's USDC ATA.
  #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = payer,
        associated_token::token_program = token_program,
    )]
  pub payer_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

  /// SenderAuthority PDA — keyless signer that owns program_usdc_ata.
  /// Authorizes the CCTP deposit_for_burn CPI.
  #[account(seeds = [SenderAuthority::SEED_PREFIX], bump)]
  pub sender_authority: Box<Account<'info, SenderAuthority>>,

  /// Intermediate program ATA — holds USDC transiently before CCTP burn.
  /// Authority: sender_authority PDA (signs the burn CPI).
  #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = usdc_mint,
        associated_token::authority = sender_authority,
        associated_token::token_program = token_program,
    )]
  pub program_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

  /// UserPayment receipt PDA for the payer.
  #[account(
        init,
        payer = payer,
        space = UserPayment::SPACE,
        seeds = [UserPayment::SEED_PREFIX, payer.key().as_ref(), &user_record.payments_count.to_le_bytes()],
        bump,
    )]
  pub user_payment: Box<Account<'info, UserPayment>>,

  /// ActivityRecord PDA for this payment event.
  #[account(
        init, payer = payer, space = ActivityRecord::SPACE,
        seeds = [
            ActivityRecord::SEED_PREFIX,
            ActivityRecord::GLOBAL_PREFIX,
            &stats.total_activities.to_le_bytes(),
        ],
        bump,
    )]
  pub activity_record: Box<Account<'info, ActivityRecord>>,

  /// User-scoped activity pointer — links this activity to the payer's history.
  #[account(
        init, payer = payer, space = UserActivityPointer::SPACE,
        seeds = [
            UserActivityPointer::SEED_PREFIX,
            UserActivityPointer::USER_PREFIX,
            payer.key().as_ref(),
            &user_record.activities_count.to_le_bytes(),
        ],
        bump,
    )]
  pub user_activity_pointer: Box<Account<'info, UserActivityPointer>>,

  pub token_program: Interface<'info, TokenInterface>,
  pub associated_token_program: Program<'info, AssociatedToken>,
  pub system_program: Program<'info, System>,
  // remaining_accounts: CCTP TokenMessengerMinter + Wormhole shim accounts
}

/// Handler for `pay_foreign_via_cctp`.
///
/// # Arguments
/// * `foreign_payable_id` — target payable ID on the foreign chain (32 bytes)
/// * `dest_cb_chain_id`   — cbChainId of the destination chain
/// * `amount`             — USDC amount to pay (base units, before fee)
/// * `max_fee`            — maximum CCTP fast-finality fee the payer accepts
pub fn process_pay_foreign_via_cctp<'info>(
  ctx: Context<'_, '_, '_, 'info, PayForeignViaCctp<'info>>,
  foreign_payable_id: [u8; 32],
  dest_cb_chain_id: [u8; 32],
  amount: u64,
  max_fee: u64,
) -> Result<()> {
  require!(amount > 0, ChainbillsError::ZeroAmount);

  amount
    .checked_add(max_fee)
    .ok_or(ChainbillsError::MathOverflow)?;

  let now = get_current_timestamp()?;
  let payer_key = ctx.accounts.payer.key();
  let sol_cb_chain_id = ctx.accounts.config.cb_chain_id;
  let global_idx = ctx.accounts.stats.total_activities;

  // ── ATAA validation ───────────────────────────────────────────────────────
  let fp = &ctx.accounts.foreign_payable;
  if !fp.allowed_tokens_and_amounts.is_empty() {
    let usdc_normalized = normalize_pubkey(&ctx.accounts.usdc_mint.key());
    require!(
      fp.is_token_amount_allowed(usdc_normalized, amount),
      ChainbillsError::TokenAmountMismatch
    );
  }

  // ── Build PaymentPayload ──────────────────────────────────────────────────
  let user_record = &ctx.accounts.user_record;
  let is_new_user = user_record.wallet == Pubkey::default();
  let payer_count = if is_new_user { 0u64 } else { user_record.payments_count };

  let user_payment_key = ctx.accounts.user_payment.key();

  let encoded_payload = encode_payment_payload(&PaymentPayload {
    action_type: ACTION_PAYMENT,
    payable_id: foreign_payable_id,
    nonce: payer_count,
    initiated_at: now,
    amount,
    payable_chain_token: fp
      .allowed_tokens_and_amounts
      .first()
      .map(|e| e.token)
      .unwrap_or_else(|| normalize_pubkey(&ctx.accounts.usdc_mint.key())),
    payable_chain_id: dest_cb_chain_id,
    payer: normalize_pubkey(&payer_key),
    payer_chain_token: normalize_pubkey(&ctx.accounts.usdc_mint.key()),
    payer_chain_id: sol_cb_chain_id,
    payer_payment_id: user_payment_key.to_bytes(),
  });

  // ── Transfer USDC: payer → program_usdc_ata ───────────────────────────────
  let total_burn = amount.checked_add(max_fee).unwrap();
  transfer_checked(
    CpiContext::new(
      ctx.accounts.token_program.to_account_info(),
      TransferChecked {
        from: ctx.accounts.payer_usdc_ata.to_account_info(),
        mint: ctx.accounts.usdc_mint.to_account_info(),
        to: ctx.accounts.program_usdc_ata.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
      },
    ),
    total_burn,
    ctx.accounts.usdc_mint.decimals,
  )?;

  // ── CPI: CCTP deposit_for_burn ────────────────────────────────────────────
  //
  // Calls TokenMessengerMinter::deposit_for_burn via sender_authority PDA
  // signer. destination_caller = dest_contract prevents griefing.
  // remaining_accounts[0..8] = deposit_for_burn accounts (see module doc).
  let dest_contract = ctx.accounts.chain_registry.registered_contract;
  let sender_authority_bump = ctx.bumps.sender_authority;
  let _ = (dest_contract, sender_authority_bump); // used in non-skip cfg blocks

  #[cfg(not(feature = "skip-external-cpi"))]
  crate::cpi::cctp::deposit_for_burn(
    total_burn,
    ctx.accounts.chain_registry.circle_domain,
    normalize_pubkey(&ctx.accounts.usdc_mint.key()),
    dest_contract,
    max_fee,
    0, // min_finality_threshold: 0 = use default
    &ctx.accounts.sender_authority.to_account_info(),
    &ctx.accounts.payer.to_account_info(),
    &ctx.accounts.program_usdc_ata.to_account_info(),
    &ctx.accounts.usdc_mint.to_account_info(),
    &ctx.accounts.token_program.to_account_info(),
    &ctx.accounts.system_program.to_account_info(),
    ctx.remaining_accounts,
    sender_authority_bump,
  )?;
  #[cfg(feature = "skip-external-cpi")]
  msg!("PayForeignViaCctp: deposit_for_burn CPI skipped (skip-external-cpi)");

  // ── CPI: payload message dispatch (mirrors EVM hasWormhole check) ─────────
  //
  // After CCTP burn: if this Solana deployment has Wormhole AND dest chain has
  // Wormhole, publish via Wormhole shim (one VAA reaches all Wormhole chains).
  // Otherwise: CCTP sendMessage for CCTP-only destinations.
  // remaining_accounts[8..16] = Wormhole accounts OR [8..10] = send_message.
  if ctx.accounts.config.has_wormhole && ctx.accounts.chain_registry.has_wormhole {
    #[cfg(not(feature = "skip-external-cpi"))]
    crate::cpi::wormhole::post_message(
      0, // nonce: 0 for payment messages (sequence number is sufficient)
      &encoded_payload,
      &ctx.accounts.payer.to_account_info(),
      &ctx.accounts.sender_authority.to_account_info(),
      &ctx.accounts.system_program.to_account_info(),
      &ctx.remaining_accounts[8..],
      sender_authority_bump,
    )?;
    #[cfg(feature = "skip-external-cpi")]
    msg!("PayForeignViaCctp: post_message CPI skipped (skip-external-cpi)");
    ctx.accounts.stats.increment_published_wormhole_messages()?;
  } else {
    // CCTP send_message: remaining_accounts[8] = event_data, [9] = sender_program
    // mt_state = remaining_accounts[0], mt_program = remaining_accounts[6]
    #[cfg(not(feature = "skip-external-cpi"))]
    {
      require!(
        ctx.remaining_accounts.len() >= 10,
        crate::errors::ChainbillsError::MissingRemainingAccounts
      );
      crate::cpi::cctp::send_message(
        ctx.accounts.chain_registry.circle_domain,
        dest_contract,
        dest_contract, // destination_caller = dest contract (prevents griefing)
        0,             // min_finality_threshold
        &encoded_payload,
        &ctx.accounts.payer.to_account_info(),
        &ctx.accounts.sender_authority.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        &ctx.remaining_accounts[0], // mt_state
        &ctx.remaining_accounts[8], // event_data_payload
        &ctx.remaining_accounts[9], // sender_program
        &ctx.remaining_accounts[6], // mt_program
        sender_authority_bump,
      )?;
    }
    #[cfg(feature = "skip-external-cpi")]
    msg!("PayForeignViaCctp: send_message CPI skipped (skip-external-cpi)");
    ctx.accounts.stats.increment_emitted_cctp_payment_messages()?;
  }

  // ── State updates ─────────────────────────────────────────────────────────
  let _ = encoded_payload; // used by CPIs above; suppress if both paths cfg-skip
  let user_record = &mut ctx.accounts.user_record;
  if is_new_user {
    user_record.wallet = payer_key;
    user_record.created_at = now;
    ctx.accounts.stats.increment_total_users()?;
    // First time this wallet initiates a cross-chain payment — record init.
    emit!(UserInitialized {
      user: payer_key,
      timestamp: now,
    });
  }
  let payer_count_final = user_record.payments_count;
  user_record.increment_payments()?;
  user_record.increment_activities()?;

  let up = &mut ctx.accounts.user_payment;
  up.payer = payer_key;
  up.payable = Pubkey::from(foreign_payable_id);
  up.payer_count = payer_count_final;
  up.chain_count = ctx.accounts.stats.total_user_payments;
  up.token_mint = ctx.accounts.usdc_mint.key();
  up.amount = amount;
  up.payable_chain_id = dest_cb_chain_id;
  up.payer_chain_id = sol_cb_chain_id;
  up.created_at = now;

  let activity = &mut ctx.accounts.activity_record;
  activity.global_index = global_idx;
  activity.activity_type = ActivityType::UserPaid;
  activity.entity = user_payment_key;
  activity.actor = payer_key;
  activity.timestamp = now;

  ctx.accounts.user_activity_pointer.global_index = global_idx;
  ctx.accounts.stats.increment_total_user_payments()?;
  ctx.accounts.stats.increment_total_activities()?;

  emit!(UserPaid {
    payment: user_payment_key,
    payer: payer_key,
    payable: Pubkey::from(foreign_payable_id),
    token: ctx.accounts.usdc_mint.key(),
    amount,
    timestamp: now,
  });
  msg!(
    "PayForeignViaCctp: payer={} foreign_payable={:?} dest_chain={:?} \
     amount={} max_fee={} chain_count={} timestamp={}",
    payer_key,
    foreign_payable_id,
    dest_cb_chain_id,
    amount,
    max_fee,
    up.chain_count,
    now,
  );

  Ok(())
}
