// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IDiamondCut} from '../interfaces/diamond/IDiamondCut.sol';

/// ERC-2535 selector table, facet registry, interface registry, and cut logic.
library LibDiamond {
  /// The facet address has no code.
  error DiamondCutFacetHasNoCode(address facet);

  /// The selector is already routed (on add) or already routed to the same facet (on replace).
  error DiamondCutFunctionAlreadyExists(bytes4 selector);

  /// The selector is not routed.
  error DiamondCutFunctionDoesNotExist(bytes4 selector);

  /// The selector is implemented by the diamond itself and cannot be replaced or removed.
  error DiamondCutImmutableFunction(bytes4 selector);

  /// The initializer address has no code.
  error DiamondCutInitAddressHasNoCode(address init);

  /// The initializer reverted without a reason.
  error DiamondCutInitFailed(address init, bytes data);

  /// The facet address is invalid for the cut action.
  error DiamondCutInvalidFacetAddress();

  /// Initializer calldata was supplied without an initializer.
  error DiamondCutInvalidInitCalldata();

  /// The cut action is unknown.
  error DiamondCutInvalidAction(uint8 action);

  /// A facet cut listed no selectors.
  error DiamondCutNoSelectors();

  /// Facet and position of a routed selector.
  struct FacetAddressAndPosition {
    address facetAddress;
    uint96 functionSelectorPosition;
  }

  /// Selectors and list position of a facet.
  struct FacetFunctionSelectors {
    bytes4[] functionSelectors;
    uint256 facetAddressPosition;
  }

  /// @custom:storage-location erc7201:chainbills.diamond
  struct Layout {
    /// Selector routing table.
    mapping(bytes4 selector => FacetAddressAndPosition) selectorToFacetAndPosition;
    /// Reverse lookup from facet to its selectors.
    mapping(address facet => FacetFunctionSelectors) facetFunctionSelectors;
    /// Every facet with at least one selector.
    address[] facetAddresses;
    /// ERC-165 support registry.
    mapping(bytes4 interfaceId => bool) supportedInterfaces;
  }

  /// keccak256(abi.encode(uint256(keccak256('chainbills.diamond')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0xc080b72b3f52c9625dcc786789ca29520d2336a3872fcd094b6ce71f19f0e800;

  /// Returns the diamond storage.
  /// @return $ Storage pointer.
  function layout() internal pure returns (Layout storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }

  /// Applies `cuts` and then runs the optional initializer.
  /// @param cuts Selector-table changes.
  /// @param init Initializer delegatecall target, or zero.
  /// @param data Initializer calldata.
  function diamondCut(IDiamondCut.FacetCut[] memory cuts, address init, bytes memory data) internal {
    for (uint256 i; i < cuts.length; i++) {
      IDiamondCut.FacetCutAction action = cuts[i].action;
      if (action == IDiamondCut.FacetCutAction.Add) {
        addFunctions(cuts[i].facetAddress, cuts[i].functionSelectors);
      } else if (action == IDiamondCut.FacetCutAction.Replace) {
        replaceFunctions(cuts[i].facetAddress, cuts[i].functionSelectors);
      } else if (action == IDiamondCut.FacetCutAction.Remove) {
        removeFunctions(cuts[i].facetAddress, cuts[i].functionSelectors);
      } else {
        revert DiamondCutInvalidAction(uint8(action));
      }
    }
    emit IDiamondCut.DiamondCut(cuts, init, data);
    initializeDiamondCut(init, data);
  }

  /// Routes new `selectors` to `facet`.
  /// @param facet Facet address.
  /// @param selectors Selectors to add.
  function addFunctions(address facet, bytes4[] memory selectors) internal {
    if (selectors.length == 0) revert DiamondCutNoSelectors();
    if (facet == address(0)) revert DiamondCutInvalidFacetAddress();
    Layout storage $ = layout();
    uint96 position = uint96($.facetFunctionSelectors[facet].functionSelectors.length);
    if (position == 0) _addFacet($, facet);
    for (uint256 i; i < selectors.length; i++) {
      bytes4 selector = selectors[i];
      if ($.selectorToFacetAndPosition[selector].facetAddress != address(0)) {
        revert DiamondCutFunctionAlreadyExists(selector);
      }
      _addFunction($, selector, position, facet);
      position++;
    }
  }

  /// Reroutes existing `selectors` to `facet`.
  /// @param facet Facet address.
  /// @param selectors Selectors to replace.
  function replaceFunctions(address facet, bytes4[] memory selectors) internal {
    if (selectors.length == 0) revert DiamondCutNoSelectors();
    if (facet == address(0)) revert DiamondCutInvalidFacetAddress();
    Layout storage $ = layout();
    uint96 position = uint96($.facetFunctionSelectors[facet].functionSelectors.length);
    if (position == 0) _addFacet($, facet);
    for (uint256 i; i < selectors.length; i++) {
      bytes4 selector = selectors[i];
      address oldFacet = $.selectorToFacetAndPosition[selector].facetAddress;
      if (oldFacet == facet) revert DiamondCutFunctionAlreadyExists(selector);
      _removeFunction($, oldFacet, selector);
      _addFunction($, selector, position, facet);
      position++;
    }
  }

  /// Removes `selectors` from the diamond. `facet` must be zero.
  /// @param facet Must be the zero address.
  /// @param selectors Selectors to remove.
  function removeFunctions(address facet, bytes4[] memory selectors) internal {
    if (selectors.length == 0) revert DiamondCutNoSelectors();
    if (facet != address(0)) revert DiamondCutInvalidFacetAddress();
    Layout storage $ = layout();
    for (uint256 i; i < selectors.length; i++) {
      bytes4 selector = selectors[i];
      _removeFunction($, $.selectorToFacetAndPosition[selector].facetAddress, selector);
    }
  }

  /// Delegatecalls `init` with `data`, bubbling any revert.
  /// @param init Initializer, or zero.
  /// @param data Initializer calldata.
  function initializeDiamondCut(address init, bytes memory data) internal {
    if (init == address(0)) {
      if (data.length != 0) revert DiamondCutInvalidInitCalldata();
      return;
    }
    if (init.code.length == 0) revert DiamondCutInitAddressHasNoCode(init);
    (bool success, bytes memory returndata) = init.delegatecall(data);
    if (!success) {
      if (returndata.length > 0) {
        assembly {
          revert(add(returndata, 32), mload(returndata))
        }
      }
      revert DiamondCutInitFailed(init, data);
    }
  }

  /// Appends `facet` to the facet list after checking it has code.
  function _addFacet(Layout storage $, address facet) private {
    if (facet.code.length == 0) revert DiamondCutFacetHasNoCode(facet);
    $.facetFunctionSelectors[facet].facetAddressPosition = $.facetAddresses.length;
    $.facetAddresses.push(facet);
  }

  /// Routes one selector to `facet` at `position`.
  function _addFunction(Layout storage $, bytes4 selector, uint96 position, address facet) private {
    $.selectorToFacetAndPosition[selector] = FacetAddressAndPosition(facet, position);
    $.facetFunctionSelectors[facet].functionSelectors.push(selector);
  }

  /// Unroutes one selector, and drops `facet` from the facet list when it has no selectors left.
  function _removeFunction(Layout storage $, address facet, bytes4 selector) private {
    if (facet == address(0)) revert DiamondCutFunctionDoesNotExist(selector);
    if (facet == address(this)) revert DiamondCutImmutableFunction(selector);

    // Swap the selector with the facet's last selector, then pop.
    bytes4[] storage selectors = $.facetFunctionSelectors[facet].functionSelectors;
    uint256 position = $.selectorToFacetAndPosition[selector].functionSelectorPosition;
    uint256 lastPosition = selectors.length - 1;
    if (position != lastPosition) {
      bytes4 lastSelector = selectors[lastPosition];
      selectors[position] = lastSelector;
      // forge-lint: disable-next-line(unsafe-typecast)
      $.selectorToFacetAndPosition[lastSelector].functionSelectorPosition = uint96(position);
    }
    selectors.pop();
    delete $.selectorToFacetAndPosition[selector];

    // Swap the facet with the last facet, then pop, once it serves nothing.
    if (lastPosition == 0) {
      uint256 lastFacetPosition = $.facetAddresses.length - 1;
      uint256 facetPosition = $.facetFunctionSelectors[facet].facetAddressPosition;
      if (facetPosition != lastFacetPosition) {
        address lastFacet = $.facetAddresses[lastFacetPosition];
        $.facetAddresses[facetPosition] = lastFacet;
        $.facetFunctionSelectors[lastFacet].facetAddressPosition = facetPosition;
      }
      $.facetAddresses.pop();
      delete $.facetFunctionSelectors[facet].facetAddressPosition;
    }
  }
}
