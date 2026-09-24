// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Minimal facet used to exercise diamond cuts in tests.
/// @dev Function names avoid a `test` prefix so `forge test` does not pick them up as test cases of their own.
contract TestFacet {
  function facetValueA() external pure returns (uint256) {
    return 42;
  }

  function facetValueB() external pure returns (uint256) {
    return 43;
  }
}

/// A second version of `TestFacet` used to exercise `Replace` cuts.
contract TestFacetV2 {
  function facetValueA() external pure returns (uint256) {
    return 99;
  }

  function facetValueB() external pure returns (uint256) {
    return 43;
  }
}

/// Returns the selectors of `TestFacet` / `TestFacetV2` (identical layout).
library TestFacetSelectors {
  function selectors() internal pure returns (bytes4[] memory list) {
    list = new bytes4[](2);
    list[0] = TestFacet.facetValueA.selector;
    list[1] = TestFacet.facetValueB.selector;
  }
}

/// Diamond-cut initializer that always reverts without a reason string.
contract FailingInitializer {
  function fail() external pure {
    revert();
  }
}
