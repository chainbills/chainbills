// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CbAdminScript} from './CbAdminScript.sol';
import {IChainbills} from '../../src/interfaces/IChainbills.sol';

/// Shared role-name lookup for `GrantRole` and `RevokeRole`.
abstract contract CbRoleScript is CbAdminScript {
  /// Resolves `name` (one of the role identifier getter names on `IChainbills`, e.g. `"TOKEN_MANAGER_ROLE"`) to its
  /// role identifier by calling the matching getter on `chainbills`, so the resolved value always matches what is
  /// actually deployed.
  function _role(IChainbills chainbills, string memory name) internal view returns (bytes32) {
    bytes32 nameHash = keccak256(bytes(name));
    if (nameHash == keccak256('DEFAULT_ADMIN_ROLE')) return chainbills.DEFAULT_ADMIN_ROLE();
    if (nameHash == keccak256('CONFIG_MANAGER_ROLE')) return chainbills.CONFIG_MANAGER_ROLE();
    if (nameHash == keccak256('CHAIN_MANAGER_ROLE')) return chainbills.CHAIN_MANAGER_ROLE();
    if (nameHash == keccak256('TOKEN_MANAGER_ROLE')) return chainbills.TOKEN_MANAGER_ROLE();
    if (nameHash == keccak256('FEE_MANAGER_ROLE')) return chainbills.FEE_MANAGER_ROLE();
    if (nameHash == keccak256('PAUSER_ROLE')) return chainbills.PAUSER_ROLE();
    if (nameHash == keccak256('UNPAUSER_ROLE')) return chainbills.UNPAUSER_ROLE();
    if (nameHash == keccak256('RELAYER_ROLE')) return chainbills.RELAYER_ROLE();
    if (nameHash == keccak256('PAYABLE_SYNC_ROLE')) return chainbills.PAYABLE_SYNC_ROLE();
    if (nameHash == keccak256('RESCUER_ROLE')) return chainbills.RESCUER_ROLE();
    revert(string.concat('CbRoleScript: unknown role ', name));
  }
}
