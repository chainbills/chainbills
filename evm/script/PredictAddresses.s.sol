// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbFacetDeployer} from './base/CbFacetDeployer.sol';
import {CbFacetSet} from '../src/CbFacetSet.sol';

/// Prints every address `DeployChainbills` would produce for `CB_SALT` and `OWNER`, without broadcasting or
/// deploying anything. A CREATE2 address depends only on the deployer, the salt, and the creation code — never on
/// the broadcaster's nonce or the target chain — so the same `CB_SALT` and `OWNER` predict (and later deploy) the
/// same diamond address on every chain.
///
/// Required env: `CB_SALT`, `OWNER`.
contract PredictAddresses is CbFacetDeployer {
  function run() public view {
    bytes32 salt = vm.envBytes32('CB_SALT');
    address owner = vm.envAddress('OWNER');

    LinkedLibrary[] memory libs = _predictLibraries(salt);
    for (uint256 i; i < libs.length; i++) {
      console.log(libs[i].name, libs[i].addr);
    }

    address[] memory facetImpls = _predictFacets(salt, libs);
    CbFacetSet.FacetEntry[] memory entries = CbFacetSet.facets();
    for (uint256 i; i < entries.length; i++) {
      console.log(entries[i].name, facetImpls[i]);
    }

    address diamondCutFacet = _predict(salt, _rawCode('DiamondCutFacet'));
    console.log('DiamondCutFacet', diamondCutFacet);

    address init = _predict(salt, _rawCode('ChainbillsDiamondInit'));
    console.log('ChainbillsDiamondInit', init);

    bytes memory diamondInitCode = abi.encodePacked(_rawCode('Diamond'), abi.encode(owner, diamondCutFacet));
    address diamond = _predict(salt, diamondInitCode);
    console.log('Diamond', diamond);
  }
}
