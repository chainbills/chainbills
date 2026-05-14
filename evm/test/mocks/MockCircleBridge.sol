// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IMessageTransmitter} from 'src/circle/IMessageTransmitter.sol';
import {ITokenMinter} from 'src/circle/ITokenMinter.sol';

/// Minimal mock for ICircleBridge used in Chainbills setup and payment tests.
contract MockCircleBridge {
  IMessageTransmitter private immutable _transmitter;
  ITokenMinter private immutable _minter;

  constructor(address transmitter_, address minter_) {
    _transmitter = IMessageTransmitter(transmitter_);
    _minter = ITokenMinter(minter_);
  }

  function localMessageTransmitter() external view returns (IMessageTransmitter) {
    return _transmitter;
  }

  function localMinter() external view returns (ITokenMinter) {
    return _minter;
  }

  function depositForBurn(uint256, uint32, bytes32, address) external pure returns (uint64) {
    return 0;
  }

  function depositForBurnWithCaller(uint256, uint32, bytes32, address, bytes32) external pure returns (uint64) {
    return 0;
  }

  function owner() external pure returns (address) { return address(0); }
  function handleReceiveMessage(uint32, bytes32, bytes memory) external pure returns (bool) { return true; }
  function remoteCircleBridges(uint32) external pure returns (bytes32) { return bytes32(0); }
  function transferOwnership(address) external {}

  // Blank Test Function to exclude this Mock from test coverage reports.
  function test() public {}
}
