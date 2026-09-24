// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IMessageTransmitter} from './IMessageTransmitter.sol';
import {ITokenMinter} from './ITokenMinter.sol';

interface ICircleBridge {
  /**
   * @notice Deposits and burns tokens from sender to be minted on destination domain (CCTP v2).
   * No return value in v2. Use bytes32(0) destinationCaller to allow any relayer.
   * @param _amount amount of tokens to burn
   * @param _destinationDomain destination domain
   * @param _mintRecipient address of mint recipient on destination domain
   * @param _burnToken address of contract to burn deposited tokens, on local domain
   * @param _destinationCaller caller on destination domain (bytes32(0) = any)
   * @param _maxFee maximum fee for fast finality (0 = standard)
   * @param _minFinalityThreshold minimum finality threshold (2000 = FINALIZED)
   */
  function depositForBurn(
    uint256 _amount,
    uint32 _destinationDomain,
    bytes32 _mintRecipient,
    address _burnToken,
    bytes32 _destinationCaller,
    uint256 _maxFee,
    uint32 _minFinalityThreshold
  ) external;

  function owner() external view returns (address);

  function localMessageTransmitter() external view returns (IMessageTransmitter);

  function localMinter() external view returns (ITokenMinter);

  function remoteCircleBridges(uint32 domain) external view returns (bytes32);

  // owner only methods
  function transferOwnership(address newOwner) external;
}
