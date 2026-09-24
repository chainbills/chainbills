// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbFacetDeployer} from './base/CbFacetDeployer.sol';
import {CbFacetSet} from '../src/CbFacetSet.sol';
import {ChainbillsDiamondInit} from '../src/ChainbillsDiamondInit.sol';
import {Diamond} from '../src/diamond/Diamond.sol';
import {IChainbills} from '../src/interfaces/IChainbills.sol';
import {IDiamondCut} from '../src/interfaces/diamond/IDiamondCut.sol';
import {
  ForeignChainAddresses,
  ForeignChainConfig,
  ForeignChainFinality,
  ForeignChainLimits,
  ForeignChainProtocolIds,
  ForeignChainSwitches
} from '../src/types/CbTypes.sol';
import {MockMessageTransmitterV2, MockTokenMessengerV2, MockTokenMinterV2} from '../test/mocks/MockCctp.sol';
import {MockERC20} from '../test/mocks/MockERC20.sol';
import {MockWormhole} from '../test/mocks/MockWormhole.sol';

/// Deploys two fully wired Chainbills diamonds — chain A (`CB_SALT`) and chain B (`CB_SALT` plus one) — against a
/// single local anvil, each with its own Wormhole and CCTP mocks and USDC, registered as foreign chains of each
/// other over both protocols with matching USDC. For manual end-to-end runs only; nothing here is meant for a real
/// chain, and mocked infrastructure never appears in `DeployChainbills`.
///
/// Required env: `RPC_URL` (see `script/env/anvil.env`), `PRIVATE_KEY`, `CB_SALT`.
contract DeployLocalStack is CbFacetDeployer {
  uint16 internal constant CHAIN_A_WORMHOLE_ID = 2;
  uint16 internal constant CHAIN_B_WORMHOLE_ID = 3;
  uint32 internal constant CHAIN_A_CIRCLE_DOMAIN = 0;
  uint32 internal constant CHAIN_B_CIRCLE_DOMAIN = 1;
  uint16 internal constant FEE_BPS = 200;
  uint8 internal constant MAX_ALLOWED_TOKENS_AND_AMOUNTS = 20;

  struct LocalChain {
    IChainbills cb;
    bytes32 cbChainId;
    uint16 wormholeChainId;
    uint32 circleDomain;
    MockWormhole wormhole;
    MockMessageTransmitterV2 transmitter;
    MockTokenMessengerV2 messenger;
    MockTokenMinterV2 minter;
    MockERC20 usdc;
  }

  function run() public {
    bytes32 saltA = vm.envBytes32('CB_SALT');
    bytes32 saltB = bytes32(uint256(saltA) + 1);
    address deployer = vm.envAddress('OWNER');

    vm.startBroadcast();
    LocalChain memory chainA =
      _deployLocalChain(saltA, deployer, keccak256('eip155:31337:a'), CHAIN_A_WORMHOLE_ID, CHAIN_A_CIRCLE_DOMAIN);
    LocalChain memory chainB =
      _deployLocalChain(saltB, deployer, keccak256('eip155:31337:b'), CHAIN_B_WORMHOLE_ID, CHAIN_B_CIRCLE_DOMAIN);
    _link(chainA, chainB);
    _link(chainB, chainA);
    vm.stopBroadcast();

    console.log('Chain A diamond', address(chainA.cb));
    console.log('Chain A USDC', address(chainA.usdc));
    console.log('Chain B diamond', address(chainB.cb));
    console.log('Chain B USDC', address(chainB.usdc));
  }

  function _deployLocalChain(
    bytes32 salt,
    address owner,
    bytes32 cbChainId,
    uint16 wormholeChainId,
    uint32 circleDomain
  ) internal returns (LocalChain memory chain) {
    chain = _deployMocks(cbChainId, wormholeChainId, circleDomain);
    chain.cb = _deployDiamond(salt, owner, cbChainId);
    chain.cb.setupWormhole(address(chain.wormhole), wormholeChainId, 1);
    chain.cb.setupCctp(address(chain.messenger));
    chain.cb.allowPaymentsForToken(address(chain.cb));
    chain.cb.allowPaymentsForToken(address(chain.usdc));
  }

  function _deployMocks(bytes32 cbChainId, uint16 wormholeChainId, uint32 circleDomain)
    internal
    returns (LocalChain memory chain)
  {
    chain.cbChainId = cbChainId;
    chain.wormholeChainId = wormholeChainId;
    chain.circleDomain = circleDomain;
    chain.wormhole = new MockWormhole(wormholeChainId);
    chain.transmitter = new MockMessageTransmitterV2(circleDomain);
    chain.minter = new MockTokenMinterV2();
    chain.messenger = new MockTokenMessengerV2(chain.transmitter, chain.minter);
    chain.transmitter.setTokenMessenger(address(chain.messenger));
    chain.usdc = new MockERC20('USD Coin', 'USDC', 6);
  }

  function _deployDiamond(bytes32 salt, address owner, bytes32 cbChainId) internal returns (IChainbills) {
    LinkedLibrary[] memory libs = _deployLibraries(salt);
    address[] memory facetImpls = _deployFacets(salt, libs);
    (address diamondCutFacet,) = _deployIfNeeded(salt, _rawCode('DiamondCutFacet'), 'DiamondCutFacet');
    (address init,) = _deployIfNeeded(salt, _rawCode('ChainbillsDiamondInit'), 'ChainbillsDiamondInit');
    bytes memory diamondInitCode = abi.encodePacked(_rawCode('Diamond'), abi.encode(owner, diamondCutFacet));
    (address diamondAddr, bool isNew) = _deployIfNeeded(salt, diamondInitCode, 'Diamond');

    if (isNew) {
      IDiamondCut.FacetCut[] memory cuts = CbFacetSet.buildAddCut(facetImpls);
      ChainbillsDiamondInit.InitParams memory params = ChainbillsDiamondInit.InitParams({
        cbChainId: cbChainId,
        admin: owner,
        feeCollector: owner,
        withdrawalFeeBps: FEE_BPS,
        maxAllowedTokensAndAmounts: MAX_ALLOWED_TOKENS_AND_AMOUNTS
      });
      IDiamondCut(diamondAddr).diamondCut(cuts, init, abi.encodeCall(ChainbillsDiamondInit.init, (params)));
    }

    return IChainbills(diamondAddr);
  }

  /// Registers `remote` on `local` with every path enabled and fast finality, and maps the USDC pair.
  function _link(LocalChain memory local, LocalChain memory remote) internal {
    bytes32 remoteDiamond = _toBytes32(address(remote.cb));
    local.messenger.setRemoteTokenMessenger(remote.circleDomain, _toBytes32(address(remote.messenger)));
    local.minter.setLocalToken(remote.circleDomain, _toBytes32(address(remote.usdc)), address(local.usdc));
    local.cb.registerForeignChain(remote.cbChainId, _defaultForeignChainConfig(remote, remoteDiamond));
    local.cb.registerMatchingToken(remote.cbChainId, _toBytes32(address(remote.usdc)), address(local.usdc));
  }

  function _defaultForeignChainConfig(LocalChain memory remote, bytes32 remoteDiamond)
    internal
    pure
    returns (ForeignChainConfig memory config)
  {
    config.protocolIds = ForeignChainProtocolIds({
      wormholeChainId: remote.wormholeChainId,
      hasWormholeChainId: true,
      circleDomain: remote.circleDomain,
      hasCircleDomain: true
    });
    config.addresses = ForeignChainAddresses({
      wormholeEmitter: remoteDiamond,
      cctpMessageSender: remoteDiamond,
      cctpBurnSender: remoteDiamond,
      cctpRecipient: remoteDiamond,
      cctpMintRecipient: remoteDiamond,
      cctpDestinationCaller: remoteDiamond
    });
    config.switches = ForeignChainSwitches({
      isCctpUpdateEnabled: true,
      isInboundUpdateEnabled: true,
      isOutboundPaymentEnabled: true,
      isInboundPaymentEnabled: true
    });
    config.finality = ForeignChainFinality({
      outboundUpdateFinality: 1000,
      outboundPaymentFinality: 1000,
      minInboundUpdateFinality: 1000,
      minInboundPaymentFinality: 1000
    });
    config.limits = ForeignChainLimits({hasMaxOutboundCctpFeeBps: false, maxOutboundCctpFeeBps: 0});
  }

  function _toBytes32(address account) internal pure returns (bytes32) {
    return bytes32(uint256(uint160(account)));
  }
}
