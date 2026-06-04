import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testTimeout: 60_000,
  // rpc-websockets bundles uuid@14 (pure ESM). Map all uuid requires to the
  // top-level uuid@8 CJS build so jest can require() them without ESM support.
  moduleNameMapper: {
    '^uuid$': '<rootDir>/node_modules/uuid/dist/index.js',
  },
};

export default config;
