// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Script, console} from 'forge-std/Script.sol';

/// Shared CREATE2 deployment helpers for every Chainbills deploy and admin script.
/// @dev Every contract Chainbills deploys — the six linked libraries, every facet, `DiamondCutFacet`,
/// `ChainbillsDiamondInit`, and the diamond itself — goes through the canonical deterministic deployment proxy at
/// `CREATE2_DEPLOYER` with a caller-chosen salt, so the same salt and constructor arguments produce the same address
/// on every chain.
///
/// A linked library's address depends only on its own (already-linked) creation code, so libraries are deployed
/// bottom-up and their addresses are patched into whatever depends on them — other libraries and facets alike —
/// before that code is hashed or deployed. This sidesteps `forge`'s automatic library auto-linking, which deploys
/// libraries through its own internal salt instead of the caller's, and reads creation code straight out of the
/// build artifact rather than through `vm.getCode`, which refuses to return bytecode that still has unresolved
/// library placeholders. Patching happens on the artifact's hex-encoded `bytecode.object` string, because a
/// placeholder is literal ASCII text (`__$<34 hex chars>$__`) written into the position a linked address would
/// otherwise decode to — patching it before decoding avoids ever hex-decoding invalid, not-yet-linked bytecode.
abstract contract CbScript is Script {
  /// Canonical deterministic deployment proxy. Same address on every EVM chain that has ever received the
  /// keyless deployment transaction (https://github.com/Arachnid/deterministic-deployment-proxy).
  address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

  /// The target chain has no code at `CREATE2_DEPLOYER`.
  error Create2DeployerNotFound(address deployer);

  /// A CREATE2 deployment returned an address other than the one predicted off-chain.
  error Create2AddressMismatch(address predicted, address actual);

  /// A low-level call to `CREATE2_DEPLOYER` reverted.
  error Create2DeploymentFailed();

  /// Reverts unless `CREATE2_DEPLOYER` already has code on the current chain.
  function _requireCreate2Deployer() internal view {
    if (CREATE2_DEPLOYER.code.length == 0) revert Create2DeployerNotFound(CREATE2_DEPLOYER);
  }

  /// Returns the CREATE2 address `initCode` would deploy to under `salt`.
  /// @param salt CREATE2 salt.
  /// @param initCode Full creation code, including constructor arguments and every library already linked.
  /// @return Predicted address.
  function _predict(bytes32 salt, bytes memory initCode) internal pure returns (address) {
    return vm.computeCreate2Address(salt, keccak256(initCode), CREATE2_DEPLOYER);
  }

  /// Deploys `initCode` under `salt` through `CREATE2_DEPLOYER` when no code sits at the predicted address yet;
  /// otherwise reuses what is already there. Safe to call repeatedly (idempotent reruns).
  /// @param salt CREATE2 salt.
  /// @param initCode Full creation code, including constructor arguments and every library already linked.
  /// @param label Human-readable name logged alongside the address.
  /// @return addr The deployed (or already-deployed) address.
  /// @return wasDeployed True when this call broadcast a new deployment.
  function _deployIfNeeded(bytes32 salt, bytes memory initCode, string memory label)
    internal
    returns (address addr, bool wasDeployed)
  {
    addr = _predict(salt, initCode);
    if (addr.code.length > 0) {
      console.log(string.concat(label, ' already deployed at'), addr);
      return (addr, false);
    }

    _requireCreate2Deployer();
    (bool ok, bytes memory ret) = CREATE2_DEPLOYER.call(abi.encodePacked(salt, initCode));
    if (!ok || ret.length != 20) revert Create2DeploymentFailed();
    // casting to 'bytes20' is safe because the length check above already rejects anything but a 20-byte address
    // forge-lint: disable-next-line(unsafe-typecast)
    address actual = address(bytes20(ret));
    if (actual != addr) revert Create2AddressMismatch(addr, actual);

    console.log(string.concat('Deployed ', label, ' at'), addr);
    return (addr, true);
  }

  /// Returns the hex-encoded creation code (`0x`-prefixed, possibly still carrying unresolved library
  /// placeholders) of `contractName`, read directly from its build artifact at `out/<contractName>.sol/<contractName>.json`.
  /// @param contractName Contract name; must be unique across `src/` (true of every Chainbills contract).
  function _rawCodeHex(string memory contractName) internal view returns (string memory) {
    string memory json = vm.readFile(string.concat('out/', contractName, '.sol/', contractName, '.json'));
    return vm.parseJsonString(json, '.bytecode.object');
  }

  /// Returns the creation code of `contractName` decoded to bytes. Only valid once every library placeholder it
  /// contains, if any, has been patched with `_linkHex`.
  /// @param contractName Contract name; must be unique across `src/` (true of every Chainbills contract).
  function _rawCode(string memory contractName) internal view returns (bytes memory) {
    return _decode(_rawCodeHex(contractName));
  }

  /// Decodes a fully-linked hex creation-code string (as returned by `_rawCodeHex` or `_linkHex`) to bytes.
  function _decode(string memory hexCode) internal pure returns (bytes memory) {
    return vm.parseBytes(hexCode);
  }

  /// Patches every occurrence of `sourcePath:contractName`'s link placeholder in the hex-encoded creation `code`
  /// with `addr`. A no-op when the placeholder does not appear, so it is safe to call for a library `code` does
  /// not actually reference.
  /// @param code Hex-encoded creation code (as returned by `_rawCodeHex`).
  /// @param sourcePath Source file path of the library being linked, e.g. `src/libraries/CbLedger.sol`.
  /// @param contractName Library name declared in that file.
  /// @param addr Deployed address of the library.
  /// @return The patched hex-encoded creation code.
  function _linkHex(string memory code, string memory sourcePath, string memory contractName, address addr)
    internal
    pure
    returns (string memory)
  {
    bytes memory placeholder = bytes(_linkPlaceholder(sourcePath, contractName));
    bytes memory replacement = bytes(_toHex40(addr));
    bytes memory buf = bytes(code);
    uint256 n = buf.length;
    uint256 phLen = placeholder.length;
    if (n < phLen) return code;
    for (uint256 i; i + phLen <= n; i++) {
      bool isMatch = true;
      for (uint256 j; j < phLen; j++) {
        if (buf[i + j] != placeholder[j]) {
          isMatch = false;
          break;
        }
      }
      if (isMatch) {
        for (uint256 j; j < phLen; j++) {
          buf[i + j] = replacement[j];
        }
        i += phLen - 1;
      }
    }
    return string(buf);
  }

  /// Computes the 40-ASCII-character `__$<34 hex chars>$__` placeholder solc embeds for an unlinked library
  /// reference, in the same textual form it appears in `bytecode.object`.
  /// @param sourcePath Source file path of the library, e.g. `src/libraries/CbLedger.sol`.
  /// @param contractName Library name declared in that file.
  function _linkPlaceholder(string memory sourcePath, string memory contractName)
    internal
    pure
    returns (string memory placeholder)
  {
    bytes32 hash = keccak256(bytes(string.concat(sourcePath, ':', contractName)));
    bytes memory hexAlphabet = '0123456789abcdef';
    bytes memory hexHash = new bytes(34);
    for (uint256 i; i < 17; i++) {
      uint8 b = uint8(hash[i]);
      hexHash[2 * i] = hexAlphabet[b >> 4];
      hexHash[2 * i + 1] = hexAlphabet[b & 0x0f];
    }
    placeholder = string(abi.encodePacked('__$', hexHash, '$__'));
  }

  /// Lowercase, `0x`-free, 40-character hex encoding of `addr`.
  function _toHex40(address addr) internal pure returns (string memory) {
    bytes memory hexAlphabet = '0123456789abcdef';
    bytes memory out = new bytes(40);
    uint160 a = uint160(addr);
    for (uint256 i; i < 20; i++) {
      // casting to 'uint8' is safe because the right shift by a multiple of 8 leaves exactly one byte in range
      // forge-lint: disable-next-line(unsafe-typecast)
      uint8 b = uint8(a >> (8 * (19 - i)));
      out[2 * i] = hexAlphabet[b >> 4];
      out[2 * i + 1] = hexAlphabet[b & 0x0f];
    }
    return string(out);
  }
}
