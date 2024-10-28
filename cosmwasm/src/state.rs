use sylvia::cw_schema::cw_serde;
use sylvia::cw_std::{Addr, Uint128};

#[cw_serde(crate = "sylvia::cw_schema")]
/// Keeps track of all activities on this chain.
pub struct ChainStats {
  /// Wormhole-Chain ID for this chain.
  pub chain_id: u16,
  /// Total number of users that have ever been initialized on this chain.
  pub users_count: u64,
  /// Total number of payables that have ever been created on this chain.
  pub payables_count: u64,
  /// Total number of payments that have ever been made on this chain.
  pub payments_count: u64,
  /// Total number of withdrawals that have ever been made on this chain.
  pub withdrawals_count: u64,
}

impl ChainStats {
  pub const fn initialize(chain_id: u16) -> Self {
    ChainStats {
      chain_id,
      users_count: 0,
      payables_count: 0,
      payments_count: 0,
      withdrawals_count: 0,
    }
  }

  pub fn next_user(&self) -> u64 {
    self.users_count.checked_add(1).unwrap()
  }

  pub fn next_payable(&self) -> u64 {
    self.payables_count.checked_add(1).unwrap()
  }

  pub fn next_payment(&self) -> u64 {
    self.payments_count.checked_add(1).unwrap()
  }

  pub fn next_withdrawal(&self) -> u64 {
    self.withdrawals_count.checked_add(1).unwrap()
  }
}

#[cw_serde(crate = "sylvia::cw_schema")]
/// Config account data. Mainly Governance.
pub struct Config {
  /// Deployer of this contract.
  pub owner: Addr,
  /// Chainbills' FeeCollector address.
  pub chainbills_fee_collector: Addr,
  /// Percentage of withdrawal for fees.
  pub withdrawal_fee_percentage: Uint128,
}

#[cw_serde(crate = "sylvia::cw_schema")]
/// A user is an entity that can create payables and make payments.
pub struct User {
  /// The nth count of users on this chain at the point this user was
  /// initialized.
  pub chain_count: u64,
  /// Total number of payables that this user has ever created.
  pub payables_count: u64,
  /// Total number of payments that this user has ever made.
  pub payments_count: u64,
  /// Total number of withdrawals that this user has ever made.
  pub withdrawals_count: u64,
}

impl User {
  pub const fn initialize(chain_count: u64) -> Self {
    User {
      chain_count,
      payables_count: 0,
      payments_count: 0,
      withdrawals_count: 0,
    }
  }

  pub fn next_payable(&self) -> u64 {
    self.payables_count.checked_add(1).unwrap()
  }

  pub fn next_payment(&self) -> u64 {
    self.payments_count.checked_add(1).unwrap()
  }

  pub fn next_withdrawal(&self) -> u64 {
    self.withdrawals_count.checked_add(1).unwrap()
  }
}

#[cw_serde(crate = "sylvia::cw_schema")]
/// Keeps data about tokens that have ever been used for payments. Also tells
/// whether the token is a native token (its denom) or a Cw20 (its Addr).
pub struct TokenDetails {
  /// Whether payments are currently accepted in this token.
  pub is_supported: bool,
  /// Whether this token is a native token or a Cw20 token.
  pub is_native_token: bool,
  /// The maximum withdrawal fee for this token.
  pub max_withdrawal_fees: Uint128,
  /// The total amount of user payments in this token.
  pub total_user_paid: Uint128,
  /// The total amount of payable payments in this token.
  pub total_payable_received: Uint128,
  /// The total amount of withdrawals in this token.
  pub total_withdrawn: Uint128,
  /// The total amount of fees collected from withdrawals in this token.
  pub total_withdrawal_fees_collected: Uint128,
}

impl TokenDetails {
  pub const fn initialize(
    is_supported: bool,
    is_native_token: bool,
    max_withdrawal_fees: Uint128,
  ) -> Self {
    TokenDetails {
      is_supported,
      is_native_token,
      max_withdrawal_fees,
      total_user_paid: Uint128::zero(),
      total_payable_received: Uint128::zero(),
      total_withdrawn: Uint128::zero(),
      total_withdrawal_fees_collected: Uint128::zero(),
    }
  }

  pub fn add_user_paid(&mut self, amount: Uint128) {
    self.total_user_paid = self.total_user_paid.checked_add(amount).unwrap()
  }

  pub fn add_payable_received(&mut self, amount: Uint128) {
    self.total_payable_received =
      self.total_payable_received.checked_add(amount).unwrap()
  }

  pub fn add_withdrawn(&mut self, amount: Uint128) {
    self.total_withdrawn = self.total_withdrawn.checked_add(amount).unwrap()
  }

