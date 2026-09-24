// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {ChainbillsDiamondInit} from 'src/ChainbillsDiamondInit.sol';
import {IChainbills} from 'src/interfaces/IChainbills.sol';
import {ICbErrors} from 'src/interfaces/ICbErrors.sol';
import {ICbEvents} from 'src/interfaces/ICbEvents.sol';
import {CCTP_FINALITY_FAST, CCTP_FINALITY_FINALIZED} from 'src/types/CbConstants.sol';
import {
  ForeignChainAddresses,
  ForeignChainConfig,
  ForeignChainFinality,
  ForeignChainLimits,
  ForeignChainProtocolIds,
  ForeignChainSwitches,
  TokenAndAmount
} from 'src/types/CbTypes.sol';
import {MockMessageTransmitterV2, MockTokenMessengerV2, MockTokenMinterV2} from '../mocks/MockCctp.sol';
import {MockERC20} from '../mocks/MockERC20.sol';
import {MockWormhole} from '../mocks/MockWormhole.sol';
import {CbDeployer} from './CbDeployer.sol';

/// Shared fixture: chain A is deployed and fully configured in `setUp`; `_setUpChainB` adds a second chain wired to
/// chain A over both Wormhole and CCTP.
abstract contract CbTestBase is Test, ICbErrors, ICbEvents {
  /// One simulated chain.
  struct SimChain {
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

  uint16 internal constant DEFAULT_FEE_BPS = 200;
  uint8 internal constant DEFAULT_MAX_ALLOWED_TOKENS_AND_AMOUNTS = 20;
  uint256 internal constant WORMHOLE_FEE = 0.001 ether;

  address internal owner = makeAddr('owner');
  address internal feeCollector = makeAddr('fee-collector');
  address internal host = makeAddr('host');
  address internal payer = makeAddr('payer');
  address internal relayer = makeAddr('relayer');
  address internal stranger = makeAddr('stranger');

  SimChain internal chainA;
  SimChain internal chainB;

  /// Chain A diamond, for brevity.
  IChainbills internal cb;
  /// Chain A USDC, for brevity.
  MockERC20 internal usdc;
  /// Native token sentinel of chain A (the diamond address).
  address internal native;

  function setUp() public virtual {
    chainA = _deployChain(keccak256('eip155:1'), 2, 0);
    cb = chainA.cb;
    usdc = chainA.usdc;
    native = address(cb);
  }

  // ---------------------------------------------------------------------------
  // Chains
  // ---------------------------------------------------------------------------

  /// Deploys a diamond with Wormhole and CCTP mocks, USDC, and the native token allowed.
  function _deployChain(bytes32 cbChainId, uint16 wormholeChainId, uint32 circleDomain)
    internal
    returns (SimChain memory chain)
  {
    chain.cbChainId = cbChainId;
    chain.wormholeChainId = wormholeChainId;
    chain.circleDomain = circleDomain;
    chain.wormhole = new MockWormhole(wormholeChainId);
    chain.wormhole.setMessageFee(WORMHOLE_FEE);
    chain.transmitter = new MockMessageTransmitterV2(circleDomain);
    chain.minter = new MockTokenMinterV2();
    chain.messenger = new MockTokenMessengerV2(chain.transmitter, chain.minter);
    chain.transmitter.setTokenMessenger(address(chain.messenger));
    chain.usdc = new MockERC20('USD Coin', 'USDC', 6);

    vm.startPrank(owner);
    chain.cb = CbDeployer.deploy(
      owner,
      ChainbillsDiamondInit.InitParams({
        cbChainId: cbChainId,
        admin: owner,
        feeCollector: feeCollector,
        withdrawalFeeBps: DEFAULT_FEE_BPS,
        maxAllowedTokensAndAmounts: DEFAULT_MAX_ALLOWED_TOKENS_AND_AMOUNTS
      })
    );
    chain.cb.setupWormhole(address(chain.wormhole), wormholeChainId, 1);
    chain.cb.setupCctp(address(chain.messenger));
    chain.cb.allowPaymentsForToken(address(chain.cb));
    chain.cb.allowPaymentsForToken(address(chain.usdc));
    chain.cb.grantRole(chain.cb.RELAYER_ROLE(), relayer);
    vm.stopPrank();
  }

  /// Deploys chain B and wires A and B to each other over Wormhole and CCTP with matching USDC.
  function _setUpChainB() internal {
    chainB = _deployChain(keccak256('eip155:2'), 3, 1);
    _link(chainA, chainB);
    _link(chainB, chainA);
  }

  /// Registers `remote` on `local` with every path enabled and fast finality, and maps the USDC pair.
  function _link(SimChain memory local, SimChain memory remote) internal {
    bytes32 remoteDiamond = _toBytes32(address(remote.cb));
    local.messenger.setRemoteTokenMessenger(remote.circleDomain, _toBytes32(address(remote.messenger)));
    local.minter.setLocalToken(remote.circleDomain, _toBytes32(address(remote.usdc)), address(local.usdc));
    vm.startPrank(owner);
    local.cb.registerForeignChain(remote.cbChainId, _defaultForeignChainConfig(remote, remoteDiamond));
    local.cb.registerMatchingToken(remote.cbChainId, _toBytes32(address(remote.usdc)), address(local.usdc));
    vm.stopPrank();
  }

  /// Returns a configuration with every path enabled, all addresses set to `remoteDiamond`, and fast finality.
  function _defaultForeignChainConfig(SimChain memory remote, bytes32 remoteDiamond)
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
      outboundUpdateFinality: CCTP_FINALITY_FAST,
      outboundPaymentFinality: CCTP_FINALITY_FAST,
      minInboundUpdateFinality: CCTP_FINALITY_FAST,
      minInboundPaymentFinality: CCTP_FINALITY_FAST
    });
    config.limits = ForeignChainLimits({hasMaxOutboundCctpFeeBps: false, maxOutboundCctpFeeBps: 0});
  }

  // ---------------------------------------------------------------------------
  // Relaying
  // ---------------------------------------------------------------------------

  /// Returns the VAA of the latest Wormhole message published on `chain`.
  function _lastVaa(SimChain memory chain) internal view returns (bytes memory) {
    return chain.wormhole.vaaOf(chain.wormhole.publishedCount() - 1);
  }

  /// Returns the latest CCTP message sent from `chain`, attested at `finality` with `feeExecuted` for burns.
  function _lastCctp(SimChain memory chain, uint32 finality, uint256 feeExecuted, bool isBurn)
    internal
    view
    returns (bytes memory message, bytes memory attestation)
  {
    return chain.transmitter.attest(chain.transmitter.lastSent(), finality, feeExecuted, isBurn);
  }

  /// Returns the CCTP message at `index` sent from `chain`, attested at `finality` with `feeExecuted` for burns.
  function _cctpAt(SimChain memory chain, uint256 index, uint32 finality, uint256 feeExecuted, bool isBurn)
    internal
    view
    returns (bytes memory message, bytes memory attestation)
  {
    return chain.transmitter.attest(chain.transmitter.sent(index), finality, feeExecuted, isBurn);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /// Creates a payable on `chain` hosted by `host_`, paying the broadcast fee.
  function _createPayable(SimChain memory chain, address host_, TokenAndAmount[] memory allowed, bool isAutoWithdraw)
    internal
    returns (bytes32 payableId)
  {
    uint256 fee = chain.cb.quoteBroadcastFee();
    vm.deal(host_, host_.balance + fee);
    vm.prank(host_);
    (payableId,) = chain.cb.createPayable{value: fee}(allowed, isAutoWithdraw);
  }

  /// Returns an empty allowed-tokens list.
  function _anyToken() internal pure returns (TokenAndAmount[] memory) {
    return new TokenAndAmount[](0);
  }

  /// Returns a one-entry allowed-tokens list.
  function _only(address token, uint256 amount) internal pure returns (TokenAndAmount[] memory list) {
    list = new TokenAndAmount[](1);
    list[0] = TokenAndAmount(token, amount);
  }

  /// Mints USDC on `chain` to `to` and approves the diamond.
  function _fundUsdc(SimChain memory chain, address to, uint256 amount) internal {
    chain.usdc.mint(to, amount);
    vm.prank(to);
    chain.usdc.approve(address(chain.cb), type(uint256).max);
  }

  function _toBytes32(address account) internal pure returns (bytes32) {
    return bytes32(uint256(uint160(account)));
  }

  // Excludes the base from coverage reports.
  function test() public virtual {}
}
