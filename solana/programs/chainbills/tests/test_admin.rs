/// Mollusk-SVM integration tests for admin instructions.
///
/// Tests: allow_token, disallow_token, register_chain, update_chain,
/// update_fee_settings.
///
/// Note: `initialize` is not tested here because it requires a ProgramData
/// account populated with an upgrade authority — non-trivial to construct
/// without a full validator. Covered by TypeScript tests instead.
///
/// Run: `cargo test -p chainbills test_admin`

use anchor_lang::prelude::Pubkey;
use mollusk_svm::Mollusk;
use mollusk_svm_programs_token::token as spl_token_program;
use solana_account::Account;
use solana_program::instruction::{AccountMeta, Instruction};

const PROGRAM_ID: Pubkey =
  solana_program::pubkey!("DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk");
const SYSTEM_PROGRAM: Pubkey =
  solana_program::pubkey!("11111111111111111111111111111111");

// Instruction discriminators from IDL
const DISC_ALLOW_TOKEN: [u8; 8] = [127, 147, 164, 111, 0, 161, 111, 84];
const DISC_DISALLOW_TOKEN: [u8; 8] = [128, 24, 199, 234, 114, 157, 151, 177];
const DISC_REGISTER_CHAIN: [u8; 8] = [230, 181, 152, 173, 20, 163, 157, 243];
const DISC_UPDATE_FEE_SETTINGS: [u8; 8] =
  [155, 121, 178, 253, 181, 139, 103, 177];

// Account discriminators from IDL
const DISC_CONFIG: [u8; 8] = [155, 12, 170, 224, 30, 250, 204, 130];
const DISC_TOKEN_CONFIG: [u8; 8] = [92, 73, 255, 43, 107, 51, 117, 101];
const DISC_CHAIN_REGISTRY: [u8; 8] = [119, 7, 172, 219, 63, 243, 194, 231];
const DISC_STATS: [u8; 8] = [0xbe, 0x7d, 0x33, 0x3f, 0xa9, 0xc5, 0x24, 0xee];

fn mollusk() -> Mollusk {
  let mut m = Mollusk::new(&PROGRAM_ID, "../../target/deploy/chainbills");
  spl_token_program::add_program(&mut m);
  m
}

fn pda(seeds: &[&[u8]]) -> Pubkey {
  Pubkey::find_program_address(seeds, &PROGRAM_ID).0
}

fn config_pda() -> Pubkey {
  pda(&[b"config"])
}

fn token_config_pda(mint: &Pubkey) -> Pubkey {
  pda(&[b"token_config", mint.as_ref()])
}

fn chain_registry_pda(cb_chain_id: &[u8; 32]) -> Pubkey {
  pda(&[b"chain_registry", cb_chain_id.as_ref()])
}

fn stats_pda() -> Pubkey {
  pda(&[b"stats"])
}

/// Stats layout: 8(disc) + 13×8(u64 counters) + 4(registered_cctp_chain_count u32) = 116 bytes
fn make_stats() -> Account {
  let mut data = vec![0u8; 116];
  data[0..8].copy_from_slice(&DISC_STATS);
  Account {
    lamports: 1_000_000_000,
    data,
    owner: PROGRAM_ID,
    executable: false,
    rent_epoch: u64::MAX,
  }
}

/// Config account layout (after 8-byte discriminator):
///   owner(32) + fee_collector(32) + fee_bps(2) + cb_chain_id(32)
///   + nonce_counter(8) + has_wormhole(1) + has_cctp(1) = 116 bytes total
fn make_config(owner: &Pubkey) -> Account {
  let mut data = vec![0u8; 116];
  data[0..8].copy_from_slice(&DISC_CONFIG);
  data[8..40].copy_from_slice(owner.as_ref());
  data[40..72].copy_from_slice(owner.as_ref()); // fee_collector = owner
  data[72..74].copy_from_slice(&200u16.to_le_bytes()); // fee_bps = 200 (2%)
  data[74..106].fill(1); // cb_chain_id
  data[114] = 1; // has_wormhole
  data[115] = 1; // has_cctp
  Account {
    lamports: 1_000_000_000,
    data,
    owner: PROGRAM_ID,
    executable: false,
    rent_epoch: u64::MAX,
  }
}

