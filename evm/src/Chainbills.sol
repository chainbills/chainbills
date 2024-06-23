// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import 'wormhole/Chains.sol';
import 'wormhole/libraries/BytesParsing.sol';
import 'wormhole/Utils.sol';

import './CbGovernance.sol';
import './CbPayloadMessages.sol';

/// @title A Cross-Chain Payment Gateway.
/// @notice This contract uses Wormhole's generic-messaging to send
/// PayloadMessages (for actions) and paid tokens to the Chainbills Solana
/// program.
// Initializable,
contract Chainbills is
  CbGovernance,
  CbPayloadMessages,
  ReentrancyGuard
  // ReentrancyGuardUpgradeable
{
  using BytesParsing for bytes;

  /// Sets up this smart contract when it is deployed.
  /// @dev Sets the owner, wormhole, tokenBridge, chainId, and
  /// wormholeFinality variables.
  /// See ChainbillState.sol for descriptions of each state variable.
  constructor(
    address wormhole_,
    address tokenBridge_,
    uint16 chainId_,
    uint8 wormholeFinality_
  ) {
    if (wormhole_ == address(0)) revert InvalidWormholeAddress();
    else if (tokenBridge_ == address(0)) revert InvalidTokenBridgeAddress();
    else if (chainId_ == 0) revert InvalidWormholeChainId();
    else if (wormholeFinality_ == 0) revert InvalidWormholeFinality();

    setWormhole(wormhole_);
    setTokenBridge(tokenBridge_);
    setChainId(chainId_);
    setWormholeFinality(wormholeFinality_);
  }

  /// Initialize a Payable.
  ///
  /// @param description Displayed to payers when paying to and on receipts of
  /// a payable.
  /// @param allowsFreePayments Whether a payable allows payments of any amount
  /// of any token.
  /// @param tokensAndAmounts The accepted tokens (and their amounts) on a
  /// payable.
  /// @return messageSequence Wormhole message sequence for the Wormhole token
  /// bridge contract. This sequence is incremented (per message) for each
  /// message emitter.
  function initializePayable(
    string calldata description,
    bool allowsFreePayments,
    CbTokenAndAmount[] calldata tokensAndAmounts
  ) public payable returns (uint64 messageSequence) {
    bytes memory descBytes = bytes(description);
    if (descBytes.length == 0) revert EmptyDescriptionProvided();
    else if (descBytes.length > MAX_PAYABLES_DESCRIPTION_LENGTH) {
      revert MaxPayableDescriptionReached();
    } else if (tokensAndAmounts.length > MAX_PAYABLES_TOKENS) {
      revert MaxPayableTokensCapacityReached();
    } else if (
      (allowsFreePayments && tokensAndAmounts.length > 0) ||
      (!allowsFreePayments && tokensAndAmounts.length == 0)
    ) {
      revert ImproperPayablesConfiguration();
    } else {
      for (uint16 i = 0; i < tokensAndAmounts.length; i++) {
        address token = fromWormholeFormat(tokensAndAmounts[i].token);
        if (token == address(0)) revert InvalidTokenAddress();

        uint8 decimals = getDecimals(token);
        uint256 amount = tokensAndAmounts[i].amount;
        uint256 denormalized = denormalizeAmount(amount, decimals);
        if (amount == 0 || denormalized == 0) revert ZeroAmountSpecified();
      }
    }

    messageSequence = sendPayloadMessage(
      CbPayloadMessage({
        actionId: ACTION_ID_INITIALIZE_PAYABLE,
        caller: toWormholeFormat(msg.sender),
        payableId: toWormholeFormat(address(0)),
        token: toWormholeFormat(address(0)),
        amount: 0,
        allowsFreePayments: allowsFreePayments,
        tokensAndAmounts: tokensAndAmounts,
        description: description
      })
    );
  }

  /// Stop a payable from accepting payments.
  /// @dev Should be called only by the host (user) that owns the payable.
  /// otherwise the Solana will reject the update.
  ///
  /// @param payableId The payable's Wormhole-normalized address to be closed.
  /// @return messageSequence Wormhole message sequence for the Wormhole token
  /// bridge contract. This sequence is incremented (per message) for each
  /// message emitter.
  function closePayable(
    bytes32 payableId
  ) public payable returns (uint64 messageSequence) {
    messageSequence = sendPayloadMessage(
      CbPayloadMessage({
        actionId: ACTION_ID_CLOSE_PAYABLE,
        caller: toWormholeFormat(msg.sender),
        payableId: payableId,
        token: toWormholeFormat(address(0)),
        amount: 0,
        allowsFreePayments: false,
        tokensAndAmounts: new CbTokenAndAmount[](0),
        description: ''
      })
    );
  }

  /// Allow a closed payable to continue accepting payments.
  /// @dev Should be called only by the host (user) that owns the payable.
  /// otherwise the Solana will reject the update.
  ///
  /// @param payableId The payable's Wormhole-normalized address to re-open
  /// @return messageSequence Wormhole message sequence for the Wormhole token
  /// bridge contract. This sequence is incremented (per message) for each
  /// message emitter.
  function reopenPayable(
    bytes32 payableId
  ) public payable returns (uint64 messageSequence) {
    messageSequence = sendPayloadMessage(
      CbPayloadMessage({
        actionId: ACTION_ID_REOPEN_PAYABLE,
        caller: toWormholeFormat(msg.sender),
        payableId: payableId,
        token: toWormholeFormat(address(0)),
        amount: 0,
        allowsFreePayments: false,
        tokensAndAmounts: new CbTokenAndAmount[](0),
        description: ''
      })
    );
  }

  /// Allows a payable's host to update the payable's description.
  ///
  /// @param payableId The payable's Wormhole-normalized address to re-open
  /// @param description The new description to update with
  /// @return messageSequence Wormhole message sequence for the Wormhole token
  /// bridge contract. This sequence is incremented (per message) for each
  /// message emitter.
  function updatePayableDescription(
    bytes32 payableId,
    string calldata description
  ) public payable returns (uint64 messageSequence) {
    bytes memory descBytes = bytes(description);
    if (descBytes.length == 0) revert EmptyDescriptionProvided();
    else if (descBytes.length > MAX_PAYABLES_DESCRIPTION_LENGTH) {
      revert MaxPayableDescriptionReached();
    }
    messageSequence = sendPayloadMessage(
      CbPayloadMessage({
        actionId: ACTION_ID_UPDATE_PAYABLE_DESCRIPTION,
        caller: toWormholeFormat(msg.sender),
        payableId: payableId,
        description: description,
        token: toWormholeFormat(address(0)),
        amount: 0,
        allowsFreePayments: false,
        tokensAndAmounts: new CbTokenAndAmount[](0)
      })
    );
  }

  /// Transfers the amount of tokens from a payer to a payable.
  ///
  /// @param payableId The payable's Wormhole-normalized address to pay into.
  /// @param token The Wormhole-normalized address of the token been paid.
  /// Provide the address of this token as bridged on Solana.
  /// @param amount The Wormhole-normalized (with 8 decimals) amount of the
  /// token.
  /// @return messageSequence Wormhole message sequence for the Wormhole token
  /// bridge contract. This sequence is incremented (per message) for each
  /// message emitter.
  function pay(
    bytes32 payableId,
    bytes32 token,
    uint256 amount
  ) public payable nonReentrant returns (uint64 messageSequence) {
    // Perform necessary checks
    uint16 targetChain = CHAIN_ID_SOLANA;
    address localToken = tokenBridge().wrappedAsset(targetChain, token);
    if (localToken == address(0)) revert TokenNotAttested();

    uint8 decimals = getDecimals(localToken);
    uint256 denormalized = denormalizeAmount(amount, decimals);
    if (amount == 0 || denormalized == 0) revert ZeroAmountSpecified();

    bytes32 targetContract = getRegisteredEmitter(targetChain);
    if (targetContract == bytes32(0)) revert EmitterNotRegistered();

    uint256 wormholeFee = wormhole().messageFee();
    if (msg.value < (wormholeFee + getRelayerFee())) {
      revert InsufficientFeesValue();
    }

    // transfer tokens from user to the this contract and
    // approve the token bridge to spend the specified tokens
    uint256 amountReceived = custodyTokens(localToken, denormalized);
    ITokenBridge bridge = tokenBridge();
    SafeERC20.safeIncreaseAllowance(
      IERC20(localToken),
      address(bridge),
      amountReceived
    );

    // Call `transferTokensWithPayload`method on the token bridge and pay
    // the Wormhole network fee. The token bridge will emit a Wormhole
    // message with an encoded `TransferWithPayload` struct
    messageSequence = bridge.transferTokensWithPayload{value: wormholeFee}(
      localToken,
      amountReceived,
      targetChain,
      targetContract,
      0, // batchId. 0 for no batching.
      encodePayloadMessage(
        CbPayloadMessage({
          actionId: ACTION_ID_PAY,
          caller: toWormholeFormat(msg.sender),
          payableId: payableId,
          token: token,
          amount: amount,
          allowsFreePayments: false,
          tokensAndAmounts: new CbTokenAndAmount[](0),
          description: ''
        })
      )
    );
  }

  /// Transfers the amount of tokens from a payable to a host.
  /// @dev Should be called only by the host (user) that owns the payable.
  /// otherwise the Solana will reject the payload message. Also, the
  /// details should have positive balances in the payable.
  ///
  /// @param payableId The payable's Wormhole-normalized address to withdraw
  /// from.
  /// @param token The Wormhole-normalized address of the token been paid.
  /// Provide the address of this token as bridged on Solana.
  /// @param amount The Wormhole-normalized (with 8 decimals) amount of the
  /// token.
  /// @return messageSequence Wormhole message sequence for the Wormhole token
  /// bridge contract. This sequence is incremented (per message) for each
  /// message emitter.
  function withdraw(
    bytes32 payableId,
    bytes32 token,
    uint256 amount
  ) public payable returns (uint64 messageSequence) {
    messageSequence = sendPayloadMessage(
      CbPayloadMessage({
        actionId: ACTION_ID_WITHDRAW,
        caller: toWormholeFormat(msg.sender),
        payableId: payableId,
        token: token,
        amount: amount,
        allowsFreePayments: false,
        tokensAndAmounts: new CbTokenAndAmount[](0),
        description: ''
      })
    );
  }

  /// Completes the withdrawal from Solana that was initiated by the {withdraw}
  /// function.
  /// @dev The token bridge contract calls the Wormhole core endpoint to verify
  /// the `TransferWithPayload` message. The token bridge contract saves the
  /// message hash in storage to prevent `TransferWithPayload` messages from
  /// being replayed.
  /// @param encoded Encoded `TransferWithPayload` message
  function completeWithdrawal(bytes memory encoded) public {
    // Parse the encoded Wormhole message
    // SECURITY: Just parseVM is called instead of parseAndVerifyVM since
    // consequent calls to the TokenBridge will verify the encoded message.
    IWormhole.VM memory parsed = wormhole().parseVM(encoded);

    // Obtain the previously saved token address for this transfer
    uint256 _payloadIndex = 33;
    bytes32 sourceAddress;
    uint16 sourceChain;
    (sourceAddress, _payloadIndex) = parsed.payload.asBytes32(_payloadIndex);
    (sourceChain, _payloadIndex) = parsed.payload.asUint16(_payloadIndex);
    address token = tokenBridge().wrappedAsset(sourceChain, sourceAddress);
    if (token == address(0)) revert TokenNotAttested();

    // check balance before completing the transfer
    uint256 balanceBefore = getBalance(token);

    ITokenBridge bridge = tokenBridge();
    // Call `completeTransferWithPayload` on the token bridge. This
    // method acts as a reentrancy protection since it does not allow
    // transfers to be redeemed more than once.
    bytes memory transferPayload = bridge.completeTransferWithPayload(encoded);

    // compute and save the balance difference after completing the transfer
    uint256 amountTransferred = getBalance(token) - balanceBefore;

    // parse the wormhole message payload into the `TransferWithPayload` struct
    ITokenBridge.TransferWithPayload memory transfer = bridge
      .parseTransferWithPayload(transferPayload);

    // confirm that the message sender is a registered Chainbills contract
    if (transfer.fromAddress != getRegisteredEmitter(parsed.emitterChainId)) {
      revert EmitterNotRegistered();
    }

    // parse the CbPayloadMessage from the `TransferWithPayload` struct and
    // complete transfer back to original caller.
    CbPayloadMessage memory payload = decodePayloadMessage(transfer.payload);
    address caller = fromWormholeFormat(payload.caller);
    if (caller == address(0)) revert InvalidCallerAddress();
    SafeERC20.safeTransfer(IERC20(token), caller, amountTransferred);
  }

  function sendPayloadMessage(
    CbPayloadMessage memory payload
  ) internal returns (uint64 messageSequence) {
    // Ensure sufficient fee was provided.
    IWormhole wh = wormhole();
    uint256 wormholeFee = wh.messageFee();
    if (msg.value < (wormholeFee + getRelayerFee())) {
      revert InsufficientFeesValue();
    }

    messageSequence = wh.publishMessage(
      0, // batchId. 0 for no batching.
      encodePayloadMessage(payload),
      wormholeFinality()
    );
  }

  function custodyTokens(
    address token,
    uint256 amount
  ) internal returns (uint256) {
    // query own token balance before transfer
    uint256 balanceBefore = getBalance(token);

    // deposit tokens
    SafeERC20.safeTransferFrom(
      IERC20(token),
      msg.sender,
      address(this),
      amount
    );

    // return the balance difference
    return getBalance(token) - balanceBefore;
  }

  function getBalance(address token) internal view returns (uint256 balance) {
    // fetch the specified token balance for this contract
    (, bytes memory queriedBalance) = token.staticcall(
      abi.encodeWithSelector(IERC20.balanceOf.selector, address(this))
    );
    balance = abi.decode(queriedBalance, (uint256));
  }

  function getDecimals(address token) internal view returns (uint8) {
    (, bytes memory queriedDecimals) = token.staticcall(
      abi.encodeWithSignature('decimals()')
    );
    return abi.decode(queriedDecimals, (uint8));
  }

  function denormalizeAmount(
    uint256 amount,
    uint8 decimals
  ) internal pure returns (uint256) {
    if (decimals > 8) amount *= 10 ** (decimals - 8);
    return amount;
  }

  function normalizeAmount(
    uint256 amount,
    uint8 decimals
  ) internal pure returns (uint256) {
    if (decimals > 8) amount /= 10 ** (decimals - 8);
    return amount;
  }

  fallback() external payable {}

  receive() external payable {}
}
