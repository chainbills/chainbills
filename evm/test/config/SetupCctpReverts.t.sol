// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CbTestBase} from '../base/CbTestBase.sol';

contract BrokenTokenMessengerNoTransmitter {
  function localMessageTransmitter() external pure returns (address) {
    return address(0xdead1);
  }

  function localMinter() external pure returns (address) {
    return address(0xdead2);
  }
}

contract BrokenTokenMessengerCodedTransmitterNoMinter {
  address public localMessageTransmitterAddr;

  constructor(address transmitter_) {
    localMessageTransmitterAddr = transmitter_;
  }

  function localMessageTransmitter() external view returns (address) {
    return localMessageTransmitterAddr;
  }

  function localMinter() external pure returns (address) {
    return address(0xdead3);
  }
}

contract SetupCctpRevertsTest is CbTestBase {
  function test_RevertWhen_SetupCctp_MessageTransmitterHasNoCode() public {
    BrokenTokenMessengerNoTransmitter broken = new BrokenTokenMessengerNoTransmitter();
    vm.expectRevert(InvalidCctpConfig.selector);
    vm.prank(owner);
    cb.setupCctp(address(broken));
  }

  function test_RevertWhen_SetupCctp_TokenMinterHasNoCode() public {
    // A transmitter with real code but the minter address returned is an EOA.
    address realTransmitter = address(chainA.transmitter);
    BrokenTokenMessengerCodedTransmitterNoMinter broken =
      new BrokenTokenMessengerCodedTransmitterNoMinter(realTransmitter);
    vm.expectRevert(InvalidCctpConfig.selector);
    vm.prank(owner);
    cb.setupCctp(address(broken));
  }
}
