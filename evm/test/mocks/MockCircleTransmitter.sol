// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Minimal mock for IMessageTransmitter used in Chainbills setup and CCTP tests.
contract MockCircleTransmitter {
  uint32 private immutable _domain;
  bool public receiveSuccess = true;

  constructor(uint32 domain_) {
    _domain = domain_;
  }

  function setReceiveSuccess(bool success) external {
    receiveSuccess = success;
  }

  function localDomain() external view returns (uint32) {
    return _domain;
  }

  function receiveMessage(bytes memory, bytes calldata) external view returns (bool) {
    return receiveSuccess;
  }

  function sendMessage(uint32, bytes32, bytes calldata) external pure returns (uint64) {
    return 0;
  }

  // Stub remaining IMessageTransmitter methods to satisfy any potential cast.
  function attesterManager() external pure returns (address) {
    return address(0);
  }

  function availableNonces(uint32) external pure returns (uint64) {
    return 0;
  }

  function getNumEnabledAttesters() external pure returns (uint256) {
    return 0;
  }

  function isEnabledAttester(address) external pure returns (bool) {
    return false;
  }

  function maxMessageBodySize() external pure returns (uint256) {
    return 0;
  }

  function owner() external pure returns (address) {
    return address(0);
  }

  function paused() external pure returns (bool) {
    return false;
  }

  function pauser() external pure returns (address) {
    return address(0);
  }

  function rescuer() external pure returns (address) {
    return address(0);
  }

  function version() external pure returns (uint32) {
    return 0;
  }
  function transferOwnership(address) external {}
  function updateAttesterManager(address) external {}

  function getEnabledAttester(uint256) external pure returns (address) {
    return address(0);
  }
  function disableAttester(address) external {}
  function enableAttester(address) external {}
  function setSignatureThreshold(uint256) external {}

  // Blank Test Function to exclude this Mock from test coverage reports.
  function test() public {}
}
