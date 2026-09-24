// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IDiamondCut} from '../interfaces/diamond/IDiamondCut.sol';
import {LibOwnership} from '../access/LibOwnership.sol';
import {LibDiamond} from './LibDiamond.sol';

/// Chainbills diamond entry point. Holds all state and delegates every call to the facet
/// registered for its selector.
/// @dev The constructor takes only the owner and the cut facet so the diamond deploys to the same
/// address on every chain through CREATE2. All other facets and initialization arrive in the first
/// `diamondCut`. The diamond has no `receive` function: native tokens enter only through payable
/// facet functions.
contract Diamond {
  /// No facet serves `selector`.
  error FunctionNotFound(bytes4 selector);

  /// The owner is the zero address.
  error ZeroOwner();

  /// Sets the owner and routes `diamondCut` to `diamondCutFacet`.
  /// @param owner_ Initial owner.
  /// @param diamondCutFacet Facet implementing `IDiamondCut.diamondCut`.
  constructor(address owner_, address diamondCutFacet) payable {
    if (owner_ == address(0)) revert ZeroOwner();
    LibOwnership.setOwner(owner_);

    bytes4[] memory selectors = new bytes4[](1);
    selectors[0] = IDiamondCut.diamondCut.selector;
    IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
    cuts[0] = IDiamondCut.FacetCut({
      facetAddress: diamondCutFacet, action: IDiamondCut.FacetCutAction.Add, functionSelectors: selectors
    });
    LibDiamond.diamondCut(cuts, address(0), '');
  }

  /// Delegates the call to the facet registered for `msg.sig`.
  fallback() external payable {
    address facet = LibDiamond.layout().selectorToFacetAndPosition[msg.sig].facetAddress;
    if (facet == address(0)) revert FunctionNotFound(msg.sig);
    assembly {
      calldatacopy(0, 0, calldatasize())
      let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
      returndatacopy(0, 0, returndatasize())
      switch result
      case 0 { revert(0, returndatasize()) }
      default { return(0, returndatasize()) }
    }
  }
}
