// State-level unit tests that don't require on-chain invocation.
//
// These cover the pure logic methods on Payable, ForeignPayable, Stats, etc.
// Run with: `cargo test -p chainbills test_state`
//
// For instruction-level tests (initialize, allow_token, pay, etc.) that need
// on-chain invocation, use the TypeScript test suite: `npm test` in solana/.
//
// The actual test methods are inline in each state module:
//   src/state/payable.rs::tests
//   src/state/foreign_payable.rs::tests
//   src/payload/decode.rs::tests
//   src/utils.rs::tests
//
// Run the full suite:
//   cargo test -p chainbills
