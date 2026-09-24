// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ALL_FEATURES, FEATURE_PAY, FEATURE_WITHDRAW} from 'src/types/CbConstants.sol';
import {CHAIN_MANAGER_ROLE, CONFIG_MANAGER_ROLE} from 'src/types/CbRoles.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

contract GovernanceTest is CbTestBase {
  address internal alice = makeAddr('alice');
  address internal bob = makeAddr('bob');

  // ---------------------------------------------------------------------------
  // Role getters
  // ---------------------------------------------------------------------------

  function test_RoleGetters_ReturnDistinctIdentifiers() public view {
    assertEq(cb.DEFAULT_ADMIN_ROLE(), bytes32(0));
    assertEq(cb.CONFIG_MANAGER_ROLE(), keccak256('CONFIG_MANAGER_ROLE'));
    assertEq(cb.CHAIN_MANAGER_ROLE(), keccak256('CHAIN_MANAGER_ROLE'));
    assertEq(cb.TOKEN_MANAGER_ROLE(), keccak256('TOKEN_MANAGER_ROLE'));
    assertEq(cb.FEE_MANAGER_ROLE(), keccak256('FEE_MANAGER_ROLE'));
    assertEq(cb.PAUSER_ROLE(), keccak256('PAUSER_ROLE'));
    assertEq(cb.UNPAUSER_ROLE(), keccak256('UNPAUSER_ROLE'));
    assertEq(cb.RELAYER_ROLE(), keccak256('RELAYER_ROLE'));
    assertEq(cb.PAYABLE_SYNC_ROLE(), keccak256('PAYABLE_SYNC_ROLE'));
    assertEq(cb.RESCUER_ROLE(), keccak256('RESCUER_ROLE'));
  }

  function test_InitialAdmin_HoldsEveryRoleExceptRelayer() public view {
    assertTrue(cb.hasRole(cb.DEFAULT_ADMIN_ROLE(), owner));
    assertTrue(cb.hasRole(cb.CONFIG_MANAGER_ROLE(), owner));
    assertTrue(cb.hasRole(cb.CHAIN_MANAGER_ROLE(), owner));
    assertTrue(cb.hasRole(cb.TOKEN_MANAGER_ROLE(), owner));
    assertTrue(cb.hasRole(cb.FEE_MANAGER_ROLE(), owner));
    assertTrue(cb.hasRole(cb.PAUSER_ROLE(), owner));
    assertTrue(cb.hasRole(cb.UNPAUSER_ROLE(), owner));
    assertTrue(cb.hasRole(cb.PAYABLE_SYNC_ROLE(), owner));
    assertTrue(cb.hasRole(cb.RESCUER_ROLE(), owner));
    assertFalse(cb.hasRole(cb.RELAYER_ROLE(), owner));
  }

  // ---------------------------------------------------------------------------
  // Grant / revoke / renounce
  // ---------------------------------------------------------------------------

  function test_GrantRole_AddsMemberAndEmits() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit RoleGranted(CHAIN_MANAGER_ROLE, alice, owner);
    vm.prank(owner);
    cb.grantRole(CHAIN_MANAGER_ROLE, alice);
    assertTrue(cb.hasRole(CHAIN_MANAGER_ROLE, alice));
  }

  function test_RevertWhen_GrantRole_CallerLacksAdminRole() public {
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, bytes32(0)));
    vm.prank(stranger);
    cb.grantRole(CHAIN_MANAGER_ROLE, alice);
  }

  function test_RevertWhen_GrantRole_ZeroAccount() public {
    vm.expectRevert(InvalidAddress.selector);
    vm.prank(owner);
    cb.grantRole(CHAIN_MANAGER_ROLE, address(0));
  }

  function test_RevokeRole_RemovesMemberAndEmits() public {
    vm.prank(owner);
    cb.grantRole(CHAIN_MANAGER_ROLE, alice);
    vm.expectEmit(true, true, true, true, address(cb));
    emit RoleRevoked(CHAIN_MANAGER_ROLE, alice, owner);
    vm.prank(owner);
    cb.revokeRole(CHAIN_MANAGER_ROLE, alice);
    assertFalse(cb.hasRole(CHAIN_MANAGER_ROLE, alice));
  }

  function test_RevertWhen_RevokeRole_LastDefaultAdmin() public {
    bytes32 defaultAdminRole = cb.DEFAULT_ADMIN_ROLE();
    vm.expectRevert(LastDefaultAdmin.selector);
    vm.prank(owner);
    cb.revokeRole(defaultAdminRole, owner);
  }

  function test_RevokeRole_NonLastDefaultAdminSucceeds() public {
    vm.startPrank(owner);
    cb.grantRole(cb.DEFAULT_ADMIN_ROLE(), alice);
    cb.revokeRole(cb.DEFAULT_ADMIN_ROLE(), owner);
    vm.stopPrank();
    assertFalse(cb.hasRole(cb.DEFAULT_ADMIN_ROLE(), owner));
    assertTrue(cb.hasRole(cb.DEFAULT_ADMIN_ROLE(), alice));
  }

  function test_RenounceRole_RemovesCallersOwnRole() public {
    vm.prank(owner);
    cb.grantRole(CHAIN_MANAGER_ROLE, alice);
    vm.prank(alice);
    cb.renounceRole(CHAIN_MANAGER_ROLE, alice);
    assertFalse(cb.hasRole(CHAIN_MANAGER_ROLE, alice));
  }

  function test_RevertWhen_RenounceRole_WrongConfirmation() public {
    vm.prank(owner);
    cb.grantRole(CHAIN_MANAGER_ROLE, alice);
    vm.expectRevert(AccessControlBadConfirmation.selector);
    vm.prank(alice);
    cb.renounceRole(CHAIN_MANAGER_ROLE, bob);
  }

  function test_SetRoleAdmin_ChangesAdminAndEmits() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit RoleAdminChanged(CHAIN_MANAGER_ROLE, bytes32(0), CONFIG_MANAGER_ROLE);
    vm.prank(owner);
    cb.setRoleAdmin(CHAIN_MANAGER_ROLE, CONFIG_MANAGER_ROLE);
    assertEq(cb.getRoleAdmin(CHAIN_MANAGER_ROLE), CONFIG_MANAGER_ROLE);

    // The new admin role now gates granting; a plain DEFAULT_ADMIN_ROLE holder without it cannot.
    vm.startPrank(owner);
    cb.revokeRole(CONFIG_MANAGER_ROLE, owner);
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, owner, CONFIG_MANAGER_ROLE));
    cb.grantRole(CHAIN_MANAGER_ROLE, bob);
    vm.stopPrank();

    // A holder of the new admin role can grant it.
    vm.prank(owner);
    cb.grantRole(CONFIG_MANAGER_ROLE, alice);
    vm.prank(alice);
    cb.grantRole(CHAIN_MANAGER_ROLE, bob);
    assertTrue(cb.hasRole(CHAIN_MANAGER_ROLE, bob));
  }

  function test_RevertWhen_SetRoleAdmin_CallerLacksDefaultAdmin() public {
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, bytes32(0)));
    vm.prank(stranger);
    cb.setRoleAdmin(CHAIN_MANAGER_ROLE, CONFIG_MANAGER_ROLE);
  }

  function test_GrantRoleBatch_GrantsToEveryAccount() public {
    address[] memory accounts = new address[](2);
    accounts[0] = alice;
    accounts[1] = bob;
    vm.prank(owner);
    cb.grantRoleBatch(CHAIN_MANAGER_ROLE, accounts);
    assertTrue(cb.hasRole(CHAIN_MANAGER_ROLE, alice));
    assertTrue(cb.hasRole(CHAIN_MANAGER_ROLE, bob));
  }

  // ---------------------------------------------------------------------------
  // Enumeration
  // ---------------------------------------------------------------------------

  function test_EnumerableMembers_ReflectGrants() public {
    vm.startPrank(owner);
    cb.grantRole(CHAIN_MANAGER_ROLE, alice);
    cb.grantRole(CHAIN_MANAGER_ROLE, bob);
    vm.stopPrank();
    assertEq(cb.getRoleMemberCount(CHAIN_MANAGER_ROLE), 3); // owner + alice + bob
    address[] memory members = cb.getRoleMembers(CHAIN_MANAGER_ROLE);
    assertEq(members.length, 3);
    bool foundAlice;
    bool foundBob;
    for (uint256 i; i < members.length; i++) {
      if (members[i] == alice) foundAlice = true;
      if (members[i] == bob) foundBob = true;
      assertEq(cb.getRoleMember(CHAIN_MANAGER_ROLE, i), members[i]);
    }
    assertTrue(foundAlice && foundBob);
  }

  function test_GetKnownRoles_IncludesEveryGrantedRole() public view {
    bytes32[] memory known = cb.getKnownRoles();
    assertTrue(known.length >= 9);
  }

  function test_GetRolesOf_ReturnsHeldRolesOnly() public {
    vm.prank(owner);
    cb.grantRole(CHAIN_MANAGER_ROLE, alice);
    bytes32[] memory roles = cb.getRolesOf(alice);
    assertEq(roles.length, 1);
    assertEq(roles[0], CHAIN_MANAGER_ROLE);
    assertEq(cb.getRolesOf(stranger).length, 0);
  }

  // ---------------------------------------------------------------------------
  // Pause
  // ---------------------------------------------------------------------------

  function test_Pause_BlocksGuardedFunctionsAndEmits() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit Paused(owner);
    vm.prank(owner);
    cb.pause();
    assertTrue(cb.paused());

    vm.expectRevert(EnforcedPause.selector);
    vm.prank(host);
    cb.createPayable(_anyToken(), false);
  }

  function test_RevertWhen_Pause_CallerLacksPauserRole() public {
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, cb.PAUSER_ROLE()));
    vm.prank(stranger);
    cb.pause();
  }

  function test_Unpause_LiftsGlobalPauseAndEmits() public {
    vm.prank(owner);
    cb.pause();
    vm.expectEmit(true, true, true, true, address(cb));
    emit Unpaused(owner);
    vm.prank(owner);
    cb.unpause();
    assertFalse(cb.paused());
  }

  function test_RevertWhen_Unpause_CallerLacksUnpauserRole() public {
    vm.prank(owner);
    cb.pause();
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, cb.UNPAUSER_ROLE()));
    vm.prank(stranger);
    cb.unpause();
  }

  function test_PauseFeatures_SetsBitsAndEmits() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit FeaturesPaused(FEATURE_PAY, FEATURE_PAY, owner);
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_PAY);
    assertTrue(cb.isFeaturePaused(FEATURE_PAY));
    assertFalse(cb.isFeaturePaused(FEATURE_WITHDRAW));
    assertEq(cb.pausedFeatures(), FEATURE_PAY);
  }

  function test_UnpauseFeatures_ClearsBitsAndEmits() public {
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_PAY | FEATURE_WITHDRAW);
    vm.expectEmit(true, true, true, true, address(cb));
    emit FeaturesUnpaused(FEATURE_PAY, FEATURE_WITHDRAW, owner);
    vm.prank(owner);
    cb.unpauseFeatures(FEATURE_PAY);
    assertFalse(cb.isFeaturePaused(FEATURE_PAY));
    assertTrue(cb.isFeaturePaused(FEATURE_WITHDRAW));
  }

  function test_RevertWhen_PauseFeatures_Zero() public {
    vm.expectRevert(abi.encodeWithSelector(InvalidFeatures.selector, uint256(0)));
    vm.prank(owner);
    cb.pauseFeatures(0);
  }

  function test_RevertWhen_PauseFeatures_UndefinedBit() public {
    uint256 invalid = ALL_FEATURES + 1;
    vm.expectRevert(abi.encodeWithSelector(InvalidFeatures.selector, invalid));
    vm.prank(owner);
    cb.pauseFeatures(invalid);
  }

  function test_RevertWhen_PauseFeatures_CallerLacksPauserRole() public {
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, cb.PAUSER_ROLE()));
    vm.prank(stranger);
    cb.pauseFeatures(FEATURE_PAY);
  }

  function test_RevertWhen_UnpauseFeatures_CallerLacksUnpauserRole() public {
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_PAY);
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, cb.UNPAUSER_ROLE()));
    vm.prank(stranger);
    cb.unpauseFeatures(FEATURE_PAY);
  }

  function test_FeaturePause_DoesNotBlockOtherFeatures() public {
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_WITHDRAW);
    // Creating a payable (FEATURE_CREATE_PAYABLE) still works.
    vm.deal(host, WORMHOLE_FEE);
    vm.prank(host);
    cb.createPayable{value: WORMHOLE_FEE}(_anyToken(), false);
  }
}
