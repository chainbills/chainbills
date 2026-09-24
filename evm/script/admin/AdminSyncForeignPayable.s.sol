// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';
import {TokenAndAmountForeign} from '../../src/types/CbTypes.sol';

/// Applies foreign payable state to `DIAMOND` directly, bypassing Wormhole and CCTP. Caller must hold
/// `PAYABLE_SYNC_ROLE`. Nonce ordering still applies.
///
/// Required env: `DIAMOND`, `PAYABLE_ID`, `FOREIGN_CB_CHAIN_ID`, `NONCE` (uint64), `INITIATED_AT` (uint64),
/// `ACTION_TYPE` (uint8; 1 create/snapshot, 2 close, 3 reopen, 4 update allowed tokens and amounts),
/// `IS_CLOSED` (bool; applied for action types 1, 2, and 3). Optional, parallel arrays for action types 1 and 4:
/// `ALLOWED_TOKENS` (32-byte format, comma-separated), `ALLOWED_AMOUNTS` (uint64, comma-separated).
contract AdminSyncForeignPayable is CbAdminScript {
  function run() public {
    bytes32 payableId = vm.envBytes32('PAYABLE_ID');
    bytes32 foreignChainId = vm.envBytes32('FOREIGN_CB_CHAIN_ID');
    uint64 nonce = uint64(vm.envUint('NONCE'));
    uint64 initiatedAt = uint64(vm.envUint('INITIATED_AT'));
    uint8 actionType = uint8(vm.envUint('ACTION_TYPE'));
    bool isClosed = vm.envBool('IS_CLOSED');
    TokenAndAmountForeign[] memory allowedTokensAndAmounts = _readAllowedTokensAndAmounts();

    vm.startBroadcast();
    _diamond().adminSyncForeignPayable(
      payableId, foreignChainId, nonce, initiatedAt, actionType, isClosed, allowedTokensAndAmounts
    );
    vm.stopBroadcast();

    console.log('Synced foreign payable');
    console.logBytes32(payableId);
  }

  function _readAllowedTokensAndAmounts() internal view returns (TokenAndAmountForeign[] memory list) {
    if (!vm.envExists('ALLOWED_TOKENS')) return new TokenAndAmountForeign[](0);

    bytes32[] memory tokens = vm.envBytes32('ALLOWED_TOKENS', ',');
    uint256[] memory amounts = vm.envUint('ALLOWED_AMOUNTS', ',');
    require(tokens.length == amounts.length, 'AdminSyncForeignPayable: ALLOWED_TOKENS/ALLOWED_AMOUNTS length mismatch');

    list = new TokenAndAmountForeign[](tokens.length);
    for (uint256 i; i < tokens.length; i++) {
      list[i] = TokenAndAmountForeign({token: tokens[i], amount: uint64(amounts[i])});
    }
  }
}
