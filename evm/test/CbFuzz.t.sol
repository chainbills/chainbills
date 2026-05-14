// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import {Test} from 'forge-std/Test.sol';
import {Chainbills} from 'src/Chainbills.sol';
import {CbGetters} from 'src/CbGetters.sol';
import {CbStructs} from 'src/CbStructs.sol';
import {CbPayables} from 'src/CbPayables.sol';
import {CbTransactions} from 'src/CbTransactions.sol';
import {CbDecodePayload, CbEncodePayablePayload, CbEncodePaymentPayload} from 'src/CbPayloadMessages.sol';
import {USDC} from './mocks/MockUSDC.sol';

contract CbFuzzTest is CbStructs, Test {
  using CbEncodePayablePayload for PayablePayload;
  using CbEncodePaymentPayload for PaymentPayload;
  using CbDecodePayload for bytes;

  Chainbills chainbills;
  CbGetters cbGetters;
  USDC usdc;

  address owner = makeAddr('owner');
  address host = makeAddr('host');
  address user = makeAddr('user');
  address feeCollector = makeAddr('fee-collector');

  uint16 feePercent = 200; // 2%
  uint256 maxWtdlFeesEth = 5e17;
  uint256 maxWtdlFeesUsdc = 1e10; // 10,000 USDC

  // Blank test to exclude contract from coverage.
  function test() public {}

  function setUp() public {
    vm.startPrank(owner);
    chainbills = Chainbills(payable(address(new ERC1967Proxy(address(new Chainbills()), ''))));
    usdc = new USDC();

    chainbills.initialize(feeCollector, feePercent);
    chainbills.setPayablesLogic(address(new CbPayables()));
    chainbills.setTransactionsLogic(address(new CbTransactions()));

    chainbills.allowPaymentsForToken(address(chainbills));
    chainbills.updateMaxWithdrawalFees(address(chainbills), maxWtdlFeesEth);
    chainbills.allowPaymentsForToken(address(usdc));
    chainbills.updateMaxWithdrawalFees(address(usdc), maxWtdlFeesUsdc);

    cbGetters = new CbGetters(address(chainbills));
    vm.stopPrank();
  }

  // ---------------------------------------------------------------------------
  // 1. Fee calculation invariants
  //    Property: computed fee never exceeds the withdrawal amount, and
  //    amount-due (amount - fee) never underflows.
  // ---------------------------------------------------------------------------

  // Verify the fee formula is safe for all valid (contract-capped 0-10000) percentages.
  function testFuzz_feeNeverExceedsAmount(uint128 amount, uint16 rawPercent, uint128 maxFees) public pure {
    // Cap feePercent to the valid range enforced by setWithdrawalFeePercentage.
    uint16 feePercent_ = uint16(bound(uint256(rawPercent), 0, 10000));
    uint256 amt = uint256(amount);
    uint256 max = uint256(maxFees);
    uint256 percent = (amt * feePercent_) / 10000;
    uint256 fee = percent > max ? max : percent;
    // fee must never exceed the amount (would cause underflow on amtDue = amount - fee).
    assertLe(fee, amt, 'fee exceeds amount');
  }

  // The actual contract caps feePercent at 10000. Verify the cap prevents
  // the fee from exceeding amount for any valid (<=10000) percentage.
  function testFuzz_feeWithCappedPercentage(uint128 amount, uint16 rawPercent, uint128 maxFees) public pure {
    uint16 feePercent_ = uint16(bound(uint256(rawPercent), 0, 10000));
    uint256 amt = uint256(amount);
    uint256 max = uint256(maxFees);
    uint256 percent = (amt * feePercent_) / 10000;
    uint256 fee = percent > max ? max : percent;
    assertLe(fee, amt, 'capped fee exceeds amount');
    // amtDue must not underflow (checked arithmetic in solidity 0.8)
    assertEq(amt - fee + fee, amt, 'roundtrip mismatch');
  }

  // ---------------------------------------------------------------------------
  // 2. PayablePayload encode/decode roundtrip
  //    Property: for any valid (actionType 1-4) payload, decode(encode(p)) == p
  //    for every field.
  // ---------------------------------------------------------------------------

  function testFuzz_payablePayloadRoundtrip(
    bytes32 payableId,
    uint64 nonce,
    uint8 rawActionType,
    uint8 numTokens,
    bytes32 tokenSeed,
    uint64 amountSeed
  ) public pure {
    uint8 actionType = uint8(bound(uint256(rawActionType), 1, 4));
    numTokens = uint8(bound(uint256(numTokens), 0, 10));

    TokenAndAmountForeign[] memory ataa = new TokenAndAmountForeign[](numTokens);
    for (uint8 i = 0; i < numTokens; i++) {
      ataa[i] = TokenAndAmountForeign({
        token: keccak256(abi.encodePacked(tokenSeed, i)),
        amount: uint64(bound(uint256(amountSeed) + i, 1, type(uint64).max))
      });
    }

    bool isClosed = (actionType == 2);
    PayablePayload memory original = PayablePayload({
      version: 1,
      actionType: actionType,
      payableId: payableId,
      nonce: nonce,
      isClosed: isClosed,
      allowedTokensAndAmounts: ataa
    });

    PayablePayload memory decoded = original.encode().decodePayablePayload();

    assertEq(decoded.version, original.version, 'version mismatch');
    assertEq(decoded.actionType, original.actionType, 'actionType mismatch');
    assertEq(decoded.payableId, original.payableId, 'payableId mismatch');
    assertEq(decoded.nonce, original.nonce, 'nonce mismatch');
    if (actionType == 1 || actionType == 4) {
      // Create/update encode ATAA; isClosed is always false on wire.
      assertEq(decoded.allowedTokensAndAmounts.length, numTokens, 'ataa length mismatch');
      for (uint8 i = 0; i < numTokens; i++) {
        assertEq(decoded.allowedTokensAndAmounts[i].token, ataa[i].token, 'ataa token mismatch');
        assertEq(decoded.allowedTokensAndAmounts[i].amount, ataa[i].amount, 'ataa amount mismatch');
      }
    } else {
      // Close (2) / reopen (3) encode only isClosed — ATAA is absent from wire format.
      assertEq(decoded.allowedTokensAndAmounts.length, 0, 'ATAA must be empty for close/reopen');
      assertEq(decoded.isClosed, isClosed, 'isClosed mismatch');
    }
  }

  // ---------------------------------------------------------------------------
  // 3. PaymentPayload encode/decode roundtrip
  //    Property: all fields survive encode → decode unchanged.
  // ---------------------------------------------------------------------------

  function testFuzz_paymentPayloadRoundtrip(
    bytes32 payableId,
    bytes32 payableChainToken,
    bytes32 payableChainId,
    bytes32 payer,
    bytes32 payerChainToken,
    bytes32 payerChainId,
    uint64 amount,
    uint64 circleNonce
  ) public pure {
    PaymentPayload memory original = PaymentPayload({
      version: 1,
      payableId: payableId,
      payableChainToken: payableChainToken,
      payableChainId: payableChainId,
      payer: payer,
      payerChainToken: payerChainToken,
      payerChainId: payerChainId,
      amount: amount,
      circleNonce: circleNonce
    });

    PaymentPayload memory decoded = original.encode().decodePaymentPayload();

    assertEq(decoded.version, 1, 'version');
    assertEq(decoded.payableId, payableId, 'payableId');
    assertEq(decoded.payableChainToken, payableChainToken, 'payableChainToken');
    assertEq(decoded.payableChainId, payableChainId, 'payableChainId');
    assertEq(decoded.payer, payer, 'payer');
    assertEq(decoded.payerChainToken, payerChainToken, 'payerChainToken');
    assertEq(decoded.payerChainId, payerChainId, 'payerChainId');
    assertEq(decoded.amount, amount, 'amount');
    assertEq(decoded.circleNonce, circleNonce, 'circleNonce');
  }

  // ---------------------------------------------------------------------------
  // 4. Nonce stale detection
  //    Property: after syncing with nonce N, any N' <= N must revert with
  //    StalePayableUpdateNonce. N' > N must succeed.
  // ---------------------------------------------------------------------------

  function testFuzz_nonceStaleDetection(uint64 firstNonce, uint64 secondNonce) public {
    // firstNonce must be > 0 so there's a valid initial sync.
    firstNonce = uint64(bound(uint256(firstNonce), 1, type(uint64).max - 1));

    bytes32 payableId = keccak256('fuzz-nonce-payable');
    bytes32 chainId = keccak256('eip155:99');

    vm.prank(owner);
    chainbills.adminSyncForeignPayable(payableId, chainId, firstNonce, 1, false, new TokenAndAmountForeign[](0));

    if (secondNonce <= firstNonce) {
      vm.prank(owner);
      vm.expectRevert(StalePayableUpdateNonce.selector);
      chainbills.adminSyncForeignPayable(payableId, chainId, secondNonce, 1, false, new TokenAndAmountForeign[](0));
    } else {
      vm.prank(owner);
      chainbills.adminSyncForeignPayable(payableId, chainId, secondNonce, 1, false, new TokenAndAmountForeign[](0));
      assertEq(cbGetters.getForeignPayable(payableId).chainId, chainId, 'chainId after update');
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Pagination never reverts and always returns bounded results
  //    Property: payableIdsPaginated(offset, count) never reverts for any
  //    offset+count combo, and always returns length <= count.
  // ---------------------------------------------------------------------------

  function testFuzz_payablesPaginationNeverReverts(uint256 offset, uint256 count) public {
    // Create 5 payables to have a realistic dataset.
    vm.startPrank(host);
    for (uint256 i = 0; i < 5; i++) {
      chainbills.createPayable(new TokenAndAmount[](0), false);
    }
    vm.stopPrank();

    count = bound(count, 0, 100);
    bytes32[] memory results = cbGetters.chainPayableIdsPaginated(offset, count);
    assertLe(results.length, count, 'length exceeds requested count');
  }

  function testFuzz_userPayablesPaginationNeverReverts(uint256 offset, uint256 count) public {
    vm.startPrank(host);
    for (uint256 i = 0; i < 3; i++) {
      chainbills.createPayable(new TokenAndAmount[](0), false);
    }
    vm.stopPrank();

    count = bound(count, 0, 100);
    bytes32[] memory results = cbGetters.userPayableIdsPaginated(host, offset, count);
    assertLe(results.length, count, 'length exceeds requested count');
  }

  // ---------------------------------------------------------------------------
  // 6. ATAA amount enforcement
  //    Property: paying the wrong amount to a payable with allowedTokensAndAmounts
  //    always reverts. Paying the exact required amount always succeeds.
  // ---------------------------------------------------------------------------

  function testFuzz_ataaAmountEnforcement(uint256 requiredAmt, uint256 payAmt) public {
    // Constrain to realistic token amounts (1 to 1e12 tokens with 6 decimals).
    requiredAmt = bound(requiredAmt, 1, 1e12);
    payAmt = bound(payAmt, 1, 1e12);

    TokenAndAmount[] memory ataa = new TokenAndAmount[](1);
    ataa[0] = TokenAndAmount({token: address(usdc), amount: requiredAmt});
    vm.prank(host);
    (bytes32 payableId,) = chainbills.createPayable(ataa, false);

    deal(address(usdc), user, payAmt + 1);
    vm.startPrank(user);
    usdc.approve(address(chainbills), payAmt + 1);

    if (payAmt != requiredAmt) {
      vm.expectRevert(MatchingTokenAndAmountNotFound.selector);
      chainbills.pay(payableId, address(usdc), payAmt);
    } else {
      chainbills.pay(payableId, address(usdc), payAmt);
      assertEq(cbGetters.getBalances(payableId)[0].amount, payAmt, 'balance after pay');
    }
    vm.stopPrank();
  }

  // ---------------------------------------------------------------------------
  // 7. Balance consistency invariant
  //    Property: after N payments of the same token, the stored balance equals
  //    the sum of amounts paid.
  // ---------------------------------------------------------------------------

  function testFuzz_balanceAccumulatesCorrectly(uint8 numPayments, uint64 paymentAmt) public {
    numPayments = uint8(bound(uint256(numPayments), 1, 10));
    paymentAmt = uint64(bound(uint256(paymentAmt), 1, 1e8)); // max 100 USDC each

    vm.prank(host);
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    uint256 totalPaid = 0;
    for (uint8 i = 0; i < numPayments; i++) {
      deal(address(usdc), user, paymentAmt);
      vm.startPrank(user);
      usdc.approve(address(chainbills), paymentAmt);
      chainbills.pay(payableId, address(usdc), paymentAmt);
      vm.stopPrank();
      totalPaid += paymentAmt;
    }

    TokenAndAmount[] memory balances = cbGetters.getBalances(payableId);
    assertEq(balances.length, 1, 'should have exactly one balance entry');
    assertEq(balances[0].token, address(usdc), 'wrong token');
    assertEq(balances[0].amount, totalPaid, 'balance != sum of payments');
    assertEq(cbGetters.getPayable(payableId).paymentsCount, numPayments, 'paymentsCount mismatch');
  }

  // ---------------------------------------------------------------------------
  // 8. Withdraw-after-pay invariant
  //    Property: after paying X then withdrawing Y <= X, stored balance == X - Y.
  //    The fee formula: fee = min(Y * feePercent / 10000, maxFees).
  //    Host receives Y - fee. Fee collector receives fee.
  // ---------------------------------------------------------------------------

  function testFuzz_withdrawBalanceConsistency(uint64 payAmt, uint64 withdrawAmt) public {
    payAmt = uint64(bound(uint256(payAmt), 1e6, 1e10)); // 1 to 10,000 USDC
    withdrawAmt = uint64(bound(uint256(withdrawAmt), 1, payAmt)); // can't withdraw more than paid

    vm.prank(host);
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    deal(address(usdc), user, payAmt);
    vm.startPrank(user);
    usdc.approve(address(chainbills), payAmt);
    chainbills.pay(payableId, address(usdc), payAmt);
    vm.stopPrank();

    uint256 hostBalBefore = usdc.balanceOf(host);
    uint256 feeCollectorBalBefore = usdc.balanceOf(feeCollector);

    vm.prank(host);
    chainbills.withdraw(payableId, address(usdc), withdrawAmt);

    // Verify remaining payable balance.
    assertEq(cbGetters.getBalances(payableId)[0].amount, payAmt - withdrawAmt, 'remaining balance wrong');

    // Verify fee and host payout.
    uint256 percent = (uint256(withdrawAmt) * feePercent) / 10000;
    uint256 fee = percent > maxWtdlFeesUsdc ? maxWtdlFeesUsdc : percent;
    uint256 amtDue = uint256(withdrawAmt) - fee;

    assertEq(usdc.balanceOf(host) - hostBalBefore, amtDue, 'host received wrong amount');
    assertEq(usdc.balanceOf(feeCollector) - feeCollectorBalBefore, fee, 'fee collector received wrong amount');
  }

  // ---------------------------------------------------------------------------
  // 9. setWithdrawalFeePercentage cap enforcement
  //    Property: any feePercent > 10000 must revert.
  // ---------------------------------------------------------------------------

  function testFuzz_feePercentageCap(uint16 feePercent_) public {
    if (feePercent_ > 10000) {
      vm.prank(owner);
      vm.expectRevert(InvalidWithdrawalFeePercentage.selector);
      chainbills.setWithdrawalFeePercentage(feePercent_);
    } else {
      vm.prank(owner);
      chainbills.setWithdrawalFeePercentage(feePercent_);
      assertEq(cbGetters.getConfig().withdrawalFeePercentage, feePercent_);
    }
  }

  // ---------------------------------------------------------------------------
  // 10. Unregister foreign token mapping
  //     Property: after unregistering, the forward and reverse mappings are zero.
  // ---------------------------------------------------------------------------

  function testFuzz_unregisterClearsMapping(bytes32 foreignToken, bytes32 chainIdSeed) public {
    vm.assume(foreignToken != bytes32(0));
    // Build a foreign chainId that isn't this chain's chainId (which is 0 before setup).
    bytes32 foreignCbChainId = keccak256(abi.encodePacked('fuzz-chain', chainIdSeed));

    vm.startPrank(owner);
    // Register a mapping.
    chainbills.registerMatchingTokenForForeignChain(foreignCbChainId, foreignToken, address(usdc));

    // Verify forward mapping is set.
    assertEq(chainbills.forForeignChainMatchingTokenAddresses(foreignCbChainId, foreignToken), address(usdc));

    // Unregister.
    chainbills.unregisterMatchingTokenForForeignChain(foreignCbChainId, foreignToken);

    // Forward mapping must be cleared.
    assertEq(chainbills.forForeignChainMatchingTokenAddresses(foreignCbChainId, foreignToken), address(0));
    // Reverse mapping must be cleared too.
    assertEq(chainbills.forTokenAddressMatchingForeignChainTokens(address(usdc), foreignCbChainId), bytes32(0));
    vm.stopPrank();
  }
}
