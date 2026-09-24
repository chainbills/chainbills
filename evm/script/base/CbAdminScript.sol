// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Script} from 'forge-std/Script.sol';
import {IChainbills} from '../../src/interfaces/IChainbills.sol';
import {LibAddressFormat} from '../../src/libraries/LibAddressFormat.sol';

/// Shared env reading for admin scripts: one contract call each, through `IChainbills` at `DIAMOND`.
abstract contract CbAdminScript is Script {
  /// Returns the diamond named by the `DIAMOND` env var.
  function _diamond() internal view returns (IChainbills) {
    return IChainbills(vm.envAddress('DIAMOND'));
  }

  /// Reads `<chainDir>/<chainName>.json` (a `deploys/<chain>.json` record) and returns its `diamond` address.
  /// @param chainName Chain name, matching a `script/env/<chainName>.env` and `deploys/<chainName>.json` pair.
  function _diamondOf(string memory chainName) internal view returns (address) {
    string memory json = vm.readFile(string.concat('deploys/', chainName, '.json'));
    return vm.parseJsonAddress(json, '.diamond');
  }

  /// Left-pads an EVM address to the 32-byte cross-chain address format.
  function _toBytes32(address account) internal pure returns (bytes32) {
    return LibAddressFormat.toBytes32(account);
  }
}
