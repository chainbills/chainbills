//! `recv_payment_via_cctp_only` — EVM → Solana payment receipt (CCTP-only
//! path).
//!
//! ## `remaining_accounts` layout (18 accounts total)
//!
//! ### Data message receive_message (indices 0..4, 5 accounts)
//! ```text
//! [0] message_transmitter_program
//! [1] message_transmitter_state   (mut)
//! [2] used_nonce_data             (PDA in MT, init — keyed to data nonce)
//! [3] authority_pda_data          (PDA [b"message_transmitter_authority",
//!                                       chainbills_program] in MT)
//! [4] chainbills_program          (receiver — CCTP calls handle_receive_message)
//! ```
//!
//! ### Burn message receive_message (indices 5..17, 13 accounts)
//! ```text
//! [5]  message_transmitter_program (same as [0])
//! [6]  message_transmitter_state   (mut, same as [1])
//! [7]  used_nonce_burn             (PDA in MT, init — keyed to burn nonce)
//! [8]  authority_pda_burn          (PDA [b"message_transmitter_authority", TMM])
//! [9]  token_messenger_minter_prog (receiver = TMM)
//! [10] token_messenger_state
//! [11] remote_token_messenger
//! [12] token_minter_state
//! [13] local_token                 (mut)
//! [14] token_pair
//! [15] custody_token_account       (mut)
//! [16] event_authority
//! [17] token_program
//! ```

use anchor_lang::prelude::*;
use anchor_spl::{
  associated_token::AssociatedToken,
  token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
  constants::*,
  errors::ChainbillsError,
  events::ForeignPaymentReceived,
  payload::{
    decode::decode_payment_payload, wormhole::validate_cctp_transmitter,
  },
  state::{
    ActivityRecord, ActivityType, CctpDataNonce, CctpTokenBurnNonce,
    ChainRegistry, ForeignPayable, PayableActivityPointer, PayablePayment,
    PaymentNonce, Stats,
  },
  utils::get_current_timestamp,
};

/// Accounts for `recv_payment_via_cctp_only`.
#[derive(Accounts)]
#[instruction(
    src_domain: u32,
    data_nonce: [u8; 32],
    burn_nonce: [u8; 32],
    payer_chain_id: [u8; 32],
    payer: [u8; 32],
    payment_nonce: u64,
)]
pub struct RecvPaymentViaCctpOnly<'info> {
  /// Relayer submitting both CCTP messages. Must sign. Pays for new PDAs.
  #[account(mut)]
  pub relayer: Signer<'info>,

  /// CHECK: Validated against known program IDs.
  pub cctp_program: UncheckedAccount<'info>,

  /// CHECK: Validated inside handler after parsing message source domain.
  pub chain_registry: UncheckedAccount<'info>,

  /// The foreign payable receiving the payment. Must not be closed.
  #[account(mut)]
  pub foreign_payable: Box<Account<'info, ForeignPayable>>,

  /// CHECK: PDA validated via seeds.
  #[account(
        seeds = [crate::state::Payable::VAULT_SEED_PREFIX, foreign_payable.key().as_ref()],
        bump,
    )]
  pub vault_authority: UncheckedAccount<'info>,

  /// USDC mint — CCTP mints USDC into vault_usdc_ata on receive.
  pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,

  /// Vault USDC ATA — receives USDC minted by CCTP on this call.
  #[account(
        init_if_needed,
        payer = relayer,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
  pub vault_usdc_ata: Box<InterfaceAccount<'info, TokenAccount>>,

  /// PayablePayment receipt PDA for this inbound payment.
  #[account(
        init,
        payer = relayer,
        space = PayablePayment::SPACE,
        seeds = [
            PayablePayment::SEED_PREFIX,
            foreign_payable.key().as_ref(),
            &foreign_payable.payments_count.to_le_bytes(),
        ],
        bump,
    )]
  pub payable_payment: Box<Account<'info, PayablePayment>>,

  /// CctpDataNonce PDA — prevents replay of the data message.
  #[account(
        init,
        payer = relayer,
        space = CctpDataNonce::SPACE,
        seeds = [CctpDataNonce::SEED_PREFIX, &src_domain.to_le_bytes(), &data_nonce],
        bump,
    )]
  pub cctp_data_nonce_pda: Box<Account<'info, CctpDataNonce>>,

  /// CctpTokenBurnNonce PDA — prevents replay of the burn message.
  #[account(
        init,
        payer = relayer,
        space = CctpTokenBurnNonce::SPACE,
        seeds = [CctpTokenBurnNonce::SEED_PREFIX, &src_domain.to_le_bytes(), &burn_nonce],
        bump,
    )]
  pub cctp_burn_nonce_pda: Box<Account<'info, CctpTokenBurnNonce>>,

  /// PaymentNonce PDA — prevents double-recording of the same payment.
  #[account(
        init,
        payer = relayer,
        space = PaymentNonce::SPACE,
        seeds = [
            PaymentNonce::SEED_PREFIX,
            &payer_chain_id,
            &payer,
            &payment_nonce.to_le_bytes(),
        ],
        bump,
    )]
  pub payment_nonce_pda: Box<Account<'info, PaymentNonce>>,

  /// Stats — counters incremented here.
  #[account(mut, seeds = [Stats::SEED_PREFIX], bump)]
  pub stats: Box<Account<'info, Stats>>,

  /// ActivityRecord PDA for this payment event.
  #[account(
        init, payer = relayer, space = ActivityRecord::SPACE,
        seeds = [
            ActivityRecord::SEED_PREFIX,
            ActivityRecord::GLOBAL_PREFIX,
            &stats.total_activities.to_le_bytes(),
        ],
        bump,
    )]
  pub activity_record: Box<Account<'info, ActivityRecord>>,

  /// Payable-scoped activity pointer — links this activity to the payable's history.
  #[account(
        init, payer = relayer, space = PayableActivityPointer::SPACE,
        seeds = [
            PayableActivityPointer::SEED_PREFIX,
            PayableActivityPointer::PAYABLE_PREFIX,
            foreign_payable.key().as_ref(),
            &foreign_payable.payments_count.to_le_bytes(),
        ],
        bump,
    )]
  pub payable_activity_pointer: Box<Account<'info, PayableActivityPointer>>,

  pub token_program: Interface<'info, TokenInterface>,
  pub associated_token_program: Program<'info, AssociatedToken>,
  pub system_program: Program<'info, System>,
}

