// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbWithdrawals} from '../interfaces/ICbWithdrawals.sol';
import {CbFacetBase} from './CbFacetBase.sol';

contract CbWithdrawalsFacet is CbFacetBase, ICbWithdrawals {
  function withdraw(bytes32 payableId, address token, uint256 amount) external returns (bytes32 withdrawalId) {
    revert('unimplemented');
  }

  function withdrawAll(bytes32 payableId, address token) external returns (bytes32 withdrawalId) {
    revert('unimplemented');
  }

  function rescueUntrackedBalance(address token, address to) external returns (uint256 amount) {
    revert('unimplemented');
  }
}
