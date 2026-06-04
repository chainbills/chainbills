//! `recv_payment_via_cctp_wormhole` — EVM → Solana payment receipt (Wormhole +
//! CCTP path).
//!
//! ## `remaining_accounts` layout (13 accounts — burn receive_message)
//! ```text
//! [0]  message_transmitter_program
//! [1]  message_transmitter_state  (mut)
//! [2]  used_nonce                 (PDA in MT, init — keyed to burn nonce)
//! [3]  authority_pda              (PDA [b"message_transmitter_authority", TMM])
//! [4]  token_messenger_minter_prog (receiver = TMM, mints USDC)
//! [5]  token_messenger_state
//! [6]  remote_token_messenger     (for src_domain)
//! [7]  token_minter_state
//! [8]  local_token                (for USDC, mut)
//! [9]  token_pair                 (for src_domain + src_token)
//! [10] custody_token_account      (CCTP USDC custody, mut)
//! [11] event_authority            (PDA [b"__event_authority"] in TMM)
//! [12] token_program
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
    decode::decode_payment_payload,
    wormhole::{
      parse_posted_vaa, validate_wormhole_program, verify_posted_vaa_pda,
    },
  },
  state::{
    ActivityRecord, ActivityType, CctpTokenBurnNonce, ChainRegistry,
    ConsumedVaa, ForeignPayable, PayableActivityPointer, PayablePayment,
    PaymentNonce, Stats,
  },
  utils::get_current_timestamp,
};

/// Accounts for `recv_payment_via_cctp_wormhole`.
#[derive(Accounts)]
#[instruction(
    vaa_hash: [u8; 32],
    payer_chain_id: [u8; 32],
    payer: [u8; 32],
    payment_nonce: u64,
    cctp_burn_nonce: [u8; 32],
    src_domain: u32,
)]
pub struct RecvPaymentViaCctpWormhole<'info> {
  /// Relayer submitting this VAA + CCTP message. Must sign. Pays for new PDAs.
  #[account(mut)]
  pub relayer: Signer<'info>,

  /// CHECK: Validated against known program IDs inside handler.
  pub wormhole_program: UncheckedAccount<'info>,

  /// CHECK: Owned by wormhole_program. PDA verified via vaa_hash.
  #[account(
        constraint = posted_vaa.owner == wormhole_program.key
            @ ChainbillsError::InvalidEmitter
    )]
  pub posted_vaa: UncheckedAccount<'info>,

  /// CHECK: Validated inside handler after VAA parse.
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

  /// ConsumedVaa PDA — init fails on replay.
  #[account(
        init,
        payer = relayer,
        space = ConsumedVaa::SPACE,
        seeds = [ConsumedVaa::SEED_PREFIX, &vaa_hash],
        bump,
    )]
  pub consumed_vaa: Box<Account<'info, ConsumedVaa>>,

  /// PaymentNonce PDA — init fails on replay.
  #[account(
        init,
        payer = relayer,
        space = crate::state::PaymentNonce::SPACE,
        seeds = [
            crate::state::PaymentNonce::SEED_PREFIX,
            &payer_chain_id,
            &payer,
            &payment_nonce.to_le_bytes(),
        ],
        bump,
    )]
  pub payment_nonce_pda: Box<Account<'info, PaymentNonce>>,

  /// CctpTokenBurnNonce PDA — init fails on replay.
  #[account(
        init,
        payer = relayer,
        space = CctpTokenBurnNonce::SPACE,
        seeds = [CctpTokenBurnNonce::SEED_PREFIX, &src_domain.to_le_bytes(), &cctp_burn_nonce],
        bump,
    )]
  pub cctp_burn_nonce_pda: Box<Account<'info, CctpTokenBurnNonce>>,

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