/// Handler for `recv_payment_via_cctp_only`.
pub fn process_recv_payment_via_cctp_only<'info>(
  ctx: Context<'_, '_, '_, 'info, RecvPaymentViaCctpOnly<'info>>,
  src_domain: u32,
  data_nonce: [u8; 32],
  burn_nonce: [u8; 32],
  payer_chain_id: [u8; 32],
  payer: [u8; 32],
  payment_nonce: u64,
  data_message: Vec<u8>,
  data_attestation: Vec<u8>,
  burn_message: Vec<u8>,
  burn_attestation: Vec<u8>,
) -> Result<()> {
  let now = get_current_timestamp()?;
  let program_id = ctx.program_id;

  validate_cctp_transmitter(ctx.accounts.cctp_program.key)?;

  const CCTP_BODY_OFFSET: usize = 148;
  require!(
    data_message.len() > CCTP_BODY_OFFSET,
    ChainbillsError::InvalidPayloadLength
  );

  let msg_src_domain =
    u32::from_be_bytes(data_message[4..8].try_into().unwrap());
  require!(
    msg_src_domain == src_domain,
    ChainbillsError::InvalidEmitter
  );

  let mut parsed_data_nonce = [0u8; 32];
  parsed_data_nonce.copy_from_slice(&data_message[12..44]);
  require!(
    parsed_data_nonce == data_nonce,
    ChainbillsError::InvalidEmitter
  );

  let mut sender = [0u8; 32];
  sender.copy_from_slice(&data_message[44..76]);

  let chain_registry = {
    let raw = ctx.accounts.chain_registry.try_borrow_data()?;
    ChainRegistry::try_deserialize(&mut &raw[..])?
  };
  require!(chain_registry.has_cctp, ChainbillsError::InvalidEmitter);
  require!(
    chain_registry.circle_domain == src_domain,
    ChainbillsError::InvalidEmitter
  );
  require!(
    chain_registry.registered_contract == sender,
    ChainbillsError::InvalidEmitter
  );
  let (expected_cr, _) = Pubkey::find_program_address(
    &[ChainRegistry::SEED_PREFIX, &chain_registry.cb_chain_id],
    program_id,
  );
  require!(
    expected_cr == ctx.accounts.chain_registry.key(),
    ChainbillsError::InvalidEmitter
  );

  // CPI: receive_message for data message — verifies attestation, marks
  // Circle's used_nonce. Chainbills is the receiver (no-op callback).
  // remaining_accounts[0..5].
  #[cfg(not(feature = "skip-external-cpi"))]
  crate::cpi::cctp::receive_data_message(
    &data_message,
    &data_attestation,
    &ctx.accounts.relayer.to_account_info(),
    &ctx.accounts.relayer.to_account_info(),
    &ctx.accounts.system_program.to_account_info(),
    &ctx.remaining_accounts[..5],
  )?;
  #[cfg(feature = "skip-external-cpi")]
  msg!("RecvPaymentViaCctpOnly: data receive_message CPI skipped (skip-external-cpi)");
  let _ = data_attestation; // used above; suppress if cfg-skipped

  let body = &data_message[CCTP_BODY_OFFSET..];
  require!(
    data_message.len() == CCTP_BODY_OFFSET + PAYMENT_PAYLOAD_SIZE,
    ChainbillsError::InvalidPayloadLength
  );
  require!(
    body[0] == PAYLOAD_TYPE_PAYMENT,
    ChainbillsError::InvalidPayloadType
  );
  let payload = decode_payment_payload(body)?;

  require!(
    payload.payer_chain_id == payer_chain_id,
    ChainbillsError::InvalidEmitter
  );
  require!(payload.payer == payer, ChainbillsError::InvalidEmitter);
  require!(
    payload.nonce == payment_nonce,
    ChainbillsError::InvalidEmitter
  );

  require!(
    !ctx.accounts.foreign_payable.is_closed,
    ChainbillsError::ForeignPayableClosed
  );
  require!(
    ctx.accounts.foreign_payable.payable_id == payload.payable_id,
    ChainbillsError::ForeignPayableNotFound
  );

  require!(
    burn_message.len() > CCTP_BODY_OFFSET,
    ChainbillsError::InvalidPayloadLength
  );
  let mut parsed_burn_nonce = [0u8; 32];
  parsed_burn_nonce.copy_from_slice(&burn_message[12..44]);
  require!(
    parsed_burn_nonce == burn_nonce,
    ChainbillsError::InvalidEmitter
  );

  // CPI: receive_message for burn message — verifies attestation and mints
  // USDC to vault_usdc_ata via TokenMessengerMinter callback.
  // remaining_accounts[5..18].
  #[cfg(not(feature = "skip-external-cpi"))]
  crate::cpi::cctp::receive_burn_message(
    &burn_message,
    &burn_attestation,
    &ctx.accounts.relayer.to_account_info(),
    &ctx.accounts.relayer.to_account_info(),
    &ctx.accounts.vault_usdc_ata.to_account_info(),
    &ctx.accounts.token_program.to_account_info(),
    &ctx.accounts.system_program.to_account_info(),
    &ctx.remaining_accounts[5..],
  )?;
  #[cfg(feature = "skip-external-cpi")]
  msg!("RecvPaymentViaCctpOnly: burn receive_message CPI skipped (skip-external-cpi)");
  let _ = burn_attestation; // used above; suppress if cfg-skipped

  let fp = &mut ctx.accounts.foreign_payable;
  let payable_key = fp.key();
  let payable_count = fp.payments_count;
  fp.increment_payments()?;

  let token_mint = ctx.accounts.usdc_mint.key();
  let global_idx = ctx.accounts.stats.total_activities;
  let chain_count = ctx.accounts.stats.total_payable_payments;

  let pp = &mut ctx.accounts.payable_payment;
  pp.payable = payable_key;
  pp.payer = payer;
  pp.payable_count = payable_count;
  pp.chain_count = chain_count;
  pp.token_mint = token_mint;
  pp.amount = payload.amount;
  pp.payer_chain_id = payer_chain_id;
  pp.payer_payment_id = payload.payer_payment_id;
  pp.created_at = now;

  let pp_key = pp.key();

  ctx.accounts.cctp_data_nonce_pda.circle_domain = src_domain;
  ctx.accounts.cctp_data_nonce_pda.nonce = data_nonce;
  ctx.accounts.cctp_data_nonce_pda.processed_at = now;

  ctx.accounts.cctp_burn_nonce_pda.circle_domain = src_domain;
  ctx.accounts.cctp_burn_nonce_pda.nonce = burn_nonce;
  ctx.accounts.cctp_burn_nonce_pda.processed_at = now;

  ctx.accounts.payment_nonce_pda.payer_chain_id = payer_chain_id;
  ctx.accounts.payment_nonce_pda.payer = payer;
  ctx.accounts.payment_nonce_pda.nonce = payment_nonce;
  ctx.accounts.payment_nonce_pda.processed_at = now;

  let activity = &mut ctx.accounts.activity_record;
  activity.global_index = global_idx;
  activity.activity_type = ActivityType::PayableReceived;
  activity.entity = pp_key;
  activity.actor = payable_key;
  activity.timestamp = now;

  ctx.accounts.payable_activity_pointer.global_index = global_idx;

  ctx.accounts.stats.increment_total_payable_payments()?;
  ctx.accounts.stats.increment_total_activities()?;
  ctx
    .accounts
    .stats
    .increment_received_cctp_payment_messages()?;

  emit!(ForeignPaymentReceived {
    payable_payment: pp_key,
    payable: payable_key,
    payer,
    payer_chain_id,
    amount: payload.amount,
    timestamp: now,
  });
  msg!(
    "RecvPaymentViaCctpOnly: payable={} payer={:?} token={} amount={} \
     payer_chain={:?} chain_count={} src_domain={} timestamp={}",
    payable_key,
    payer,
    token_mint,
    payload.amount,
    payer_chain_id,
    chain_count,
    src_domain,
    now,
  );

  Ok(())
}
