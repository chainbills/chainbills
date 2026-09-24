// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IMessageHandlerV2} from 'src/interfaces/circle/IMessageHandlerV2.sol';
import {MockERC20} from './MockERC20.sol';

/// Circle TokenMinterV2 simulation: maps remote tokens to local tokens and mints them.
contract MockTokenMinterV2 {
  mapping(uint32 remoteDomain => mapping(bytes32 remoteToken => address)) public localTokens;

  function setLocalToken(uint32 remoteDomain, bytes32 remoteToken, address localToken) external {
    localTokens[remoteDomain][remoteToken] = localToken;
  }

  function getLocalToken(uint32 remoteDomain, bytes32 remoteToken) external view returns (address) {
    return localTokens[remoteDomain][remoteToken];
  }
}

/// Circle MessageTransmitterV2 simulation producing and consuming real CCTP V2 message bytes.
/// @dev An attestation is `abi.encodePacked(keccak256(message))`. Tests call `attest` to stamp the finality and, for
/// burns, the executed fee (as Circle's attester does), then submit the returned message and attestation.
contract MockMessageTransmitterV2 {
  uint32 public immutable localDomain;
  address public tokenMessenger;
  uint256 public nonceCounter;
  bool public isFailingReceives;
  bytes[] internal _sent;
  mapping(uint32 sourceDomain => mapping(bytes32 nonce => bool)) public usedNonces;

  event MessageSent(bytes message);

  constructor(uint32 localDomain_) {
    localDomain = localDomain_;
  }

  function setTokenMessenger(address tokenMessenger_) external {
    tokenMessenger = tokenMessenger_;
  }

  function setFailingReceives(bool isFailing) external {
    isFailingReceives = isFailing;
  }

  function sentCount() external view returns (uint256) {
    return _sent.length;
  }

  function sent(uint256 index) external view returns (bytes memory) {
    return _sent[index];
  }

  function lastSent() external view returns (bytes memory) {
    return _sent[_sent.length - 1];
  }

  function sendMessage(
    uint32 destinationDomain,
    bytes32 recipient,
    bytes32 destinationCaller,
    uint32 minFinalityThreshold,
    bytes calldata messageBody
  ) external {
    _send(
      destinationDomain,
      bytes32(uint256(uint160(msg.sender))),
      recipient,
      destinationCaller,
      minFinalityThreshold,
      messageBody
    );
  }

  /// Entry point for the token messenger; the header sender is the messenger itself.
  function sendFromMessenger(
    uint32 destinationDomain,
    bytes32 recipient,
    bytes32 destinationCaller,
    uint32 minFinalityThreshold,
    bytes calldata messageBody
  ) external {
    require(msg.sender == tokenMessenger, 'MockTransmitter: not messenger');
    _send(
      destinationDomain,
      bytes32(uint256(uint160(msg.sender))),
      recipient,
      destinationCaller,
      minFinalityThreshold,
      messageBody
    );
  }

  /// Returns `message` with finality and executed fee stamped, plus its attestation.
  /// @param message Message as sent.
  /// @param finalityThresholdExecuted Finality to stamp.
  /// @param feeExecuted Fee to stamp into a burn body; ignored for data messages.
  /// @param isBurn Whether `message` is a burn message.
  function attest(bytes memory message, uint32 finalityThresholdExecuted, uint256 feeExecuted, bool isBurn)
    external
    pure
    returns (bytes memory stamped, bytes memory attestation)
  {
    stamped = message;
    assembly {
      let base := add(stamped, 32)
      // finalityThresholdExecuted is 4 bytes at offset 144.
      let word := mload(add(base, 144))
      word := or(and(word, not(shl(224, 0xffffffff))), shl(224, finalityThresholdExecuted))
      mstore(add(base, 144), word)
      // feeExecuted is 32 bytes at body offset 164 (absolute 312).
      if isBurn { mstore(add(base, 312), feeExecuted) }
    }
    attestation = abi.encodePacked(keccak256(stamped));
  }

  function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool) {
    if (isFailingReceives) return false;
    require(
      keccak256(attestation) == keccak256(abi.encodePacked(keccak256(message))), 'MockTransmitter: bad attestation'
    );
    uint32 sourceDomain = uint32(bytes4(message[4:8]));
    uint32 destinationDomain = uint32(bytes4(message[8:12]));
    bytes32 nonce = bytes32(message[12:44]);
    bytes32 sender = bytes32(message[44:76]);
    address recipient = address(uint160(uint256(bytes32(message[76:108]))));
    bytes32 destinationCaller = bytes32(message[108:140]);
    uint32 finalityThresholdExecuted = uint32(bytes4(message[144:148]));
    require(destinationDomain == localDomain, 'MockTransmitter: wrong domain');
    require(
      destinationCaller == bytes32(0) || destinationCaller == bytes32(uint256(uint160(msg.sender))),
      'MockTransmitter: wrong caller'
    );
    require(!usedNonces[sourceDomain][nonce], 'MockTransmitter: nonce used');
    usedNonces[sourceDomain][nonce] = true;

    bytes calldata body = message[148:];
    bool isHandled = finalityThresholdExecuted >= 2000
      ? IMessageHandlerV2(recipient)
        .handleReceiveFinalizedMessage(sourceDomain, sender, finalityThresholdExecuted, body)
      : IMessageHandlerV2(recipient)
        .handleReceiveUnfinalizedMessage(sourceDomain, sender, finalityThresholdExecuted, body);
    require(isHandled, 'MockTransmitter: handler failed');
    return true;
  }

  function _send(
    uint32 destinationDomain,
    bytes32 sender,
    bytes32 recipient,
    bytes32 destinationCaller,
    uint32 minFinalityThreshold,
    bytes calldata messageBody
  ) private {
    bytes32 nonce = keccak256(abi.encode(localDomain, ++nonceCounter));
    bytes memory message = abi.encodePacked(
      uint32(1),
      localDomain,
      destinationDomain,
      nonce,
      sender,
      recipient,
      destinationCaller,
      minFinalityThreshold,
      uint32(0),
      messageBody
    );
    _sent.push(message);
    emit MessageSent(message);
  }
}

