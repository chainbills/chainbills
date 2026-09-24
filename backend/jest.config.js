// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Jest unit test config
//
// Runs *.spec.ts files colocated with source under src/. e2e tests live under
// test/ with their own config (test/jest-e2e.json) so `npm test` never needs
// a live Postgres.
// ──────────────────────────────────────────────────────────────────────────────

/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // @solana/web3.js pulls in rpc-websockets -> uuid@14 (ESM-only). Node's
  // package.json#exports resolves this fine via plain `require`, but Jest's
  // CJS module loader does not, so these two are exempted from the default
  // "never transform node_modules" behaviour and run through ts-jest too.
  transformIgnorePatterns: ['/node_modules/(?!(uuid|rpc-websockets)/)'],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
