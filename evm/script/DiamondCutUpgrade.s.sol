// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbFacetDeployer} from './base/CbFacetDeployer.sol';
import {CbFacetSet} from '../src/CbFacetSet.sol';
import {IChainbills} from '../src/interfaces/IChainbills.sol';
import {IDiamondCut} from '../src/interfaces/diamond/IDiamondCut.sol';

/// Deploys new implementations of the facets named in `FACETS` and cuts the diamond over to them.
///
/// For each facet, the new implementation's selectors (from `CbFacetSet`, i.e. this branch's source) are diffed
/// against whatever the diamond currently routes: selectors already routed elsewhere are `Replace`d, selectors the
/// facet gains are `Add`ed, and selectors the diamond currently routes to the facet's old implementation but that no
/// longer appear in the new selector set are `Remove`d. A brand-new facet name (nothing currently routes any of its
/// selectors) is a pure `Add`.
///
/// Required env: `CB_SALT`, `DIAMOND`, `FACETS` (comma-separated `CbFacetSet` facet names). Set `DRY_RUN=true` to
/// print the cut without broadcasting.
contract DiamondCutUpgrade is CbFacetDeployer {
  function run() public {
    bytes32 salt = vm.envBytes32('CB_SALT');
    IChainbills diamond = IChainbills(vm.envAddress('DIAMOND'));
    string[] memory facetNames = vm.envString('FACETS', ',');
    bool dryRun = vm.envOr('DRY_RUN', false);

    LinkedLibrary[] memory libs = dryRun ? _predictLibraries(salt) : _deployLibraries(salt);

    IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](facetNames.length * 3);
    uint256 count;

    if (!dryRun) vm.startBroadcast();
    for (uint256 i; i < facetNames.length; i++) {
      count = _appendFacetCuts(cuts, count, diamond, facetNames[i], salt, libs, dryRun);
    }

    if (count == 0) {
      console.log('Nothing to cut: every named facet already matches CbFacetSet.');
      if (!dryRun) vm.stopBroadcast();
      return;
    }

    IDiamondCut.FacetCut[] memory finalCuts = new IDiamondCut.FacetCut[](count);
    for (uint256 i; i < count; i++) {
      finalCuts[i] = cuts[i];
    }

    if (dryRun) {
      _printCuts(finalCuts);
      return;
    }

    IDiamondCut(address(diamond)).diamondCut(finalCuts, address(0), '');
    vm.stopBroadcast();
    console.log('Cut', count, 'selector changes onto', address(diamond));
  }

  /// Deploys (or predicts) `facetName`'s new implementation, diffs it against the diamond's current routing, and
  /// appends up to three `FacetCut`s (`Replace`, `Add`, `Remove`, in that order, skipping empty ones) to `cuts`
  /// starting at `cuts[count]`.
  /// @return newCount `count` plus however many cuts were appended.
  function _appendFacetCuts(
    IDiamondCut.FacetCut[] memory cuts,
    uint256 count,
    IChainbills diamond,
    string memory facetName,
    bytes32 salt,
    LinkedLibrary[] memory libs,
    bool dryRun
  ) internal returns (uint256 newCount) {
    CbFacetSet.FacetEntry memory entry = _findFacetEntry(facetName);
    bytes memory code = _decode(_linkAllHex(_rawCodeHex(entry.name), libs));
    address newImpl = dryRun ? _predict(salt, code) : _deploy(salt, code, entry.name);

    (bytes4[] memory replaceSelectors, bytes4[] memory addSelectors, bytes4[] memory removeSelectors) =
      _diff(diamond, entry.selectors, newImpl);

    newCount = count;
    if (replaceSelectors.length > 0) {
      cuts[newCount++] = IDiamondCut.FacetCut(newImpl, IDiamondCut.FacetCutAction.Replace, replaceSelectors);
    }
    if (addSelectors.length > 0) {
      cuts[newCount++] = IDiamondCut.FacetCut(newImpl, IDiamondCut.FacetCutAction.Add, addSelectors);
    }
    if (removeSelectors.length > 0) {
      cuts[newCount++] = IDiamondCut.FacetCut(address(0), IDiamondCut.FacetCutAction.Remove, removeSelectors);
    }
  }

  function _deploy(bytes32 salt, bytes memory code, string memory label) internal returns (address addr) {
    (addr,) = _deployIfNeeded(salt, code, label);
  }

  function _findFacetEntry(string memory facetName) internal pure returns (CbFacetSet.FacetEntry memory) {
    CbFacetSet.FacetEntry[] memory entries = CbFacetSet.facets();
    bytes32 nameHash = keccak256(bytes(facetName));
    for (uint256 i; i < entries.length; i++) {
      if (keccak256(bytes(entries[i].name)) == nameHash) return entries[i];
    }
    revert(string.concat('DiamondCutUpgrade: unknown facet ', facetName));
  }

  /// Splits `newSelectors` into `Replace` (currently routed to some other address), `Add` (currently routed
  /// nowhere), and silently drops whichever are already routed to `newImpl` (nothing to cut). Separately finds
  /// `Remove`: selectors the old implementation of this facet served that `newSelectors` no longer includes. The
  /// old implementation is whichever address currently serves a selector in `newSelectors`, other than `newImpl`.
  function _diff(IChainbills diamond, bytes4[] memory newSelectors, address newImpl)
    internal
    view
    returns (bytes4[] memory replaceSelectors, bytes4[] memory addSelectors, bytes4[] memory removeSelectors)
  {
    address oldImpl;
    for (uint256 i; i < newSelectors.length; i++) {
      address current = diamond.facetAddress(newSelectors[i]);
      if (current != address(0) && current != newImpl) {
        oldImpl = current;
        break;
      }
    }

    bytes4[] memory replaceBuf = new bytes4[](newSelectors.length);
    bytes4[] memory addBuf = new bytes4[](newSelectors.length);
    uint256 replaceCount;
    uint256 addCount;
    for (uint256 i; i < newSelectors.length; i++) {
      address current = diamond.facetAddress(newSelectors[i]);
      if (current == newImpl) {
        continue; // already correctly routed; nothing to cut for this selector
      } else if (current == address(0)) {
        addBuf[addCount++] = newSelectors[i];
      } else {
        replaceBuf[replaceCount++] = newSelectors[i];
      }
    }

    bytes4[] memory oldSelectors = oldImpl == address(0) ? new bytes4[](0) : diamond.facetFunctionSelectors(oldImpl);
    bytes4[] memory removeBuf = new bytes4[](oldSelectors.length);
    uint256 removeCount;
    for (uint256 i; i < oldSelectors.length; i++) {
      if (!_contains(newSelectors, oldSelectors[i])) {
        removeBuf[removeCount++] = oldSelectors[i];
      }
    }

    replaceSelectors = _truncate(replaceBuf, replaceCount);
    addSelectors = _truncate(addBuf, addCount);
    removeSelectors = _truncate(removeBuf, removeCount);
  }

  function _contains(bytes4[] memory selectors, bytes4 selector) internal pure returns (bool) {
    for (uint256 i; i < selectors.length; i++) {
      if (selectors[i] == selector) return true;
    }
    return false;
  }

  function _truncate(bytes4[] memory arr, uint256 len) internal pure returns (bytes4[] memory out) {
    out = new bytes4[](len);
    for (uint256 i; i < len; i++) {
      out[i] = arr[i];
    }
  }

  function _printCuts(IDiamondCut.FacetCut[] memory cuts) internal pure {
    for (uint256 i; i < cuts.length; i++) {
      console.log('---');
      console.log('facet', cuts[i].facetAddress);
      console.log(
        'action',
        cuts[i].action == IDiamondCut.FacetCutAction.Add
          ? 'Add'
          : cuts[i].action == IDiamondCut.FacetCutAction.Replace ? 'Replace' : 'Remove'
      );
      for (uint256 j; j < cuts[i].functionSelectors.length; j++) {
        console.logBytes4(cuts[i].functionSelectors[j]);
      }
    }
  }
}
