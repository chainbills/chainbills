// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Minimal mock for ITokenMinter used during Chainbills setup and payment tests.
contract MockCircleTokenMinter {
  mapping(bytes32 => address) public localTokens;

  function setLocalToken(bytes32 sourceIdHash, address localToken) external {
    localTokens[sourceIdHash] = localToken;
  }

  function remoteTokensToLocalTokens(bytes32 sourceIdHash) external view returns (address) {
    return localTokens[sourceIdHash];
  }

  function burnLimitsPerMessage(address) external pure returns (uint256) {
    return type(uint256).max;
  }

  // Blank Test Function to exclude this Mock from test coverage reports.
  function test() public {}
}
