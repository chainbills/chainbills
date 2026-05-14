// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import {Test} from 'forge-std/Test.sol';
import {Chainbills} from 'src/Chainbills.sol';
import {CbGetters} from 'src/CbGetters.sol';
import {CbStructs} from 'src/CbStructs.sol';
import {CbPayables} from 'src/CbPayables.sol';
import {CbTransactions} from 'src/CbTransactions.sol';
import {USDC} from './mocks/MockUSDC.sol';

contract CbGettersTest is CbStructs, Test {
  Chainbills chainbills;
  CbGetters cbGetters;
  USDC usdc;

  address owner = makeAddr('owner');
  address user = makeAddr('user');
  address host = makeAddr('host');
  address admin = makeAddr('admin');
  address feeCollector = makeAddr('fee-collector');

  uint16 feePercent = 200;
  uint256 usdcAmt = 1e8; // 100 USDC
  uint256 maxWtdlFeeUsdc = 2e8; // 200 USDC

  bytes32 foreignCbChainId = keccak256('eip155:2');

  // IDs captured during setUp for later assertions.
  bytes32 payableId;
  bytes32 paymentId;
  bytes32 withdrawalId;

  // Blank Test Function to exclude this Test contract itself from test coverage reports.
  function test() public {}

  function setUp() public {
    vm.startPrank(owner);
    chainbills = Chainbills(payable(address(new ERC1967Proxy(address(new Chainbills()), ''))));
    usdc = new USDC();

    chainbills.initialize(feeCollector, feePercent);
    chainbills.setPayablesLogic(address(new CbPayables()));
    chainbills.setTransactionsLogic(address(new CbTransactions()));
    chainbills.grantAdminRole(admin);

    chainbills.allowPaymentsForToken(address(usdc));
    chainbills.updateMaxWithdrawalFees(address(usdc), maxWtdlFeeUsdc);

    cbGetters = new CbGetters(address(chainbills));
    vm.stopPrank();

    // Create a payable as host.
    vm.prank(host);
    (payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    // Make a payment from user.
    deal(address(usdc), user, usdcAmt * 10);
    vm.prank(user);
    usdc.approve(address(chainbills), usdcAmt * 10);
    vm.prank(user);
    (paymentId,) = chainbills.pay(payableId, address(usdc), usdcAmt);

    // Withdraw from host.
    vm.prank(host);
    withdrawalId = chainbills.withdraw(payableId, address(usdc), usdcAmt);
  }

  // ------------------------------------------------------------------------
  // CbGetters constructor
  // ------------------------------------------------------------------------

  function testConstructorZeroAddressReverts() public {
    vm.expectRevert(CbGetters.InvalidAddress.selector);
    new CbGetters(address(0));
  }

  // ------------------------------------------------------------------------
  // getConfig
  // ------------------------------------------------------------------------

  function testGetConfig() public view {
    Config memory conf = cbGetters.getConfig();
    assertEq(conf.feeCollector, feeCollector);
    assertEq(conf.withdrawalFeePercentage, feePercent);
  }

  // ------------------------------------------------------------------------
  // getChainStats
  // ------------------------------------------------------------------------

  function testGetChainStats() public view {
    ChainStats memory stats = cbGetters.getChainStats();
    // host + user are both initialized as users.
    assertEq(stats.usersCount, 2);
    assertEq(stats.payablesCount, 1);
    assertEq(stats.userPaymentsCount, 1);
    assertEq(stats.payablePaymentsCount, 1);
    assertEq(stats.withdrawalsCount, 1);
  }

  // ------------------------------------------------------------------------
  // getTokenDetails
  // ------------------------------------------------------------------------

  function testGetTokenDetailsInvalidZeroAddressReverts() public {
    vm.expectRevert(InvalidTokenAddress.selector);
    cbGetters.getTokenDetails(address(0));
  }

  function testGetTokenDetailsUnregisteredReverts() public {
    vm.expectRevert(InvalidTokenAddress.selector);
    cbGetters.getTokenDetails(makeAddr('unregistered'));
  }

  function testGetTokenDetails() public view {
    TokenDetails memory d = cbGetters.getTokenDetails(address(usdc));
    assertTrue(d.isSupported);
    assertEq(d.token, address(usdc));
    assertEq(d.maxWithdrawalFees, maxWtdlFeeUsdc);
    assertEq(d.totalUserPaid, usdcAmt);
    assertEq(d.totalPayableReceived, usdcAmt);
    assertEq(d.totalWithdrawn, usdcAmt);
  }

  // ------------------------------------------------------------------------
  // getUser
  // ------------------------------------------------------------------------

  function testGetUserZeroAddressReverts() public {
    vm.expectRevert(InvalidWalletAddress.selector);
    cbGetters.getUser(address(0));
  }

  function testGetUserNotInitializedReverts() public {
    vm.expectRevert(InvalidWalletAddress.selector);
    cbGetters.getUser(makeAddr('never-interacted'));
  }

  function testGetUser() public view {
    User memory u = cbGetters.getUser(host);
    assertEq(u.payablesCount, 1);
    assertEq(u.withdrawalsCount, 1);
    assertGt(u.chainCount, 0);
  }

  // ------------------------------------------------------------------------
  // getActivityRecord
  // ------------------------------------------------------------------------

  function testGetActivityRecordZeroIdReverts() public {
    vm.expectRevert(InvalidActivityId.selector);
    cbGetters.getActivityRecord(bytes32(0));
  }

  function testGetActivityRecordInvalidIdReverts() public {
    vm.expectRevert(InvalidActivityId.selector);
    cbGetters.getActivityRecord(keccak256('nonexistent'));
  }

  function testGetActivityRecord() public view {
    // The first activity is InitializedUser for host.
    bytes32 actId = chainbills.chainActivityIds(0);
    ActivityRecord memory r = cbGetters.getActivityRecord(actId);
    assertEq(r.chainCount, 1);
    assertGt(r.timestamp, 0);
  }

  // ------------------------------------------------------------------------
  // getPayable
  // ------------------------------------------------------------------------

  function testGetPayableZeroIdReverts() public {
    vm.expectRevert(InvalidPayableId.selector);
    cbGetters.getPayable(bytes32(0));
  }

  function testGetPayableNonexistentReverts() public {
    vm.expectRevert(InvalidPayableId.selector);
    cbGetters.getPayable(keccak256('nope'));
  }

  function testGetPayable() public view {
    Payable memory p = cbGetters.getPayable(payableId);
    assertEq(p.host, host);
    assertEq(p.chainCount, 1);
    assertEq(p.hostCount, 1);
    assertEq(p.paymentsCount, 1);
    assertEq(p.withdrawalsCount, 1);
    assertFalse(p.isClosed);
  }

  // ------------------------------------------------------------------------
  // getForeignPayable
  // ------------------------------------------------------------------------

  function testGetForeignPayableZeroIdReverts() public {
    vm.expectRevert(InvalidPayableId.selector);
    cbGetters.getForeignPayable(bytes32(0));
  }

  function testGetForeignPayableNonexistentReverts() public {
    vm.expectRevert(InvalidPayableId.selector);
    cbGetters.getForeignPayable(keccak256('no-foreign'));
  }

  function testGetForeignPayable() public {
    bytes32 fpId = keccak256('foreign-payable');
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(fpId, foreignCbChainId, 1, 1, false, new TokenAndAmountForeign[](0));

    PayableForeign memory fp = cbGetters.getForeignPayable(fpId);
    assertEq(fp.chainId, foreignCbChainId);
    assertFalse(fp.isClosed);
  }

  // ------------------------------------------------------------------------
  // getUserPayment
  // ------------------------------------------------------------------------

  function testGetUserPaymentZeroIdReverts() public {
    vm.expectRevert(InvalidPaymentId.selector);
    cbGetters.getUserPayment(bytes32(0));
  }

  function testGetUserPaymentNonexistentReverts() public {
    vm.expectRevert(InvalidPaymentId.selector);
    cbGetters.getUserPayment(keccak256('nope'));
  }

  function testGetUserPayment() public view {
    UserPayment memory p = cbGetters.getUserPayment(paymentId);
    assertEq(p.payableId, payableId);
    assertEq(p.payer, user);
    assertEq(p.token, address(usdc));
    assertEq(p.amount, usdcAmt);
    assertGt(p.timestamp, 0);
  }

  // ------------------------------------------------------------------------
  // getPayablePayment
  // ------------------------------------------------------------------------

  function testGetPayablePaymentZeroIdReverts() public {
    vm.expectRevert(InvalidPaymentId.selector);
    cbGetters.getPayablePayment(bytes32(0));
  }

  function testGetPayablePaymentNonexistentReverts() public {
    vm.expectRevert(InvalidPaymentId.selector);
    cbGetters.getPayablePayment(keccak256('nope'));
  }

  function testGetPayablePayment() public view {
    // The payable payment ID is on the payable payments list.
    bytes32 ppId = chainbills.chainPayablePaymentIds(0);
    PayablePayment memory p = cbGetters.getPayablePayment(ppId);
    assertEq(p.payableId, payableId);
    assertEq(p.amount, usdcAmt);
  }

  // ------------------------------------------------------------------------
  // getWithdrawal
  // ------------------------------------------------------------------------

  function testGetWithdrawalZeroIdReverts() public {
    vm.expectRevert(InvalidWithdrawalId.selector);
    cbGetters.getWithdrawal(bytes32(0));
  }

  function testGetWithdrawalNonexistentReverts() public {
    vm.expectRevert(InvalidWithdrawalId.selector);
    cbGetters.getWithdrawal(keccak256('nope'));
  }

  function testGetWithdrawal() public view {
    Withdrawal memory w = cbGetters.getWithdrawal(withdrawalId);
    assertEq(w.payableId, payableId);
    assertEq(w.host, host);
    assertEq(w.token, address(usdc));
    assertEq(w.amount, usdcAmt);
  }

  // ------------------------------------------------------------------------
  // getAllowedTokensAndAmounts
  // ------------------------------------------------------------------------

  function testGetAllowedTokensAndAmountsEmpty() public view {
    // The payable created in setUp has no ATAA.
    TokenAndAmount[] memory items = cbGetters.getAllowedTokensAndAmounts(payableId);
    assertEq(items.length, 0);
  }

  function testGetAllowedTokensAndAmountsWithEntries() public {
    TokenAndAmount[] memory ataa = new TokenAndAmount[](2);
    ataa[0] = TokenAndAmount({token: address(usdc), amount: usdcAmt});
    ataa[1] = TokenAndAmount({token: address(usdc), amount: usdcAmt * 2});

    vm.prank(host);
    (bytes32 pid,) = chainbills.createPayable(ataa, false);

    TokenAndAmount[] memory items = cbGetters.getAllowedTokensAndAmounts(pid);
    assertEq(items.length, 2);
    assertEq(items[0].token, address(usdc));
    assertEq(items[0].amount, usdcAmt);
    assertEq(items[1].amount, usdcAmt * 2);
  }

  // ------------------------------------------------------------------------
  // getBalances
  // ------------------------------------------------------------------------

  function testGetBalancesAfterPayment() public view {
    TokenAndAmount[] memory balances = cbGetters.getBalances(payableId);
    // After payment + withdrawal the internal balance is 0 — the balance slot
    // still exists but with amount=0.
    assertEq(balances.length, 1);
    assertEq(balances[0].token, address(usdc));
    assertEq(balances[0].amount, 0);
  }

  // ------------------------------------------------------------------------
  // getForeignPayableAllowedTokensAndAmounts
  // ------------------------------------------------------------------------

  function testGetForeignPayableAllowedTokensAndAmounts() public {
    bytes32 fpId = keccak256('fp-ataa');
    TokenAndAmountForeign[] memory ataa = new TokenAndAmountForeign[](2);
    ataa[0] = TokenAndAmountForeign({token: bytes32(uint256(1)), amount: 1e6});
    ataa[1] = TokenAndAmountForeign({token: bytes32(uint256(2)), amount: 2e6});
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(fpId, foreignCbChainId, 1, 1, false, ataa);

    TokenAndAmountForeign[] memory items = cbGetters.getForeignPayableAllowedTokensAndAmounts(fpId);
    assertEq(items.length, 2);
    assertEq(items[0].amount, 1e6);
    assertEq(items[1].amount, 2e6);
  }

  // ------------------------------------------------------------------------
  // getPayableChainPaymentsCount
  // ------------------------------------------------------------------------

  function testGetPayableChainPaymentsCountZeroPayableIdReverts() public {
    vm.expectRevert(InvalidPayableId.selector);
    cbGetters.getPayableChainPaymentsCount(bytes32(0), foreignCbChainId);
  }

  function testGetPayableChainPaymentsCountReturnsZeroForNoPayments() public view {
    assertEq(cbGetters.getPayableChainPaymentsCount(payableId, foreignCbChainId), 0);
  }

  // ------------------------------------------------------------------------
  // getForForeignChainMatchingTokenAddress
  // ------------------------------------------------------------------------

  function testGetForForeignChainMatchingTokenAddressUnregisteredReverts() public {
    vm.expectRevert(InvalidChainIdOrForeignToken.selector);
    cbGetters.getForForeignChainMatchingTokenAddress(foreignCbChainId, bytes32(uint256(1)));
  }

  function testGetForForeignChainMatchingTokenAddress() public {
    bytes32 foreignToken = bytes32(uint256(uint160(address(usdc))));
    vm.prank(owner);
    chainbills.registerMatchingTokenForForeignChain(foreignCbChainId, foreignToken, address(usdc));

    address match_ = cbGetters.getForForeignChainMatchingTokenAddress(foreignCbChainId, foreignToken);
    assertEq(match_, address(usdc));
  }

  // ------------------------------------------------------------------------
  // getForTokenAddressMatchingForeignChainToken
  // ------------------------------------------------------------------------

  function testGetForTokenAddressMatchingForeignChainTokenUnregisteredReverts() public {
    vm.expectRevert(InvalidChainIdOrForeignToken.selector);
    cbGetters.getForTokenAddressMatchingForeignChainToken(address(usdc), foreignCbChainId);
  }

  function testGetForTokenAddressMatchingForeignChainToken() public {
    bytes32 foreignToken = bytes32(uint256(uint160(address(usdc))));
    vm.prank(owner);
    chainbills.registerMatchingTokenForForeignChain(foreignCbChainId, foreignToken, address(usdc));

    bytes32 match_ = cbGetters.getForTokenAddressMatchingForeignChainToken(address(usdc), foreignCbChainId);
    assertEq(match_, foreignToken);
  }

  // ------------------------------------------------------------------------
  // Bulk getters
  // ------------------------------------------------------------------------

  function testGetUsersBulk() public {
    vm.prank(makeAddr('user2'));
    chainbills.createPayable(new TokenAndAmount[](0), false);

    address[] memory wallets = new address[](2);
    wallets[0] = host;
    wallets[1] = makeAddr('user2');
    User[] memory users = cbGetters.getUsersBulk(wallets);
    assertEq(users.length, 2);
    assertEq(users[0].payablesCount, 1);
    assertEq(users[1].payablesCount, 1);
  }

  function testGetPayablesBulk() public {
    vm.prank(host);
    (bytes32 pid2,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    bytes32[] memory ids = new bytes32[](2);
    ids[0] = payableId;
    ids[1] = pid2;
    Payable[] memory payables = cbGetters.getPayablesBulk(ids);
    assertEq(payables.length, 2);
    assertEq(payables[0].hostCount, 1);
    assertEq(payables[1].hostCount, 2);
  }

  function testGetUserPaymentsBulk() public {
    vm.prank(user);
    (bytes32 pid2,) = chainbills.pay(payableId, address(usdc), usdcAmt);

    bytes32[] memory ids = new bytes32[](2);
    ids[0] = paymentId;
    ids[1] = pid2;
    UserPayment[] memory payments = cbGetters.getUserPaymentsBulk(ids);
    assertEq(payments.length, 2);
    assertEq(payments[0].amount, usdcAmt);
    assertEq(payments[1].amount, usdcAmt);
  }

  function testGetPayablePaymentsBulk() public view {
    bytes32 ppId = chainbills.chainPayablePaymentIds(0);
    bytes32[] memory ids = new bytes32[](1);
    ids[0] = ppId;
    PayablePayment[] memory payments = cbGetters.getPayablePaymentsBulk(ids);
    assertEq(payments.length, 1);
    assertEq(payments[0].payableId, payableId);
  }

  function testGetWithdrawalsBulk() public view {
    bytes32[] memory ids = new bytes32[](1);
    ids[0] = withdrawalId;
    Withdrawal[] memory wtdls = cbGetters.getWithdrawalsBulk(ids);
    assertEq(wtdls.length, 1);
    assertEq(wtdls[0].host, host);
  }

  function testGetActivityRecordsBulk() public view {
    bytes32 actId = chainbills.chainActivityIds(0);
    bytes32[] memory ids = new bytes32[](1);
    ids[0] = actId;
    ActivityRecord[] memory records = cbGetters.getActivityRecordsBulk(ids);
    assertEq(records.length, 1);
    assertEq(records[0].chainCount, 1);
  }

  // ------------------------------------------------------------------------
  // Paginated getters — chain-level arrays
  // ------------------------------------------------------------------------

  function _create3Payables() internal {
    // Creates 3 more payables for pagination testing.
    for (uint256 i = 0; i < 3; i++) {
      vm.prank(host);
      chainbills.createPayable(new TokenAndAmount[](0), false);
    }
  }

  function testChainUserAddressesPaginated() public view {
    // setUp created 2 users (host and user).
    address[] memory page = cbGetters.chainUserAddressesPaginated(0, 10);
    assertEq(page.length, 2);

    // Offset beyond total returns empty.
    address[] memory empty = cbGetters.chainUserAddressesPaginated(100, 10);
    assertEq(empty.length, 0);

    // First user only.
    address[] memory one = cbGetters.chainUserAddressesPaginated(0, 1);
    assertEq(one.length, 1);
  }

  function testChainPayableIdsPaginated() public {
    _create3Payables(); // total = 4 (1 from setUp + 3)
    bytes32[] memory page = cbGetters.chainPayableIdsPaginated(0, 10);
    assertEq(page.length, 4);

    bytes32[] memory mid = cbGetters.chainPayableIdsPaginated(1, 2);
    assertEq(mid.length, 2);

    bytes32[] memory empty = cbGetters.chainPayableIdsPaginated(10, 5);
    assertEq(empty.length, 0);

    // Limit clips at total.
    bytes32[] memory clipped = cbGetters.chainPayableIdsPaginated(3, 100);
    assertEq(clipped.length, 1);
  }

  function testChainForeignPayableIdsPaginated() public {
    // Seed two foreign payables via adminSync.
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(keccak256('fp1'), foreignCbChainId, 1, 1, false, new TokenAndAmountForeign[](0));
    vm.prank(admin);
    chainbills.adminSyncForeignPayable(keccak256('fp2'), foreignCbChainId, 1, 1, false, new TokenAndAmountForeign[](0));

    bytes32[] memory page = cbGetters.chainForeignPayableIdsPaginated(0, 10);
    assertEq(page.length, 2);

    bytes32[] memory empty = cbGetters.chainForeignPayableIdsPaginated(10, 5);
    assertEq(empty.length, 0);
  }

  function testChainUserPaymentIdsPaginated() public view {
    // One payment from setUp.
    bytes32[] memory page = cbGetters.chainUserPaymentIdsPaginated(0, 10);
    assertEq(page.length, 1);
    assertEq(page[0], paymentId);

    bytes32[] memory empty = cbGetters.chainUserPaymentIdsPaginated(1, 5);
    assertEq(empty.length, 0);
  }

  function testChainPayablePaymentIdsPaginated() public view {
    bytes32[] memory page = cbGetters.chainPayablePaymentIdsPaginated(0, 10);
    assertEq(page.length, 1);

    bytes32[] memory empty = cbGetters.chainPayablePaymentIdsPaginated(1, 5);
    assertEq(empty.length, 0);
  }

  function testChainWithdrawalIdsPaginated() public view {
    bytes32[] memory page = cbGetters.chainWithdrawalIdsPaginated(0, 10);
    assertEq(page.length, 1);
    assertEq(page[0], withdrawalId);
  }

  function testChainActivityIdsPaginated() public view {
    // host: InitializedUser + CreatedPayable, user: InitializedUser + UserPaid +
    // PayableReceived; host: Withdrew → total at least 6.
    bytes32[] memory page = cbGetters.chainActivityIdsPaginated(0, 100);
    assertGt(page.length, 0);

    bytes32[] memory empty = cbGetters.chainActivityIdsPaginated(1000, 5);
    assertEq(empty.length, 0);
  }

  // ------------------------------------------------------------------------
  // Paginated getters — user-scoped arrays
  // ------------------------------------------------------------------------

  function testUserPayableIdsPaginated() public view {
    bytes32[] memory ids = cbGetters.userPayableIdsPaginated(host, 0, 10);
    assertEq(ids.length, 1);
    assertEq(ids[0], payableId);

    bytes32[] memory empty = cbGetters.userPayableIdsPaginated(host, 1, 5);
    assertEq(empty.length, 0);
  }

  function testUserPaymentIdsPaginated() public view {
    bytes32[] memory ids = cbGetters.userPaymentIdsPaginated(user, 0, 10);
    assertEq(ids.length, 1);
    assertEq(ids[0], paymentId);
  }

  function testUserActivityIdsPaginated() public view {
    bytes32[] memory ids = cbGetters.userActivityIdsPaginated(host, 0, 100);
    assertGt(ids.length, 0);
  }

  function testUserWithdrawalIdsPaginated() public view {
    bytes32[] memory ids = cbGetters.userWithdrawalIdsPaginated(host, 0, 10);
    assertEq(ids.length, 1);
    assertEq(ids[0], withdrawalId);
  }

  // ------------------------------------------------------------------------
  // Paginated getters — payable-scoped arrays
  // ------------------------------------------------------------------------

  function testPayablePaymentIdsPaginated() public view {
    bytes32[] memory ids = cbGetters.payablePaymentIdsPaginated(payableId, 0, 10);
    assertEq(ids.length, 1);

    bytes32[] memory empty = cbGetters.payablePaymentIdsPaginated(payableId, 1, 5);
    assertEq(empty.length, 0);
  }

  function testPayableActivityIdsPaginated() public view {
    bytes32[] memory ids = cbGetters.payableActivityIdsPaginated(payableId, 0, 100);
    // Activities: CreatedPayable + PayableReceived + Withdrew = 3.
    assertGte(ids.length, 3);
  }

  function testPayableWithdrawalIdsPaginated() public view {
    bytes32[] memory ids = cbGetters.payableWithdrawalIdsPaginated(payableId, 0, 10);
    assertEq(ids.length, 1);
    assertEq(ids[0], withdrawalId);
  }

  function testPayableChainPaymentIdsPaginated() public view {
    // This chain's payments: use config.cbChainId — but since cbChainId is not set,
    // payments map to bytes32(0). Just verify empty results for foreignCbChainId.
    bytes32[] memory ids = cbGetters.payableChainPaymentIdsPaginated(payableId, foreignCbChainId, 0, 10);
    assertEq(ids.length, 0);
  }

  // ------------------------------------------------------------------------
  // Helper: assertGte
  // ------------------------------------------------------------------------

  function assertGte(uint256 a, uint256 b) internal pure {
    assertGe(a, b);
  }
}
