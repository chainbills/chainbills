// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CbScript} from './CbScript.sol';

/// Deploys and links the six linked libraries facets depend on: `CbPayloadCodec`, `CbPagination`, `CbLedger`,
/// `CbWormholeMessaging`, `CbCctpMessaging`, and `CbPayableSync`. `CbCctpMessaging` links `CbPayloadCodec`;
/// `CbPayableSync` links `CbCctpMessaging`, `CbPayloadCodec`, and `CbWormholeMessaging` — both are deployed only
/// after their dependencies, so the libraries below are declared in a valid deployment order.
abstract contract CbLibrarySet is CbScript {
  /// One deployed library, keyed by its fully-qualified name for linking.
  struct LinkedLibrary {
    string sourcePath;
    string name;
    address addr;
  }

  /// Deploys (or reuses) every linked library under `salt`, in dependency order.
  /// @param salt CREATE2 salt shared by every Chainbills deployment on this chain.
  /// @return libs The six libraries, in deployment order.
  function _deployLibraries(bytes32 salt) internal returns (LinkedLibrary[] memory libs) {
    libs = new LinkedLibrary[](6);

    libs[0] = _deployLibrary(salt, 'src/libraries/CbPayloadCodec.sol', 'CbPayloadCodec', libs, 0);
    libs[1] = _deployLibrary(salt, 'src/libraries/CbPagination.sol', 'CbPagination', libs, 0);
    libs[2] = _deployLibrary(salt, 'src/libraries/CbLedger.sol', 'CbLedger', libs, 0);
    libs[3] = _deployLibrary(salt, 'src/libraries/CbWormholeMessaging.sol', 'CbWormholeMessaging', libs, 0);
    libs[4] = _deployLibrary(salt, 'src/libraries/CbCctpMessaging.sol', 'CbCctpMessaging', libs, 4);
    libs[5] = _deployLibrary(salt, 'src/libraries/CbPayableSync.sol', 'CbPayableSync', libs, 5);
  }

  /// Predicts the address of every linked library under `salt` without deploying anything.
  /// @param salt CREATE2 salt shared by every Chainbills deployment on this chain.
  /// @return libs The six libraries, in deployment order, with predicted (possibly undeployed) addresses.
  function _predictLibraries(bytes32 salt) internal view returns (LinkedLibrary[] memory libs) {
    libs = new LinkedLibrary[](6);

    libs[0] = _predictLibrary(salt, 'src/libraries/CbPayloadCodec.sol', 'CbPayloadCodec', libs, 0);
    libs[1] = _predictLibrary(salt, 'src/libraries/CbPagination.sol', 'CbPagination', libs, 0);
    libs[2] = _predictLibrary(salt, 'src/libraries/CbLedger.sol', 'CbLedger', libs, 0);
    libs[3] = _predictLibrary(salt, 'src/libraries/CbWormholeMessaging.sol', 'CbWormholeMessaging', libs, 0);
    libs[4] = _predictLibrary(salt, 'src/libraries/CbCctpMessaging.sol', 'CbCctpMessaging', libs, 4);
    libs[5] = _predictLibrary(salt, 'src/libraries/CbPayableSync.sol', 'CbPayableSync', libs, 5);
  }

  /// Patches every already-deployed library address in `libs[0:linkedCount]` into hex-encoded creation `code`.
  function _linkLibrariesHex(string memory code, LinkedLibrary[] memory libs, uint256 linkedCount)
    private
    pure
    returns (string memory)
  {
    for (uint256 i; i < linkedCount; i++) {
      code = _linkHex(code, libs[i].sourcePath, libs[i].name, libs[i].addr);
    }
    return code;
  }

  function _deployLibrary(
    bytes32 salt,
    string memory sourcePath,
    string memory name,
    LinkedLibrary[] memory libs,
    uint256 linkedCount
  ) private returns (LinkedLibrary memory) {
    bytes memory code = _decode(_linkLibrariesHex(_rawCodeHex(name), libs, linkedCount));
    (address addr,) = _deployIfNeeded(salt, code, name);
    return LinkedLibrary(sourcePath, name, addr);
  }

  function _predictLibrary(
    bytes32 salt,
    string memory sourcePath,
    string memory name,
    LinkedLibrary[] memory libs,
    uint256 linkedCount
  ) private view returns (LinkedLibrary memory) {
    bytes memory code = _decode(_linkLibrariesHex(_rawCodeHex(name), libs, linkedCount));
    return LinkedLibrary(sourcePath, name, _predict(salt, code));
  }

  /// Patches every one of the six library addresses into hex-encoded creation `code`. Safe for any facet:
  /// placeholders for libraries the facet does not use simply never match.
  /// @param code Hex-encoded creation code (as returned by `_rawCodeHex`).
  /// @param libs The six linked libraries, addressed.
  function _linkAllHex(string memory code, LinkedLibrary[] memory libs) internal pure returns (string memory) {
    return _linkLibrariesHex(code, libs, libs.length);
  }
}
