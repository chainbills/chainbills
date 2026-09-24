// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbQuoteViews} from '../interfaces/ICbQuoteViews.sol';
import {WithdrawalQuote} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

contract CbQuoteViewsFacet is CbFacetBase, ICbQuoteViews {
  function quoteBroadcastFee() external view returns (uint256) {
    revert('unimplemented');
  }

  function quotePublishPayableDetailsFee(bytes32 payableId) external view returns (uint256) {
    revert('unimplemented');
  }

  function quoteWithdrawalFee(address token, uint256 amount) external view returns (WithdrawalQuote memory) {
    revert('unimplemented');
  }

  function quoteWithdrawal(bytes32 payableId, address token, uint256 amount)
    external
    view
    returns (WithdrawalQuote memory)
  {
    revert('unimplemented');
  }

  function canPay(bytes32 payableId, address token, uint256 amount) external view returns (bool, bytes4) {
    revert('unimplemented');
  }

  function canPayForeign(bytes32 payableId, address token, uint256 amount, uint256 maxFee)
    external
    view
    returns (bool, bytes4)
  {
    revert('unimplemented');
  }

  function canWithdraw(bytes32 payableId, address caller, address token, uint256 amount)
    external
    view
    returns (bool, bytes4)
  {
    revert('unimplemented');
  }

  function getUntrackedBalance(address token) external view returns (uint256) {
    revert('unimplemented');
  }
}
