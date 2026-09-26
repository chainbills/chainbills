// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Allowlists tokens for payment on the diamond named by `DIAMOND`.
///
/// Two modes, decided at runtime:
///
///   1. Single token — set `TOKEN` (0x-hex, or the diamond's own address for the native token).
///      Example: `TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 ./script/run.sh base AllowPaymentsForToken`
///
///   2. Sync from `script/env/tokens.json` — leave `TOKEN` unset. The script reads the list for
///      `CHAIN_NAME` and allowlists every entry not already `isSupported`. The `"NATIVE"` sentinel
///      resolves to the diamond's own address. Already-allowed tokens are skipped, so this is
///      safe to re-run after every tokens.json edit.
///      Example: `./script/run.sh base AllowPaymentsForToken`
///
/// Required env: `DIAMOND` (both modes). Either `TOKEN` (single-token mode) or `CHAIN_NAME` (sync
/// mode). `CHAIN_NAME` is exported by `run.sh` automatically.
contract AllowPaymentsForToken is CbAdminScript {
  function run() public {
    string memory tokenEnv = vm.envOr('TOKEN', string(''));

    if (bytes(tokenEnv).length > 0) {
      _allowSingle(vm.envAddress('TOKEN'));
    } else {
      _syncFromJson();
    }
  }

  /// Allowlists a single explicit token address. Idempotent — safe to re-run.
  function _allowSingle(address token) internal {
    if (_diamond().isTokenSupported(token)) {
      console.log('Token already allowed, no-op:', token);
      return;
    }

    vm.startBroadcast();
    _diamond().allowPaymentsForToken(token);
    vm.stopBroadcast();

    console.log('Allowed payments for token', token);
  }

  /// Reads `script/env/tokens.json[chainName]` and allowlists every entry not already supported.
  /// `"NATIVE"` resolves to the diamond's own address (Chainbills' native-token sentinel).
  function _syncFromJson() internal {
    string memory chainName = vm.envString('CHAIN_NAME');
    console.log('Syncing token allowlist from tokens.json for chain', chainName);

    address[] memory tokens = _readAllowedTokens(chainName);
    if (tokens.length == 0) {
      console.log('tokens.json has no entries for this chain - nothing to do');
      return;
    }

    // Two passes so we broadcast one contiguous batch of transactions after the read checks.
    // Bump the counter as we go so the summary matches the actual number of tx broadcasts.
    address[] memory toAllow = new address[](tokens.length);
    uint256 count;
    for (uint256 i; i < tokens.length; i++) {
      address token = tokens[i];
      if (_diamond().isTokenSupported(token)) {
        console.log('Skipping already-allowed token', token);
        continue;
      }
      toAllow[count] = token;
      count++;
    }

    if (count == 0) {
      console.log('Every tokens.json entry is already allowed - nothing to broadcast');
      return;
    }

    vm.startBroadcast();
    for (uint256 i; i < count; i++) {
      _diamond().allowPaymentsForToken(toAllow[i]);
      console.log('Allowed payments for token', toAllow[i]);
    }
    vm.stopBroadcast();

    console.log('Newly allowed tokens:', count);
  }

  /// Reads `script/env/tokens.json[chainName]` and returns the token addresses. `"NATIVE"` resolves
  /// to the diamond's own address (Chainbills' native-token sentinel).
  function _readAllowedTokens(string memory chainName) internal view returns (address[] memory) {
    string memory json = vm.readFile('script/env/tokens.json');
    string memory key = string.concat('.', chainName);
    if (!vm.keyExistsJson(json, key)) return new address[](0);

    string[] memory names = vm.parseJsonStringArray(json, key);
    address[] memory result = new address[](names.length);
    address diamond = address(_diamond());
    for (uint256 i; i < names.length; i++) {
      bool isNative = keccak256(bytes(names[i])) == keccak256(bytes('NATIVE'));
      result[i] = isNative ? diamond : vm.parseAddress(names[i]);
    }
    return result;
  }
}