/// Circle TokenMessengerV2 simulation: burns on deposit and mints `amount - feeExecuted` on receipt.
contract MockTokenMessengerV2 is IMessageHandlerV2 {
  MockMessageTransmitterV2 public immutable transmitter;
  MockTokenMinterV2 public immutable minter;
  mapping(uint32 domain => bytes32) public remoteTokenMessengers;
  address public feeRecipient = address(0xFEE);

  constructor(MockMessageTransmitterV2 transmitter_, MockTokenMinterV2 minter_) {
    transmitter = transmitter_;
    minter = minter_;
  }

  function localMessageTransmitter() external view returns (address) {
    return address(transmitter);
  }

  function localMinter() external view returns (address) {
    return address(minter);
  }

  function setRemoteTokenMessenger(uint32 domain, bytes32 messenger) external {
    remoteTokenMessengers[domain] = messenger;
  }

  function depositForBurnWithHook(
    uint256 amount,
    uint32 destinationDomain,
    bytes32 mintRecipient,
    address burnToken,
    bytes32 destinationCaller,
    uint256 maxFee,
    uint32 minFinalityThreshold,
    bytes calldata hookData
  ) external {
    require(amount > 0 && maxFee < amount, 'MockMessenger: bad amount');
    IERC20(burnToken).transferFrom(msg.sender, address(this), amount);
    MockERC20(burnToken).burn(address(this), amount);
    bytes memory body = abi.encodePacked(
      uint32(1),
      bytes32(uint256(uint160(burnToken))),
      mintRecipient,
      amount,
      bytes32(uint256(uint160(msg.sender))),
      maxFee,
      uint256(0),
      uint256(0),
      hookData
    );
    transmitter.sendFromMessenger(
      destinationDomain, remoteTokenMessengers[destinationDomain], destinationCaller, minFinalityThreshold, body
    );
  }

  function handleReceiveFinalizedMessage(uint32 sourceDomain, bytes32 sender, uint32, bytes calldata body)
    external
    returns (bool)
  {
    return _mint(sourceDomain, sender, body);
  }

  function handleReceiveUnfinalizedMessage(uint32 sourceDomain, bytes32 sender, uint32, bytes calldata body)
    external
    returns (bool)
  {
    return _mint(sourceDomain, sender, body);
  }

  function _mint(uint32 sourceDomain, bytes32 sender, bytes calldata body) private returns (bool) {
    require(msg.sender == address(transmitter), 'MockMessenger: not transmitter');
    require(sender == remoteTokenMessengers[sourceDomain], 'MockMessenger: unknown remote messenger');
    bytes32 burnToken = bytes32(body[4:36]);
    address mintRecipient = address(uint160(uint256(bytes32(body[36:68]))));
    uint256 amount = uint256(bytes32(body[68:100]));
    uint256 feeExecuted = uint256(bytes32(body[164:196]));
    address localToken = minter.getLocalToken(sourceDomain, burnToken);
    require(localToken != address(0), 'MockMessenger: unknown token');
    MockERC20(localToken).mint(mintRecipient, amount - feeExecuted);
    if (feeExecuted > 0) MockERC20(localToken).mint(feeRecipient, feeExecuted);
    return true;
  }
}