/// TokenConfig layout: 8(disc) + 32(mint) + 1(is_allowed) + 8(max_fee)
/// + 8(total_user_paid) + 8(total_payable_received) + 8(total_withdrawn)
/// + 8(total_fees_collected) = 81 bytes
fn make_token_config(mint: &Pubkey, allowed: bool) -> Account {
  let mut data = vec![0u8; 81];
  data[0..8].copy_from_slice(&DISC_TOKEN_CONFIG);
  data[8..40].copy_from_slice(mint.as_ref());
  data[40] = u8::from(allowed);
  Account {
    lamports: 1_000_000_000,
    data,
    owner: PROGRAM_ID,
    executable: false,
    rent_epoch: u64::MAX,
  }
}

fn signer_account() -> Account {
  Account {
    lamports: 10_000_000_000,
    data: vec![],
    owner: SYSTEM_PROGRAM,
    executable: false,
    rent_epoch: u64::MAX,
  }
}

fn empty_system_account() -> Account {
  Account {
    lamports: 0,
    data: vec![],
    owner: SYSTEM_PROGRAM,
    executable: false,
    rent_epoch: u64::MAX,
  }
}

// ─── allow_token ────────────────────────────────────────────────────────────

#[test]
fn test_allow_token_creates_token_config() {
  let mollusk = mollusk();
  let owner = Pubkey::new_unique();
  let mint = Pubkey::new_unique();
  let token_config_key = token_config_pda(&mint);
  let config_key = config_pda();

  let max_fee: u64 = 5_000_000;
  let mut ix_data = DISC_ALLOW_TOKEN.to_vec();
  ix_data.extend_from_slice(&max_fee.to_le_bytes());

  let ix = Instruction {
    program_id: PROGRAM_ID,
    accounts: vec![
      AccountMeta::new(owner, true),
      AccountMeta::new_readonly(config_key, false),
      AccountMeta::new_readonly(mint, false),
      AccountMeta::new(token_config_key, false),
      AccountMeta::new_readonly(spl_token_program::ID, false),
      AccountMeta::new_readonly(SYSTEM_PROGRAM, false),
    ],
    data: ix_data,
  };

  // Minimal SPL Token mint account (82 bytes, decimals=6, initialized)
  let mut mint_data = vec![0u8; 82];
  mint_data[44] = 6; // decimals
  mint_data[45] = 1; // is_initialized
  let mint_account = Account {
    lamports: 1_000_000,
    data: mint_data,
    owner: spl_token_program::ID,
    executable: false,
    rent_epoch: u64::MAX,
  };

  let (system_key, system_acc) =
    mollusk_svm::program::keyed_account_for_system_program();
  let (spl_key, spl_acc) = spl_token_program::keyed_account();

  let accounts = vec![
    (owner, signer_account()),
    (config_key, make_config(&owner)),
    (mint, mint_account),
    (token_config_key, empty_system_account()),
    (spl_key, spl_acc),
    (system_key, system_acc),
  ];

  let result = mollusk.process_instruction(&ix, &accounts);
  assert!(
    !result.program_result.is_err(),
    "allow_token failed: {:?}",
    result.program_result
  );

  let token_cfg_data = result
    .get_account(&token_config_key)
    .expect("token_config not in result")
    .data
    .clone();
  assert_eq!(&token_cfg_data[0..8], &DISC_TOKEN_CONFIG, "wrong discriminator");
  assert_eq!(token_cfg_data[40], 1, "token should be allowed (byte 40)");
}

// ─── disallow_token ──────────────────────────────────────────────────────────

#[test]
fn test_disallow_token_flips_flag_to_false() {
  let mollusk = mollusk();
  let owner = Pubkey::new_unique();
  let mint = Pubkey::new_unique();
  let token_config_key = token_config_pda(&mint);
  let config_key = config_pda();

  let ix = Instruction {
    program_id: PROGRAM_ID,
    accounts: vec![
      AccountMeta::new_readonly(owner, true),
      AccountMeta::new_readonly(config_key, false),
      AccountMeta::new(token_config_key, false),
    ],
    data: DISC_DISALLOW_TOKEN.to_vec(),
  };

  let accounts = vec![
    (owner, signer_account()),
    (config_key, make_config(&owner)),
    (token_config_key, make_token_config(&mint, true)),
  ];

  let result = mollusk.process_instruction(&ix, &accounts);
  assert!(
    !result.program_result.is_err(),
    "disallow_token failed: {:?}",
    result.program_result
  );

  let token_cfg_data = result
    .get_account(&token_config_key)
    .expect("token_config not in result")
    .data
    .clone();
  assert_eq!(token_cfg_data[40], 0, "token should be disallowed (byte 40)");
}

