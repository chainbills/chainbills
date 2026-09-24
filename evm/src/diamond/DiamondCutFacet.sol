// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IDiamondCut} from '../interfaces/diamond/IDiamondCut.sol';
import {LibOwnership} from '../access/LibOwnership.sol';
import {LibDiamond} from './LibDiamond.sol';

/// Owner-only ERC-2535 diamond cut.
contract DiamondCutFacet is IDiamondCut {
  /// @inheritdoc IDiamondCut
  function diamondCut(FacetCut[] calldata cuts, address init, bytes calldata data) external override {
    LibOwnership.enforceIsOwner();
    LibDiamond.diamondCut(cuts, init, data);
  }
}
