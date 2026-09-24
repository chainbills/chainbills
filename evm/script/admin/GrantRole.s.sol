// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbRoleScript} from '../base/CbRoleScript.sol';
import {IChainbills} from '../../src/interfaces/IChainbills.sol';

/// Grants `ROLE_NAME` to `ACCOUNT` on `DIAMOND`. Caller must hold the admin role of `ROLE_NAME`.
///
/// Required env: `DIAMOND`, `ROLE_NAME` (e.g. `"TOKEN_MANAGER_ROLE"`), `ACCOUNT`.
contract GrantRole is CbRoleScript {
  function run() public {
    IChainbills chainbills = _diamond();
    string memory roleName = vm.envString('ROLE_NAME');
    bytes32 role = _role(chainbills, roleName);
    address account = vm.envAddress('ACCOUNT');

    vm.startBroadcast();
    chainbills.grantRole(role, account);
    vm.stopBroadcast();

    console.log('Granted', roleName);
    console.log('to', account);
  }
}
