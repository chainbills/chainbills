// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

contract CbErrors {
  error InvalidWormholeAddress();
  error InvalidWormholeChainId();
  error InvalidWormholeEmitterAddress();
  error InvalidWormholeFinality();
  error InvalidTokenBridgeAddress();
  error EmptyDescriptionProvided();
  error MaxPayableDescriptionReached();
  error MaxPayableTokensCapacityReached();
  error ImproperPayablesConfiguration();
  error InvalidTokenAddress();
  error ZeroAmountSpecified();
  error InsufficientFeesValue();
  error EmitterNotRegistered();
  error TokenNotAttested();
  error InvalidCallerAddress();
}