#[test]
fn test_disallow_token_rejects_non_owner() {
  let mollusk = mollusk();
  let owner = Pubkey::new_unique();
  let attacker = Pubkey::new_unique();
  let mint = Pubkey::new_unique();
  let token_config_key = token_config_pda(&mint);
  let config_key = config_pda();

  let ix = Instruction {
    program_id: PROGRAM_ID,
    accounts: vec![
      AccountMeta::new_readonly(attacker, true),
      AccountMeta::new_readonly(config_key, false),
      AccountMeta::new(token_config_key, false),
    ],
    data: DISC_DISALLOW_TOKEN.to_vec(),
  };

  let accounts = vec![
    (attacker, signer_account()),
    (config_key, make_config(&owner)),
    (token_config_key, make_token_config(&mint, true)),
  ];

  let result = mollusk.process_instruction(&ix, &accounts);
  assert!(result.program_result.is_err(), "should have rejected non-owner");
}

// ─── register_chain ──────────────────────────────────────────────────────────

#[test]
fn test_register_chain_stores_all_fields() {
  let mollusk = mollusk();
  let owner = Pubkey::new_unique();
  let config_key = config_pda();
  let stats_key = stats_pda();
  let cb_chain_id = [42u8; 32];
  let chain_registry_key = chain_registry_pda(&cb_chain_id);

  let mut ix_data = DISC_REGISTER_CHAIN.to_vec();
  ix_data.extend_from_slice(&cb_chain_id);
  ix_data.push(1u8); // has_wormhole
  ix_data.extend_from_slice(&10002u16.to_le_bytes()); // wormhole_chain_id
  ix_data.push(0u8); // has_cctp
  ix_data.extend_from_slice(&0u32.to_le_bytes()); // circle_domain
  ix_data.extend_from_slice(&[7u8; 32]); // registered_contract

  let ix = Instruction {
    program_id: PROGRAM_ID,
    accounts: vec![
      AccountMeta::new(owner, true),
      AccountMeta::new_readonly(config_key, false),
      AccountMeta::new(chain_registry_key, false),
      AccountMeta::new(stats_key, false),
      AccountMeta::new_readonly(SYSTEM_PROGRAM, false),
    ],
    data: ix_data,
  };

  let (system_key, system_acc) =
    mollusk_svm::program::keyed_account_for_system_program();

  let accounts = vec![
    (owner, signer_account()),
    (config_key, make_config(&owner)),
    (chain_registry_key, empty_system_account()),
    (stats_key, make_stats()),
    (system_key, system_acc),
  ];

  let result = mollusk.process_instruction(&ix, &accounts);
  assert!(
    !result.program_result.is_err(),
    "register_chain failed: {:?}",
    result.program_result
  );

  let reg_data = result
    .get_account(&chain_registry_key)
    .expect("chain_registry not in result")
    .data
    .clone();
  // ChainRegistry layout: 8(disc) + 32(cb_chain_id) + 1(has_wormhole) +
  //   2(wormhole_chain_id) + 1(has_cctp) + 4(circle_domain) + 32(registered_contract)
  assert_eq!(&reg_data[0..8], &DISC_CHAIN_REGISTRY, "wrong discriminator");
  assert_eq!(&reg_data[8..40], &cb_chain_id, "cb_chain_id mismatch");
  assert_eq!(reg_data[40], 1, "has_wormhole should be true");
  assert_eq!(
    &reg_data[41..43],
    &10002u16.to_le_bytes(),
    "wormhole_chain_id mismatch"
  );
  assert_eq!(reg_data[43], 0, "has_cctp should be false");
  assert_eq!(&reg_data[48..80], &[7u8; 32], "registered_contract mismatch");
}

