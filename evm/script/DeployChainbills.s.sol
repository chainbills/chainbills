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
/// `DiamondCutFacet`, `ChainbillsDiamondInit`, and the diamond itself — goes through CREATE2 under `CB_SALT`, so the
/// same `OWNER` and `CB_SALT` produce the same diamond address on every chain. Rerunning against a chain that
/// already has some or all of these deployed reuses what is there and only cuts and initializes the diamond once.
///
/// Required env: `CB_SALT`, `CAIP2`, `CHAIN_NAME`, `OWNER`, `ADMIN`, `FEE_COLLECTOR`, `WITHDRAWAL_FEE_BPS`,
/// `MAX_ALLOWED_TOKENS_AND_AMOUNTS`. Optional post-deploy config: `TOKEN_MESSENGER` (CCTP), `WORMHOLE_ADDRESS` +
/// `WORMHOLE_CHAIN_ID` + `WORMHOLE_FINALITY` (Wormhole), `script/env/tokens.json` (allowed tokens, `"NATIVE"` for
/// the diamond's own address), `RELAYERS` (comma-separated addresses granted `RELAYER_ROLE`). Applying these
/// requires the broadcasting key to hold the relevant role, which the initializer grants to `ADMIN`.
contract DeployChainbills is CbFacetDeployer {
  function run() public returns (IChainbills chainbills) {
    bytes32 salt = vm.envBytes32('CB_SALT');
    address owner = vm.envAddress('OWNER');
    string memory caip2 = vm.envString('CAIP2');
    string memory chainName = vm.envString('CHAIN_NAME');

    ChainbillsDiamondInit.InitParams memory params = ChainbillsDiamondInit.InitParams({
      cbChainId: keccak256(bytes(caip2)),
      admin: vm.envAddress('ADMIN'),
      feeCollector: vm.envAddress('FEE_COLLECTOR'),
      withdrawalFeeBps: uint16(vm.envUint('WITHDRAWAL_FEE_BPS')),
      maxAllowedTokensAndAmounts: uint8(vm.envUint('MAX_ALLOWED_TOKENS_AND_AMOUNTS'))
    });

    vm.startBroadcast();
    LinkedLibrary[] memory libs = _deployLibraries(salt);
    address[] memory facetImpls = _deployFacets(salt, libs);
    (address diamondCutFacet,) = _deployIfNeeded(salt, _rawCode('DiamondCutFacet'), 'DiamondCutFacet');
    (address init,) = _deployIfNeeded(salt, _rawCode('ChainbillsDiamondInit'), 'ChainbillsDiamondInit');

    bytes memory diamondInitCode = abi.encodePacked(_rawCode('Diamond'), abi.encode(owner, diamondCutFacet));
    (address diamondAddr, bool diamondIsNew) = _deployIfNeeded(salt, diamondInitCode, 'Diamond');
    chainbills = IChainbills(diamondAddr);

    if (diamondIsNew) {
      IDiamondCut.FacetCut[] memory cuts = CbFacetSet.buildAddCut(facetImpls);
      IDiamondCut(diamondAddr).diamondCut(cuts, init, abi.encodeCall(ChainbillsDiamondInit.init, (params)));
      console.log('Cut and initialized diamond at', diamondAddr);
    } else {
      console.log('Diamond already cut and initialized at', diamondAddr);
    }

    _applyOptionalConfig(chainbills, chainName);
    vm.stopBroadcast();

    _writeDeployRecord(chainName, caip2, salt, owner, chainbills, params, libs, facetImpls, diamondCutFacet, init);
  }

  /// Applies post-deploy configuration present in the environment. A no-op for anything left unset.
  function _applyOptionalConfig(IChainbills chainbills, string memory chainName) internal {
    address tokenMessenger = vm.envOr('TOKEN_MESSENGER', address(0));
    if (tokenMessenger != address(0)) {
      chainbills.setupCctp(tokenMessenger);
      console.log('Configured CCTP with TokenMessenger', tokenMessenger);
    }

    address wormhole = vm.envOr('WORMHOLE_ADDRESS', address(0));
    if (wormhole != address(0)) {
      uint16 wormholeChainId = uint16(vm.envUint('WORMHOLE_CHAIN_ID'));
      uint8 finality = uint8(vm.envUint('WORMHOLE_FINALITY'));
      chainbills.setupWormhole(wormhole, wormholeChainId, finality);
      console.log('Configured Wormhole at', wormhole);
    }

    _allowConfiguredTokens(chainbills, chainName);

    address[] memory relayers = vm.envOr('RELAYERS', ',', new address[](0));
    for (uint256 i; i < relayers.length; i++) {
      chainbills.grantRole(chainbills.RELAYER_ROLE(), relayers[i]);
      console.log('Granted RELAYER_ROLE to', relayers[i]);
    }
  }

  /// Allows every token listed for `chainName` in `script/env/tokens.json`. `"NATIVE"` resolves to the diamond's
  /// own address, the wire format for the native token.
  function _allowConfiguredTokens(IChainbills chainbills, string memory chainName) internal {
    string memory json = vm.readFile('script/env/tokens.json');
    string memory key = string.concat('.', chainName);
    if (!vm.keyExistsJson(json, key)) return;

    string[] memory tokens = vm.parseJsonStringArray(json, key);
    for (uint256 i; i < tokens.length; i++) {
      bool isNative = keccak256(bytes(tokens[i])) == keccak256(bytes('NATIVE'));
      address token = isNative ? address(chainbills) : vm.parseAddress(tokens[i]);
      chainbills.allowPaymentsForToken(token);
      console.log('Allowed payments for token', token);
    }
  }

  /// Writes `deploys/<chainName>.json` with every address this run produced or reused.
  function _writeDeployRecord(
    string memory chainName,
    string memory caip2,
    bytes32 salt,
    address owner,
    IChainbills chainbills,
    ChainbillsDiamondInit.InitParams memory params,
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
    vm.serializeString(rootKey, 'chain', chainName);
    vm.serializeString(rootKey, 'caip2', caip2);
    vm.serializeUint(rootKey, 'chainId', block.chainid);
    vm.serializeBytes32(rootKey, 'cbChainId', params.cbChainId);
    vm.serializeBytes32(rootKey, 'salt', salt);
    vm.serializeAddress(rootKey, 'owner', owner);
    vm.serializeAddress(rootKey, 'admin', params.admin);
    vm.serializeAddress(rootKey, 'diamond', address(chainbills));
    vm.serializeAddress(rootKey, 'diamondCutFacet', diamondCutFacet);
    vm.serializeAddress(rootKey, 'init', init);
    vm.serializeString(rootKey, 'libraries', librariesJson);
    vm.serializeString(rootKey, 'facets', facetsJson);
    string memory finalJson = vm.serializeUint(rootKey, 'deployedAtBlock', block.number);

    string memory outPath = string.concat('deploys/', chainName, '.json');
    vm.writeJson(finalJson, outPath);
    console.log('Wrote deploy record to', outPath);
  }
}