  pub fn add_withdrawal_fees_collected(&mut self, amount: Uint128) {
    self.total_withdrawal_fees_collected = self
      .total_withdrawal_fees_collected
      .checked_add(amount)
      .unwrap()
  }
}

#[cw_serde(crate = "sylvia::cw_schema")]
/// A combination of a token address and its associated amount.
///
/// This combination is used to constrain how much of a token a payable can
/// accept. It is also used to record the details of a payment or a withdrawal.
///
/// Token is stored as a string to allow for the storage of native tokens
/// (different denoms).
pub struct TokenAndAmount {
  /// The address of the associated token.
  pub token: String,
  /// The amount of the token with its decimals.
  pub amount: Uint128,
}

#[cw_serde(crate = "sylvia::cw_schema")]
/// A payable is like a public invoice through which anybody can pay to.
pub struct Payable {
  /// The nth count of payables on this chain at the point this payable
  /// was created.
  pub chain_count: u64,
  /// The wallet address of that created this Payable.
  pub host: Addr,
  /// The nth count of payables that the host has created at the point of
  /// this payable's creation.
  pub host_count: u64,
  /// The allowed tokens (and their amounts) on this payable.
  pub allowed_tokens_and_amounts: Vec<TokenAndAmount>,
  /// Records of how much is in this payable.
  pub balances: Vec<TokenAndAmount>,
  /// The timestamp of when this payable was created.
  pub created_at: u64,
  /// The total number of payments made to this payable.
  pub payments_count: u64,
  /// The total number of withdrawals made from this payable.
  pub withdrawals_count: u64,
  /// Whether this payable is currently accepting payments.
  pub is_closed: bool,
}

impl Payable {
  pub fn next_payment(&self) -> u64 {
    self.payments_count.checked_add(1).unwrap()
  }

  pub fn next_withdrawal(&self) -> u64 {
    self.withdrawals_count.checked_add(1).unwrap()
  }
}

#[cw_serde(crate = "sylvia::cw_schema")]
/// A user's receipt of a payment made in this chain to a Payable on any
/// blockchain network (this-chain inclusive).
pub struct UserPayment {
  /// The ID of the Payable to which this Payment was made.
  pub payable_id: [u8; 32],
  /// The wallet address that made this Payment.
  pub payer: Addr,
  /// The Wormhole Chain ID of the chain into which the payment was made.
  pub payable_chain_id: u16,
  /// The nth count of payments on this chain at the point this payment
  /// was made.
  pub chain_count: u64,
  /// The nth count of payments that the payer has made
  /// at the point of making this payment.
  pub payer_count: u64,
  /// The nth count of payments that the payable has received
  /// at the point when this payment was made.
  pub payable_count: u64,
  /// When this payment was made.
  pub timestamp: u64,
  /// The amount and token that the payer paid
  pub details: TokenAndAmount,
}

#[cw_serde(crate = "sylvia::cw_schema")]
/// Receipt of a payment from any blockchain network (this-chain inclusive)
/// made to a Payable in this chain.
pub struct PayablePayment {
  /// The ID of the Payable to which this Payment was made.
  pub payable_id: [u8; 32],
  /// The Wormhole-normalized wallet address that made this Payment.
  /// If the payer is on CosmWasm, then will be the bytes of their wallet
  /// address.
  pub payer: [u8; 32],
  /// The Wormhole Chain ID of the chain from which the payment was made.
  pub payer_chain_id: u16,
  /// The nth count of payments to this payable from the payment source
  /// chain at the point this payment was recorded.
  pub local_chain_count: u64,
  /// The nth count of payments that the payable has received
  /// at the point when this payment was made.
  pub payable_count: u64,
  /// The nth count of payments that the payer has made
  /// at the point of making this payment.
  pub payer_count: u64,
  /// When this payment was made.
  pub timestamp: u64,
  /// The amount and token that the payer paid
  pub details: TokenAndAmount,
}

#[cw_serde(crate = "sylvia::cw_schema")]
/// A receipt of a withdrawal made by a Host from a Payable.
pub struct Withdrawal {
  /// The ID of the Payable from which this Withdrawal was made.
  pub payable_id: [u8; 32],
  /// The wallet address (payable's owner) that made this Withdrawal.
  pub host: Addr,
  /// The nth count of withdrawals on this chain at the point
  /// this withdrawal was made.
  pub chain_count: u64,
  /// The nth count of withdrawals that the host has made
  /// at the point of making this withdrawal.
  pub host_count: u64,
  /// The nth count of withdrawals that has been made from
  /// this payable at the point when this withdrawal was made.
  pub payable_count: u64,
  /// When this withdrawal was made.
  pub timestamp: u64,
  /// The amount and token that the host withdrew
  pub details: TokenAndAmount,
}
