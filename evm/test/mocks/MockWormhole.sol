// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IWormhole} from 'wormhole/interfaces/IWormhole.sol';

/// Configurable Wormhole mock for testing. Implements the full IWormhole interface
/// with configurable parseAndVerifyVM and messageFee responses; all other methods
/// are no-ops or return zero values.
contract MockWormhole is IWormhole {
  IWormhole.VM private _presetVM;
  bool private _presetValid;
  string private _presetReason;
  uint256 private _fee;

  function setMessageFee(uint256 fee) external {
    _fee = fee;
  }

  /// @param vm_ The VM struct to return from parseAndVerifyVM.
  /// @param valid Whether the VM is considered valid.
  /// @param reason Reason string (used only when valid=false).
  function setPresetVM(IWormhole.VM memory vm_, bool valid, string memory reason) external {
    _presetVM = vm_;
    _presetValid = valid;
    _presetReason = reason;
  }

  // ---- Configurable core methods ----

  function parseAndVerifyVM(bytes calldata)
    external
    view
    override
    returns (IWormhole.VM memory vm, bool valid, string memory reason)
  {
    return (_presetVM, _presetValid, _presetReason);
  }

  function messageFee() external view override returns (uint256) {
    return _fee;
  }

  function publishMessage(uint32, bytes memory, uint8) external payable override returns (uint64) {
    return 0;
  }

  // ---- Stub implementations ----

  function initialize() external override {}

  function verifyVM(VM memory) external pure override returns (bool, string memory) {
    return (false, '');
  }

  function verifySignatures(bytes32, Signature[] memory, GuardianSet memory)
    external
    pure
    override
    returns (bool, string memory)
  {
    return (false, '');
  }

  function parseVM(bytes memory) external pure override returns (VM memory) {
    VM memory empty;
    return empty;
  }

  function quorum(uint256) external pure override returns (uint256) {
    return 0;
  }

  function getGuardianSet(uint32) external pure override returns (GuardianSet memory) {
    address[] memory keys = new address[](0);
    return GuardianSet({keys: keys, expirationTime: 0});
  }

  function getCurrentGuardianSetIndex() external pure override returns (uint32) {
    return 0;
  }

  function getGuardianSetExpiry() external pure override returns (uint32) {
    return 0;
  }

  function governanceActionIsConsumed(bytes32) external pure override returns (bool) {
    return false;
  }

  function isInitialized(address) external pure override returns (bool) {
    return false;
  }

  function chainId() external pure override returns (uint16) {
    return 0;
  }

  function isFork() external pure override returns (bool) {
    return false;
  }

  function governanceChainId() external pure override returns (uint16) {
    return 0;
  }

  function governanceContract() external pure override returns (bytes32) {
    return bytes32(0);
  }

  function evmChainId() external pure override returns (uint256) {
    return 0;
  }

  function nextSequence(address) external pure override returns (uint64) {
    return 0;
  }

  function parseContractUpgrade(bytes memory) external pure override returns (ContractUpgrade memory) {
    ContractUpgrade memory e;
    return e;
  }

  function parseGuardianSetUpgrade(bytes memory) external pure override returns (GuardianSetUpgrade memory) {
    GuardianSetUpgrade memory e;
    return e;
  }

  function parseSetMessageFee(bytes memory) external pure override returns (SetMessageFee memory) {
    SetMessageFee memory e;
    return e;
  }

  function parseTransferFees(bytes memory) external pure override returns (TransferFees memory) {
    TransferFees memory e;
    return e;
  }

  function parseRecoverChainId(bytes memory) external pure override returns (RecoverChainId memory) {
    RecoverChainId memory e;
    return e;
  }

  function submitContractUpgrade(bytes memory) external override {}
  function submitSetMessageFee(bytes memory) external override {}
  function submitNewGuardianSet(bytes memory) external override {}
  function submitTransferFees(bytes memory) external override {}
  function submitRecoverChainId(bytes memory) external override {}

  // Blank Test Function to exclude this Mock from test coverage reports.
  function test() public {}
}
