// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — ABI sync test
//
// When evm/abi/chainbills.json exists (local dev, CI with the full repo),
// asserts that the copied ABI in chainbills.ts deep-equals the JSON source of
// truth. When the file is absent (Docker build, CI without the evm/ tree),
// the test is skipped with a descriptive message so the build does not fail.
// ──────────────────────────────────────────────────────────────────────────────

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chainbillsAbi } from './chainbills';

// Path from this file: ../../../../evm/abi/chainbills.json
const EVM_ABI_JSON_PATH = join(__dirname, '../../../../evm/abi/chainbills.json');

describe('chainbillsAbi sync', () => {
  it('matches evm/abi/chainbills.json when that file exists, skipped otherwise', async () => {
    if (!existsSync(EVM_ABI_JSON_PATH)) {
      process.stdout.write(`Skipping ABI sync check — ${EVM_ABI_JSON_PATH} not present in this build context.\n`);
      return;
    }
    const raw = await readFile(EVM_ABI_JSON_PATH, 'utf-8');
    const sourceOfTruth = JSON.parse(raw) as unknown;
    expect(chainbillsAbi).toEqual(sourceOfTruth);
  });
});
