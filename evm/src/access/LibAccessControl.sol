// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {ICbErrors} from '../interfaces/ICbErrors.sol';
import {ICbEvents} from '../interfaces/ICbEvents.sol';
import {DEFAULT_ADMIN_ROLE} from '../types/CbRoles.sol';

/// Enumerable role-based access control for the diamond.
/// @dev Semantics follow OpenZeppelin AccessControl: every role has an admin role (default
/// `DEFAULT_ADMIN_ROLE`) whose holders grant and revoke it. Members are enumerable, and the last
/// `DEFAULT_ADMIN_ROLE` holder can never be removed.
library LibAccessControl {
  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableSet for EnumerableSet.Bytes32Set;

  /// Members and admin role of one role.
  struct RoleData {
    EnumerableSet.AddressSet members;
    bytes32 adminRole;
  }

  /// @custom:storage-location erc7201:chainbills.access
  struct Layout {
    /// Role data by role identifier.
    mapping(bytes32 role => RoleData) roles;
    /// Every role that has ever had a member or a custom admin.
    EnumerableSet.Bytes32Set knownRoles;
  }

  /// keccak256(abi.encode(uint256(keccak256('chainbills.access')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0x84f0b1d64bb65b0b884e06f830be85b7215ca0279d578e12ca2c66f3f0d5bb00;

  /// Returns the access-control storage.
  /// @return $ Storage pointer.
  function layout() internal pure returns (Layout storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }

  /// Returns whether `account` holds `role`.
  /// @param role Role identifier.
  /// @param account Account to check.
  /// @return True when the account holds the role.
  function hasRole(bytes32 role, address account) internal view returns (bool) {
    return layout().roles[role].members.contains(account);
  }

  /// Reverts unless the caller holds `role`.
  /// @param role Role identifier.
  function enforceRole(bytes32 role) internal view {
    if (!hasRole(role, msg.sender)) revert ICbErrors.AccessControlUnauthorizedAccount(msg.sender, role);
  }

  /// Returns the admin role of `role`.
  /// @param role Role identifier.
  /// @return Admin role identifier.
  function getRoleAdmin(bytes32 role) internal view returns (bytes32) {
    return layout().roles[role].adminRole;
  }

  /// Sets the admin role of `role`.
  /// @param role Role identifier.
  /// @param adminRole New admin role identifier.
  function setRoleAdmin(bytes32 role, bytes32 adminRole) internal {
    Layout storage $ = layout();
    bytes32 previousAdminRole = $.roles[role].adminRole;
    $.roles[role].adminRole = adminRole;
    $.knownRoles.add(role);
    emit ICbEvents.RoleAdminChanged(role, previousAdminRole, adminRole);
  }

  /// Grants `role` to `account`. No-op when already granted.
  /// @param role Role identifier.
  /// @param account Account receiving the role.
  /// @return True when the role was newly granted.
  function grantRole(bytes32 role, address account) internal returns (bool) {
    if (account == address(0)) revert ICbErrors.InvalidAddress();
    Layout storage $ = layout();
    if (!$.roles[role].members.add(account)) return false;
    $.knownRoles.add(role);
    emit ICbEvents.RoleGranted(role, account, msg.sender);
    return true;
  }

  /// Revokes `role` from `account`. No-op when not granted. Never removes the last default admin.
  /// @param role Role identifier.
  /// @param account Account losing the role.
  /// @return True when the role was revoked.
  function revokeRole(bytes32 role, address account) internal returns (bool) {
    Layout storage $ = layout();
    if (!$.roles[role].members.contains(account)) return false;
    if (role == DEFAULT_ADMIN_ROLE && $.roles[role].members.length() == 1) revert ICbErrors.LastDefaultAdmin();
    $.roles[role].members.remove(account);
    emit ICbEvents.RoleRevoked(role, account, msg.sender);
    return true;
  }

  /// Returns the number of holders of `role`.
  /// @param role Role identifier.
  /// @return Holder count.
  function getRoleMemberCount(bytes32 role) internal view returns (uint256) {
    return layout().roles[role].members.length();
  }

  /// Returns the holder of `role` at `index`.
  /// @param role Role identifier.
  /// @param index Zero-based index.
  /// @return Holder address.
  function getRoleMember(bytes32 role, uint256 index) internal view returns (address) {
    return layout().roles[role].members.at(index);
  }

  /// Returns every holder of `role`.
  /// @param role Role identifier.
  /// @return Holder addresses.
  function getRoleMembers(bytes32 role) internal view returns (address[] memory) {
    return layout().roles[role].members.values();
  }

  /// Returns every role that has ever had a member or a custom admin.
  /// @return Role identifiers.
  function getKnownRoles() internal view returns (bytes32[] memory) {
    return layout().knownRoles.values();
  }
}
