// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'forge-std/Script.sol';
import 'src/Chainbills.sol';

/// Registers a foreign (peer) chain on this deployed Chainbills contract.
/// Bundles registerChainCircleDomain, registerChainWormholeId, and
/// registerForeignContract into a single broadcast.
///
/// Required env vars:
///   CB_ADDRESS              - this chain's Chainbills proxy address
///   FOREIGN_CB_CHAIN_ID     - cbChainId (bytes32) of the peer chain
///   FOREIGN_CIRCLE_DOMAIN   - Circle domain (uint32) of the peer chain
///   FOREIGN_WORMHOLE_ID     - Wormhole chain ID (uint16) of the peer chain (0 to skip)
///   FOREIGN_CB_ADDRESS      - Chainbills contract address on the peer chain
contract RegisterForeignChain is Script {
  function run() public {
    address cbAddr = vm.envAddress('CB_ADDRESS');
    bytes32 foreignCbChainId = vm.envBytes32('FOREIGN_CB_CHAIN_ID');
    uint32 foreignCircleDomain = uint32(vm.envUint('FOREIGN_CIRCLE_DOMAIN'));
    uint16 foreignWormholeId = uint16(vm.envUint('FOREIGN_WORMHOLE_ID'));
    address foreignCbAddress = vm.envAddress('FOREIGN_CB_ADDRESS');

    Chainbills chainbills = Chainbills(payable(cbAddr));
    bytes32 emitterAddress = bytes32(uint256(uint160(foreignCbAddress)));

    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    console.log('Registering foreign chain on Chainbills ...');

    chainbills.registerChainCircleDomain(foreignCbChainId, foreignCircleDomain);
    console.log('Registered Circle Domain:', foreignCircleDomain);

    if (foreignWormholeId != 0) {
      chainbills.registerChainWormholeId(foreignCbChainId, foreignWormholeId);
      console.log('Registered Wormhole Chain ID:', foreignWormholeId);
    }

    chainbills.registerForeignContract(foreignCbChainId, emitterAddress);
    console.log('Registered Foreign Contract:', foreignCbAddress);

    vm.stopBroadcast();
  }
}
