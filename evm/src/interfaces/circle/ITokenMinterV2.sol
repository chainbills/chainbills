// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Subset of Circle's CCTP V2 TokenMinterV2 used by Chainbills.
interface ITokenMinterV2 {
  /// Returns the local token minted for a remote token.
  /// @param remoteDomain Circle domain of the remote chain.
  /// @param remoteToken Remote token in 32-byte format.
  /// @return Local token address, or zero.
  function getLocalToken(uint32 remoteDomain, bytes32 remoteToken) external view returns (address);
}
