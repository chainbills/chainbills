// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

interface IMessageTransmitter {
  event MessageSent(bytes message);

  /**
   * @notice Sends an outgoing message from the source domain (CCTP v2). No return value.
   * @param destinationDomain Domain of destination chain
   * @param recipient Address of message recipient on destination domain as bytes32
   * @param destinationCaller caller on destination domain (bytes32(0) = any)
   * @param minFinalityThreshold minimum finality threshold (2000 = FINALIZED)
   * @param messageBody Raw bytes content of message
   */
  function sendMessage(
    uint32 destinationDomain,
    bytes32 recipient,
    bytes32 destinationCaller,
    uint32 minFinalityThreshold,
    bytes calldata messageBody
  ) external;

  /**
   * @notice Emitted when tokens are minted
   * @param _mintRecipient recipient address of minted tokens
   * @param _amount amount of minted tokens
   * @param _mintToken contract address of minted token
   */
  event MintAndWithdraw(address _mintRecipient, uint256 _amount, address _mintToken);

  /**
   * @notice Receive a message. Messages with a given nonce can only be broadcast once.
   * The message body of a valid message is passed to the specified recipient for further processing.
   *
   * CCTP v2 message format:
   * Field                  Bytes  Type    Index
   * version                4      uint32  0
   * sourceDomain           4      uint32  4
   * destinationDomain      4      uint32  8
   * nonce                  32     bytes32 12
   * sender                 32     bytes32 44
   * recipient              32     bytes32 76
   * destinationCaller      32     bytes32 108
   * minFinalityThreshold   4      uint32  140
   * finalityThresholdExecuted 4   uint32  144
   * messageBody            dynamic bytes   148
   *
   * @param _message Message bytes
   * @param _attestation Concatenated 65-byte signature(s) of `_message`
   * @return success bool, true if successful
   */
  function receiveMessage(bytes memory _message, bytes calldata _attestation) external returns (bool success);

  function attesterManager() external view returns (address);

  function availableNonces(uint32 domain) external view returns (uint64);

  function getNumEnabledAttesters() external view returns (uint256);

  function isEnabledAttester(address _attester) external view returns (bool);

  function localDomain() external view returns (uint32);

  function maxMessageBodySize() external view returns (uint256);

  function owner() external view returns (address);

  function paused() external view returns (bool);

  function pauser() external view returns (address);

  function rescuer() external view returns (address);

  function version() external view returns (uint32);

  // owner only methods
  function transferOwnership(address newOwner) external;

  function updateAttesterManager(address _newAttesterManager) external;

  // attester manager only methods
  function getEnabledAttester(uint256 _index) external view returns (address);

  function disableAttester(address _attester) external;

  function enableAttester(address _attester) external;

  function setSignatureThreshold(uint256 newSignatureThreshold) external;
}
