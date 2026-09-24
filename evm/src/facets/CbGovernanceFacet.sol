// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {LibAccessControl} from '../access/LibAccessControl.sol';
import {LibPause} from '../access/LibPause.sol';
import {ICbGovernance} from '../interfaces/ICbGovernance.sol';
import '../types/CbRoles.sol' as Roles;
import {CbFacetBase} from './CbFacetBase.sol';

/// Roles and pause switches.
contract CbGovernanceFacet is CbFacetBase, ICbGovernance {
  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------

  /// @inheritdoc ICbGovernance
  function hasRole(bytes32 role, address account) external view returns (bool) {
    return LibAccessControl.hasRole(role, account);
  }

  /// @inheritdoc ICbGovernance
  function getRoleAdmin(bytes32 role) external view returns (bytes32) {
    return LibAccessControl.getRoleAdmin(role);
  }

  /// @inheritdoc ICbGovernance
  function grantRole(bytes32 role, address account) external onlyRole(LibAccessControl.getRoleAdmin(role)) {
    LibAccessControl.grantRole(role, account);
  }

  /// @inheritdoc ICbGovernance
  function revokeRole(bytes32 role, address account) external onlyRole(LibAccessControl.getRoleAdmin(role)) {
    LibAccessControl.revokeRole(role, account);
  }

  /// @inheritdoc ICbGovernance
  function renounceRole(bytes32 role, address callerConfirmation) external {
    if (callerConfirmation != msg.sender) revert AccessControlBadConfirmation();
    LibAccessControl.revokeRole(role, msg.sender);
  }

  /// @inheritdoc ICbGovernance
  function setRoleAdmin(bytes32 role, bytes32 adminRole) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
    LibAccessControl.setRoleAdmin(role, adminRole);
  }

  /// @inheritdoc ICbGovernance
  function grantRoleBatch(bytes32 role, address[] calldata accounts)
    external
    onlyRole(LibAccessControl.getRoleAdmin(role))
  {
    for (uint256 i; i < accounts.length; i++) {
      LibAccessControl.grantRole(role, accounts[i]);
    }
  }

  /// @inheritdoc ICbGovernance
  function getRoleMemberCount(bytes32 role) external view returns (uint256) {
    return LibAccessControl.getRoleMemberCount(role);
  }

  /// @inheritdoc ICbGovernance
  function getRoleMember(bytes32 role, uint256 index) external view returns (address) {
    return LibAccessControl.getRoleMember(role, index);
  }

  /// @inheritdoc ICbGovernance
  function getRoleMembers(bytes32 role) external view returns (address[] memory) {
    return LibAccessControl.getRoleMembers(role);
  }

  /// @inheritdoc ICbGovernance
  function getKnownRoles() external view returns (bytes32[] memory) {
    return LibAccessControl.getKnownRoles();
  }

  /// @inheritdoc ICbGovernance
  function getRolesOf(address account) external view returns (bytes32[] memory roles) {
    bytes32[] memory known = LibAccessControl.getKnownRoles();

    // Count the held roles, then fill an exactly sized array.
    uint256 count;
    for (uint256 i; i < known.length; i++) {
      if (LibAccessControl.hasRole(known[i], account)) count++;
    }
    roles = new bytes32[](count);
    uint256 next;
    for (uint256 i; i < known.length; i++) {
      if (LibAccessControl.hasRole(known[i], account)) roles[next++] = known[i];
    }
  }

  /// @inheritdoc ICbGovernance
  function DEFAULT_ADMIN_ROLE() external pure returns (bytes32) {
    return Roles.DEFAULT_ADMIN_ROLE;
  }

  /// @inheritdoc ICbGovernance
  function CONFIG_MANAGER_ROLE() external pure returns (bytes32) {
    return Roles.CONFIG_MANAGER_ROLE;
  }

  /// @inheritdoc ICbGovernance
  function CHAIN_MANAGER_ROLE() external pure returns (bytes32) {
    return Roles.CHAIN_MANAGER_ROLE;
  }

  /// @inheritdoc ICbGovernance
  function TOKEN_MANAGER_ROLE() external pure returns (bytes32) {
    return Roles.TOKEN_MANAGER_ROLE;
  }

  /// @inheritdoc ICbGovernance
  function FEE_MANAGER_ROLE() external pure returns (bytes32) {
    return Roles.FEE_MANAGER_ROLE;
  }

  /// @inheritdoc ICbGovernance
  function PAUSER_ROLE() external pure returns (bytes32) {
    return Roles.PAUSER_ROLE;
  }

  /// @inheritdoc ICbGovernance
  function UNPAUSER_ROLE() external pure returns (bytes32) {
    return Roles.UNPAUSER_ROLE;
  }

  /// @inheritdoc ICbGovernance
  function RELAYER_ROLE() external pure returns (bytes32) {
    return Roles.RELAYER_ROLE;
  }

  /// @inheritdoc ICbGovernance
  function PAYABLE_SYNC_ROLE() external pure returns (bytes32) {
    return Roles.PAYABLE_SYNC_ROLE;
  }

  /// @inheritdoc ICbGovernance
  function RESCUER_ROLE() external pure returns (bytes32) {
    return Roles.RESCUER_ROLE;
  }

  // ---------------------------------------------------------------------------
  // Pause
  // ---------------------------------------------------------------------------

  /// @inheritdoc ICbGovernance
  function pause() external onlyRole(Roles.PAUSER_ROLE) {
    LibPause.pause();
  }

  /// @inheritdoc ICbGovernance
  function unpause() external onlyRole(Roles.UNPAUSER_ROLE) {
    LibPause.unpause();
  }

  /// @inheritdoc ICbGovernance
  function pauseFeatures(uint256 features) external onlyRole(Roles.PAUSER_ROLE) {
    LibPause.pauseFeatures(features);
  }

  /// @inheritdoc ICbGovernance
  function unpauseFeatures(uint256 features) external onlyRole(Roles.UNPAUSER_ROLE) {
    LibPause.unpauseFeatures(features);
  }

  /// @inheritdoc ICbGovernance
  function paused() external view returns (bool) {
    return LibPause.layout().isPaused;
  }

  /// @inheritdoc ICbGovernance
  function pausedFeatures() external view returns (uint256) {
    return LibPause.layout().pausedFeatures;
  }

  /// @inheritdoc ICbGovernance
  function isFeaturePaused(uint256 feature) external view returns (bool) {
    return LibPause.isFeaturePaused(feature);
  }
}
