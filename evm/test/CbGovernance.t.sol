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

  uint16 feePercentA = 200; // 2% (with 2 decimals)
  uint16 feePercentB = 300; // 3% (with 2 decimals)
  uint256 maxWtdlFeesUsdcA = 2e8; // 200 USDC
  uint256 maxWtdlFeesUsdcB = 25e7; // 250 USDC
  uint256 ethAmt = 1e16; // 0.01 ETH
  uint256 usdcAmt = 1e8; // 100 USDC

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

  function testAllowAndStopPaymentsForToken() public {
    // Try to allow payments for token with non-owner and confirm revert
    vm.startPrank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.allowPaymentsForToken(address(usdc));
    vm.stopPrank();

    // Try to stop payments for token with non-owner and confirm revert
    vm.startPrank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.stopPaymentsForToken(address(usdc));
    vm.stopPrank();

    // Create a payable
    vm.startPrank(user);
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);
    vm.stopPrank();

    // Try to make payment before token is supported and confirm revert
    vm.startPrank(user);
    deal(address(usdc), user, usdcAmt);
    usdc.approve(address(chainbills), usdcAmt);
    vm.expectRevert(UnsupportedToken.selector);
    chainbills.pay(payableId, address(usdc), usdcAmt);
    vm.stopPrank();

    // Allow payments for token
    vm.startPrank(owner);
    vm.expectEmit(true, true, true, true);
    emit AllowedPaymentsForToken(address(usdc));
    chainbills.allowPaymentsForToken(address(usdc));
    vm.stopPrank();

    // Verify token is supported
    assertTrue(chainbills.getTokenDetails(address(usdc)).isSupported);

    // Make successful payment
    vm.startPrank(user);
    vm.expectEmit(true, true, false, true);
    emit UserPaid(payableId, user, bytes32(0), 0, 1, 1);
    chainbills.pay(payableId, address(usdc), usdcAmt);
    vm.stopPrank();

    // Stop payments for token
    vm.startPrank(owner);
    vm.expectEmit(true, true, true, true);
    emit StoppedPaymentsForToken(address(usdc));
    chainbills.stopPaymentsForToken(address(usdc));
    vm.stopPrank();

    // Verify token is no longer supported
    assertFalse(chainbills.getTokenDetails(address(usdc)).isSupported);

    // Try to make payment after token is no longer supported and confirm revert
    vm.startPrank(user);
    deal(address(usdc), user, usdcAmt);
    usdc.approve(address(chainbills), usdcAmt);
    vm.expectRevert(UnsupportedToken.selector);
    chainbills.pay(payableId, address(usdc), usdcAmt);
    vm.stopPrank();
  }

  function testSetFeeCollectorAddress() public {
    // Try to set fee collector with non-owner and confirm revert
    vm.startPrank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.setFeeCollectorAddress(feeCollectorA);
    vm.stopPrank();

    // Prepare contract for payments
    vm.startPrank(owner);
    chainbills.allowPaymentsForToken(address(usdc));
    chainbills.updateMaxWithdrawalFees(address(usdc), maxWtdlFeesUsdcA);
    vm.stopPrank();

    // Create payable and make payment
    vm.startPrank(user);
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);
    deal(address(usdc), user, usdcAmt);
    usdc.approve(address(chainbills), usdcAmt);
    chainbills.pay(payableId, address(usdc), usdcAmt);
    vm.stopPrank();

    // Set fee collector A as owner
    vm.startPrank(owner);
    vm.expectEmit(true, true, true, true);
    emit SetFeeCollectorAddress(feeCollectorA);
    chainbills.setFeeCollectorAddress(feeCollectorA);
    vm.stopPrank();

    // Verify fee collector is set
    assertEq(chainbills.getConfig().feeCollector, feeCollectorA);

    // Make withdrawal and verify fee collector A balance
    uint256 withdrawalAmt = usdcAmt / 2;
    uint256 expectedFee = (withdrawalAmt * feePercentA) / 10000; // includes 2 decimals

    vm.startPrank(user);
    chainbills.withdraw(payableId, address(usdc), withdrawalAmt);
    vm.stopPrank();

    assertEq(usdc.balanceOf(feeCollectorA), expectedFee);
    uint256 prevFeeCollectorABalance = usdc.balanceOf(feeCollectorA);

    // Set new fee collector B as owner
    vm.startPrank(owner);
    vm.expectEmit(true, true, true, true);
    emit SetFeeCollectorAddress(feeCollectorB);
    chainbills.setFeeCollectorAddress(feeCollectorB);
    vm.stopPrank();

    // Verify fee collector is updated
    assertEq(chainbills.getConfig().feeCollector, feeCollectorB);

    // Make withdrawal and verify fee collector B balance
    // Re-use the same withdrawal amount as it was half of the payment
    vm.startPrank(user);
    chainbills.withdraw(payableId, address(usdc), withdrawalAmt);
    vm.stopPrank();

    // Verify fee collector B balance is updated
    assertEq(usdc.balanceOf(feeCollectorB), expectedFee);

    // Verify fee collector A balance is unchanged
    assertEq(usdc.balanceOf(feeCollectorA), prevFeeCollectorABalance);
  }

  function testSetWithdrawalFeePercentage() public {
    // Try to set withdrawal fee percentage as non-owner
    vm.startPrank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.setWithdrawalFeePercentage(100);
    vm.stopPrank();

    // Prepare contract for payments
    vm.startPrank(owner);
    chainbills.allowPaymentsForToken(address(usdc));
    chainbills.updateMaxWithdrawalFees(address(usdc), maxWtdlFeesUsdcA);

    // Set withdrawal fee percentage A as owner
    vm.expectEmit(true, true, true, true);
    emit SetWithdrawalFeePercentage(feePercentA);
    chainbills.setWithdrawalFeePercentage(feePercentA);
    vm.stopPrank();

    // Verify fee percentage is set
    assertEq(chainbills.getConfig().withdrawalFeePercentage, feePercentA);

    // Create payable and make payment
    vm.startPrank(user);
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);
    deal(address(usdc), user, usdcAmt);
    usdc.approve(address(chainbills), usdcAmt);
    chainbills.pay(payableId, address(usdc), usdcAmt);

    // Make withdrawal and verify fee with percentage A
    uint256 withdrawalAmt = usdcAmt;
    uint256 expectedFeeA = (withdrawalAmt * feePercentA) / 10000; // includes 2 decimals
    uint256 prevBalance = usdc.balanceOf(feeCollectorA);

    vm.expectEmit(true, true, false, true);
    emit Withdrew(payableId, user, bytes32(0), 1, 1, 1);
    chainbills.withdraw(payableId, address(usdc), withdrawalAmt);
    vm.stopPrank();

    assertEq(usdc.balanceOf(feeCollectorA), prevBalance + expectedFeeA);

    // Set new withdrawal fee percentage B as owner
    vm.startPrank(owner);
    vm.expectEmit(true, true, true, true);
    emit SetWithdrawalFeePercentage(feePercentB);
    chainbills.setWithdrawalFeePercentage(feePercentB);
    vm.stopPrank();

    // Verify fee percentage is updated
    assertEq(chainbills.getConfig().withdrawalFeePercentage, feePercentB);

    // make another payment
    vm.startPrank(user);
    deal(address(usdc), user, usdcAmt);
    usdc.approve(address(chainbills), usdcAmt);
    chainbills.pay(payableId, address(usdc), usdcAmt);

    // Make withdrawal and verify fee with percentage B
    prevBalance = usdc.balanceOf(feeCollectorA);
    uint256 expectedFeeB = (withdrawalAmt * feePercentB) / 10000; // includes 2 decimals

    vm.expectEmit(true, true, false, true);
    emit Withdrew(payableId, user, bytes32(0), 2, 2, 2);
    chainbills.withdraw(payableId, address(usdc), withdrawalAmt);
    vm.stopPrank();

    assertEq(usdc.balanceOf(feeCollectorA), prevBalance + expectedFeeB);
  }

  function testUpdateMaxWithdrawalFees() public {
    uint256 hugeAmount = 15e9; // 15,000 USDC

    // Try updating max withdrawal fees as non-owner
    vm.startPrank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.updateMaxWithdrawalFees(address(usdc), maxWtdlFeesUsdcA);
    vm.stopPrank();

    // Update max withdrawal fees as owner to maxFeesA
    vm.startPrank(owner);
    chainbills.allowPaymentsForToken(address(usdc)); // Prepare contract for payments
    vm.expectEmit(true, true, true, true);
    emit UpdatedMaxWithdrawalFees(address(usdc), maxWtdlFeesUsdcA);
    chainbills.updateMaxWithdrawalFees(address(usdc), maxWtdlFeesUsdcA);
    vm.stopPrank();

    // Verify max withdrawal fees is updated
    assertEq(chainbills.getTokenDetails(address(usdc)).maxWithdrawalFees, maxWtdlFeesUsdcA);

    // Create payable and make huge payment
    vm.startPrank(user);
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);
    deal(address(usdc), user, hugeAmount);
    usdc.approve(address(chainbills), hugeAmount);
    chainbills.pay(payableId, address(usdc), hugeAmount);

    // Make withdrawal and verify fee is capped at maximum A
    uint256 prevBalance = usdc.balanceOf(feeCollectorA);

    vm.expectEmit(true, true, false, true);
    emit Withdrew(payableId, user, bytes32(0), 1, 1, 1);
    chainbills.withdraw(payableId, address(usdc), hugeAmount);
    vm.stopPrank();

    assertEq(usdc.balanceOf(feeCollectorA), prevBalance + maxWtdlFeesUsdcA);

    // Update max withdrawal fees as owner to amount B
    vm.startPrank(owner);
    vm.expectEmit(true, true, true, true);
    emit UpdatedMaxWithdrawalFees(address(usdc), maxWtdlFeesUsdcB);
    chainbills.updateMaxWithdrawalFees(address(usdc), maxWtdlFeesUsdcB);
    vm.stopPrank();

    // Verify max withdrawal fees is updated
    assertEq(chainbills.getTokenDetails(address(usdc)).maxWithdrawalFees, maxWtdlFeesUsdcB);

    // Make another huge payment
    vm.startPrank(user);
    deal(address(usdc), user, hugeAmount);
    usdc.approve(address(chainbills), hugeAmount);
    chainbills.pay(payableId, address(usdc), hugeAmount);

    // Make withdrawal and verify fee is capped at maximum B
    prevBalance = usdc.balanceOf(feeCollectorA);

    vm.expectEmit(true, true, false, true);
    emit Withdrew(payableId, user, bytes32(0), 2, 2, 2);
    chainbills.withdraw(payableId, address(usdc), hugeAmount);
    vm.stopPrank();

    assertEq(usdc.balanceOf(feeCollectorA), prevBalance + maxWtdlFeesUsdcB);
  }
}
