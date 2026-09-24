// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Minimal facet used to exercise diamond cuts in tests.
contract TestFacet {
  function testFacetValue() external pure returns (uint256) {
    return 42;
  }

  function testFacetOtherValue() external pure returns (uint256) {
    return 43;
  }
}

/// A second version of `TestFacet` used to exercise `Replace` cuts.
contract TestFacetV2 {
  function testFacetValue() external pure returns (uint256) {
    return 99;
  }

  function testFacetOtherValue() external pure returns (uint256) {
    return 43;
  }
}

/// Returns the selectors of `TestFacet` / `TestFacetV2` (identical layout).
library TestFacetSelectors {
  function selectors() internal pure returns (bytes4[] memory list) {
    list = new bytes4[](2);
    list[0] = TestFacet.testFacetValue.selector;
    list[1] = TestFacet.testFacetOtherValue.selector;
  }
}

/// Diamond-cut initializer that always reverts without a reason string.
contract FailingInitializer {
  function fail() external pure {
    revert();
  }
}

