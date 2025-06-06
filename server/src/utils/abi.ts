export const abi = [
  { type: 'fallback', stateMutability: 'payable' },
  { type: 'receive', stateMutability: 'payable' },
  {
    type: 'function',
    name: 'UPGRADE_INTERFACE_VERSION',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'activities',
    inputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      { name: 'chainCount', type: 'uint256', internalType: 'uint256' },
      { name: 'userCount', type: 'uint256', internalType: 'uint256' },
      { name: 'payableCount', type: 'uint256', internalType: 'uint256' },
      { name: 'timestamp', type: 'uint256', internalType: 'uint256' },
      { name: 'entity', type: 'bytes32', internalType: 'bytes32' },
      {
        name: 'activityType',
        type: 'uint8',
        internalType: 'enum CbStructs.ActivityType'
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'allowPaymentsForToken',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'chainActivityIds',
    inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'chainForeignPayableIds',
    inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'chainPayableIds',
    inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'chainPayablePaymentIds',
    inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'chainStats',
    inputs: [],
    outputs: [
      { name: 'usersCount', type: 'uint256', internalType: 'uint256' },
      { name: 'payablesCount', type: 'uint256', internalType: 'uint256' },
      {
        name: 'foreignPayablesCount',
        type: 'uint256',
        internalType: 'uint256'
      },
      { name: 'userPaymentsCount', type: 'uint256', internalType: 'uint256' },
      {
        name: 'payablePaymentsCount',
        type: 'uint256',
        internalType: 'uint256'
      },
      { name: 'withdrawalsCount', type: 'uint256', internalType: 'uint256' },
      { name: 'activitiesCount', type: 'uint256', internalType: 'uint256' },
      {
        name: 'publishedWormholeMessagesCount',
        type: 'uint256',
        internalType: 'uint256'
      },
      {
        name: 'consumedWormholeMessagesCount',
        type: 'uint256',
        internalType: 'uint256'
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'chainUserAddresses',
    inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'chainUserPaymentIds',
    inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'chainWithdrawalIds',
    inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'circleBridge',
    inputs: [],
    outputs: [
      { name: '', type: 'address', internalType: 'contract ICircleBridge' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'circleTokenMinter',
    inputs: [],
    outputs: [
      { name: '', type: 'address', internalType: 'contract ITokenMinter' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'circleTransmitter',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IMessageTransmitter'
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'closePayable',
    inputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: 'wormholeMessageSequence',
        type: 'uint64',
        internalType: 'uint64'
      }
    ],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'config',
    inputs: [],
    outputs: [
      { name: 'wormholeFinality', type: 'uint8', internalType: 'uint8' },
      { name: 'wormholeChainId', type: 'uint16', internalType: 'uint16' },
      {
        name: 'withdrawalFeePercentage',
        type: 'uint16',
        internalType: 'uint16'
      },
      { name: 'circleDomain', type: 'uint32', internalType: 'uint32' },
      { name: 'feeCollector', type: 'address', internalType: 'address' },
      { name: 'wormhole', type: 'address', internalType: 'address' },
      { name: 'circleBridge', type: 'address', internalType: 'address' },
      { name: 'circleTokenMinter', type: 'address', internalType: 'address' },
      { name: 'circleTransmitter', type: 'address', internalType: 'address' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'consumedWormholeMessages',
    inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'createPayable',
    inputs: [
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct CbStructs.TokenAndAmount[]',
        components: [
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' }
        ]
      },
      { name: '', type: 'bool', internalType: 'bool' }
    ],
    outputs: [
      { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
      {
        name: 'wormholeMessageSequence',
        type: 'uint64',
        internalType: 'uint64'
      }
    ],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'forForeignChainMatchingTokenAddresses',
    inputs: [
      { name: '', type: 'uint16', internalType: 'uint16' },
      { name: '', type: 'bytes32', internalType: 'bytes32' }
    ],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'forTokenAddressMatchingForeignChainTokens',
    inputs: [
      { name: '', type: 'address', internalType: 'address' },
      { name: '', type: 'uint16', internalType: 'uint16' }
    ],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'foreignPayableAllowedTokensAndAmounts',
    inputs: [
      { name: '', type: 'bytes32', internalType: 'bytes32' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [
      { name: 'token', type: 'bytes32', internalType: 'bytes32' },
      { name: 'amount', type: 'uint64', internalType: 'uint64' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'foreignPayables',
    inputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      { name: 'chainId', type: 'uint16', internalType: 'uint16' },
      {
        name: 'allowedTokensAndAmountsCount',
        type: 'uint8',
        internalType: 'uint8'
      },
      { name: 'isClosed', type: 'bool', internalType: 'bool' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getActivityRecord',
    inputs: [{ name: 'activityId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CbStructs.ActivityRecord',
        components: [
          { name: 'chainCount', type: 'uint256', internalType: 'uint256' },
          { name: 'userCount', type: 'uint256', internalType: 'uint256' },
          { name: 'payableCount', type: 'uint256', internalType: 'uint256' },
          { name: 'timestamp', type: 'uint256', internalType: 'uint256' },
          { name: 'entity', type: 'bytes32', internalType: 'bytes32' },
          {
            name: 'activityType',
            type: 'uint8',
            internalType: 'enum CbStructs.ActivityType'
          }
        ]
      }
    ],
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
        internalType: 'struct CbStructs.TokenAndAmount[]',
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
        internalType: 'struct CbStructs.TokenAndAmount[]',
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
    name: 'getChainStats',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CbStructs.ChainStats',
        components: [
          { name: 'usersCount', type: 'uint256', internalType: 'uint256' },
          { name: 'payablesCount', type: 'uint256', internalType: 'uint256' },
          {
            name: 'foreignPayablesCount',
            type: 'uint256',
            internalType: 'uint256'
          },
          {
            name: 'userPaymentsCount',
            type: 'uint256',
            internalType: 'uint256'
          },
          {
            name: 'payablePaymentsCount',
            type: 'uint256',
            internalType: 'uint256'
          },
          {
            name: 'withdrawalsCount',
            type: 'uint256',
            internalType: 'uint256'
          },
          { name: 'activitiesCount', type: 'uint256', internalType: 'uint256' },
          {
            name: 'publishedWormholeMessagesCount',
            type: 'uint256',
            internalType: 'uint256'
          },
          {
            name: 'consumedWormholeMessagesCount',
            type: 'uint256',
            internalType: 'uint256'
          }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getConfig',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CbStructs.Config',
        components: [
          { name: 'wormholeFinality', type: 'uint8', internalType: 'uint8' },
          { name: 'wormholeChainId', type: 'uint16', internalType: 'uint16' },
          {
            name: 'withdrawalFeePercentage',
            type: 'uint16',
            internalType: 'uint16'
          },
          { name: 'circleDomain', type: 'uint32', internalType: 'uint32' },
          { name: 'feeCollector', type: 'address', internalType: 'address' },
          { name: 'wormhole', type: 'address', internalType: 'address' },
          { name: 'circleBridge', type: 'address', internalType: 'address' },
          {
            name: 'circleTokenMinter',
            type: 'address',
            internalType: 'address'
          },
          {
            name: 'circleTransmitter',
            type: 'address',
            internalType: 'address'
          }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getForForeignChainMatchingTokenAddress',
    inputs: [
      { name: 'chainId', type: 'uint16', internalType: 'uint16' },
      { name: 'foreignToken', type: 'bytes32', internalType: 'bytes32' }
    ],
    outputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getForTokenAddressMatchingForeignChainToken',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'chainId', type: 'uint16', internalType: 'uint16' }
    ],
    outputs: [
      { name: 'foreignToken', type: 'bytes32', internalType: 'bytes32' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getForeignPayable',
    inputs: [{ name: 'payableId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CbStructs.PayableForeign',
        components: [
          { name: 'chainId', type: 'uint16', internalType: 'uint16' },
          {
            name: 'allowedTokensAndAmountsCount',
            type: 'uint8',
            internalType: 'uint8'
          },
          { name: 'isClosed', type: 'bool', internalType: 'bool' }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getForeignPayableAllowedTokensAndAmounts',
    inputs: [{ name: 'payableId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct CbStructs.TokenAndAmountForeign[]',
        components: [
          { name: 'token', type: 'bytes32', internalType: 'bytes32' },
          { name: 'amount', type: 'uint64', internalType: 'uint64' }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getPayable',
    inputs: [{ name: 'payableId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CbStructs.Payable',
        components: [
          { name: 'host', type: 'address', internalType: 'address' },
          { name: 'chainCount', type: 'uint256', internalType: 'uint256' },
          { name: 'hostCount', type: 'uint256', internalType: 'uint256' },
          { name: 'createdAt', type: 'uint256', internalType: 'uint256' },
          { name: 'paymentsCount', type: 'uint256', internalType: 'uint256' },
          {
            name: 'withdrawalsCount',
            type: 'uint256',
            internalType: 'uint256'
          },
          { name: 'activitiesCount', type: 'uint256', internalType: 'uint256' },
          {
            name: 'allowedTokensAndAmountsCount',
            type: 'uint8',
            internalType: 'uint8'
          },
          { name: 'balancesCount', type: 'uint8', internalType: 'uint8' },
          { name: 'isClosed', type: 'bool', internalType: 'bool' },
          { name: 'isAutoWithdraw', type: 'bool', internalType: 'bool' }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getPayableChainPaymentIds',
    inputs: [
      { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'chainId_', type: 'uint16', internalType: 'uint16' }
    ],
    outputs: [{ name: '', type: 'bytes32[]', internalType: 'bytes32[]' }],
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
    name: 'getPayablePayment',
    inputs: [{ name: 'paymentId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CbStructs.PayablePayment',
        components: [
          { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
          { name: 'payer', type: 'bytes32', internalType: 'bytes32' },
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'chainCount', type: 'uint256', internalType: 'uint256' },
          { name: 'payerChainId', type: 'uint16', internalType: 'uint16' },
          { name: 'localChainCount', type: 'uint256', internalType: 'uint256' },
          { name: 'payableCount', type: 'uint256', internalType: 'uint256' },
          { name: 'timestamp', type: 'uint256', internalType: 'uint256' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getTokenDetails',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CbStructs.TokenDetails',
        components: [
          { name: 'isSupported', type: 'bool', internalType: 'bool' },
          { name: 'token', type: 'address', internalType: 'address' },
          {
            name: 'maxWithdrawalFees',
            type: 'uint256',
            internalType: 'uint256'
          },
          { name: 'totalUserPaid', type: 'uint256', internalType: 'uint256' },
          {
            name: 'totalPayableReceived',
            type: 'uint256',
            internalType: 'uint256'
          },
          { name: 'totalWithdrawn', type: 'uint256', internalType: 'uint256' },
          {
            name: 'totalWithdrawalFeesCollected',
            type: 'uint256',
            internalType: 'uint256'
          }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getUser',
    inputs: [{ name: 'wallet', type: 'address', internalType: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CbStructs.User',
        components: [
          { name: 'chainCount', type: 'uint256', internalType: 'uint256' },
          { name: 'payablesCount', type: 'uint256', internalType: 'uint256' },
          { name: 'paymentsCount', type: 'uint256', internalType: 'uint256' },
          {
            name: 'withdrawalsCount',
            type: 'uint256',
            internalType: 'uint256'
          },
          { name: 'activitiesCount', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getUserPayment',
    inputs: [{ name: 'paymentId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CbStructs.UserPayment',
        components: [
          { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
          { name: 'payer', type: 'address', internalType: 'address' },
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'payableChainId', type: 'uint16', internalType: 'uint16' },
          { name: 'chainCount', type: 'uint256', internalType: 'uint256' },
          { name: 'payerCount', type: 'uint256', internalType: 'uint256' },
          { name: 'timestamp', type: 'uint256', internalType: 'uint256' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getWithdrawal',
    inputs: [
      { name: 'withdrawalId', type: 'bytes32', internalType: 'bytes32' }
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CbStructs.Withdrawal',
        components: [
          { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
          { name: 'host', type: 'address', internalType: 'address' },
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'chainCount', type: 'uint256', internalType: 'uint256' },
          { name: 'hostCount', type: 'uint256', internalType: 'uint256' },
          { name: 'payableCount', type: 'uint256', internalType: 'uint256' },
          { name: 'timestamp', type: 'uint256', internalType: 'uint256' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getWormholeMessageFee',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'hasWormhole',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      { name: 'feeCollector', type: 'address', internalType: 'address' },
      { name: 'feePercent', type: 'uint16', internalType: 'uint16' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
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
      { name: '', type: 'bytes32', internalType: 'bytes32' },
      { name: '', type: 'address', internalType: 'address' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [
      { name: 'userPaymentId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'payablePaymentId', type: 'bytes32', internalType: 'bytes32' }
    ],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'payForeignWithCircle',
    inputs: [
      { name: '', type: 'bytes32', internalType: 'bytes32' },
      { name: '', type: 'address', internalType: 'address' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [
      { name: 'userPaymentId', type: 'bytes32', internalType: 'bytes32' },
      {
        name: 'wormholeMessageSequence',
        type: 'uint64',
        internalType: 'uint64'
      }
    ],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'payableActivityIds',
    inputs: [
      { name: '', type: 'bytes32', internalType: 'bytes32' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'payableAllowedTokensAndAmounts',
    inputs: [
      { name: '', type: 'bytes32', internalType: 'bytes32' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'payableBalances',
    inputs: [
      { name: '', type: 'bytes32', internalType: 'bytes32' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' }
    ],
    stateMutability: 'view'
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
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'chainCount', type: 'uint256', internalType: 'uint256' },
      { name: 'payerChainId', type: 'uint16', internalType: 'uint16' },
      { name: 'localChainCount', type: 'uint256', internalType: 'uint256' },
      { name: 'payableCount', type: 'uint256', internalType: 'uint256' },
      { name: 'timestamp', type: 'uint256', internalType: 'uint256' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' }
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
      { name: 'activitiesCount', type: 'uint256', internalType: 'uint256' },
      {
        name: 'allowedTokensAndAmountsCount',
        type: 'uint8',
        internalType: 'uint8'
      },
      { name: 'balancesCount', type: 'uint8', internalType: 'uint8' },
      { name: 'isClosed', type: 'bool', internalType: 'bool' },
      { name: 'isAutoWithdraw', type: 'bool', internalType: 'bool' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'payablesLogic',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'perChainConsumedWormholeMessages',
    inputs: [
      { name: '', type: 'uint16', internalType: 'uint16' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'perChainConsumedWormholeMessagesCount',
    inputs: [{ name: '', type: 'uint16', internalType: 'uint16' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'proxiableUUID',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'publishPayableDetails',
    inputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: 'wormholeMessageSequence',
        type: 'uint64',
        internalType: 'uint64'
      }
    ],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'receiveForeignPaymentWithCircle',
    inputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct CbStructs.RedeemCirclePaymentParameters',
        components: [
          { name: 'wormholeEncoded', type: 'bytes', internalType: 'bytes' },
          { name: 'circleBridgeMessage', type: 'bytes', internalType: 'bytes' },
          { name: 'circleAttestation', type: 'bytes', internalType: 'bytes' }
        ]
      }
    ],
    outputs: [
      { name: 'payablePaymentId', type: 'bytes32', internalType: 'bytes32' }
    ],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'recordForeignPayableUpdate',
    inputs: [{ name: '', type: 'bytes', internalType: 'bytes' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'registerCircleDomainToWormholeChainId',
    inputs: [
      { name: 'circleDomain', type: 'uint32', internalType: 'uint32' },
      { name: 'chainId', type: 'uint16', internalType: 'uint16' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
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
    name: 'registerMatchingTokenForForeignChain',
    inputs: [
      { name: 'chainId', type: 'uint16', internalType: 'uint16' },
      { name: 'foreignToken', type: 'bytes32', internalType: 'bytes32' },
      { name: 'token', type: 'address', internalType: 'address' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'registeredForeignContracts',
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
    inputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: 'wormholeMessageSequence',
        type: 'uint64',
        internalType: 'uint64'
      }
    ],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'setFeeCollectorAddress',
    inputs: [
      { name: 'feeCollector', type: 'address', internalType: 'address' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'setPayablesLogic',
    inputs: [
      { name: 'payablesLogicAddress', type: 'address', internalType: 'address' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'setTransactionsLogic',
    inputs: [
      {
        name: 'transactionsLogicAddress',
        type: 'address',
        internalType: 'address'
      }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'setWithdrawalFeePercentage',
    inputs: [{ name: 'feePercent', type: 'uint16', internalType: 'uint16' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'setupWormholeAndCircle',
    inputs: [
      { name: 'wormhole', type: 'address', internalType: 'address' },
      { name: 'circleBridge', type: 'address', internalType: 'address' },
      { name: 'wormholeChainId', type: 'uint16', internalType: 'uint16' },
      { name: 'wormholeFinality', type: 'uint8', internalType: 'uint8' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'stopPaymentsForToken',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'tokenDetails',
    inputs: [{ name: '', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'isSupported', type: 'bool', internalType: 'bool' },
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'maxWithdrawalFees', type: 'uint256', internalType: 'uint256' },
      { name: 'totalUserPaid', type: 'uint256', internalType: 'uint256' },
      {
        name: 'totalPayableReceived',
        type: 'uint256',
        internalType: 'uint256'
      },
      { name: 'totalWithdrawn', type: 'uint256', internalType: 'uint256' },
      {
        name: 'totalWithdrawalFeesCollected',
        type: 'uint256',
        internalType: 'uint256'
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'transactionsLogic',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view'
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
    name: 'updateMaxWithdrawalFees',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'maxWithdrawalFees', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'updatePayableAllowedTokensAndAmounts',
    inputs: [
      { name: '', type: 'bytes32', internalType: 'bytes32' },
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct CbStructs.TokenAndAmount[]',
        components: [
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' }
        ]
      }
    ],
    outputs: [
      {
        name: 'wormholeMessageSequence',
        type: 'uint64',
        internalType: 'uint64'
      }
    ],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'updatePayableAutoWithdraw',
    inputs: [
      { name: '', type: 'bytes32', internalType: 'bytes32' },
      { name: '', type: 'bool', internalType: 'bool' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'upgradeToAndCall',
    inputs: [
      { name: 'newImplementation', type: 'address', internalType: 'address' },
      { name: 'data', type: 'bytes', internalType: 'bytes' }
    ],
    outputs: [],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'userActivityIds',
    inputs: [
      { name: '', type: 'address', internalType: 'address' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view'
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
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'payableChainId', type: 'uint16', internalType: 'uint16' },
      { name: 'chainCount', type: 'uint256', internalType: 'uint256' },
      { name: 'payerCount', type: 'uint256', internalType: 'uint256' },
      { name: 'timestamp', type: 'uint256', internalType: 'uint256' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' }
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
      { name: 'withdrawalsCount', type: 'uint256', internalType: 'uint256' },
      { name: 'activitiesCount', type: 'uint256', internalType: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [
      { name: '', type: 'bytes32', internalType: 'bytes32' },
      { name: '', type: 'address', internalType: 'address' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [
      { name: 'withdrawalId', type: 'bytes32', internalType: 'bytes32' }
    ],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'withdrawals',
    inputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      { name: 'payableId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'host', type: 'address', internalType: 'address' },
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'chainCount', type: 'uint256', internalType: 'uint256' },
      { name: 'hostCount', type: 'uint256', internalType: 'uint256' },
      { name: 'payableCount', type: 'uint256', internalType: 'uint256' },
      { name: 'timestamp', type: 'uint256', internalType: 'uint256' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'wormhole',
    inputs: [],
    outputs: [
      { name: '', type: 'address', internalType: 'contract IWormhole' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'event',
    name: 'AllowedPaymentsForToken',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: false,
        internalType: 'address'
      }
    ],
    anonymous: false
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
      {
        name: 'hostWallet',
        type: 'address',
        indexed: true,
        internalType: 'address'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'ConsumedWormholePayableMessage',
    inputs: [
      {
        name: 'payableId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      {
        name: 'chainId',
        type: 'uint16',
        indexed: true,
        internalType: 'uint16'
      },
      {
        name: 'vaaHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'ConsumedWormholePaymentMessage',
    inputs: [
      {
        name: 'payableId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      {
        name: 'chainId',
        type: 'uint16',
        indexed: true,
        internalType: 'uint16'
      },
      {
        name: 'vaaHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      }
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
      {
        name: 'hostWallet',
        type: 'address',
        indexed: true,
        internalType: 'address'
      },
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
    name: 'Initialized',
    inputs: [
      {
        name: 'version',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'InitializedUser',
    inputs: [
      {
        name: 'wallet',
        type: 'address',
        indexed: true,
        internalType: 'address'
      },
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
    name: 'PayableReceived',
    inputs: [
      {
        name: 'payableId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      {
        name: 'payerWallet',
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
    name: 'RegisteredCircleDomainToWormholeChainId',
    inputs: [
      {
        name: 'circleDomain',
        type: 'uint32',
        indexed: false,
        internalType: 'uint32'
      },
      {
        name: 'chainId',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16'
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
    name: 'RegisteredMatchingTokenForForeignChain',
    inputs: [
      {
        name: 'chainId',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16'
      },
      {
        name: 'foreignToken',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32'
      },
      {
        name: 'token',
        type: 'address',
        indexed: false,
        internalType: 'address'
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
      {
        name: 'hostWallet',
        type: 'address',
        indexed: true,
        internalType: 'address'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'SetFeeCollectorAddress',
    inputs: [
      {
        name: 'feeCollector',
        type: 'address',
        indexed: false,
        internalType: 'address'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'SetPayablesLogic',
    inputs: [
      {
        name: 'payablesLogicContract',
        type: 'address',
        indexed: false,
        internalType: 'address'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'SetTransactionsLogic',
    inputs: [
      {
        name: 'transactionsLogicContract',
        type: 'address',
        indexed: false,
        internalType: 'address'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'SetWithdrawalFeePercentage',
    inputs: [
      {
        name: 'feePercent',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'SetupWormholeAndCircle',
    inputs: [],
    anonymous: false
  },
  {
    type: 'event',
    name: 'StoppedPaymentsForToken',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: false,
        internalType: 'address'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'UpdatedMaxWithdrawalFees',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: false,
        internalType: 'address'
      },
      {
        name: 'maxWithdrawalFees',
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
      {
        name: 'hostWallet',
        type: 'address',
        indexed: true,
        internalType: 'address'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'UpdatedPayableAutoWithdrawStatus',
    inputs: [
      {
        name: 'payableId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
      {
        name: 'hostWallet',
        type: 'address',
        indexed: true,
        internalType: 'address'
      },
      {
        name: 'isAutoWithdraw',
        type: 'bool',
        indexed: false,
        internalType: 'bool'
      }
    ],
    anonymous: false
  },
  {
    type: 'event',
    name: 'Upgraded',
    inputs: [
      {
        name: 'implementation',
        type: 'address',
        indexed: true,
        internalType: 'address'
      }
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
        name: 'payerWallet',
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
      {
        name: 'hostWallet',
        type: 'address',
        indexed: true,
        internalType: 'address'
      },
      {
        name: 'withdrawalId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32'
      },
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
    type: 'error',
    name: 'AddressEmptyCode',
    inputs: [{ name: 'target', type: 'address', internalType: 'address' }]
  },
  { type: 'error', name: 'CircleMintingFailed', inputs: [] },
  { type: 'error', name: 'CircleNonceMismatch', inputs: [] },
  { type: 'error', name: 'CircleRecipientMismatch', inputs: [] },
  { type: 'error', name: 'CircleSenderMismatch', inputs: [] },
  { type: 'error', name: 'CircleSourceDomainMismatch', inputs: [] },
  { type: 'error', name: 'CircleTargetDomainMismatch', inputs: [] },
  { type: 'error', name: 'CircleTokenMismatch', inputs: [] },
  {
    type: 'error',
    name: 'ERC1967InvalidImplementation',
    inputs: [
      { name: 'implementation', type: 'address', internalType: 'address' }
    ]
  },
  { type: 'error', name: 'ERC1967NonPayable', inputs: [] },
  { type: 'error', name: 'EmitterNotRegistered', inputs: [] },
  { type: 'error', name: 'FailedCall', inputs: [] },
  { type: 'error', name: 'HasAlreadyConsumedMessage', inputs: [] },
  { type: 'error', name: 'IncorrectPaymentValue', inputs: [] },
  { type: 'error', name: 'IncorrectWormholeFees', inputs: [] },
  { type: 'error', name: 'InsufficientPaymentValue', inputs: [] },
  { type: 'error', name: 'InsufficientWithdrawAmount', inputs: [] },
  { type: 'error', name: 'InsufficientWormholeFees', inputs: [] },
  { type: 'error', name: 'InvalidActivityId', inputs: [] },
  { type: 'error', name: 'InvalidChainId', inputs: [] },
  { type: 'error', name: 'InvalidChainIdOrForeignToken', inputs: [] },
  { type: 'error', name: 'InvalidCircleBridge', inputs: [] },
  { type: 'error', name: 'InvalidCircleTokenMinter', inputs: [] },
  { type: 'error', name: 'InvalidCircleTransmitter', inputs: [] },
  { type: 'error', name: 'InvalidFeeCollector', inputs: [] },
  { type: 'error', name: 'InvalidInitialization', inputs: [] },
  { type: 'error', name: 'InvalidLocalCircleDomain', inputs: [] },
  { type: 'error', name: 'InvalidPayableId', inputs: [] },
  { type: 'error', name: 'InvalidPayablePayloadActionType', inputs: [] },
  { type: 'error', name: 'InvalidPayablesLogic', inputs: [] },
  { type: 'error', name: 'InvalidPayload', inputs: [] },
  { type: 'error', name: 'InvalidPaymentId', inputs: [] },
  { type: 'error', name: 'InvalidTokenAddress', inputs: [] },
  { type: 'error', name: 'InvalidTransactionsLogic', inputs: [] },
  { type: 'error', name: 'InvalidWalletAddress', inputs: [] },
  { type: 'error', name: 'InvalidWithdrawalId', inputs: [] },
  { type: 'error', name: 'InvalidWormholeAddress', inputs: [] },
  { type: 'error', name: 'InvalidWormholeChainId', inputs: [] },
  { type: 'error', name: 'InvalidWormholeEmitterAddress', inputs: [] },
  { type: 'error', name: 'InvalidWormholeFinality', inputs: [] },
  { type: 'error', name: 'MatchingTokenAndAmountNotFound', inputs: [] },
  { type: 'error', name: 'NoBalanceForWithdrawalToken', inputs: [] },
  { type: 'error', name: 'NotInitializing', inputs: [] },
  { type: 'error', name: 'NotYourPayable', inputs: [] },
  { type: 'error', name: 'OnlyChainbillsCanCall', inputs: [] },
  { type: 'error', name: 'OnlyLogicContractsCanCall', inputs: [] },
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
  { type: 'error', name: 'UUPSUnauthorizedCallContext', inputs: [] },
  {
    type: 'error',
    name: 'UUPSUnsupportedProxiableUUID',
    inputs: [{ name: 'slot', type: 'bytes32', internalType: 'bytes32' }]
  },
  { type: 'error', name: 'UnsuccessfulFeesWithdrawal', inputs: [] },
  { type: 'error', name: 'UnsuccessfulPayment', inputs: [] },
  { type: 'error', name: 'UnsuccessfulWithdrawal', inputs: [] },
  { type: 'error', name: 'UnsupportedToken', inputs: [] },
  { type: 'error', name: 'ZeroAmountSpecified', inputs: [] }
] as const;
