// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {CbFacetSet} from '../../src/CbFacetSet.sol';
import {ChainbillsDiamondInit} from '../../src/ChainbillsDiamondInit.sol';
import {DeployChainbills} from '../../script/DeployChainbills.s.sol';
import {PredictAddresses} from '../../script/PredictAddresses.s.sol';
import {IChainbills} from '../../src/interfaces/IChainbills.sol';
import {IDiamondLoupe} from '../../src/interfaces/diamond/IDiamondLoupe.sol';
import {ProtocolConfig} from '../../src/types/CbTypes.sol';

/// Runs `DeployChainbills.deploy` in-process and checks the properties deterministic deployment depends on. `OWNER`
/// is `DEFAULT_SENDER` (forge-std's default broadcaster) because `deploy` calls the argument-less
/// `vm.startBroadcast()` itself, so every deployment happens as that address regardless of who calls `deploy`.
contract DeployChainbillsTest is Test {
  bytes32 internal constant SALT = bytes32(uint256(1));
  address internal constant ADMIN = address(0x0002);
  address internal constant FEE_COLLECTOR = address(0x0003);

  address internal owner;
  DeployChainbills.DeployConfig internal baseConfig;

  function setUp() public {
    owner = DEFAULT_SENDER;
    baseConfig = DeployChainbills.DeployConfig({
      salt: SALT,
      owner: owner,
      caip2: 'eip155:31337',
      chainName: 'test-fixture-chain',
      params: ChainbillsDiamondInit.InitParams({
        cbChainId: keccak256(bytes('eip155:31337')),
        admin: ADMIN,
        feeCollector: FEE_COLLECTOR,
        withdrawalFeeBps: 200,
        maxAllowedTokensAndAmounts: 10
      }),
      tokenMessenger: address(0),
      wormhole: address(0),
      wormholeChainId: 0,
      wormholeFinality: 0,
      allowedTokens: new address[](0),
      relayers: new address[](0),
      deployRecordPath: '' // no file-system side effects in tests
    });
  }

  function test_DiamondAddress_MatchesPrediction() public {
    (, address predicted) = new PredictAddresses().predictDiamond(SALT, owner);

    IChainbills chainbills = new DeployChainbills().deploy(baseConfig);

    assertEq(address(chainbills), predicted);
  }

  function test_DiamondAddress_IndependentOfDeployerNonce() public {
    (, address predictedBefore) = new PredictAddresses().predictDiamond(SALT, owner);

    // A plain CREATE address depends on the deployer's nonce; CREATE2 (what every Chainbills deployment uses)
    // never reads it. Bump the owner's nonce, and an unrelated account's nonce, by a large and different amount
    // each, and confirm the prediction — and the address the deployment actually lands at — are unaffected.
    vm.setNonce(owner, 50);
    address other = address(0xB0B);
    vm.setNonce(other, 12_345);

    (, address predictedAfter) = new PredictAddresses().predictDiamond(SALT, owner);
    assertEq(predictedBefore, predictedAfter);

    IChainbills chainbills = new DeployChainbills().deploy(baseConfig);
    assertEq(address(chainbills), predictedBefore);
  }

  function test_DiamondAddress_IndependentOfChainId() public {
    // A CREATE2 address never reads the chain ID: the same salt and owner predict the same diamond address
    // whatever `vm.chainId` currently simulates.
    vm.chainId(1);
    (, address predictedAtChain1) = new PredictAddresses().predictDiamond(SALT, owner);

    vm.chainId(99_999);
    (, address predictedAtChain99999) = new PredictAddresses().predictDiamond(SALT, owner);

    assertEq(predictedAtChain1, predictedAtChain99999);

    // An actual deployment on this (now chain 99_999) EVM lands exactly at the predicted address.
    IChainbills chainbills = new DeployChainbills().deploy(baseConfig);
    assertEq(address(chainbills), predictedAtChain1);
  }

  function test_Deploy_CutsEveryFacet() public {
    IChainbills chainbills = new DeployChainbills().deploy(baseConfig);

    CbFacetSet.FacetEntry[] memory entries = CbFacetSet.facets();
    IDiamondLoupe.Facet[] memory cutFacets = chainbills.facets();

    // Every CbFacetSet facet, plus DiamondCutFacet (installed by the diamond constructor).
    assertEq(cutFacets.length, entries.length + 1);
    for (uint256 i; i < entries.length; i++) {
      bytes4[] memory selectors = entries[i].selectors;
      for (uint256 j; j < selectors.length; j++) {
        assertTrue(chainbills.facetAddress(selectors[j]) != address(0));
      }
    }
  }

  function test_Deploy_AppliesInitParams() public {
    IChainbills chainbills = new DeployChainbills().deploy(baseConfig);

    assertTrue(chainbills.isInitialized());
    assertEq(chainbills.cbChainId(), keccak256(bytes('eip155:31337')));

    ProtocolConfig memory config = chainbills.getProtocolConfig();
    assertEq(config.feeCollector, FEE_COLLECTOR);
    assertEq(config.withdrawalFeeBps, 200);
    assertEq(config.maxAllowedTokensAndAmounts, 10);

    assertTrue(chainbills.hasRole(chainbills.DEFAULT_ADMIN_ROLE(), ADMIN));
    assertTrue(chainbills.hasRole(chainbills.TOKEN_MANAGER_ROLE(), ADMIN));
  }

  function test_Rerun_IsNoOp() public {
    IChainbills first = new DeployChainbills().deploy(baseConfig);
    IChainbills second = new DeployChainbills().deploy(baseConfig);

    assertEq(address(first), address(second));
    assertTrue(second.isInitialized());
  }
}
