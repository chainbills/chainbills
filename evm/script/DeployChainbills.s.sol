// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbFacetDeployer} from './base/CbFacetDeployer.sol';
import {CbFacetSet} from '../src/CbFacetSet.sol';
import {ChainbillsDiamondInit} from '../src/ChainbillsDiamondInit.sol';
import {Diamond} from '../src/diamond/Diamond.sol';
import {IChainbills} from '../src/interfaces/IChainbills.sol';
import {IDiamondCut} from '../src/interfaces/diamond/IDiamondCut.sol';

/// Deploys a fully cut and initialized Chainbills diamond. Every piece — the six linked libraries, every facet,
/// `DiamondCutFacet`, `ChainbillsDiamondInit`, and the diamond itself — goes through CREATE2 under `DeployConfig.salt`,
/// so the same `owner` and `salt` produce the same diamond address on every chain. Rerunning against a chain that
/// already has some or all of these deployed reuses what is there and only cuts and initializes the diamond once.
///
/// Call `deploy(config)` directly (no env reads) from tests or tooling, or call `run()` which reads the required env
/// vars and delegates to `deploy`.
///
/// Required env for `run()`: `CB_SALT`, `CAIP2`, `CHAIN_NAME`, `OWNER`, `ADMIN`, `FEE_COLLECTOR`,
/// `WITHDRAWAL_FEE_BPS`, `MAX_ALLOWED_TOKENS_AND_AMOUNTS`. Optional post-deploy config: `TOKEN_MESSENGER` (CCTP),
/// `WORMHOLE_ADDRESS` + `WORMHOLE_CHAIN_ID` + `WORMHOLE_FINALITY` (Wormhole), `script/env/tokens.json` (allowed
/// tokens, `"NATIVE"` for the diamond's own address), `RELAYERS` (comma-separated addresses granted `RELAYER_ROLE`).
contract DeployChainbills is CbFacetDeployer {
  /// All inputs for a full deploy. Pass to `deploy` directly from tests or tooling.
  struct DeployConfig {
    bytes32 salt;
    address owner;
    string caip2;
    string chainName;
    ChainbillsDiamondInit.InitParams params;
    /// CCTP TokenMessenger address. address(0) skips CCTP setup.
    address tokenMessenger;
    /// Wormhole core contract. address(0) skips Wormhole setup.
    address wormhole;
    uint16 wormholeChainId;
    uint8 wormholeFinality;
    /// Tokens to allow payments for. address(0) is the native-token sentinel (resolved to the diamond's own address).
    /// Empty array skips token allowlisting.
    address[] allowedTokens;
    /// Addresses to grant RELAYER_ROLE. Empty array skips.
    address[] relayers;
    /// Path for the deploy record JSON output (e.g. `deploys/arcmainnet.json`). Empty string skips writing.
    string deployRecordPath;
  }

  /// Reads env vars and calls `deploy`. See the contract-level doc for required and optional env vars.
  function run() public returns (IChainbills chainbills) {
    string memory caip2 = vm.envString('CAIP2');
    string memory chainName = vm.envString('CHAIN_NAME');

    DeployConfig memory config;
    config.salt = vm.envBytes32('CB_SALT');
    config.owner = vm.envAddress('OWNER');
    config.caip2 = caip2;
    config.chainName = chainName;
    config.params = ChainbillsDiamondInit.InitParams({
      cbChainId: keccak256(bytes(caip2)),
      admin: vm.envAddress('ADMIN'),
      feeCollector: vm.envAddress('FEE_COLLECTOR'),
      withdrawalFeeBps: uint16(vm.envUint('WITHDRAWAL_FEE_BPS')),
      maxAllowedTokensAndAmounts: uint8(vm.envUint('MAX_ALLOWED_TOKENS_AND_AMOUNTS'))
    });
    config.tokenMessenger = vm.envOr('TOKEN_MESSENGER', address(0));
    config.wormhole = vm.envOr('WORMHOLE_ADDRESS', address(0));
    if (config.wormhole != address(0)) {
      config.wormholeChainId = uint16(vm.envUint('WORMHOLE_CHAIN_ID'));
      config.wormholeFinality = uint8(vm.envUint('WORMHOLE_FINALITY'));
    }
    config.allowedTokens = _readAllowedTokensFromJson(chainName);
    config.relayers = vm.envOr('RELAYERS', ',', new address[](0));
    config.deployRecordPath = string.concat('deploys/', chainName, '.json');

    chainbills = deploy(config);
  }

  /// Deploys the full diamond stack described by `config`. No env reads.
  function deploy(DeployConfig memory config) public returns (IChainbills chainbills) {
    vm.startBroadcast();
    LinkedLibrary[] memory libs = _deployLibraries(config.salt);
    address[] memory facetImpls = _deployFacets(config.salt, libs);
    (address diamondCutFacet,) = _deployIfNeeded(config.salt, _rawCode('DiamondCutFacet'), 'DiamondCutFacet');
    (address init,) = _deployIfNeeded(config.salt, _rawCode('ChainbillsDiamondInit'), 'ChainbillsDiamondInit');

    bytes memory diamondInitCode = abi.encodePacked(_rawCode('Diamond'), abi.encode(config.owner, diamondCutFacet));
    (address diamondAddr, bool diamondIsNew) = _deployIfNeeded(config.salt, diamondInitCode, 'Diamond');
    chainbills = IChainbills(diamondAddr);

    if (diamondIsNew) {
      IDiamondCut.FacetCut[] memory cuts = CbFacetSet.buildAddCut(facetImpls);
      IDiamondCut(diamondAddr).diamondCut(cuts, init, abi.encodeCall(ChainbillsDiamondInit.init, (config.params)));
      console.log('Cut and initialized diamond at', diamondAddr);
    } else {
      console.log('Diamond already cut and initialized at', diamondAddr);
    }

    _applyOptionalConfig(chainbills, config);
    vm.stopBroadcast();

    if (bytes(config.deployRecordPath).length > 0) {
      _writeDeployRecord(config, chainbills, libs, facetImpls, diamondCutFacet, init);
    }
  }

  function _applyOptionalConfig(IChainbills chainbills, DeployConfig memory config) internal {
    if (config.tokenMessenger != address(0)) {
      chainbills.setupCctp(config.tokenMessenger);
      console.log('Configured CCTP with TokenMessenger', config.tokenMessenger);
    }

    if (config.wormhole != address(0)) {
      chainbills.setupWormhole(config.wormhole, config.wormholeChainId, config.wormholeFinality);
      console.log('Configured Wormhole at', config.wormhole);
    }

    for (uint256 i; i < config.allowedTokens.length; i++) {
      address token = config.allowedTokens[i] == address(0) ? address(chainbills) : config.allowedTokens[i];
      chainbills.allowPaymentsForToken(token);
      console.log('Allowed payments for token', token);
    }

    for (uint256 i; i < config.relayers.length; i++) {
      chainbills.grantRole(chainbills.RELAYER_ROLE(), config.relayers[i]);
      console.log('Granted RELAYER_ROLE to', config.relayers[i]);
    }
  }

  /// Reads allowed token addresses from `script/env/tokens.json` for `chainName`. Returns `address(0)` for the
  /// `"NATIVE"` sentinel. Returns an empty array when `chainName` has no entry in the file.
  function _readAllowedTokensFromJson(string memory chainName) internal view returns (address[] memory) {
    string memory json = vm.readFile('script/env/tokens.json');
    string memory key = string.concat('.', chainName);
    if (!vm.keyExistsJson(json, key)) return new address[](0);

    string[] memory tokens = vm.parseJsonStringArray(json, key);
    address[] memory result = new address[](tokens.length);
    for (uint256 i; i < tokens.length; i++) {
      bool isNative = keccak256(bytes(tokens[i])) == keccak256(bytes('NATIVE'));
      result[i] = isNative ? address(0) : vm.parseAddress(tokens[i]);
    }
    return result;
  }

  /// Writes `config.deployRecordPath` with every address this run produced or reused.
  function _writeDeployRecord(
    DeployConfig memory config,
    IChainbills chainbills,
    LinkedLibrary[] memory libs,
    address[] memory facetImpls,
    address diamondCutFacet,
    address init
  ) internal {
    CbFacetSet.FacetEntry[] memory entries = CbFacetSet.facets();

    string memory librariesKey = 'libraries';
    string memory librariesJson;
    for (uint256 i; i < libs.length; i++) {
      librariesJson = vm.serializeAddress(librariesKey, libs[i].name, libs[i].addr);
    }

    string memory facetsKey = 'facets';
    string memory facetsJson;
    for (uint256 i; i < entries.length; i++) {
      facetsJson = vm.serializeAddress(facetsKey, entries[i].name, facetImpls[i]);
    }

    string memory rootKey = 'root';
    vm.serializeString(rootKey, 'chain', config.chainName);
    vm.serializeString(rootKey, 'caip2', config.caip2);
    vm.serializeUint(rootKey, 'chainId', block.chainid);
    vm.serializeBytes32(rootKey, 'cbChainId', config.params.cbChainId);
    vm.serializeBytes32(rootKey, 'salt', config.salt);
    vm.serializeAddress(rootKey, 'owner', config.owner);
    vm.serializeAddress(rootKey, 'admin', config.params.admin);
    vm.serializeAddress(rootKey, 'diamond', address(chainbills));
    vm.serializeAddress(rootKey, 'diamondCutFacet', diamondCutFacet);
    vm.serializeAddress(rootKey, 'init', init);
    vm.serializeString(rootKey, 'libraries', librariesJson);
    vm.serializeString(rootKey, 'facets', facetsJson);
    string memory finalJson = vm.serializeUint(rootKey, 'deployedAtBlock', block.number);

    vm.writeJson(finalJson, config.deployRecordPath);
    console.log('Wrote deploy record to', config.deployRecordPath);
  }
}
