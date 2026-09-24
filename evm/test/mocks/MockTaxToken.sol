// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/// ERC-20 that burns `taxBps` of every transfer, delivering less than sent.
contract MockTaxToken is ERC20 {
  uint256 public taxBps;

  constructor(uint256 taxBps_) ERC20('Tax Token', 'TAX') {
    taxBps = taxBps_;
  }

  function setTaxBps(uint256 taxBps_) external {
    taxBps = taxBps_;
  }

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function _update(address from, address to, uint256 value) internal override {
    if (from == address(0) || to == address(0) || taxBps == 0) return super._update(from, to, value);
    uint256 tax = (value * taxBps) / 10_000;
    super._update(from, address(0), tax);
    super._update(from, to, value - tax);
  }
}
