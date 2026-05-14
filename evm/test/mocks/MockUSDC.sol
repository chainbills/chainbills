// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract USDC is ERC20 {
  constructor() ERC20('USDC', 'USDC') {}

  function decimals() public view virtual override returns (uint8) {
    return 6;
  }

  // Blank Test Function to exclude this Test contract from test coverage reports.
  function test() public {}
}
