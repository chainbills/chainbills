// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {DeployChainbills} from '../../script/DeployChainbills.s.sol';
import {RegisterForeignChain} from '../../script/admin/RegisterForeignChain.s.sol';
import {UpdateForeignChain} from '../../script/admin/UpdateForeignChain.s.sol';
import {IChainbills} from '../../src/interfaces/IChainbills.sol';
import {ForeignChain} from '../../src/types/CbTypes.sol';

/// Runs `RegisterForeignChain` (and `UpdateForeignChain`) in-process and checks the `ForeignChainConfig` they
/// build. `setUp` configures CCTP (`FOREIGN_CIRCLE_DOMAIN`) as a realistic baseline, since a foreign chain with
/// neither protocol configured but every switch defaulted on is rejected by `CbChainRegistryFacet` itself.
/// @dev `vm.setEnv` changes the real process environment, shared by every thread `forge test` runs concurrently —
/// run this suite with `forge test -j 1` (see the Testing section of the README).
contract RegisterForeignChainTest is Test {
  bytes32 internal constant SALT = bytes32(uint256(1));
  bytes32 internal constant FOREIGN_CHAIN_ID = keccak256('eip155:11155111');
  address internal owner;
  IChainbills internal chainbills;
  address internal foreignDiamond;

  function setUp() public {
    owner = DEFAULT_SENDER;
    vm.setEnv('CB_SALT', vm.toString(SALT));
    vm.setEnv('OWNER', vm.toString(owner));
    vm.setEnv('ADMIN', vm.toString(owner));
    vm.setEnv('FEE_COLLECTOR', vm.toString(owner));
    vm.setEnv('WITHDRAWAL_FEE_BPS', '200');
    vm.setEnv('MAX_ALLOWED_TOKENS_AND_AMOUNTS', '10');
    vm.setEnv('CAIP2', 'eip155:31337');
    vm.setEnv('CHAIN_NAME', 'test-fixture-chain');
    chainbills = new DeployChainbills().run();

    // A foreign deploy record RegisterForeignChain reads the target diamond address from.
    foreignDiamond = makeAddr('foreign-diamond');
    string memory json = string.concat('{"diamond":"', vm.toString(foreignDiamond), '"}');
    vm.writeJson(json, 'deploys/test-fixture-foreign-chain.json');

    vm.setEnv('DIAMOND', vm.toString(address(chainbills)));
    vm.setEnv('TARGET_CHAIN', 'test-fixture-foreign-chain');
    vm.setEnv('FOREIGN_CB_CHAIN_ID', vm.toString(FOREIGN_CHAIN_ID));
    vm.setEnv('FOREIGN_CIRCLE_DOMAIN', '0');

    // `vm.setEnv` changes the real process environment, which persists across every test function (and every
    // test contract) in a `forge test` run, not just this one — so every default this suite checks is pinned back
    // to that default here rather than left to (unreliable) absence.
    vm.setEnv('SWITCH_CCTP_UPDATE', 'true');
    vm.setEnv('SWITCH_INBOUND_UPDATE', 'true');
    vm.setEnv('SWITCH_OUTBOUND_PAYMENT', 'true');
    vm.setEnv('SWITCH_INBOUND_PAYMENT', 'true');
    vm.setEnv('FINALITY_OUTBOUND_UPDATE', '2000');
    vm.setEnv('FINALITY_OUTBOUND_PAYMENT', '2000');
    vm.setEnv('FINALITY_MIN_INBOUND_UPDATE', '2000');
    vm.setEnv('FINALITY_MIN_INBOUND_PAYMENT', '2000');
  }

  function test_Register_DefaultsEveryAddressRoleToTargetDiamond() public {
    new RegisterForeignChain().run();

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
    new RegisterForeignChain().run();

    ForeignChain memory registered = chainbills.getForeignChain(FOREIGN_CHAIN_ID);
    assertTrue(registered.config.switches.isCctpUpdateEnabled);
    assertTrue(registered.config.switches.isInboundUpdateEnabled);
    assertTrue(registered.config.switches.isOutboundPaymentEnabled);
    assertTrue(registered.config.switches.isInboundPaymentEnabled);
  }

  function test_Register_DefaultFinalityIsFinalized() public {
    new RegisterForeignChain().run();

    ForeignChain memory registered = chainbills.getForeignChain(FOREIGN_CHAIN_ID);
    assertEq(registered.config.finality.outboundUpdateFinality, 2000);
    assertEq(registered.config.finality.outboundPaymentFinality, 2000);
    assertEq(registered.config.finality.minInboundUpdateFinality, 2000);
    assertEq(registered.config.finality.minInboundPaymentFinality, 2000);
  }

  function test_Register_ProtocolIdsFromEnv() public {
    new RegisterForeignChain().run();

    ForeignChain memory registered = chainbills.getForeignChain(FOREIGN_CHAIN_ID);
    assertFalse(registered.config.protocolIds.hasWormholeChainId);
    assertTrue(registered.config.protocolIds.hasCircleDomain);
    assertEq(registered.config.protocolIds.circleDomain, 0);

    // Wormhole comes online for this chain later: UpdateForeignChain picks up the newly-set env var.
    vm.setEnv('FOREIGN_WORMHOLE_CHAIN_ID', '10002');
    new UpdateForeignChain().run();

    registered = chainbills.getForeignChain(FOREIGN_CHAIN_ID);
    assertTrue(registered.config.protocolIds.hasWormholeChainId);
    assertEq(registered.config.protocolIds.wormholeChainId, 10002);
  }

  function test_Update_ReplacesConfig() public {
    new RegisterForeignChain().run();

    vm.setEnv('SWITCH_OUTBOUND_PAYMENT', 'false');
    new UpdateForeignChain().run();

    ForeignChain memory updated = chainbills.getForeignChain(FOREIGN_CHAIN_ID);
    assertFalse(updated.config.switches.isOutboundPaymentEnabled);
    assertTrue(updated.config.switches.isInboundPaymentEnabled);
  }
}
