export default {
  version: '0.1.0',
  name: 'chainbills',
  constants: [
    {
      name: 'MAX_PAYABLES_DESCRIPTION_LENGTH',
      type: { defined: 'usize' },
      value: '3000'
    },
    { name: 'MAX_PAYABLES_TOKENS', type: { defined: 'usize' }, value: '20' }
  ],
  instructions: [
    {
      name: 'initializeGlobalStats',
      accounts: [
        { name: 'globalStats', isMut: true, isSigner: false },
        { name: 'thisProgram', isMut: false, isSigner: false },
        { name: 'thisProgramData', isMut: false, isSigner: false },
        { name: 'admin', isMut: true, isSigner: true },
        { name: 'systemProgram', isMut: false, isSigner: false }
      ],
      args: []
    },
    {
      name: 'initializeUser',
      accounts: [
        { name: 'user', isMut: true, isSigner: false },
        { name: 'globalStats', isMut: true, isSigner: false },
        { name: 'signer', isMut: true, isSigner: true },
        { name: 'systemProgram', isMut: false, isSigner: false }
      ],
      args: []
    },
    {
      name: 'initializePayable',
      accounts: [
        { name: 'payable', isMut: true, isSigner: false },
        { name: 'host', isMut: true, isSigner: false },
        { name: 'globalStats', isMut: true, isSigner: false },
        { name: 'signer', isMut: true, isSigner: true },
        { name: 'systemProgram', isMut: false, isSigner: false }
      ],
      args: [
        { name: 'description', type: 'string' },
        {
          name: 'tokensAndAmounts',
          type: { vec: { defined: 'TokenAndAmount' } }
        },
        { name: 'allowsFreePayments', type: 'bool' }
      ]
    },
    {
      name: 'closePayable',
      accounts: [
        { name: 'payable', isMut: true, isSigner: false },
        { name: 'host', isMut: false, isSigner: false },
        { name: 'signer', isMut: true, isSigner: true }
      ],
      args: []
    },
    {
      name: 'reopenPayable',
      accounts: [
        { name: 'payable', isMut: true, isSigner: false },
        { name: 'host', isMut: false, isSigner: false },
        { name: 'signer', isMut: true, isSigner: true }
      ],
      args: []
    },
    {
      name: 'updatePayableDescription',
      accounts: [
        { name: 'payable', isMut: true, isSigner: false },
        { name: 'host', isMut: false, isSigner: false },
        { name: 'signer', isMut: true, isSigner: true }
      ],
      args: [{ name: 'description', type: 'string' }]
    },
    {
      name: 'pay',
      accounts: [
        { name: 'payment', isMut: true, isSigner: false },
        { name: 'payable', isMut: true, isSigner: false },
        { name: 'payer', isMut: true, isSigner: false },
        { name: 'globalStats', isMut: true, isSigner: false },
        { name: 'thisProgram', isMut: false, isSigner: false },
        { name: 'mint', isMut: false, isSigner: false },
        { name: 'payerTokenAccount', isMut: true, isSigner: false },
        { name: 'thisProgramTokenAccount', isMut: true, isSigner: false },
        { name: 'signer', isMut: true, isSigner: true },
        { name: 'tokenProgram', isMut: false, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false }
      ],
      args: [{ name: 'amount', type: 'u64' }]
    },
    {
      name: 'withdraw',
      accounts: [
        { name: 'withdrawal', isMut: true, isSigner: false },
        { name: 'payable', isMut: true, isSigner: false },
        { name: 'host', isMut: true, isSigner: false },
        { name: 'globalStats', isMut: true, isSigner: false },
        { name: 'thisProgram', isMut: false, isSigner: false },
        { name: 'mint', isMut: false, isSigner: false },
        { name: 'hostTokenAccount', isMut: true, isSigner: false },
        { name: 'thisProgramTokenAccount', isMut: true, isSigner: false },
        { name: 'signer', isMut: true, isSigner: true },
        { name: 'tokenProgram', isMut: false, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false }
      ],
      args: [{ name: 'amount', type: 'u64' }]
    },
    {
      name: 'adminWithdraw',
      accounts: [
        { name: 'mint', isMut: false, isSigner: false },
        { name: 'thisProgram', isMut: false, isSigner: false },
        { name: 'thisProgramData', isMut: false, isSigner: false },
        { name: 'thisProgramTokenAccount', isMut: true, isSigner: false },
        { name: 'adminTokenAccount', isMut: true, isSigner: false },
        { name: 'admin', isMut: false, isSigner: true },
        { name: 'tokenProgram', isMut: false, isSigner: false }
      ],
      args: [{ name: 'amount', type: 'u64' }]
    }
  ],
  accounts: [
    {
      name: 'GlobalStats',
      type: {
        kind: 'struct',
        fields: [
          { name: 'usersCount', type: 'u64' },
          { name: 'payablesCount', type: 'u64' },
          { name: 'paymentsCount', type: 'u64' },
          { name: 'withdrawalsCount', type: 'u64' }
        ]
      }
    },
    {
      name: 'Payable',
      type: {
        kind: 'struct',
        fields: [
          { name: 'globalCount', type: 'u64' },
          { name: 'host', type: 'publicKey' },
          { name: 'hostCount', type: 'u64' },
          { name: 'description', type: 'string' },
          {
            name: 'tokensAndAmounts',
            type: { vec: { defined: 'TokenAndAmount' } }
          },
          { name: 'balances', type: { vec: { defined: 'TokenAndAmount' } } },
          { name: 'allowsFreePayments', type: 'bool' },
          { name: 'createdAt', type: 'u64' },
          { name: 'paymentsCount', type: 'u64' },
          { name: 'withdrawalsCount', type: 'u64' },
          { name: 'isClosed', type: 'bool' }
        ]
      }
    },
    {
      name: 'Payment',
      type: {
        kind: 'struct',
        fields: [
          { name: 'globalCount', type: 'u64' },
          { name: 'payable', type: 'publicKey' },
          { name: 'payer', type: 'publicKey' },
          { name: 'payerCount', type: 'u64' },
          { name: 'payableCount', type: 'u64' },
          { name: 'timestamp', type: 'u64' },
          { name: 'details', type: { defined: 'TokenAndAmount' } }
        ]
      }
    },
    {
      name: 'User',
      type: {
        kind: 'struct',
        fields: [
          { name: 'address', type: 'publicKey' },
          { name: 'globalCount', type: 'u64' },
          { name: 'payablesCount', type: 'u64' },
          { name: 'paymentsCount', type: 'u64' },
          { name: 'withdrawalsCount', type: 'u64' }
        ]
      }
    },
    {
      name: 'Withdrawal',
      type: {
        kind: 'struct',
        fields: [
          { name: 'globalCount', type: 'u64' },
          { name: 'payable', type: 'publicKey' },
          { name: 'host', type: 'publicKey' },
          { name: 'hostCount', type: 'u64' },
          { name: 'payableCount', type: 'u64' },
          { name: 'timestamp', type: 'u64' },
          { name: 'details', type: { defined: 'TokenAndAmount' } }
        ]
      }
    }
  ],
  types: [
    {
      name: 'TokenAndAmount',
      type: {
        kind: 'struct',
        fields: [
          { name: 'token', type: 'publicKey' },
          { name: 'amount', type: 'u64' }
        ]
      }
    }
  ],
  events: [
    { name: 'AdminWithdrawalEvent', fields: [] },
    { name: 'InitializedGlobalStatsEvent', fields: [] },
    {
      name: 'InitializedUserEvent',
      fields: [{ name: 'globalCount', type: 'u64', index: false }]
    },
    {
      name: 'InitializedPayableEvent',
      fields: [
        { name: 'globalCount', type: 'u64', index: false },
        { name: 'hostCount', type: 'u64', index: false }
      ]
    },
    { name: 'ClosePayableEvent', fields: [] },
    { name: 'ReopenPayableEvent', fields: [] },
    { name: 'UpdatePayableDescriptionEvent', fields: [] },
    {
      name: 'PayEvent',
      fields: [
        { name: 'globalCount', type: 'u64', index: false },
        { name: 'payableCount', type: 'u64', index: false },
        { name: 'payerCount', type: 'u64', index: false }
      ]
    },
    {
      name: 'WithdrawalEvent',
      fields: [
        { name: 'globalCount', type: 'u64', index: false },
        { name: 'payableCount', type: 'u64', index: false },
        { name: 'hostCount', type: 'u64', index: false }
      ]
    }
  ],
  errors: [
    {
      code: 6000,
      name: 'MaxPayableTokensCapacityReached',
      msg: 'payable tokens capacity has exceeded'
    },
    {
      code: 6001,
      name: 'MaxPayableDescriptionReached',
      msg: 'payable description maximum characters has exceeded'
    },
    {
      code: 6002,
      name: 'ImproperPayablesConfiguration',
      msg: 'either allows_free_payments or specify tokens_and_amounts'
    },
    {
      code: 6003,
      name: 'ZeroAmountSpecified',
      msg: 'payable amount must be greater than zero'
    },
    {
      code: 6004,
      name: 'PayableIsClosed',
      msg: 'payable is currently not accepting payments'
    },
    {
      code: 6005,
      name: 'MatchingTokenAndAccountNotFound',
      msg: 'specified payment token and amount is not allowed on this payable'
    },
    {
      code: 6006,
      name: 'InsufficientWithdrawAmount',
      msg: 'withdraw amount should be less than or equal to balance'
    },
    {
      code: 6007,
      name: 'NoBalanceForWithdrawalToken',
      msg: 'no balance found for withdrawal token'
    }
  ]
};
