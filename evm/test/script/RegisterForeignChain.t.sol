// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {ChainbillsDiamondInit} from '../../src/ChainbillsDiamondInit.sol';
import {DeployChainbills} from '../../script/DeployChainbills.s.sol';
import {RegisterForeignChain} from '../../script/admin/RegisterForeignChain.s.sol';
import {UpdateForeignChain} from '../../script/admin/UpdateForeignChain.s.sol';
import {IChainbills} from '../../src/interfaces/IChainbills.sol';
import {
  ForeignChain,
  ForeignChainAddresses,
  ForeignChainConfig,
  ForeignChainFinality,
  ForeignChainLimits,
  ForeignChainProtocolIds,
  ForeignChainSwitches
} from '../../src/types/CbTypes.sol';

/// Runs `RegisterForeignChain.register` (and `UpdateForeignChain.update`) in-process and checks the
/// `ForeignChainConfig` they apply. Uses a Circle CCTP foreign chain as a realistic baseline, since a foreign chain
/// with neither protocol configured but every switch defaulted on is rejected by `CbChainRegistryFacet` itself.
contract RegisterForeignChainTest is Test {
  bytes32 internal constant SALT = bytes32(uint256(1));
  bytes32 internal constant FOREIGN_CHAIN_ID = keccak256('eip155:11155111');
  address internal owner;
  IChainbills internal chainbills;
  address internal foreignDiamond;

  function setUp() public {
    owner = DEFAULT_SENDER;
    chainbills = new DeployChainbills().deploy(
      DeployChainbills.DeployConfig({
        salt: SALT,
        owner: owner,
        caip2: 'eip155:31337',
        chainName: 'test-fixture-chain',
        params: ChainbillsDiamondInit.InitParams({
          cbChainId: keccak256(bytes('eip155:31337')),
          admin: owner,
          feeCollector: owner,
          withdrawalFeeBps: 200,
          maxAllowedTokensAndAmounts: 10
        }),
        tokenMessenger: address(0),
        wormhole: address(0),
        wormholeChainId: 0,
        wormholeFinality: 0,
        allowedTokens: new address[](0),
        relayers: new address[](0),
        deployRecordPath: ''
      })
    );
    foreignDiamond = makeAddr('foreign-diamond');
  }

  /// Builds the default config matching the original test baseline: CCTP with Circle domain 0, all switches on,
  /// all finality at 2000 (finalized), no Wormhole, no fee cap.
  function _defaultConfig(address target) internal pure returns (ForeignChainConfig memory config) {
    bytes32 t = bytes32(uint256(uint160(target)));
    config.protocolIds = ForeignChainProtocolIds({
      hasWormholeChainId: false,
      wormholeChainId: 0,
      hasCircleDomain: true,
      circleDomain: 0
    });
    config.addresses = ForeignChainAddresses({
      wormholeEmitter: t,
      cctpMessageSender: t,
      cctpBurnSender: t,
      cctpRecipient: t,
      cctpMintRecipient: t,
      cctpDestinationCaller: t
    });
    config.switches = ForeignChainSwitches({
      isCctpUpdateEnabled: true,
      isInboundUpdateEnabled: true,
      isOutboundPaymentEnabled: true,
      isInboundPaymentEnabled: true
    });
    config.finality = ForeignChainFinality({
      outboundUpdateFinality: 2000,
      outboundPaymentFinality: 2000,
      minInboundUpdateFinality: 2000,
      minInboundPaymentFinality: 2000
    });
    config.limits = ForeignChainLimits({hasMaxOutboundCctpFeeBps: false, maxOutboundCctpFeeBps: 0});
  }

  function test_Register_DefaultsEveryAddressRoleToTargetDiamond() public {
    new RegisterForeignChain().register(address(chainbills), FOREIGN_CHAIN_ID, _defaultConfig(foreignDiamond));

    ForeignChain memory registered = chainbills.getForeignChain(FOREIGN_CHAIN_ID);
    assertTrue(registered.isRegistered);
    bytes32 expected = bytes32(uint256(uint160(foreignDiamond)));
    assertEq(registered.config.addresses.wormholeEmitter, expected);
    assertEq(registered.config.addresses.cctpMessageSender, expected);
    assertEq(registered.config.addresses.cctpBurnSender, expected);
    assertEq(registered.config.addresses.cctpRecipient, expected);
    assertEq(registered.config.addresses.cctpMintRecipient, expected);
    assertEq(registered.config.addresses.cctpDestinationCaller, expected);
  }

  function test_Register_DefaultSwitchesEnableEveryDirection() public {
    new RegisterForeignChain().register(address(chainbills), FOREIGN_CHAIN_ID, _defaultConfig(foreignDiamond));

    ForeignChain memory registered = chainbills.getForeignChain(FOREIGN_CHAIN_ID);
    assertTrue(registered.config.switches.isCctpUpdateEnabled);
    assertTrue(registered.config.switches.isInboundUpdateEnabled);
    assertTrue(registered.config.switches.isOutboundPaymentEnabled);
    assertTrue(registered.config.switches.isInboundPaymentEnabled);
  }

  function test_Register_DefaultFinalityIsFinalized() public {
    new RegisterForeignChain().register(address(chainbills), FOREIGN_CHAIN_ID, _defaultConfig(foreignDiamond));

    ForeignChain memory registered = chainbills.getForeignChain(FOREIGN_CHAIN_ID);
    assertEq(registered.config.finality.outboundUpdateFinality, 2000);
    assertEq(registered.config.finality.outboundPaymentFinality, 2000);
    assertEq(registered.config.finality.minInboundUpdateFinality, 2000);
    assertEq(registered.config.finality.minInboundPaymentFinality, 2000);
  }

  function test_Register_ProtocolIdsFromConfig() public {
    new RegisterForeignChain().register(address(chainbills), FOREIGN_CHAIN_ID, _defaultConfig(foreignDiamond));

    ForeignChain memory registered = chainbills.getForeignChain(FOREIGN_CHAIN_ID);
    assertFalse(registered.config.protocolIds.hasWormholeChainId);
    assertTrue(registered.config.protocolIds.hasCircleDomain);
    assertEq(registered.config.protocolIds.circleDomain, 0);

    // Wormhole comes online for this chain later: build the updated config and call update directly.
    ForeignChainConfig memory withWormhole = _defaultConfig(foreignDiamond);
    withWormhole.protocolIds.hasWormholeChainId = true;
    withWormhole.protocolIds.wormholeChainId = 10002;
    new UpdateForeignChain().update(address(chainbills), FOREIGN_CHAIN_ID, withWormhole);

    registered = chainbills.getForeignChain(FOREIGN_CHAIN_ID);
    assertTrue(registered.config.protocolIds.hasWormholeChainId);
    assertEq(registered.config.protocolIds.wormholeChainId, 10002);
  }

  function test_Update_ReplacesConfig() public {
    new RegisterForeignChain().register(address(chainbills), FOREIGN_CHAIN_ID, _defaultConfig(foreignDiamond));

    ForeignChainConfig memory updated = _defaultConfig(foreignDiamond);
    updated.switches.isOutboundPaymentEnabled = false;
    new UpdateForeignChain().update(address(chainbills), FOREIGN_CHAIN_ID, updated);

    ForeignChain memory fc = chainbills.getForeignChain(FOREIGN_CHAIN_ID);
    assertFalse(fc.config.switches.isOutboundPaymentEnabled);
    assertTrue(fc.config.switches.isInboundPaymentEnabled);
  }
}