/// Handler for `recv_payment_via_cctp_wormhole`.
pub fn process_recv_payment_via_cctp_wormhole<'info>(
  ctx: Context<'_, '_, '_, 'info, RecvPaymentViaCctpWormhole<'info>>,
  vaa_hash: [u8; 32],
  payer_chain_id: [u8; 32],
  payer: [u8; 32],
  payment_nonce: u64,
  cctp_burn_nonce: [u8; 32],
  src_domain: u32,
  burn_message: Vec<u8>,
  circle_attestation: Vec<u8>,
) -> Result<()> {
  let now = get_current_timestamp()?;
  let program_id = ctx.program_id;

  validate_wormhole_program(ctx.accounts.wormhole_program.key)?;

  verify_posted_vaa_pda(
    ctx.accounts.posted_vaa.key,
    &vaa_hash,
    ctx.accounts.wormhole_program.key,
  )?;
  let vaa_data = {
    let raw = ctx.accounts.posted_vaa.try_borrow_data()?;
    parse_posted_vaa(&raw)?
  };

  let chain_registry = {
    let raw = ctx.accounts.chain_registry.try_borrow_data()?;
    ChainRegistry::try_deserialize(&mut &raw[..])?
  };
  require!(chain_registry.has_wormhole, ChainbillsError::InvalidEmitter);
  require!(
    chain_registry.wormhole_chain_id == vaa_data.emitter_chain,
    ChainbillsError::InvalidVaaEmitterChain
  );
  require!(
    chain_registry.registered_contract == vaa_data.emitter_address,
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

  require!(
    !vaa_data.payload.is_empty() && vaa_data.payload[0] == PAYLOAD_TYPE_PAYMENT,
    ChainbillsError::InvalidPayloadType
  );
  let payload = decode_payment_payload(&vaa_data.payload)?;

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

  // CPI to CCTP receive_message — verifies attestation and mints USDC to
  // vault_usdc_ata via TokenMessengerMinter callback. remaining_accounts[0..13].
  #[cfg(not(feature = "skip-external-cpi"))]
  crate::cpi::cctp::receive_burn_message(
    &burn_message,
    &circle_attestation,
    &ctx.accounts.relayer.to_account_info(),
    &ctx.accounts.relayer.to_account_info(),
    &ctx.accounts.vault_usdc_ata.to_account_info(),
    &ctx.accounts.token_program.to_account_info(),
    &ctx.accounts.system_program.to_account_info(),
    ctx.remaining_accounts,
  )?;
  #[cfg(feature = "skip-external-cpi")]
  msg!("RecvPaymentViaCctpWormhole: receive_message CPI skipped (skip-external-cpi)");
  let _ = (burn_message, circle_attestation); // used above; suppress if cfg-skipped

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

  let cv = &mut ctx.accounts.consumed_vaa;
  cv.vaa_hash = vaa_hash;
  cv.emitter_chain = vaa_data.emitter_chain;
  cv.sequence = vaa_data.sequence;
  cv.payload_type = PAYLOAD_TYPE_PAYMENT;
  cv.processed_at = now;

  let pnonce = &mut ctx.accounts.payment_nonce_pda;
  pnonce.payer_chain_id = payer_chain_id;
  pnonce.payer = payer;
  pnonce.nonce = payment_nonce;
  pnonce.processed_at = now;

  let bnonce = &mut ctx.accounts.cctp_burn_nonce_pda;
  bnonce.circle_domain = src_domain;
  bnonce.nonce = cctp_burn_nonce;
  bnonce.processed_at = now;

  let activity = &mut ctx.accounts.activity_record;
  activity.global_index = global_idx;
  activity.activity_type = ActivityType::PayableReceived;
  activity.entity = pp_key;
  activity.actor = payable_key;
  activity.timestamp = now;

  ctx.accounts.payable_activity_pointer.global_index = global_idx;

  ctx.accounts.stats.increment_total_payable_payments()?;
  ctx.accounts.stats.increment_total_activities()?;
  ctx.accounts.stats.increment_consumed_wormhole_messages()?;
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
    "RecvPaymentViaCctpWormhole: payable={} payer={:?} token={} amount={} \
     payer_chain={:?} chain_count={} vaa_seq={} timestamp={}",
    payable_key,
    payer,
    token_mint,
    payload.amount,
    payer_chain_id,
    chain_count,
    vaa_data.sequence,
    now,
  );

  Ok(())
}
