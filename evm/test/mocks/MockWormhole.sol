// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IWormhole} from 'wormhole/interfaces/IWormhole.sol';

/// Wormhole core bridge simulation.
/// @dev A "VAA" here is `abi.encode(emitterChainId, emitterAddress, sequence, consistencyLevel, payload)`; its hash is
/// the keccak256 of those bytes. `publishMessage` records every message so tests can build the matching VAA and
/// deliver it to another chain's mock.
contract MockWormhole {
  /// A published message.
  struct Published {
    address emitter;
    uint64 sequence;
    uint8 consistencyLevel;
    bytes payload;
  }

  uint16 public immutable chainId;
  uint256 public messageFee;
  bool public isRejectingVaas;
  string public rejectionReason;
  Published[] internal _published;
  mapping(address emitter => uint64) public nextSequence;

  event MessagePublished(address indexed emitter, uint64 sequence, bytes payload, uint8 consistencyLevel);

  constructor(uint16 chainId_) {
    chainId = chainId_;
  }

  function setMessageFee(uint256 fee) external {
    messageFee = fee;
  }

  function setRejectingVaas(bool isRejecting, string calldata reason) external {
    isRejectingVaas = isRejecting;
    rejectionReason = reason;
  }

  function publishMessage(uint32, bytes memory payload, uint8 consistencyLevel)
    external
    payable
    returns (uint64 sequence)
  {
    require(msg.value == messageFee, 'MockWormhole: wrong fee');
    sequence = nextSequence[msg.sender]++;
    _published.push(Published(msg.sender, sequence, consistencyLevel, payload));
    emit MessagePublished(msg.sender, sequence, payload, consistencyLevel);
  }

  function publishedCount() external view returns (uint256) {
    return _published.length;
  }

  function published(uint256 index) external view returns (Published memory) {
    return _published[index];
  }

  /// Builds the VAA of the published message at `index`.
  function vaaOf(uint256 index) external view returns (bytes memory) {
    Published storage message = _published[index];
    return encodeVaa(
      chainId, bytes32(uint256(uint160(message.emitter))), message.sequence, message.consistencyLevel, message.payload
    );
  }

  /// Builds a VAA from raw fields.
  function encodeVaa(
    uint16 emitterChainId,
    bytes32 emitterAddress,
    uint64 sequence,
    uint8 consistencyLevel,
    bytes memory payload
  ) public pure returns (bytes memory) {
    return abi.encode(emitterChainId, emitterAddress, sequence, consistencyLevel, payload);
  }

  function parseAndVerifyVM(bytes calldata encodedVm)
    external
    view
    returns (IWormhole.VM memory vm, bool valid, string memory reason)
  {
    (vm.emitterChainId, vm.emitterAddress, vm.sequence, vm.consistencyLevel, vm.payload) =
      abi.decode(encodedVm, (uint16, bytes32, uint64, uint8, bytes));
    vm.hash = keccak256(encodedVm);
    vm.version = 1;
    if (isRejectingVaas) return (vm, false, rejectionReason);
    return (vm, true, '');
  }
}
