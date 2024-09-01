export const abi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'feeCollector_', type: 'address', internalType: 'address' },
      { name: 'wormhole_', type: 'address', internalType: 'address' },
      { name: 'chainId_', type: 'uint16', internalType: 'uint16' },
      { name: 'wormholeFinality_', type: 'uint8', internalType: 'uint8' }
    ],
    stateMutability: 'nonpayable'
  },
  { type: 'fallback', stateMutability: 'payable' },
  { type: 'receive', stateMutability: 'payable' },
  {
    type: 'function',
    name: 'MAX_PAYABLES_TOKENS',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'chainId',
    inputs: [],
    outputs: [{ name: '', type: 'uint16', internalType: 'uint16' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'chainStats',
    inputs: [],
    outputs: [
      { name: 'usersCount', type: 'uint256', internalType: 'uint256' },
      { name: 'payablesCount', type: 'uint256', internalType: 'uint256' },
      { name: 'paymentsCount', type: 'uint256', internalType: 'uint256' },
      { name: 'withdrawalsCount', type: 'uint256', internalType: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'closePayable',
    inputs: [{ name: 'payableId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'createPayable',
    inputs: [
      {
        name: 'allowedTokensAndAmounts',
        type: 'tuple[]',
        internalType: 'struct CbState.TokenAndAmount[]',
        components: [
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    outputs: [{ name: 'payableId', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'decodeCompletePaymentPayload',
    inputs: [{ name: 'encoded', type: 'bytes', internalType: 'bytes' }],
    outputs: [
      {
        name: 'parsed',
        type: 'tuple',
        internalType: 'struct CbPayload.CompletePaymentPayload',
        components: [
          { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
          { name: 'wallet', type: 'bytes32', internalType: 'bytes32' },
          { name: 'token', type: 'bytes32', internalType: 'bytes32' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' },
          { name: 'payableCount', type: 'uint256', internalType: 'uint256' },
          { name: 'timestamp', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    name: 'decodeStartPaymentPayload',
    inputs: [{ name: 'encoded', type: 'bytes', internalType: 'bytes' }],
    outputs: [
      {
        name: 'parsed',
        type: 'tuple',
        internalType: 'struct CbPayload.StartPaymentPayload',
        components: [
          { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
          { name: 'payerCount', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    name: 'encodeCompletePaymentPayload',
    inputs: [
      {
        name: 'payload',
        type: 'tuple',
        internalType: 'struct CbPayload.CompletePaymentPayload',
        components: [
          { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
          { name: 'wallet', type: 'bytes32', internalType: 'bytes32' },
          { name: 'token', type: 'bytes32', internalType: 'bytes32' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' },
          { name: 'payableCount', type: 'uint256', internalType: 'uint256' },
          { name: 'timestamp', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    outputs: [{ name: 'encoded', type: 'bytes', internalType: 'bytes' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    name: 'encodeStartPaymentPayload',
    inputs: [
      {
        name: 'payload',
        type: 'tuple',
        internalType: 'struct CbPayload.StartPaymentPayload',
        components: [
          { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
          { name: 'payerCount', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    outputs: [{ name: 'encoded', type: 'bytes', internalType: 'bytes' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    name: 'feeCollector',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getAllowedTokensAndAmounts',
    inputs: [{ name: 'payableId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct CbState.TokenAndAmount[]',
        components: [
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getBalances',
    inputs: [{ name: 'payableId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct CbState.TokenAndAmount[]',
        components: [
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getPayableChainPaymentsCount',
    inputs: [
      { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'chainId_', type: 'uint16', internalType: 'uint16' }
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getPayablePaymentDetails',
    inputs: [{ name: 'paymentId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CbState.TokenAndAmount',
        components: [
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getUserPaymentDetails',
    inputs: [{ name: 'paymentId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CbState.TokenAndAmount',
        components: [
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getWithdrawalDetails',
    inputs: [
      { name: 'withdrawalId', type: 'bytes32', internalType: 'bytes32' }
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CbState.TokenAndAmount',
        components: [
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'maxFeesPerToken',
    inputs: [{ name: '', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'ownerWithdraw',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'pay',
    inputs: [
      { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: 'paymentId', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'payableChainPaymentIds',
    inputs: [
      { name: '', type: 'bytes32', internalType: 'bytes32' },
      { name: '', type: 'uint16', internalType: 'uint16' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'payableChainPaymentsCount',
    inputs: [
      { name: '', type: 'bytes32', internalType: 'bytes32' },
      { name: '', type: 'uint16', internalType: 'uint16' }
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'payablePaymentIds',
    inputs: [
      { name: '', type: 'bytes32', internalType: 'bytes32' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'payablePayments',
    inputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'payer', type: 'bytes32', internalType: 'bytes32' },
      { name: 'payerChainId', type: 'uint16', internalType: 'uint16' },
      { name: 'localChainCount', type: 'uint256', internalType: 'uint256' },
      { name: 'payableCount', type: 'uint256', internalType: 'uint256' },
      { name: 'payerCount', type: 'uint256', internalType: 'uint256' },
      { name: 'timestamp', type: 'uint256', internalType: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'payableWithdrawalIds',
    inputs: [
      { name: '', type: 'bytes32', internalType: 'bytes32' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'payables',
    inputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      { name: 'host', type: 'address', internalType: 'address' },
      { name: 'chainCount', type: 'uint256', internalType: 'uint256' },
      { name: 'hostCount', type: 'uint256', internalType: 'uint256' },
      { name: 'createdAt', type: 'uint256', internalType: 'uint256' },
      { name: 'paymentsCount', type: 'uint256', internalType: 'uint256' },
      { name: 'withdrawalsCount', type: 'uint256', internalType: 'uint256' },
      {
        name: 'allowedTokensAndAmountsCount',
        type: 'uint8',
        internalType: 'uint8'
      },
      { name: 'balancesCount', type: 'uint8', internalType: 'uint8' },
      { name: 'isClosed', type: 'bool', internalType: 'bool' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'registerForeignContract',
    inputs: [
      { name: 'emitterChainId', type: 'uint16', internalType: 'uint16' },
      { name: 'emitterAddress', type: 'bytes32', internalType: 'bytes32' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'registeredEmitters',
    inputs: [{ name: '', type: 'uint16', internalType: 'uint16' }],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'reopenPayable',
    inputs: [{ name: 'payableId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'updateMaxWithdrawalFee',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'maxFee', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'updatePayableAllowedTokensAndAmounts',
    inputs: [
      { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
      {
        name: 'allowedTokensAndAmounts',
        type: 'tuple[]',
        internalType: 'struct CbState.TokenAndAmount[]',
        components: [
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'userPayableIds',
    inputs: [
      { name: '', type: 'address', internalType: 'address' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'userPaymentIds',
    inputs: [
      { name: '', type: 'address', internalType: 'address' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'userPayments',
    inputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'payer', type: 'address', internalType: 'address' },
      { name: 'payableChainId', type: 'uint16', internalType: 'uint16' },
      { name: 'chainCount', type: 'uint256', internalType: 'uint256' },
      { name: 'payerCount', type: 'uint256', internalType: 'uint256' },
      { name: 'payableCount', type: 'uint256', internalType: 'uint256' },
      { name: 'timestamp', type: 'uint256', internalType: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'userWithdrawalIds',
    inputs: [
      { name: '', type: 'address', internalType: 'address' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'users',
    inputs: [{ name: '', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'chainCount', type: 'uint256', internalType: 'uint256' },
      { name: 'payablesCount', type: 'uint256', internalType: 'uint256' },
      { name: 'paymentsCount', type: 'uint256', internalType: 'uint256' },
      { name: 'withdrawalsCount', type: 'uint256', internalType: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [
      { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [
      { name: 'withdrawalId', type: 'bytes32', internalType: 'bytes32' }
    ],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'withdrawals',
    inputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'host', type: 'address', internalType: 'address' },
      { name: 'chainCount', type: 'uint256', internalType: 'uint256' },
      { name: 'hostCount', type: 'uint256', internalType: 'uint256' },
      { name: 'payableCount', type: 'uint256', internalType: 'uint256' },
      { name: 'timestamp', type: 'uint256', internalType: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'wormhole',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'wormholeFinality',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    name: 'ClosedPayable',
    inputs: [
      {
        name: 'payableId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      { name: 'host', type: 'address', indexed: true, internalType: 'address' }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'CreatedPayable',
    inputs: [
      {
        name: 'payableId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      { name: 'host', type: 'address', indexed: true, internalType: 'address' },
      {
        name: 'chainCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256'
      },
      {
        name: 'hostCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'InitializedUser',
    inputs: [
      { name: 'user', type: 'address', indexed: true, internalType: 'address' },
      {
        name: 'chainCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'OwnerWithdrew',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: false,
        internalType: 'address'
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      {
        name: 'previousOwner',
        type: 'address',
        indexed: true,
        internalType: 'address'
      },
      {
        name: 'newOwner',
        type: 'address',
        indexed: true,
        internalType: 'address'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'PayablePaid',
    inputs: [
      {
        name: 'payableId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      {
        name: 'payer',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      {
        name: 'paymentId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      {
        name: 'payerChainId',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16'
      },
      {
        name: 'chainCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256'
      },
      {
        name: 'payableCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'RegisteredForeignContract',
    inputs: [
      {
        name: 'chainId',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16'
      },
      {
        name: 'emitterAddress',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'ReopenedPayable',
    inputs: [
      {
        name: 'payableId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      { name: 'host', type: 'address', indexed: true, internalType: 'address' }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'UpdatedMaxWithdrawalFee',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: false,
        internalType: 'address'
      },
      {
        name: 'maxFee',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'UpdatedPayableAllowedTokensAndAmounts',
    inputs: [
      {
        name: 'payableId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      { name: 'host', type: 'address', indexed: true, internalType: 'address' }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'UserPaid',
    inputs: [
      {
        name: 'payableId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      {
        name: 'payer',
        type: 'address',
        indexed: true,
        internalType: 'address'
      },
      {
        name: 'paymentId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      {
        name: 'payableChainId',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16'
      },
      {
        name: 'chainCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256'
      },
      {
        name: 'payerCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'Withdrew',
    inputs: [
      {
        name: 'payableId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      { name: 'host', type: 'address', indexed: true, internalType: 'address' },
      {
        name: 'withdrawalId',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32'
      },
      {
        name: 'chainCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256'
      },
      {
        name: 'payableCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256'
      },
      {
        name: 'hostCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256'
      }
    ],
    anonymous: false
  },
  { type: 'error', name: 'EmitterNotRegistered', inputs: [] },
  { type: 'error', name: 'IncorrectPaymentValue', inputs: [] },
  { type: 'error', name: 'InsufficientPaymentValue', inputs: [] },
  { type: 'error', name: 'InsufficientWithdrawAmount', inputs: [] },
  { type: 'error', name: 'InvalidChainId', inputs: [] },
  { type: 'error', name: 'InvalidFeeCollector', inputs: [] },
  { type: 'error', name: 'InvalidPageNumber', inputs: [] },
  { type: 'error', name: 'InvalidPayableId', inputs: [] },
  { type: 'error', name: 'InvalidPayload', inputs: [] },
  { type: 'error', name: 'InvalidPaymentId', inputs: [] },
  { type: 'error', name: 'InvalidTokenAddress', inputs: [] },
  { type: 'error', name: 'InvalidWithdrawalId', inputs: [] },
  { type: 'error', name: 'InvalidWormholeAddress', inputs: [] },
  { type: 'error', name: 'InvalidWormholeChainId', inputs: [] },
  { type: 'error', name: 'InvalidWormholeEmitterAddress', inputs: [] },
  { type: 'error', name: 'InvalidWormholeFinality', inputs: [] },
  { type: 'error', name: 'MatchingTokenAndAmountNotFound', inputs: [] },
  { type: 'error', name: 'MaxPayableTokensCapacityReached', inputs: [] },
  { type: 'error', name: 'NoBalanceForWithdrawalToken', inputs: [] },
  { type: 'error', name: 'NotYourPayable', inputs: [] },
  {
    type: 'error',
    name: 'OutOfBounds',
    inputs: [
      { name: 'offset', type: 'uint256', internalType: 'uint256' },
      { name: 'length', type: 'uint256', internalType: 'uint256' }
    ]
  },
  {
    type: 'error',
    name: 'OwnableInvalidOwner',
    inputs: [{ name: 'owner', type: 'address', internalType: 'address' }]
  },
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }]
  },
  { type: 'error', name: 'PayableIsAlreadyClosed', inputs: [] },
  { type: 'error', name: 'PayableIsClosed', inputs: [] },
  { type: 'error', name: 'PayableIsNotClosed', inputs: [] },
  { type: 'error', name: 'ReentrancyGuardReentrantCall', inputs: [] },
  { type: 'error', name: 'UnsuccessfulPayment', inputs: [] },
  { type: 'error', name: 'UnsuccessfulWithdrawal', inputs: [] },
  { type: 'error', name: 'ZeroAmountSpecified', inputs: [] }
] as const;
