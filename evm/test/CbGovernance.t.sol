// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import 'forge-std/Test.sol';
import 'src/Chainbills.sol';
import 'src/CbPayables.sol';
import 'src/CbTransactions.sol';

contract USDC is ERC20 {
  constructor() ERC20('USDC', 'USDC') {}

  function decimals() public view virtual override returns (uint8) {
    return 6;
  }
}

contract CbGovernanceTest is Test {
  Chainbills chainbills;
  USDC usdc;

  address feeCollectorA = makeAddr('fee-collector-a');
  address feeCollectorB = makeAddr('fee-collector-b');
  address owner = makeAddr('owner');
  address nonOwner = makeAddr('non-owner');
  address user = makeAddr('user');

  uint16 feePercentA = 200; // 2%
  uint16 feePercentB = 300; // 3%
  uint256 maxWithdrawalFeeA = 5e15;
  uint256 maxWithdrawalFeeB = 10e15;
  uint256 ethAmt = 1e16;
  uint256 usdcAmt = 1e8;

  function setUp() public {
    vm.startPrank(owner);
    chainbills = Chainbills(payable(address(new ERC1967Proxy(address(new Chainbills()), ''))));
    usdc = new USDC();

    chainbills.initialize(feeCollectorA, feePercentA);
    chainbills.setPayablesLogic(address(new CbPayables()));
    chainbills.setTransactionsLogic(address(new CbTransactions()));
    vm.stopPrank();
  }

  function testOwnerWithdraw() public {
    // Send funds to contract (both native and erc20)
    deal(address(chainbills), ethAmt);
    deal(address(usdc), address(chainbills), usdcAmt);

    // Call owner withdraw with non-contract owner and confirm revert
    vm.startPrank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.ownerWithdraw(address(chainbills), ethAmt);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.ownerWithdraw(address(usdc), usdcAmt);
    vm.stopPrank();

    // Call owner withdraw successfully and confirm emitted events
    vm.startPrank(owner);
    vm.expectEmit(true, true, true, true);
    emit OwnerWithdrew(address(chainbills), ethAmt);
    chainbills.ownerWithdraw(address(chainbills), ethAmt);

    vm.expectEmit(true, true, true, true);
    emit OwnerWithdrew(address(usdc), usdcAmt);
    chainbills.ownerWithdraw(address(usdc), usdcAmt);
    vm.stopPrank();

    // Verify balances
    assertEq(owner.balance, ethAmt);
    assertEq(usdc.balanceOf(owner), usdcAmt);
  }

  function testSetPayablesLogic() public {
    // Create new payables logic contracts
    CbPayables payablesLogic1 = new CbPayables();
    CbPayables payablesLogic2 = new CbPayables();

    // Call set payables logic with non-contract owner and confirm revert
    vm.startPrank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.setPayablesLogic(address(payablesLogic1));
    vm.stopPrank();

    // Set payables logic with contract owner and verify
    vm.startPrank(owner);
    vm.expectEmit(true, true, true, true);
    emit SetPayablesLogic(address(payablesLogic1));
    chainbills.setPayablesLogic(address(payablesLogic1));
    vm.stopPrank();

    // Verify state
    assertEq(chainbills.payablesLogic(), address(payablesLogic1));

    // Set payables logic again with a different contract and verify
    vm.startPrank(owner);
    vm.expectEmit(true, true, true, true);
    emit SetPayablesLogic(address(payablesLogic2));
    chainbills.setPayablesLogic(address(payablesLogic2));
    vm.stopPrank();

    // Verify state
    assertEq(chainbills.payablesLogic(), address(payablesLogic2));
  }

  function testSetTransactionsLogic() public {
    // Create new transactions logic contracts
    CbTransactions transactionsLogic1 = new CbTransactions();
    CbTransactions transactionsLogic2 = new CbTransactions();

    // Call set transactions logic with non-contract owner and confirm revert
    vm.startPrank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.setTransactionsLogic(address(transactionsLogic1));
    vm.stopPrank();

    // Set transactions logic with contract owner and verify
    vm.startPrank(owner);
    vm.expectEmit(true, true, true, true);
    emit SetTransactionsLogic(address(transactionsLogic1));
    chainbills.setTransactionsLogic(address(transactionsLogic1));
    vm.stopPrank();

    // Verify state
    assertEq(chainbills.transactionsLogic(), address(transactionsLogic1));

    // Set transactions logic again with a different contract and verify
    vm.startPrank(owner);
    vm.expectEmit(true, true, true, true);
    emit SetTransactionsLogic(address(transactionsLogic2));
    chainbills.setTransactionsLogic(address(transactionsLogic2));
    vm.stopPrank();

    // Verify state
    assertEq(chainbills.transactionsLogic(), address(transactionsLogic2));
  }

  function testAllowAndStopPaymentsForToken() public {}

  function testSetFeeCollectorAddress() public {}

  function testSetWithdrawalFeePercentage() public {}

  function testUpdateMaxWithdrawalFees() public {}
}
