// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Roles and pause switches.
interface ICbGovernance {
  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------

  /// Returns whether `account` holds `role`.
  /// @param role Role identifier.
  /// @param account Account to check.
  /// @return True when held.
  function hasRole(bytes32 role, address account) external view returns (bool);

  /// Returns the admin role of `role`.
  /// @param role Role identifier.
  /// @return Admin role identifier.
  function getRoleAdmin(bytes32 role) external view returns (bytes32);

  /// Grants `role` to `account`.
  /// @param role Role identifier.
  /// @param account Account receiving the role.
  /// @dev Caller must hold the admin role of `role`.
  function grantRole(bytes32 role, address account) external;

  /// Revokes `role` from `account`.
  /// @param role Role identifier.
  /// @param account Account losing the role.
  /// @dev Caller must hold the admin role of `role`. The last `DEFAULT_ADMIN_ROLE` holder cannot be removed.
  function revokeRole(bytes32 role, address account) external;

  /// Gives up `role`. `callerConfirmation` must equal the caller.
  /// @param role Role identifier.
  /// @param callerConfirmation The caller's address.
  function renounceRole(bytes32 role, address callerConfirmation) external;

  /// Sets the admin role of `role`.
  /// @param role Role identifier.
  /// @param adminRole New admin role identifier.
  /// @dev Caller must hold `DEFAULT_ADMIN_ROLE`.
  function setRoleAdmin(bytes32 role, bytes32 adminRole) external;

  /// Grants `role` to every account in `accounts`.
  /// @param role Role identifier.
  /// @param accounts Accounts receiving the role.
  /// @dev Caller must hold the admin role of `role`.
  function grantRoleBatch(bytes32 role, address[] calldata accounts) external;

  /// Returns the number of holders of `role`.
  /// @param role Role identifier.
  /// @return Holder count.
  function getRoleMemberCount(bytes32 role) external view returns (uint256);

  /// Returns the holder of `role` at `index`.
  /// @param role Role identifier.
  /// @param index Zero-based index.
  /// @return Holder address.
  function getRoleMember(bytes32 role, uint256 index) external view returns (address);

  /// Returns every holder of `role`.
  /// @param role Role identifier.
  /// @return Holder addresses.
  function getRoleMembers(bytes32 role) external view returns (address[] memory);

  /// Returns every role that has ever had a member or a custom admin.
  /// @return Role identifiers.
  function getKnownRoles() external view returns (bytes32[] memory);

  /// Returns every role `account` holds among the known roles.
  /// @param account Account to check.
  /// @return Role identifiers.
  function getRolesOf(address account) external view returns (bytes32[] memory);

  /// Role identifier getters.
  function DEFAULT_ADMIN_ROLE() external pure returns (bytes32);
  function CONFIG_MANAGER_ROLE() external pure returns (bytes32);
  function CHAIN_MANAGER_ROLE() external pure returns (bytes32);
  function TOKEN_MANAGER_ROLE() external pure returns (bytes32);
  function FEE_MANAGER_ROLE() external pure returns (bytes32);
  function PAUSER_ROLE() external pure returns (bytes32);
  function UNPAUSER_ROLE() external pure returns (bytes32);
  function RELAYER_ROLE() external pure returns (bytes32);
  function PAYABLE_SYNC_ROLE() external pure returns (bytes32);
  function RESCUER_ROLE() external pure returns (bytes32);

  // ---------------------------------------------------------------------------
  // Pause
  // ---------------------------------------------------------------------------

  /// Pauses every feature. Caller must hold `PAUSER_ROLE`.
  function pause() external;

  /// Lifts the global pause. Caller must hold `UNPAUSER_ROLE`.
  function unpause() external;

  /// Pauses `features` (bit flags from `CbConstants.sol`). Caller must hold `PAUSER_ROLE`.
  /// @param features Bit set of feature flags.
  function pauseFeatures(uint256 features) external;

  /// Unpauses `features`. Caller must hold `UNPAUSER_ROLE`.
  /// @param features Bit set of feature flags.
  function unpauseFeatures(uint256 features) external;

  /// Returns whether the protocol is paused globally.
  /// @return True when paused.
  function paused() external view returns (bool);

  /// Returns the individually paused features.
  /// @return Bit set of paused feature flags.
  function pausedFeatures() external view returns (uint256);

  /// Returns whether `feature` is blocked, globally or individually.
  /// @param feature Feature flag.
  /// @return True when blocked.
  function isFeaturePaused(uint256 feature) external view returns (bool);
}