#[test]
fn test_register_chain_rejects_non_owner() {
  let mollusk = mollusk();
  let owner = Pubkey::new_unique();
  let attacker = Pubkey::new_unique();
  let config_key = config_pda();
  let stats_key = stats_pda();
  let cb_chain_id = [99u8; 32];
  let chain_registry_key = chain_registry_pda(&cb_chain_id);

  let mut ix_data = DISC_REGISTER_CHAIN.to_vec();
  ix_data.extend_from_slice(&cb_chain_id);
  ix_data.push(1u8);
  ix_data.extend_from_slice(&1u16.to_le_bytes());
  ix_data.push(0u8);
  ix_data.extend_from_slice(&0u32.to_le_bytes());
  ix_data.extend_from_slice(&[0u8; 32]);

  let ix = Instruction {
    program_id: PROGRAM_ID,
    accounts: vec![
      AccountMeta::new(attacker, true),
      AccountMeta::new_readonly(config_key, false),
      AccountMeta::new(chain_registry_key, false),
      AccountMeta::new(stats_key, false),
      AccountMeta::new_readonly(SYSTEM_PROGRAM, false),
    ],
    data: ix_data,
  };

  let (system_key, system_acc) =
    mollusk_svm::program::keyed_account_for_system_program();

  let accounts = vec![
    (attacker, signer_account()),
    (config_key, make_config(&owner)),
    (chain_registry_key, empty_system_account()),
    (stats_key, make_stats()),
    (system_key, system_acc),
  ];

  let result = mollusk.process_instruction(&ix, &accounts);
  assert!(result.program_result.is_err(), "should have rejected non-owner");
}

// ─── update_fee_settings ─────────────────────────────────────────────────────

#[test]
fn test_update_fee_settings_updates_config() {
  let mollusk = mollusk();
  let owner = Pubkey::new_unique();
  let new_fee_collector = Pubkey::new_unique();
  let config_key = config_pda();

  let new_fee_bps: u16 = 300; // 3%
  let mut ix_data = DISC_UPDATE_FEE_SETTINGS.to_vec();
  ix_data.extend_from_slice(&new_fee_bps.to_le_bytes());

  let ix = Instruction {
    program_id: PROGRAM_ID,
    accounts: vec![
      AccountMeta::new_readonly(owner, true),
      AccountMeta::new(config_key, false),
      AccountMeta::new_readonly(new_fee_collector, false),
    ],
    data: ix_data,
  };

  let accounts = vec![
    (owner, signer_account()),
    (config_key, make_config(&owner)),
    (new_fee_collector, Account::default()),
  ];

  let result = mollusk.process_instruction(&ix, &accounts);
  assert!(
    !result.program_result.is_err(),
    "update_fee_settings failed: {:?}",
    result.program_result
  );

  let config_data =
    result.get_account(&config_key).expect("config not in result").data.clone();
  let stored_fee = u16::from_le_bytes([config_data[72], config_data[73]]);
  assert_eq!(stored_fee, new_fee_bps, "fee_bps not updated");
  assert_eq!(
    &config_data[40..72],
    new_fee_collector.as_ref(),
    "fee_collector not updated"
  );
}

#[test]
fn test_update_fee_settings_rejects_fee_over_10000() {
  let mollusk = mollusk();
  let owner = Pubkey::new_unique();
  let fee_collector = Pubkey::new_unique();
  let config_key = config_pda();

  let bad_fee: u16 = 10_001;
  let mut ix_data = DISC_UPDATE_FEE_SETTINGS.to_vec();
  ix_data.extend_from_slice(&bad_fee.to_le_bytes());

  let ix = Instruction {
    program_id: PROGRAM_ID,
    accounts: vec![
      AccountMeta::new_readonly(owner, true),
      AccountMeta::new(config_key, false),
      AccountMeta::new_readonly(fee_collector, false),
    ],
    data: ix_data,
  };

  let accounts = vec![
    (owner, signer_account()),
    (config_key, make_config(&owner)),
    (fee_collector, Account::default()),
  ];

  let result = mollusk.process_instruction(&ix, &accounts);
  assert!(
    result.program_result.is_err(),
    "should have rejected fee_bps > 10_000"
  );
}
