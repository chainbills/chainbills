// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CHAIN_MANAGER_ROLE} from 'src/types/CbRoles.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

contract AccessControlNoOpsTest is CbTestBase {
  address internal alice = makeAddr('alice');

  function test_GrantRoleTwice_SecondCallIsNoOp() public {
    vm.startPrank(owner);
    cb.grantRole(CHAIN_MANAGER_ROLE, alice);
    // The second call must not emit RoleGranted again; using recordLogs to prove no event was emitted.
    vm.recordLogs();
    cb.grantRole(CHAIN_MANAGER_ROLE, alice);
    assertEq(vm.getRecordedLogs().length, 0);
    vm.stopPrank();
    assertTrue(cb.hasRole(CHAIN_MANAGER_ROLE, alice));
  }

  function test_RevokeRole_UngrantedAccountIsNoOp() public {
    vm.recordLogs();
    vm.prank(owner);
    cb.revokeRole(CHAIN_MANAGER_ROLE, alice);
    assertEq(vm.getRecordedLogs().length, 0);
    assertFalse(cb.hasRole(CHAIN_MANAGER_ROLE, alice));
  }
}
