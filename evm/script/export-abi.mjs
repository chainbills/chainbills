#!/usr/bin/env node
// Exports the Chainbills diamond's ABI from forge's build artifacts. Plain Node, no runtime dependencies: run
// `forge build` first, then `node script/export-abi.mjs` (or `npm run abi:export`).
//
// Writes:
//   abi/chainbills.json        - IChainbills (every routed function, event, and error) plus the diamond- and
//                                 cut-level errors declared outside IChainbills (Diamond, LibDiamond, CbFacetSet).
//   abi/chainbills.ts          - the same array as `export const chainbillsAbi = [...] as const;`
//   abi/facets/<Interface>.json - one file per facet interface (ICb<Facet>.sol), its own ABI only.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'out');
const SRC_INTERFACES_DIR = join(ROOT, 'src', 'interfaces');
const ABI_DIR = join(ROOT, 'abi');
const FACETS_DIR = join(ABI_DIR, 'facets');

// Contracts whose declared errors are cut- and diamond-level, not part of any facet interface, but still part of
// what a caller of the deployed diamond can revert with.
const EXTRA_ERROR_SOURCES = ['Diamond', 'LibDiamond', 'CbFacetSet'];

// ICb<Facet>.sol files that are shared error/event definitions rather than one facet's own interface.
const SHARED_INTERFACE_NAMES = new Set(['ICbErrors', 'ICbEvents']);

function readArtifact(contractName) {
  const file = join(OUT_DIR, `${contractName}.sol`, `${contractName}.json`);
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (cause) {
    throw new Error(`missing build artifact for ${contractName} (run 'forge build' first): ${file}`, { cause });
  }
  return JSON.parse(raw);
}

/// Canonical Solidity type of one ABI input/output, recursing into tuples. Two ABI entries with the same name and
/// the same canonical input types always share the same selector, so this string is a reliable dedup key without
/// needing to compute keccak256 selectors directly.
function canonicalType(param) {
  if (param.type.startsWith('tuple')) {
    const arraySuffix = param.type.slice('tuple'.length);
    return `(${param.components.map(canonicalType).join(',')})${arraySuffix}`;
  }
  return param.type;
}

function dedupeKey(entry) {
  const inputs = (entry.inputs ?? []).map(canonicalType).join(',');
  if (entry.type === 'event') return `event ${entry.name}(${inputs})${entry.anonymous ? ' anonymous' : ''}`;
  return `${entry.type} ${entry.name}(${inputs})`;
}

function collectInto(combined, seen, entries) {
  for (const entry of entries) {
    if (entry.type !== 'function' && entry.type !== 'event' && entry.type !== 'error') continue;
    const key = dedupeKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(entry);
  }
}

function main() {
  const seen = new Set();
  const combined = [];

  collectInto(combined, seen, readArtifact('IChainbills').abi);
  for (const name of EXTRA_ERROR_SOURCES) {
    const errors = readArtifact(name).abi.filter((entry) => entry.type === 'error');
    collectInto(combined, seen, errors);
  }

  mkdirSync(ABI_DIR, { recursive: true });
  writeFileSync(join(ABI_DIR, 'chainbills.json'), `${JSON.stringify(combined, null, 2)}\n`);
  writeFileSync(
    join(ABI_DIR, 'chainbills.ts'),
    `export const chainbillsAbi = ${JSON.stringify(combined, null, 2)} as const;\n`
  );

  mkdirSync(FACETS_DIR, { recursive: true });
  const facetInterfaceNames = readdirSync(SRC_INTERFACES_DIR)
    .filter((file) => file.startsWith('ICb') && file.endsWith('.sol'))
    .map((file) => file.slice(0, -'.sol'.length))
    .filter((name) => !SHARED_INTERFACE_NAMES.has(name))
    .sort();

  for (const name of facetInterfaceNames) {
    const abi = readArtifact(name).abi.filter(
      (entry) => entry.type === 'function' || entry.type === 'event' || entry.type === 'error'
    );
    writeFileSync(join(FACETS_DIR, `${name}.json`), `${JSON.stringify(abi, null, 2)}\n`);
  }

  console.log(
    `Wrote abi/chainbills.json and abi/chainbills.ts (${combined.length} entries), ` +
      `and ${facetInterfaceNames.length} facet files under abi/facets/.`
  );
}

main();
