// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbWithdrawals} from '../interfaces/ICbWithdrawals.sol';
import {CbLedger} from '../libraries/CbLedger.sol';
import {LibTokenTransfer} from '../libraries/LibTokenTransfer.sol';
import {LibPayableStorage} from '../storage/LibPayableStorage.sol';
import {LibTokenRegistryStorage} from '../storage/LibTokenRegistryStorage.sol';
import {FEATURE_WITHDRAW} from '../types/CbConstants.sol';
import {RESCUER_ROLE} from '../types/CbRoles.sol';
import {Payable} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

/// Host withdrawals and untracked balance rescue.
contract CbWithdrawalsFacet is CbFacetBase, ICbWithdrawals {
  /// @inheritdoc ICbWithdrawals
  function withdraw(bytes32 payableId, address token, uint256 amount)
    external
    nonReentrant
    whenNotPaused(FEATURE_WITHDRAW)
    returns (bytes32 withdrawalId)
  {
    _requireHost(payableId);
    withdrawalId = CbLedger.withdraw(payableId, token, amount);
  }

  /// @inheritdoc ICbWithdrawals
  function withdrawAll(bytes32 payableId, address token)
    external
    nonReentrant
    whenNotPaused(FEATURE_WITHDRAW)
    returns (bytes32 withdrawalId)
  {
    _requireHost(payableId);
    uint256 amount = LibPayableStorage.layout().balances[payableId][token];
    if (amount == 0) revert NoBalanceForWithdrawalToken();
    withdrawalId = CbLedger.withdraw(payableId, token, amount);
  }

  /// @inheritdoc ICbWithdrawals
  function rescueUntrackedBalance(address token, address to)
    external
    onlyRole(RESCUER_ROLE)
    nonReentrant
    returns (uint256 amount)
  {
    /* CHECKS */
    if (to == address(0)) revert InvalidAddress();
    uint256 balance = LibTokenTransfer.balanceOfSelf(token);
    uint256 tracked = LibTokenRegistryStorage.layout().stats[token].totalPayableBalance;
    if (balance <= tracked) revert NothingToRescue(token);

    /* STATE CHANGES */
    amount = balance - tracked;
    emit UntrackedBalanceRescued(token, to, amount);

    /* TRANSFER */
    LibTokenTransfer.push(token, to, amount);
  }

  /// Reverts unless the payable exists and the caller is its host.
  function _requireHost(bytes32 payableId) private view {
    Payable storage payable_ = LibPayableStorage.layout().payables[payableId];
    if (payable_.host == address(0)) revert InvalidPayableId();
    if (payable_.host != msg.sender) revert NotYourPayable();
  }
}
