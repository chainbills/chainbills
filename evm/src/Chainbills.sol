// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import 'wormhole/interfaces/IWormhole.sol';
import 'wormhole/Utils.sol';
import './circle/ICircleBridge.sol';
import './circle/IMessageTransmitter.sol';
import './circle/ITokenMinter.sol';
import './CbErrors.sol';
import './CbGovernance.sol';
import './CbPayables.sol';
import './CbTransactions.sol';

/// A Cross-Chain Payment Gateway.
contract Chainbills is Initializable, CbPayables, CbTransactions {
  fallback() external payable {}

  receive() external payable {}

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /// Sets up this smart contract when it is deployed.
  /// @param feeCollector The address that will collect withdrawal fees.
  /// @param wormhole The address of the Wormhole contract.
  /// @param circleBridge The address of the Circle Bridge contract.
  /// @param chainId The Wormhole Chain ID of the chain.
  /// @param wormholeFinality Confirmed/Finalized for Wormhole messages.
  function initialize(
    address feeCollector,
    address wormhole,
    address circleBridge,
    uint16 chainId,
    uint8 wormholeFinality
  ) public initializer {
    if (feeCollector == address(0)) revert InvalidFeeCollector();
    else if (wormhole == address(0)) revert InvalidWormholeAddress();
    else if (chainId == 0) revert InvalidWormholeChainId();
    else if (wormholeFinality == 0) revert InvalidWormholeFinality();
    else if (circleBridge == address(0)) revert InvalidCircleBridge();

    IMessageTransmitter circleTransmitter =
      ICircleBridge(circleBridge).localMessageTransmitter();
    uint32 circleDomain = circleTransmitter.localDomain();
    ITokenMinter circleTokenMinter = ICircleBridge(circleBridge).localMinter();

    // Set necessary config variables like feeCollector, wormhole, chainId, and 
    // wormholeFinality, circleDomain, circleBridge, circleTransmitter, and
    // circleTokenMinter.
    config = Config(
      wormholeFinality,
      chainId,
      200 /* 200 means 2% withdrawal fee (with 2 decimal places) */,
      circleDomain,
      feeCollector,
      wormhole,
      circleBridge,
      address(circleTransmitter),
      address(circleTokenMinter)
    );
    chainStats = ChainStats(0, 0, 0, 0, 0, 0, 0, 0, 0);

    // Initialize the Governance.
    __CbGovernance_init();
  }
}
