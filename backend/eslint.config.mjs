// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — ESLint flat config
//
// Mirrors relayer/'s formatting (2 spaces, single quotes, 120 columns) via
// eslint-plugin-prettier, adds TypeScript strict-ish linting, and enforces the
// WORKER_RULES.md rule that `process.env` is only read inside `src/config/`
// (Prisma's own `env()` in schema.prisma is the sole exception and is not
// TypeScript, so it is unaffected by this rule).
// ──────────────────────────────────────────────────────────────────────────────

import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

const noProcessEnv = {
  selector: "MemberExpression[object.name='process'][property.name='env']",
  message: 'Do not read process.env outside src/config/. Add the variable to env.schema.ts instead.',
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'generated/**'],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      sourceType: 'commonjs',
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: eslintPluginPrettier,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'prettier/prettier': 'error',
      'no-console': 'error',
      'no-restricted-syntax': ['error', noProcessEnv],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    // Prisma's env() call lives in schema.prisma, not TS, so nothing to
    // exempt here; this override only lifts the process.env ban for the
    // config module itself, which is where it is read and validated.
    files: ['src/config/**/*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Tests legitimately need process.env to seed env vars before loading the
    // app under test, and console.warn for skipped-step notices in e2e flows.
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-syntax': 'off',
      'no-console': 'off',
    },
  },
  eslintConfigPrettier,
];
