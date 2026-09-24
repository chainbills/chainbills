// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Contract that rejects every native transfer.
contract RejectEth {
  receive() external payable {
    revert('RejectEth');
  }

  /// Forwards an arbitrary call, letting tests act as this contract.
  function execute(address target, bytes calldata data) external payable returns (bytes memory) {
    (bool success, bytes memory result) = target.call{value: msg.value}(data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    }
    return result;
  }
}
