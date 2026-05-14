// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Initializable} from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {PausableUpgradeable} from '@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol';
import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import {Test} from 'forge-std/Test.sol';
import {Chainbills} from 'src/Chainbills.sol';
import {CbGetters} from 'src/CbGetters.sol';
import {CbStructs} from 'src/CbStructs.sol';
import {CbPayables} from 'src/CbPayables.sol';
import {CbTransactions} from 'src/CbTransactions.sol';
import {MockWormhole} from './mocks/MockWormhole.sol';
import {MockCircleBridge} from './mocks/MockCircleBridge.sol';
import {MockCircleTransmitter} from './mocks/MockCircleTransmitter.sol';
import {MockCircleTokenMinter} from './mocks/MockCircleTokenMinter.sol';

contract CbSetupTest is CbStructs, Test {
  Chainbills chainbills;
  CbGetters cbGetters;
  MockWormhole mockWormhole;
  MockCircleBridge mockCircleBridge;
  MockCircleTransmitter mockCircleTransmitter;
  MockCircleTokenMinter mockCircleTokenMinter;

  address owner = makeAddr('owner');
  address nonOwner = makeAddr('non-owner');
  address feeCollector = makeAddr('fee-collector');
  address admin = makeAddr('admin');

  uint16 feePercent = 200; // 2% with 2 decimals
  bytes32 thisCbChainId = keccak256('eip155:1');
  bytes32 foreignCbChainId = keccak256('eip155:2');
  uint16 foreignWormholeChainId = 2;
  uint32 localCircleDomain = 0;
  uint32 foreignCircleDomain = 1;
  uint16 thisWormholeChainId = 2;

  // Blank Test Function to exclude this Test contract itself from test coverage reports.
  function test() public {}

  function setUp() public {
    vm.startPrank(owner);
    chainbills = Chainbills(payable(address(new ERC1967Proxy(address(new Chainbills()), ''))));

    mockCircleTokenMinter = new MockCircleTokenMinter();
    mockCircleTransmitter = new MockCircleTransmitter(localCircleDomain);
    mockCircleBridge = new MockCircleBridge(address(mockCircleTransmitter), address(mockCircleTokenMinter));
    mockWormhole = new MockWormhole();

    chainbills.initialize(feeCollector, feePercent);
    chainbills.setPayablesLogic(address(new CbPayables()));
    chainbills.setTransactionsLogic(address(new CbTransactions()));
    cbGetters = new CbGetters(address(chainbills));
    vm.stopPrank();
  }

  // ------------------------------------------------------------------------
  // Initialize
  // ------------------------------------------------------------------------

  function testInitializeRevertsOnZeroFeeCollector() public {
    Chainbills fresh = Chainbills(payable(address(new ERC1967Proxy(address(new Chainbills()), ''))));
    vm.expectRevert(InvalidFeeCollector.selector);
    fresh.initialize(address(0), feePercent);
  }

  function testInitializeSetsConfig() public view {
    Config memory conf = cbGetters.getConfig();
    assertEq(conf.feeCollector, feeCollector);
    assertEq(conf.withdrawalFeePercentage, feePercent);
  }

  function testCannotReinitialize() public {
    vm.expectRevert(Initializable.InvalidInitialization.selector);
    chainbills.initialize(feeCollector, feePercent);
  }

  // ------------------------------------------------------------------------
  // Pause / Unpause
  // ------------------------------------------------------------------------

  function testPauseAndUnpauseByOwner() public {
    vm.startPrank(owner);
    chainbills.pause();
    assertTrue(chainbills.paused());
    chainbills.unpause();
    assertFalse(chainbills.paused());
    vm.stopPrank();
  }

  function testUpgradeToNewImplementation() public {
    Chainbills newImpl = new Chainbills();
    vm.prank(owner);
    chainbills.upgradeToAndCall(address(newImpl), '');
  }

  function testUpgradeRevertsForNonOwner() public {
    Chainbills newImpl = new Chainbills();
    vm.prank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.upgradeToAndCall(address(newImpl), '');
  }

  function testPauseRevertsForNonOwner() public {
    vm.prank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.pause();
  }

  function testUnpauseRevertsForNonOwner() public {
    vm.prank(owner);
    chainbills.pause();
    vm.prank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.unpause();
  }

  function testPauseRevertsWhenAlreadyPaused() public {
    vm.startPrank(owner);
    chainbills.pause();
    vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
    chainbills.pause();
    vm.stopPrank();
  }

  function testUnpauseRevertsWhenNotPaused() public {
    vm.prank(owner);
    vm.expectRevert(PausableUpgradeable.ExpectedPause.selector);
    chainbills.unpause();
  }

  // ------------------------------------------------------------------------
  // Admin role
  // ------------------------------------------------------------------------

  function testGrantAdminRole() public {
    vm.prank(owner);
    chainbills.grantAdminRole(admin);
    assertTrue(chainbills.hasRole(chainbills.ADMIN_ROLE(), admin));
  }

  function testRevokeAdminRole() public {
    vm.startPrank(owner);
    chainbills.grantAdminRole(admin);
    chainbills.revokeAdminRole(admin);
    vm.stopPrank();
    assertFalse(chainbills.hasRole(chainbills.ADMIN_ROLE(), admin));
  }

  function testGrantAdminRoleZeroAddressReverts() public {
    vm.prank(owner);
    vm.expectRevert(InvalidWalletAddress.selector);
    chainbills.grantAdminRole(address(0));
  }

  function testRevokeAdminRoleZeroAddressReverts() public {
    vm.prank(owner);
    vm.expectRevert(InvalidWalletAddress.selector);
    chainbills.revokeAdminRole(address(0));
  }

  function testGrantAdminRoleRevertsForNonOwner() public {
    vm.prank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.grantAdminRole(admin);
  }

  function testRevokeAdminRoleRevertsForNonOwner() public {
    vm.prank(owner);
    chainbills.grantAdminRole(admin);
    vm.prank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.revokeAdminRole(admin);
  }

  // ------------------------------------------------------------------------
  // setupWormholeAndCircle
  // ------------------------------------------------------------------------

  function testSetupWormholeAndCircleRevertsOnZeroWormhole() public {
    vm.prank(owner);
    vm.expectRevert(InvalidWormholeAddress.selector);
    chainbills.setupWormholeAndCircle(address(0), address(mockCircleBridge), thisWormholeChainId, 1, thisCbChainId);
  }

  function testSetupWormholeAndCircleRevertsOnZeroWormholeChainId() public {
    vm.prank(owner);
    vm.expectRevert(InvalidWormholeChainId.selector);
    chainbills.setupWormholeAndCircle(address(mockWormhole), address(mockCircleBridge), 0, 1, thisCbChainId);
  }

  function testSetupWormholeAndCircleRevertsOnZeroFinality() public {
    vm.prank(owner);
    vm.expectRevert(InvalidWormholeFinality.selector);
    chainbills.setupWormholeAndCircle(
      address(mockWormhole), address(mockCircleBridge), thisWormholeChainId, 0, thisCbChainId
    );
  }

  function testSetupWormholeAndCircleRevertsOnZeroCircleBridge() public {
    vm.prank(owner);
    vm.expectRevert(InvalidCircleBridge.selector);
    chainbills.setupWormholeAndCircle(address(mockWormhole), address(0), thisWormholeChainId, 1, thisCbChainId);
  }

  function testSetupWormholeAndCircleRevertsOnZeroChainId() public {
    vm.prank(owner);
    vm.expectRevert(InvalidChainId.selector);
    chainbills.setupWormholeAndCircle(
      address(mockWormhole), address(mockCircleBridge), thisWormholeChainId, 1, bytes32(0)
    );
  }

  function testSetupWormholeAndCircleRevertsForNonOwner() public {
    vm.prank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.setupWormholeAndCircle(
      address(mockWormhole), address(mockCircleBridge), thisWormholeChainId, 1, thisCbChainId
    );
  }

  function testSetupWormholeAndCircleSuccess() public {
    vm.prank(owner);
    vm.expectEmit(true, true, true, true);
    emit SetupWormholeAndCircle();
    chainbills.setupWormholeAndCircle(
      address(mockWormhole), address(mockCircleBridge), thisWormholeChainId, 1, thisCbChainId
    );

    Config memory conf = cbGetters.getConfig();
    assertEq(conf.wormhole, address(mockWormhole));
    assertEq(conf.circleBridge, address(mockCircleBridge));
    assertEq(conf.circleTransmitter, address(mockCircleTransmitter));
    assertEq(conf.circleTokenMinter, address(mockCircleTokenMinter));
    assertEq(conf.wormholeChainId, thisWormholeChainId);
    assertEq(conf.wormholeFinality, 1);
    assertEq(conf.cbChainId, thisCbChainId);
    assertEq(conf.circleDomain, localCircleDomain);
  }

  // ------------------------------------------------------------------------
  // setupCctpOnly
  // ------------------------------------------------------------------------

  function testSetupCctpOnlyRevertsOnZeroTransmitter() public {
    vm.prank(owner);
    vm.expectRevert(InvalidCircleTransmitter.selector);
    chainbills.setupCctpOnly(address(0), 6, thisCbChainId);
  }

  function testSetupCctpOnlyRevertsOnZeroDomain() public {
    vm.prank(owner);
    vm.expectRevert(InvalidLocalCircleDomain.selector);
    chainbills.setupCctpOnly(address(mockCircleTransmitter), 0, thisCbChainId);
  }

  function testSetupCctpOnlyRevertsOnZeroChainId() public {
    vm.prank(owner);
    vm.expectRevert(InvalidChainId.selector);
    chainbills.setupCctpOnly(address(mockCircleTransmitter), 6, bytes32(0));
  }

  function testSetupCctpOnlyRevertsForNonOwner() public {
    vm.prank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.setupCctpOnly(address(mockCircleTransmitter), 6, thisCbChainId);
  }

  function testSetupCctpOnlySuccess() public {
    uint32 domain = 6;
    vm.prank(owner);
    vm.expectEmit(true, true, true, true);
    emit SetupCCTPOnly();
    chainbills.setupCctpOnly(address(mockCircleTransmitter), domain, thisCbChainId);

    Config memory conf = cbGetters.getConfig();
    assertEq(conf.circleTransmitter, address(mockCircleTransmitter));
    assertEq(conf.circleDomain, domain);
    assertEq(conf.cbChainId, thisCbChainId);
  }

  // ------------------------------------------------------------------------
  // setChainDataMessagingProtocol
  // ------------------------------------------------------------------------

  function testSetChainDataMessagingProtocolRevertsOnZeroChainId() public {
    vm.prank(owner);
    vm.expectRevert(InvalidChainId.selector);
    chainbills.setChainDataMessagingProtocol(bytes32(0), 1);
  }

  function testSetChainDataMessagingProtocolRevertsOnInvalidValue() public {
    vm.prank(owner);
    vm.expectRevert(InvalidChainId.selector);
    chainbills.setChainDataMessagingProtocol(foreignCbChainId, 3);
  }

  function testSetChainDataMessagingProtocolRevertsForNonOwner() public {
    vm.prank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.setChainDataMessagingProtocol(foreignCbChainId, 1);
  }

  function testSetChainDataMessagingProtocolSuccess() public {
    vm.prank(owner);
    vm.expectEmit(true, true, true, true);
    emit SetChainDataMessagingProtocol(foreignCbChainId, 1);
    chainbills.setChainDataMessagingProtocol(foreignCbChainId, 1);

    assertEq(uint8(chainbills.chainDataMessagingProtocol(foreignCbChainId)), 1);
  }

  // ------------------------------------------------------------------------
  // registerChainCircleDomain
  // ------------------------------------------------------------------------

  function testRegisterChainCircleDomainRevertsOnZeroChainId() public {
    vm.prank(owner);
    vm.expectRevert(InvalidChainId.selector);
    chainbills.registerChainCircleDomain(bytes32(0), foreignCircleDomain);
  }

  function testRegisterChainCircleDomainRevertsOnZeroDomain() public {
    vm.prank(owner);
    vm.expectRevert(InvalidChainId.selector);
    chainbills.registerChainCircleDomain(foreignCbChainId, 0);
  }

  function testRegisterChainCircleDomainRevertsForNonOwner() public {
    vm.prank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.registerChainCircleDomain(foreignCbChainId, foreignCircleDomain);
  }

  function testRegisterChainCircleDomainSuccess() public {
    vm.prank(owner);
    vm.expectEmit(true, true, true, true);
    emit RegisteredChainCircleDomain(foreignCbChainId, foreignCircleDomain);
    chainbills.registerChainCircleDomain(foreignCbChainId, foreignCircleDomain);

    assertEq(chainbills.cbChainIdToCircleDomain(foreignCbChainId), foreignCircleDomain);
    assertEq(chainbills.circleDomainToCbChainId(foreignCircleDomain), foreignCbChainId);
  }

  // ------------------------------------------------------------------------
  // registerChainWormholeId
  // ------------------------------------------------------------------------

  function testRegisterChainWormholeIdRevertsOnZeroChainId() public {
    vm.prank(owner);
    vm.expectRevert(InvalidChainId.selector);
    chainbills.registerChainWormholeId(bytes32(0), foreignWormholeChainId);
  }

  function testRegisterChainWormholeIdRevertsOnZeroWormholeId() public {
    vm.prank(owner);
    vm.expectRevert(InvalidChainId.selector);
    chainbills.registerChainWormholeId(foreignCbChainId, 0);
  }

  function testRegisterChainWormholeIdRevertsForNonOwner() public {
    vm.prank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.registerChainWormholeId(foreignCbChainId, foreignWormholeChainId);
  }

  function testRegisterChainWormholeIdSuccess() public {
    vm.prank(owner);
    vm.expectEmit(true, true, true, true);
    emit RegisteredChainWormholeId(foreignCbChainId, foreignWormholeChainId);
    chainbills.registerChainWormholeId(foreignCbChainId, foreignWormholeChainId);

    assertEq(chainbills.wormholeChainIdToCbChainId(foreignWormholeChainId), foreignCbChainId);
  }

  // ------------------------------------------------------------------------
  // registerForeignContract
  // ------------------------------------------------------------------------

  function testRegisterForeignContractRevertsOnZeroChainId() public {
    bytes32 emitter = bytes32(uint256(uint160(makeAddr('emitter'))));
    vm.prank(owner);
    vm.expectRevert(InvalidChainId.selector);
    chainbills.registerForeignContract(bytes32(0), emitter);
  }

  function testRegisterForeignContractRevertsOnZeroEmitter() public {
    vm.prank(owner);
    vm.expectRevert(InvalidWormholeEmitterAddress.selector);
    chainbills.registerForeignContract(foreignCbChainId, bytes32(0));
  }

  function testRegisterForeignContractRevertsOnSameChain() public {
    // Set cbChainId first so the same-chain check has a target.
    vm.startPrank(owner);
    chainbills.setupCctpOnly(address(mockCircleTransmitter), 6, thisCbChainId);
    bytes32 emitter = bytes32(uint256(uint160(makeAddr('emitter'))));
    vm.expectRevert(InvalidChainId.selector);
    chainbills.registerForeignContract(thisCbChainId, emitter);
    vm.stopPrank();
  }

  function testRegisterForeignContractRevertsForNonOwner() public {
    bytes32 emitter = bytes32(uint256(uint160(makeAddr('emitter'))));
    vm.prank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.registerForeignContract(foreignCbChainId, emitter);
  }

  function testRegisterForeignContractSuccess() public {
    bytes32 emitter = bytes32(uint256(uint160(makeAddr('emitter'))));
    vm.prank(owner);
    vm.expectEmit(true, true, true, true);
    emit RegisteredForeignContract(foreignCbChainId, emitter);
    chainbills.registerForeignContract(foreignCbChainId, emitter);

    assertEq(chainbills.registeredForeignContracts(foreignCbChainId), emitter);
    assertEq(chainbills.registeredCbChainIds(0), foreignCbChainId);
  }

  function testRegisterForeignContractDoesNotDuplicateCbChainId() public {
    bytes32 emitterA = bytes32(uint256(uint160(makeAddr('emitterA'))));
    bytes32 emitterB = bytes32(uint256(uint160(makeAddr('emitterB'))));
    vm.startPrank(owner);
    chainbills.registerForeignContract(foreignCbChainId, emitterA);
    chainbills.registerForeignContract(foreignCbChainId, emitterB); // update
    vm.stopPrank();

    // Only pushed once — second registration must not duplicate.
    assertEq(chainbills.registeredCbChainIds(0), foreignCbChainId);
    assertEq(chainbills.registeredForeignContracts(foreignCbChainId), emitterB);
  }

  // ------------------------------------------------------------------------
  // registerMatchingTokenForForeignChain
  // ------------------------------------------------------------------------

  function testRegisterMatchingTokenRevertsOnZeroChainId() public {
    address localToken = makeAddr('local-token');
    bytes32 foreignToken = bytes32(uint256(uint160(makeAddr('foreign-token'))));
    vm.prank(owner);
    vm.expectRevert(InvalidChainId.selector);
    chainbills.registerMatchingTokenForForeignChain(bytes32(0), foreignToken, localToken);
  }

  function testRegisterMatchingTokenRevertsOnSameChain() public {
    vm.startPrank(owner);
    chainbills.setupCctpOnly(address(mockCircleTransmitter), 6, thisCbChainId);
    address localToken = makeAddr('local-token');
    bytes32 foreignToken = bytes32(uint256(uint160(makeAddr('foreign-token'))));
    vm.expectRevert(InvalidChainId.selector);
    chainbills.registerMatchingTokenForForeignChain(thisCbChainId, foreignToken, localToken);
    vm.stopPrank();
  }

  function testRegisterMatchingTokenRevertsOnZeroLocalToken() public {
    bytes32 foreignToken = bytes32(uint256(uint160(makeAddr('foreign-token'))));
    vm.prank(owner);
    vm.expectRevert(InvalidTokenAddress.selector);
    chainbills.registerMatchingTokenForForeignChain(foreignCbChainId, foreignToken, address(0));
  }

  function testRegisterMatchingTokenRevertsOnZeroForeignToken() public {
    address localToken = makeAddr('local-token');
    vm.prank(owner);
    vm.expectRevert(InvalidTokenAddress.selector);
    chainbills.registerMatchingTokenForForeignChain(foreignCbChainId, bytes32(0), localToken);
  }

  function testRegisterMatchingTokenRevertsForNonOwner() public {
    address localToken = makeAddr('local-token');
    bytes32 foreignToken = bytes32(uint256(uint160(makeAddr('foreign-token'))));
    vm.prank(nonOwner);
    vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwner));
    chainbills.registerMatchingTokenForForeignChain(foreignCbChainId, foreignToken, localToken);
  }

  function testRegisterMatchingTokenSuccess() public {
    address localToken = makeAddr('local-token');
    bytes32 foreignToken = bytes32(uint256(uint160(makeAddr('foreign-token'))));
    vm.prank(owner);
    vm.expectEmit(true, true, true, true);
    emit RegisteredMatchingTokenForForeignChain(foreignCbChainId, foreignToken, localToken);
    chainbills.registerMatchingTokenForForeignChain(foreignCbChainId, foreignToken, localToken);

    assertEq(chainbills.forForeignChainMatchingTokenAddresses(foreignCbChainId, foreignToken), localToken);
    assertEq(chainbills.forTokenAddressMatchingForeignChainTokens(localToken, foreignCbChainId), foreignToken);
  }

  // ------------------------------------------------------------------------
  // unregisterMatchingTokenForForeignChain
  // ------------------------------------------------------------------------

  function testUnregisterMatchingTokenRevertsOnZeroChainId() public {
    bytes32 foreignToken = bytes32(uint256(uint160(makeAddr('foreign-token'))));
    vm.prank(owner);
    vm.expectRevert(InvalidChainId.selector);
    chainbills.unregisterMatchingTokenForForeignChain(bytes32(0), foreignToken);
  }

  function testUnregisterMatchingTokenRevertsOnSameChain() public {
    vm.startPrank(owner);
    chainbills.setupCctpOnly(address(mockCircleTransmitter), 6, thisCbChainId);
    bytes32 foreignToken = bytes32(uint256(uint160(makeAddr('foreign-token'))));
    vm.expectRevert(InvalidChainId.selector);
    chainbills.unregisterMatchingTokenForForeignChain(thisCbChainId, foreignToken);
    vm.stopPrank();
  }

  function testUnregisterMatchingTokenRevertsOnZeroForeignToken() public {
    vm.prank(owner);
    vm.expectRevert(InvalidTokenAddress.selector);
    chainbills.unregisterMatchingTokenForForeignChain(foreignCbChainId, bytes32(0));
  }

  // ------------------------------------------------------------------------
  // CbState view helpers
  // ------------------------------------------------------------------------

  function testHasWormholeReturnsFalseBeforeSetup() public view {
    assertFalse(chainbills.hasWormhole());
  }

  function testHasCctpReturnsFalseBeforeSetup() public view {
    assertFalse(chainbills.hasCctp());
  }

  function testHasWormholeReturnsTrueAfterSetupWormholeAndCircle() public {
    vm.prank(owner);
    chainbills.setupWormholeAndCircle(
      address(mockWormhole), address(mockCircleBridge), thisWormholeChainId, 1, thisCbChainId
    );
    assertTrue(chainbills.hasWormhole());
  }

  function testHasCctpReturnsTrueAfterSetupWormholeAndCircle() public {
    vm.prank(owner);
    chainbills.setupWormholeAndCircle(
      address(mockWormhole), address(mockCircleBridge), thisWormholeChainId, 1, thisCbChainId
    );
    assertTrue(chainbills.hasCctp());
  }

  function testHasCctpReturnsTrueAfterSetupCctpOnly() public {
    vm.prank(owner);
    chainbills.setupCctpOnly(address(mockCircleTransmitter), 6, thisCbChainId);
    assertTrue(chainbills.hasCctp());
    assertFalse(chainbills.hasWormhole());
  }

  function testSupportsWormholeAndCctp() public {
    bytes32 wormholeChain = keccak256('eip155:10');
    bytes32 cctpChain = keccak256('eip155:11');
    bytes32 noneChain = keccak256('eip155:12');

    vm.startPrank(owner);
    chainbills.setChainDataMessagingProtocol(wormholeChain, 1); // WORMHOLE
    chainbills.setChainDataMessagingProtocol(cctpChain, 2); // CCTP
    chainbills.setChainDataMessagingProtocol(noneChain, 0); // NONE
    vm.stopPrank();

    assertTrue(chainbills.supportsWormhole(wormholeChain));
    assertFalse(chainbills.supportsWormhole(cctpChain));
    assertFalse(chainbills.supportsWormhole(noneChain));

    assertFalse(chainbills.supportsCctp(wormholeChain));
    assertTrue(chainbills.supportsCctp(cctpChain));
    assertFalse(chainbills.supportsCctp(noneChain));
  }
}
