// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '../src/Chainbills.sol';
import {Script, console} from 'forge-std/Script.sol';

contract CbPayableTest {
  Chainbills public cb;

  function setUp() public {
    address wormhole = 0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78;
    uint16 chainId = 10002;
    uint8 finality = 200;
    cb = new Chainbills(wormhole, wormhole, chainId, finality);
  }

  function testCreatePayable() public {
    bytes32 payableId = cb.createPayable([]);
    assert(cb.payables(payableId).payableId == payableId);
    assert(cb.payables(payableId).host == msg.sender);
    assert(cb.userPayableIds(msg.sender).length == 1);
    console.log(cb.userPayableIds(msg.sender)[0]);
  }
}
