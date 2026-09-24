// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IERC165} from '@openzeppelin/contracts/utils/introspection/IERC165.sol';
import {IDiamondCut} from './diamond/IDiamondCut.sol';
import {IDiamondLoupe} from './diamond/IDiamondLoupe.sol';
import {ICbActivityViews} from './ICbActivityViews.sol';
import {ICbChainRegistry} from './ICbChainRegistry.sol';
import {ICbConfig} from './ICbConfig.sol';
import {ICbCoreViews} from './ICbCoreViews.sol';
import {ICbCrossChainViews} from './ICbCrossChainViews.sol';
import {ICbErrors} from './ICbErrors.sol';
import {ICbEvents} from './ICbEvents.sol';
import {ICbGovernance} from './ICbGovernance.sol';
import {ICbOwnership} from './ICbOwnership.sol';
import {ICbPayableSync} from './ICbPayableSync.sol';
import {ICbPayableViews} from './ICbPayableViews.sol';
import {ICbPayables} from './ICbPayables.sol';
import {ICbPaymentViews} from './ICbPaymentViews.sol';
import {ICbPayments} from './ICbPayments.sol';
import {ICbQuoteViews} from './ICbQuoteViews.sol';
import {ICbRegistryViews} from './ICbRegistryViews.sol';
import {ICbTokenRegistry} from './ICbTokenRegistry.sol';
import {ICbWithdrawalViews} from './ICbWithdrawalViews.sol';
import {ICbWithdrawals} from './ICbWithdrawals.sol';

/// Complete external surface of the Chainbills diamond: every routed function, event, and error.
interface IChainbills is
  IERC165,
  IDiamondCut,
  IDiamondLoupe,
  ICbOwnership,
  ICbErrors,
  ICbEvents,
  ICbGovernance,
  ICbConfig,
  ICbChainRegistry,
  ICbTokenRegistry,
  ICbPayables,
  ICbPayableSync,
  ICbPayments,
  ICbWithdrawals,
  ICbCoreViews,
  ICbRegistryViews,
  ICbPayableViews,
  ICbPaymentViews,
  ICbWithdrawalViews,
  ICbActivityViews,
  ICbCrossChainViews,
  ICbQuoteViews
{}
