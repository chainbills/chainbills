export type Chainbills = {
  version: '0.1.0';
  name: 'chainbills';
  instructions: [
    {
      name: 'initialize';
      docs: [
        "Initialize the program. Specifically initialize the program's",
        "Config and Solana's ChainStats.",
        '',
        'Config holds addresses and infos that this program will use to interact',
        'with Wormhole. Other method handlers would reference properties of',
        'Config to execute Wormhole-related CPI calls.',
        '',
        'ChainStats keeps track of the count of all entities in this program,',
        'that were created on this chain (and any other chain). Entities include',
        'Users, Payables, Payments, and Withdrawals. Initializing any other entity',
        'must increment the appropriate count in the appropriate ChainStats.',
        '',
        'ChainStats has to be initialized for each BlockChain Network',
        "involved in Chainbills. Solana's ChainStats also gets initialized here.",
        'ChainStats for other chains get initialized when their foreign contracts',
        'are registered.'
      ];
      accounts: [
        {
          name: 'owner';
          isMut: true;
          isSigner: true;
          docs: [
            'Whoever initializes the config will be the owner of the program. Signer',
            'for creating the [`Config`] account and posting a Wormhole message',
            'indicating that the program is alive.'
          ];
        },
        {
          name: 'chainStats';
          isMut: true;
          isSigner: false;
          docs: [
            'Keeps track of the counts of all entities (Users, Payables, Payments,',
            'and Withdrawals) initialized on Solana Chain in Chainbills.'
          ];
        },
        {
          name: 'config';
          isMut: true;
          isSigner: false;
          docs: [
            'Config account, which saves program data useful for other instructions.',
            'Also saves the payer of the [`initialize`](crate::initialize) instruction',
            "as the program's owner."
          ];
        },
        {
          name: 'chainbillsFeeCollector';
          isMut: false;
          isSigner: false;
          docs: [
            'An external address for collecting fees during withdrawals.',
            'We save it in config and use it for withdrawals.'
          ];
        },
        {
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
          docs: ['Wormhole program.'];
        },
        {
          name: 'wormholeBridge';
          isMut: true;
          isSigner: false;
          docs: [
            'Wormhole bridge data account (a.k.a. its config).',
            '[`wormhole::post_message`] requires this account be mutable.'
          ];
        },
        {
          name: 'wormholeEmitter';
          isMut: true;
          isSigner: false;
          docs: [
            "This isn't an account that holds data; it is purely",
            'just a signer for posting Wormhole messages directly.'
          ];
        },
        {
          name: 'wormholeFeeCollector';
          isMut: true;
          isSigner: false;
          docs: [
            'Wormhole fee collector account, which requires lamports before the',
            'program can post a message (if there is a fee).',
            '[`wormhole::post_message`] requires this account be mutable.'
          ];
        },
        {
          name: 'wormholeSequence';
          isMut: true;
          isSigner: false;
          docs: [
            'message is posted, so it needs to be an [UncheckedAccount] for the',
            '[`initialize`](crate::initialize) instruction.',
            '[`wormhole::post_message`] requires this account be mutable.'
          ];
        },
        {
          name: 'wormholeMessage';
          isMut: true;
          isSigner: false;
          docs: [
            "account, which requires this program's signature.",
            '[`wormhole::post_message`] requires this account be mutable.'
          ];
        },
        {
          name: 'clock';
          isMut: false;
          isSigner: false;
          docs: ['Clock sysvar.'];
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
          docs: ['Rent sysvar.'];
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
          docs: ['System program.'];
        }
      ];
      args: [];
    },
    {
      name: 'registerForeignContract';
      docs: [
        'Register (or update) a trusted contract or Wormhole emitter from another',
        "chain. Also initialize that chain's ChainStats if need be.",
        '',
        '### Arguments',
        '* `ctx`     - `RegisterForeignEmitter` context',
        '* `chain`   - Wormhole Chain ID',
        '* `address` - Wormhole Emitter Address'
      ];
      accounts: [
        {
          name: 'foreignContract';
          isMut: true;
          isSigner: false;
          docs: [
            'Foreign Contract account. This account will be created if a contract has',
            'not been registered yet for this Wormhole Chain ID. If there already is a',
            'contract address saved in this account, its contents will be overwritted.'
          ];
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
          docs: [
            'Config Account that stores important constant addresses that are used',
            'across program instructions.'
          ];
        },
        {
          name: 'owner';
          isMut: true;
          isSigner: true;
          docs: [
            'Signer for this instruction. Should be the account that holds',
            'the upgrade authority of this program.'
          ];
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
          docs: ['System program.'];
        }
      ];
      args: [
        {
          name: 'chain';
          type: 'u16';
        },
        {
          name: 'address';
          type: {
            array: ['u8', 32];
          };
        }
      ];
    },
    {
      name: 'updateMaxWithdrawalFee';
      docs: [
        'Updates the maximum withdrawal fees of the given token.',
        '',
        '### Args',
        '* token<Pubkey>: The address of the token for which its maximum',
        'withdrawal fees is been set.',
        '* fee<u64>: The max fee to set.'
      ];
      accounts: [
        {
          name: 'maxWithdrawalFeeDetails';
          isMut: true;
          isSigner: false;
          docs: ['Account that stores the max withdrawal fee details.'];
        },
        {
          name: 'chainTokenAccount';
          isMut: true;
          isSigner: false;
          docs: [
            'Initialize the chain token account for storing payments of the token mint',
            "if it doesn't exist."
          ];
        },
        {
          name: 'feeCollector';
          isMut: false;
          isSigner: false;
          docs: [
            "Chainbills' fee collector account. Not verifying it is correct",
            'in the constraints inorder to bypass the stack offset error. However, the',
            'check is carried out inside the instruction.'
          ];
        },
        {
          name: 'feesTokenAccount';
          isMut: true;
          isSigner: false;
          docs: [
            'Initialize the fees token account for storing payments of the token mint',
            "if it doesn't exist."
          ];
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
          docs: [
            'Config Account that stores important constant addresses that are used',
            'across program instructions.'
          ];
        },
        {
          name: 'chainStats';
          isMut: true;
          isSigner: false;
          docs: [
            'Keeps track of entities on this chain. Would be used for initializing',
            'the chain_token_account for the token whose max_withdrawl_fee is being',
            'set/updated.'
          ];
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
          docs: [
            'The token mint whose max withdrawal fee is being set/updated.'
          ];
        },
        {
          name: 'owner';
          isMut: true;
          isSigner: true;
          docs: [
            'Signer for this instruction. Should be the account that holds',
            'the upgrade authority of this program. Not verifying its owner status',
            'in the constraints inorder to bypass the stack offset error. However, the',
            'check is carried out inside the instruction.'
          ];
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
          docs: ['Associated Token Program.'];
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
          docs: ['Token Program.'];
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
          docs: ['System Program.'];
        }
      ];
      args: [
        {
          name: 'token';
          type: 'publicKey';
        },
        {
          name: 'fee';
          type: 'u64';
        }
      ];
    },
    {
      name: 'updateMaxWithdrawalFeeNative';
      docs: [
        'Updates the maximum withdrawal fees of the native token (Solana).',
        '',
        '### Args',
        '* fee<u64>: The max fee to set.'
      ];
      accounts: [
        {
          name: 'maxWithdrawalFeeDetails';
          isMut: true;
          isSigner: false;
          docs: ['Account that stores the max withdrawal fee details.'];
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'owner';
          isMut: true;
          isSigner: true;
          docs: [
            'Signer for this instruction. Should be the account that holds',
            'the upgrade authority of this program.'
          ];
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: 'fee';
          type: 'u64';
        }
      ];
    },
    {
      name: 'initializeUser';
      docs: [
        'Initialize a User.',
        '',
        'A User Account keeps track of the count of all entities associated with',
        "them. That includes the number of payables they've created and the",
        "number of payments and withdrawals they've made."
      ];
      accounts: [
        {
          name: 'user';
          isMut: true;
          isSigner: false;
          docs: [
            'The PDA account to create. It houses details about the user. Keeps track',
            'of the count of entities created by the user.'
          ];
        },
        {
          name: 'chainStats';
          isMut: true;
          isSigner: false;
          docs: [
            'Keeps track of entities on this chain. Its user_count will be',
            'incremented in this instruction.'
          ];
        },
        {
          name: 'signer';
          isMut: true;
          isSigner: true;
          docs: ['The signer of the transaction.'];
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
          docs: ['The system program account.'];
        }
      ];
      args: [];
    },
    {
      name: 'createPayable';
      docs: [
        'Create a Payable',
        '',
        '### args',
        '* allowed_tokens_and_amounts<Vec<TokenAndAmount>>: The allowed tokens',
        '(and their amounts) on this payable. If this vector is empty,',
        'then the payable will accept payments in any token.'
      ];
      accounts: [
        {
          name: 'payable';
          isMut: true;
          isSigner: false;
          docs: [
            'The payable account to create. It houses details about the payable.'
          ];
        },
        {
          name: 'payableChainCounter';
          isMut: true;
          isSigner: false;
          docs: [
            'The payable chain counter account to create. It houses the payments_count',
            'for the payable per chain.'
          ];
        },
        {
          name: 'host';
          isMut: true;
          isSigner: false;
          docs: [
            'The user account of the signer that is creating the payable.'
          ];
        },
        {
          name: 'chainStats';
          isMut: true;
          isSigner: false;
          docs: [
            'Keeps track of entities on this chain. Its payable_count will be',
            'incremented in this instruction.'
          ];
        },
        {
          name: 'signer';
          isMut: true;
          isSigner: true;
          docs: ['The signer of the transaction.'];
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
          docs: ['The system program account.'];
        }
      ];
      args: [
        {
          name: 'allowedTokensAndAmounts';
          type: {
            vec: {
              defined: 'TokenAndAmount';
            };
          };
        }
      ];
    },
    {
      name: 'closePayable';
      docs: [
        'Stop a payable from accepting payments. Can be called only',
        'by the host (user) that owns the payable.'
      ];
      accounts: [
        {
          name: 'payable';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'host';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'signer';
          isMut: true;
          isSigner: true;
        }
      ];
      args: [];
    },
    {
      name: 'reopenPayable';
      docs: [
        'Allow a closed payable to continue accepting payments.',
        'Can be called only by the host (user) that owns the payable.'
      ];
      accounts: [
        {
          name: 'payable';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'host';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'signer';
          isMut: true;
          isSigner: true;
        }
      ];
      args: [];
    },
    {
      name: 'updatePayableAllowedTokensAndAmounts';
      docs: [
        "Allows a payable's host to update the payable's allowed_tokens_and_amounts.",
        '',
        '### args',
        '* allowed_tokens_and_amounts: the new set of tokens and amounts that the payable',
        'will accept.'
      ];
      accounts: [
        {
          name: 'payable';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'host';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'signer';
          isMut: true;
          isSigner: true;
        }
      ];
      args: [
        {
          name: 'allowedTokensAndAmounts';
          type: {
            vec: {
              defined: 'TokenAndAmount';
            };
          };
        }
      ];
    },
    {
      name: 'pay';
      docs: [
        'Transfers the amount of tokens from a payer to a payable',
        '',
        '### args',
        '* amount<u64>: The amount to be paid'
      ];
      accounts: [
        {
          name: 'userPayment';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payablePayment';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payableChainCounter';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payable';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'chainStats';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'maxWithdrawalFeeDetails';
          isMut: false;
          isSigner: false;
          docs: ["Ensures that payers don't pay into unsupported tokens."];
        },
        {
          name: 'payerTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'chainTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'signer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: 'amount';
          type: 'u64';
        }
      ];
    },
    {
      name: 'payNative';
      docs: [
        'Transfers the amount of native tokens (Solana) to a payable',
        '',
        '### args',
        '* amount<u64>: The Wormhole-normalized amount to be paid'
      ];
      accounts: [
        {
          name: 'userPayment';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payablePayment';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payableChainCounter';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payable';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'chainStats';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'maxWithdrawalFeeDetails';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'signer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: 'amount';
          type: 'u64';
        }
      ];
    },
    {
      name: 'withdraw';
      docs: [
        'Transfers the amount of tokens from a payable to a host',
        '',
        '### args',
        '* amount<u64>: The amount to be withdrawn'
      ];
      accounts: [
        {
          name: 'withdrawal';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payableWithdrawalCounter';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payable';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'host';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'chainStats';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'maxWithdrawalFeeDetails';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'hostTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'chainTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'feesTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'feeCollector';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'signer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: 'amount';
          type: 'u64';
        }
      ];
    },
    {
      name: 'withdrawNative';
      docs: [
        'Transfers the amount of native tokens (Solana) from a payable to a host',
        '',
        '### args',
        '* amount<u64>: The amount to be withdrawn'
      ];
      accounts: [
        {
          name: 'withdrawal';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payableWithdrawalCounter';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payable';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'host';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'chainStats';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'feeCollector';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'maxWithdrawalFeeDetails';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'signer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: 'amount';
          type: 'u64';
        }
      ];
    },
    {
      name: 'ownerWithdraw';
      docs: [
        'Withdraws fees from this program.',
        'Should be called only by upgrade authority holder of this program.',
        '',
        '### args',
        '* amount<u64>: The amount to be withdrawn'
      ];
      accounts: [
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'chainStats';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'chainTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'ownerTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'owner';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: 'amount';
          type: 'u64';
        }
      ];
    }
  ];
  accounts: [
    {
      name: 'empty';
      type: {
        kind: 'struct';
        fields: [];
      };
    },
    {
      name: 'chainStats';
      docs: ['Keeps track of all activities on this chain.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'chainId';
            docs: ['Wormhole-Chain ID for this chain.'];
            type: 'u16';
          },
          {
            name: 'usersCount';
            docs: [
              'Total number of users that have ever been initialized on this chain.'
            ];
            type: 'u64';
          },
          {
            name: 'payablesCount';
            docs: [
              'Total number of payables that have ever been created on this chain.'
            ];
            type: 'u64';
          },
          {
            name: 'paymentsCount';
            docs: [
              'Total number of payments that have ever been made on this chain.'
            ];
            type: 'u64';
          },
          {
            name: 'withdrawalsCount';
            docs: [
              'Total number of withdrawals that have ever been made on this chain.'
            ];
            type: 'u64';
          }
        ];
      };
    },
    {
      name: 'config';
      docs: [
        'Config account data. Mainly Wormhole-related addresses and infos.'
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'owner';
            docs: ['Deployer of this program.'];
            type: 'publicKey';
          },
          {
            name: 'chainbillsFeeCollector';
            docs: ["Chainbills' [FeeCollector](FeeCollector) address."];
            type: 'publicKey';
          },
          {
            name: 'wormholeBridge';
            docs: [
              "Wormhole's [BridgeData](wormhole_anchor_sdk::wormhole::BridgeData)",
              'address. Needed by the Wormhole program to post messages.'
            ];
            type: 'publicKey';
          },
          {
            name: 'wormholeEmitter';
            docs: ['Used by Wormhole to send messages'];
            type: 'publicKey';
          },
          {
            name: 'wormholeFeeCollector';
            docs: [
              "Wormhole's [FeeCollector](wormhole_anchor_sdk::wormhole::FeeCollector)",
              'address.'
            ];
            type: 'publicKey';
          },
          {
            name: 'wormholeSequence';
            docs: [
              'The [SequenceTracker](wormhole_anchor_sdk::wormhole::SequenceTracker)',
              'address for Wormhole messages. It tracks the number of messages posted',
              'by this program.'
            ];
            type: 'publicKey';
          }
        ];
      };
    },
    {
      name: 'foreignContract';
      docs: ['Foreign Contract Account Data.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'chain';
            docs: ["Contract's chain. Cannot equal `1` (Solana's Chain ID)."];
            type: 'u16';
          },
          {
            name: 'address';
            docs: ["Contract's address. Cannot be zero address."];
            type: {
              array: ['u8', 32];
            };
          }
        ];
      };
    },
    {
      name: 'maxFeeDetails';
      docs: ['Keeps track of how much of a token is its max fee.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'token';
            docs: ['The address of the token mint.'];
            type: 'publicKey';
          },
          {
            name: 'amount';
            docs: ['The amount of the token (with its decimals).'];
            type: 'u64';
          }
        ];
      };
    },
    {
      name: 'payableChainCounter';
      docs: ['A counter for the PayablePayments per chain.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'payableId';
            docs: ['The ID of the Payable to which this Payment was made.'];
            type: 'publicKey';
          },
          {
            name: 'chainId';
            docs: [
              'The Wormhole Chain ID of the chain from which the payment was made.'
            ];
            type: 'u16';
          },
          {
            name: 'paymentsCount';
            docs: [
              'The nth count of payments to this payable from the payment source',
              'chain at the point this payment was recorded.'
            ];
            type: 'u64';
          }
        ];
      };
    },
    {
      name: 'payablePayment';
      docs: [
        'Receipt of a payment from any blockchain network (this-chain inclusive)',
        'made to a Payable in this chain.'
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'payableId';
            docs: ['The ID of the Payable to which this Payment was made.'];
            type: 'publicKey';
          },
          {
            name: 'payer';
            docs: [
              'The Wormhole-normalized wallet address that made this Payment.',
              'If the payer is on Solana, then will be the bytes of their wallet address.'
            ];
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'payerChainId';
            docs: [
              'The Wormhole Chain ID of the chain from which the payment was made.'
            ];
            type: 'u16';
          },
          {
            name: 'localChainCount';
            docs: [
              'The nth count of payments to this payable from the payment source',
              'chain at the point this payment was recorded.'
            ];
            type: 'u64';
          },
          {
            name: 'payableCount';
            docs: [
              'The nth count of payments that the payable has received',
              'at the point when this payment was made.'
            ];
            type: 'u64';
          },
          {
            name: 'payerCount';
            docs: [
              'The nth count of payments that the payer has made',
              'at the point of making this payment.'
            ];
            type: 'u64';
          },
          {
            name: 'timestamp';
            docs: ['When this payment was made.'];
            type: 'u64';
          },
          {
            name: 'details';
            docs: ['The amount and token that the payer paid'];
            type: {
              defined: 'TokenAndAmount';
            };
          }
        ];
      };
    },
    {
      name: 'payableWithdrawalCounter';
      docs: [
        'A counter for the Withdrawals per Payable. This is used to track',
        "the nth withdrawal made from a payable. It contains the host's",
        'count of withdrawals and the time the withdrawal was made',
        'on the involved payable. The caller should then use the retrieved',
        'host count to get the main Withdrawal account.'
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'hostCount';
            docs: [
              'The host count of withdrawals at the point when the withdrawal was made.'
            ];
            type: 'u64';
          }
        ];
      };
    },
    {
      name: 'payable';
      docs: [
        'A payable is like a public invoice through which anybody can pay to.'
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'chainCount';
            docs: [
              'The nth count of payables on this chain at the point this payable',
              'was created.'
            ];
            type: 'u64';
          },
          {
            name: 'host';
            docs: ['The wallet address of that created this Payable.'];
            type: 'publicKey';
          },
          {
            name: 'hostCount';
            docs: [
              'The nth count of payables that the host has created at the point of',
              "this payable's creation."
            ];
            type: 'u64';
          },
          {
            name: 'allowedTokensAndAmounts';
            docs: ['The allowed tokens (and their amounts) on this payable.'];
            type: {
              vec: {
                defined: 'TokenAndAmount';
              };
            };
          },
          {
            name: 'balances';
            docs: ['Records of how much is in this payable.'];
            type: {
              vec: {
                defined: 'TokenAndAmount';
              };
            };
          },
          {
            name: 'createdAt';
            docs: ['The timestamp of when this payable was created.'];
            type: 'u64';
          },
          {
            name: 'paymentsCount';
            docs: ['The total number of payments made to this payable.'];
            type: 'u64';
          },
          {
            name: 'withdrawalsCount';
            docs: ['The total number of withdrawals made from this payable.'];
            type: 'u64';
          },
          {
            name: 'isClosed';
            docs: ['Whether this payable is currently accepting payments.'];
            type: 'bool';
          }
        ];
      };
    },
    {
      name: 'userPayment';
      docs: [
        "A user's receipt of a payment made in this chain to a Payable on any",
        'blockchain network (this-chain inclusive).'
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'payableId';
            docs: [
              'The ID of the Payable to which this Payment was made.',
              'If the payable was created in Solana, then this will be the bytes that',
              "payable's Pubkey. Otherwise, it will be a valid 32-byte hash ID",
              'from another chain.'
            ];
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'payer';
            docs: ['The wallet address that made this Payment.'];
            type: 'publicKey';
          },
          {
            name: 'payableChainId';
            docs: [
              'The Wormhole Chain ID of the chain into which the payment was made.'
            ];
            type: 'u16';
          },
          {
            name: 'chainCount';
            docs: [
              'The nth count of payments on this chain at the point this payment',
              'was made.'
            ];
            type: 'u64';
          },
          {
            name: 'payerCount';
            docs: [
              'The nth count of payments that the payer has made',
              'at the point of making this payment.'
            ];
            type: 'u64';
          },
          {
            name: 'payableCount';
            docs: [
              'The nth count of payments that the payable has received',
              'at the point when this payment was made.'
            ];
            type: 'u64';
          },
          {
            name: 'timestamp';
            docs: ['When this payment was made.'];
            type: 'u64';
          },
          {
            name: 'details';
            docs: ['The amount and token that the payer paid'];
            type: {
              defined: 'TokenAndAmount';
            };
          }
        ];
      };
    },
    {
      name: 'user';
      docs: ['A user is an entity that can create payables and make payments.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'walletAddress';
            docs: ['The address of the wallet that owns this User account.'];
            type: 'publicKey';
          },
          {
            name: 'chainCount';
            docs: [
              'The nth count of users on this chain at the point this user was',
              'initialized.'
            ];
            type: 'u64';
          },
          {
            name: 'payablesCount';
            docs: ['Total number of payables that this user has ever created.'];
            type: 'u64';
          },
          {
            name: 'paymentsCount';
            docs: ['Total number of payments that this user has ever made.'];
            type: 'u64';
          },
          {
            name: 'withdrawalsCount';
            docs: ['Total number of withdrawals that this user has ever made.'];
            type: 'u64';
          }
        ];
      };
    },
    {
      name: 'withdrawal';
      docs: ['A receipt of a withdrawal made by a Host from a Payable.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'payableId';
            docs: [
              'The address of the Payable from which this Withdrawal was made.'
            ];
            type: 'publicKey';
          },
          {
            name: 'host';
            docs: [
              "The wallet address (payable's owner) that made this Withdrawal."
            ];
            type: 'publicKey';
          },
          {
            name: 'chainCount';
            docs: [
              'The nth count of withdrawals on this chain at the point',
              'this withdrawal was made.'
            ];
            type: 'u64';
          },
          {
            name: 'hostCount';
            docs: [
              'The nth count of withdrawals that the host has made',
              'at the point of making this withdrawal.'
            ];
            type: 'u64';
          },
          {
            name: 'payableCount';
            docs: [
              'The nth count of withdrawals that has been made from',
              'this payable at the point when this withdrawal was made.'
            ];
            type: 'u64';
          },
          {
            name: 'timestamp';
            docs: ['When this withdrawal was made.'];
            type: 'u64';
          },
          {
            name: 'details';
            docs: ['The amount and token that the host withdrew'];
            type: {
              defined: 'TokenAndAmount';
            };
          }
        ];
      };
    },
    {
      name: 'wormholeReceived';
      docs: ['Holds data for every received message. Prevents replay attacks.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'batchId';
            docs: ['AKA nonce. Should always be zero.'];
            type: 'u32';
          },
          {
            name: 'vaaHash';
            docs: ['Keccak256 hash of verified Wormhole message.'];
            type: {
              array: ['u8', 32];
            };
          }
        ];
      };
    }
  ];
  types: [
    {
      name: 'TokenAndAmount';
      docs: [
        'A combination of a token address and its associated amount.',
        '',
        'This combination is used to constrain how much of a token',
        'a payable can accept. It is also used to record the details',
        'of a payment or a withdrawal.'
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'token';
            docs: ['The associated token mint.'];
            type: 'publicKey';
          },
          {
            name: 'amount';
            docs: ['The amount of the token with its decimals.'];
            type: 'u64';
          }
        ];
      };
    }
  ];
  events: [
    {
      name: 'InitializedEvent';
      fields: [];
    },
    {
      name: 'RegisteredForeignContractEvent';
      fields: [
        {
          name: 'chainId';
          type: 'u16';
          index: false;
        },
        {
          name: 'emitter';
          type: {
            array: ['u8', 32];
          };
          index: false;
        }
      ];
    },
    {
      name: 'UpdatedMaxWithdrawalFeeEvent';
      fields: [
        {
          name: 'token';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'maxFee';
          type: 'u64';
          index: false;
        }
      ];
    },
    {
      name: 'InitializedUserEvent';
      fields: [
        {
          name: 'wallet';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'chainCount';
          type: 'u64';
          index: false;
        }
      ];
    },
    {
      name: 'CreatedPayableEvent';
      fields: [
        {
          name: 'payableId';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'hostWallet';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'chainCount';
          type: 'u64';
          index: false;
        },
        {
          name: 'hostCount';
          type: 'u64';
          index: false;
        }
      ];
    },
    {
      name: 'ClosePayableEvent';
      fields: [
        {
          name: 'payableId';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'hostWallet';
          type: 'publicKey';
          index: false;
        }
      ];
    },
    {
      name: 'ReopenPayableEvent';
      fields: [
        {
          name: 'payableId';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'hostWallet';
          type: 'publicKey';
          index: false;
        }
      ];
    },
    {
      name: 'UpdatedPayableAllowedTokensAndAmountsEvent';
      fields: [
        {
          name: 'payableId';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'hostWallet';
          type: 'publicKey';
          index: false;
        }
      ];
    },
    {
      name: 'PayablePayEvent';
      fields: [
        {
          name: 'payableId';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'payerWallet';
          type: {
            array: ['u8', 32];
          };
          index: false;
        },
        {
          name: 'paymentId';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'payerChainId';
          type: 'u16';
          index: false;
        },
        {
          name: 'chainCount';
          type: 'u64';
          index: false;
        },
        {
          name: 'payableCount';
          type: 'u64';
          index: false;
        }
      ];
    },
    {
      name: 'UserPayEvent';
      fields: [
        {
          name: 'payableId';
          type: {
            array: ['u8', 32];
          };
          index: false;
        },
        {
          name: 'payerWallet';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'paymentId';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'payableChainId';
          type: 'u16';
          index: false;
        },
        {
          name: 'chainCount';
          type: 'u64';
          index: false;
        },
        {
          name: 'payerCount';
          type: 'u64';
          index: false;
        }
      ];
    },
    {
      name: 'WithdrawalEvent';
      fields: [
        {
          name: 'payableId';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'hostWallet';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'withdrawalId';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'chainCount';
          type: 'u64';
          index: false;
        },
        {
          name: 'payableCount';
          type: 'u64';
          index: false;
        },
        {
          name: 'hostCount';
          type: 'u64';
          index: false;
        }
      ];
    },
    {
      name: 'OwnerWithdrawalEvent';
      fields: [
        {
          name: 'token';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'amount';
          type: 'u64';
          index: false;
        }
      ];
    }
  ];
  errors: [
    {
      code: 6000;
      name: 'MaxPayableTokensCapacityReached';
      msg: 'MaxPayableTokensCapacityReached';
    },
    {
      code: 6001;
      name: 'ZeroAmountSpecified';
      msg: 'ZeroAmountSpecified';
    },
    {
      code: 6002;
      name: 'PayableIsClosed';
      msg: 'PayableIsClosed';
    },
    {
      code: 6003;
      name: 'PayableIsAlreadyClosed';
      msg: 'PayableIsAlreadyClosed';
    },
    {
      code: 6004;
      name: 'PayableIsNotClosed';
      msg: 'PayableIsNotClosed';
    },
    {
      code: 6005;
      name: 'MatchingTokenAndAmountNotFound';
      msg: 'MatchingTokenAndAmountNotFound';
    },
    {
      code: 6006;
      name: 'InsufficientWithdrawAmount';
      msg: 'InsufficientWithdrawAmount';
    },
    {
      code: 6007;
      name: 'NoBalanceForWithdrawalToken';
      msg: 'NoBalanceForWithdrawalToken';
    },
    {
      code: 6008;
      name: 'OwnerUnauthorized';
      msg: 'OwnerUnauthorized';
    },
    {
      code: 6009;
      name: 'InvalidWormholeBridge';
      msg: 'InvalidWormholeBridge';
    },
    {
      code: 6010;
      name: 'InvalidForeignContract';
      msg: 'InvalidForeignContract';
    },
    {
      code: 6011;
      name: 'WrongFeeCollectorAddress';
      msg: 'WrongFeeCollectorAddress';
    }
  ];
};

export const IDL: Chainbills = {
  version: '0.1.0',
  name: 'chainbills',
  instructions: [
    {
      name: 'initialize',
      docs: [
        "Initialize the program. Specifically initialize the program's",
        "Config and Solana's ChainStats.",
        '',
        'Config holds addresses and infos that this program will use to interact',
        'with Wormhole. Other method handlers would reference properties of',
        'Config to execute Wormhole-related CPI calls.',
        '',
        'ChainStats keeps track of the count of all entities in this program,',
        'that were created on this chain (and any other chain). Entities include',
        'Users, Payables, Payments, and Withdrawals. Initializing any other entity',
        'must increment the appropriate count in the appropriate ChainStats.',
        '',
        'ChainStats has to be initialized for each BlockChain Network',
        "involved in Chainbills. Solana's ChainStats also gets initialized here.",
        'ChainStats for other chains get initialized when their foreign contracts',
        'are registered.'
      ],
      accounts: [
        {
          name: 'owner',
          isMut: true,
          isSigner: true,
          docs: [
            'Whoever initializes the config will be the owner of the program. Signer',
            'for creating the [`Config`] account and posting a Wormhole message',
            'indicating that the program is alive.'
          ]
        },
        {
          name: 'chainStats',
          isMut: true,
          isSigner: false,
          docs: [
            'Keeps track of the counts of all entities (Users, Payables, Payments,',
            'and Withdrawals) initialized on Solana Chain in Chainbills.'
          ]
        },
        {
          name: 'config',
          isMut: true,
          isSigner: false,
          docs: [
            'Config account, which saves program data useful for other instructions.',
            'Also saves the payer of the [`initialize`](crate::initialize) instruction',
            "as the program's owner."
          ]
        },
        {
          name: 'chainbillsFeeCollector',
          isMut: false,
          isSigner: false,
          docs: [
            'An external address for collecting fees during withdrawals.',
            'We save it in config and use it for withdrawals.'
          ]
        },
        {
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false,
          docs: ['Wormhole program.']
        },
        {
          name: 'wormholeBridge',
          isMut: true,
          isSigner: false,
          docs: [
            'Wormhole bridge data account (a.k.a. its config).',
            '[`wormhole::post_message`] requires this account be mutable.'
          ]
        },
        {
          name: 'wormholeEmitter',
          isMut: true,
          isSigner: false,
          docs: [
            "This isn't an account that holds data; it is purely",
            'just a signer for posting Wormhole messages directly.'
          ]
        },
        {
          name: 'wormholeFeeCollector',
          isMut: true,
          isSigner: false,
          docs: [
            'Wormhole fee collector account, which requires lamports before the',
            'program can post a message (if there is a fee).',
            '[`wormhole::post_message`] requires this account be mutable.'
          ]
        },
        {
          name: 'wormholeSequence',
          isMut: true,
          isSigner: false,
          docs: [
            'message is posted, so it needs to be an [UncheckedAccount] for the',
            '[`initialize`](crate::initialize) instruction.',
            '[`wormhole::post_message`] requires this account be mutable.'
          ]
        },
        {
          name: 'wormholeMessage',
          isMut: true,
          isSigner: false,
          docs: [
            "account, which requires this program's signature.",
            '[`wormhole::post_message`] requires this account be mutable.'
          ]
        },
        {
          name: 'clock',
          isMut: false,
          isSigner: false,
          docs: ['Clock sysvar.']
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
          docs: ['Rent sysvar.']
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
          docs: ['System program.']
        }
      ],
      args: []
    },
    {
      name: 'registerForeignContract',
      docs: [
        'Register (or update) a trusted contract or Wormhole emitter from another',
        "chain. Also initialize that chain's ChainStats if need be.",
        '',
        '### Arguments',
        '* `ctx`     - `RegisterForeignEmitter` context',
        '* `chain`   - Wormhole Chain ID',
        '* `address` - Wormhole Emitter Address'
      ],
      accounts: [
        {
          name: 'foreignContract',
          isMut: true,
          isSigner: false,
          docs: [
            'Foreign Contract account. This account will be created if a contract has',
            'not been registered yet for this Wormhole Chain ID. If there already is a',
            'contract address saved in this account, its contents will be overwritted.'
          ]
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false,
          docs: [
            'Config Account that stores important constant addresses that are used',
            'across program instructions.'
          ]
        },
        {
          name: 'owner',
          isMut: true,
          isSigner: true,
          docs: [
            'Signer for this instruction. Should be the account that holds',
            'the upgrade authority of this program.'
          ]
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
          docs: ['System program.']
        }
      ],
      args: [
        {
          name: 'chain',
          type: 'u16'
        },
        {
          name: 'address',
          type: {
            array: ['u8', 32]
          }
        }
      ]
    },
    {
      name: 'updateMaxWithdrawalFee',
      docs: [
        'Updates the maximum withdrawal fees of the given token.',
        '',
        '### Args',
        '* token<Pubkey>: The address of the token for which its maximum',
        'withdrawal fees is been set.',
        '* fee<u64>: The max fee to set.'
      ],
      accounts: [
        {
          name: 'maxWithdrawalFeeDetails',
          isMut: true,
          isSigner: false,
          docs: ['Account that stores the max withdrawal fee details.']
        },
        {
          name: 'chainTokenAccount',
          isMut: true,
          isSigner: false,
          docs: [
            'Initialize the chain token account for storing payments of the token mint',
            "if it doesn't exist."
          ]
        },
        {
          name: 'feeCollector',
          isMut: false,
          isSigner: false,
          docs: [
            "Chainbills' fee collector account. Not verifying it is correct",
            'in the constraints inorder to bypass the stack offset error. However, the',
            'check is carried out inside the instruction.'
          ]
        },
        {
          name: 'feesTokenAccount',
          isMut: true,
          isSigner: false,
          docs: [
            'Initialize the fees token account for storing payments of the token mint',
            "if it doesn't exist."
          ]
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false,
          docs: [
            'Config Account that stores important constant addresses that are used',
            'across program instructions.'
          ]
        },
        {
          name: 'chainStats',
          isMut: true,
          isSigner: false,
          docs: [
            'Keeps track of entities on this chain. Would be used for initializing',
            'the chain_token_account for the token whose max_withdrawl_fee is being',
            'set/updated.'
          ]
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
          docs: [
            'The token mint whose max withdrawal fee is being set/updated.'
          ]
        },
        {
          name: 'owner',
          isMut: true,
          isSigner: true,
          docs: [
            'Signer for this instruction. Should be the account that holds',
            'the upgrade authority of this program. Not verifying its owner status',
            'in the constraints inorder to bypass the stack offset error. However, the',
            'check is carried out inside the instruction.'
          ]
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
          docs: ['Associated Token Program.']
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
          docs: ['Token Program.']
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
          docs: ['System Program.']
        }
      ],
      args: [
        {
          name: 'token',
          type: 'publicKey'
        },
        {
          name: 'fee',
          type: 'u64'
        }
      ]
    },
    {
      name: 'updateMaxWithdrawalFeeNative',
      docs: [
        'Updates the maximum withdrawal fees of the native token (Solana).',
        '',
        '### Args',
        '* fee<u64>: The max fee to set.'
      ],
      accounts: [
        {
          name: 'maxWithdrawalFeeDetails',
          isMut: true,
          isSigner: false,
          docs: ['Account that stores the max withdrawal fee details.']
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false
        },
        {
          name: 'owner',
          isMut: true,
          isSigner: true,
          docs: [
            'Signer for this instruction. Should be the account that holds',
            'the upgrade authority of this program.'
          ]
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false
        }
      ],
      args: [
        {
          name: 'fee',
          type: 'u64'
        }
      ]
    },
    {
      name: 'initializeUser',
      docs: [
        'Initialize a User.',
        '',
        'A User Account keeps track of the count of all entities associated with',
        "them. That includes the number of payables they've created and the",
        "number of payments and withdrawals they've made."
      ],
      accounts: [
        {
          name: 'user',
          isMut: true,
          isSigner: false,
          docs: [
            'The PDA account to create. It houses details about the user. Keeps track',
            'of the count of entities created by the user.'
          ]
        },
        {
          name: 'chainStats',
          isMut: true,
          isSigner: false,
          docs: [
            'Keeps track of entities on this chain. Its user_count will be',
            'incremented in this instruction.'
          ]
        },
        {
          name: 'signer',
          isMut: true,
          isSigner: true,
          docs: ['The signer of the transaction.']
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
          docs: ['The system program account.']
        }
      ],
      args: []
    },
    {
      name: 'createPayable',
      docs: [
        'Create a Payable',
        '',
        '### args',
        '* allowed_tokens_and_amounts<Vec<TokenAndAmount>>: The allowed tokens',
        '(and their amounts) on this payable. If this vector is empty,',
        'then the payable will accept payments in any token.'
      ],
      accounts: [
        {
          name: 'payable',
          isMut: true,
          isSigner: false,
          docs: [
            'The payable account to create. It houses details about the payable.'
          ]
        },
        {
          name: 'payableChainCounter',
          isMut: true,
          isSigner: false,
          docs: [
            'The payable chain counter account to create. It houses the payments_count',
            'for the payable per chain.'
          ]
        },
        {
          name: 'host',
          isMut: true,
          isSigner: false,
          docs: ['The user account of the signer that is creating the payable.']
        },
        {
          name: 'chainStats',
          isMut: true,
          isSigner: false,
          docs: [
            'Keeps track of entities on this chain. Its payable_count will be',
            'incremented in this instruction.'
          ]
        },
        {
          name: 'signer',
          isMut: true,
          isSigner: true,
          docs: ['The signer of the transaction.']
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
          docs: ['The system program account.']
        }
      ],
      args: [
        {
          name: 'allowedTokensAndAmounts',
          type: {
            vec: {
              defined: 'TokenAndAmount'
            }
          }
        }
      ]
    },
    {
      name: 'closePayable',
      docs: [
        'Stop a payable from accepting payments. Can be called only',
        'by the host (user) that owns the payable.'
      ],
      accounts: [
        {
          name: 'payable',
          isMut: true,
          isSigner: false
        },
        {
          name: 'host',
          isMut: false,
          isSigner: false
        },
        {
          name: 'signer',
          isMut: true,
          isSigner: true
        }
      ],
      args: []
    },
    {
      name: 'reopenPayable',
      docs: [
        'Allow a closed payable to continue accepting payments.',
        'Can be called only by the host (user) that owns the payable.'
      ],
      accounts: [
        {
          name: 'payable',
          isMut: true,
          isSigner: false
        },
        {
          name: 'host',
          isMut: false,
          isSigner: false
        },
        {
          name: 'signer',
          isMut: true,
          isSigner: true
        }
      ],
      args: []
    },
    {
      name: 'updatePayableAllowedTokensAndAmounts',
      docs: [
        "Allows a payable's host to update the payable's allowed_tokens_and_amounts.",
        '',
        '### args',
        '* allowed_tokens_and_amounts: the new set of tokens and amounts that the payable',
        'will accept.'
      ],
      accounts: [
        {
          name: 'payable',
          isMut: true,
          isSigner: false
        },
        {
          name: 'host',
          isMut: false,
          isSigner: false
        },
        {
          name: 'signer',
          isMut: true,
          isSigner: true
        }
      ],
      args: [
        {
          name: 'allowedTokensAndAmounts',
          type: {
            vec: {
              defined: 'TokenAndAmount'
            }
          }
        }
      ]
    },
    {
      name: 'pay',
      docs: [
        'Transfers the amount of tokens from a payer to a payable',
        '',
        '### args',
        '* amount<u64>: The amount to be paid'
      ],
      accounts: [
        {
          name: 'userPayment',
          isMut: true,
          isSigner: false
        },
        {
          name: 'payablePayment',
          isMut: true,
          isSigner: false
        },
        {
          name: 'payableChainCounter',
          isMut: true,
          isSigner: false
        },
        {
          name: 'payable',
          isMut: true,
          isSigner: false
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: false
        },
        {
          name: 'chainStats',
          isMut: true,
          isSigner: false
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false
        },
        {
          name: 'maxWithdrawalFeeDetails',
          isMut: false,
          isSigner: false,
          docs: ["Ensures that payers don't pay into unsupported tokens."]
        },
        {
          name: 'payerTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'chainTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'signer',
          isMut: true,
          isSigner: true
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false
        }
      ],
      args: [
        {
          name: 'amount',
          type: 'u64'
        }
      ]
    },
    {
      name: 'payNative',
      docs: [
        'Transfers the amount of native tokens (Solana) to a payable',
        '',
        '### args',
        '* amount<u64>: The Wormhole-normalized amount to be paid'
      ],
      accounts: [
        {
          name: 'userPayment',
          isMut: true,
          isSigner: false
        },
        {
          name: 'payablePayment',
          isMut: true,
          isSigner: false
        },
        {
          name: 'payableChainCounter',
          isMut: true,
          isSigner: false
        },
        {
          name: 'payable',
          isMut: true,
          isSigner: false
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: false
        },
        {
          name: 'chainStats',
          isMut: true,
          isSigner: false
        },
        {
          name: 'maxWithdrawalFeeDetails',
          isMut: false,
          isSigner: false
        },
        {
          name: 'signer',
          isMut: true,
          isSigner: true
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false
        }
      ],
      args: [
        {
          name: 'amount',
          type: 'u64'
        }
      ]
    },
    {
      name: 'withdraw',
      docs: [
        'Transfers the amount of tokens from a payable to a host',
        '',
        '### args',
        '* amount<u64>: The amount to be withdrawn'
      ],
      accounts: [
        {
          name: 'withdrawal',
          isMut: true,
          isSigner: false
        },
        {
          name: 'payableWithdrawalCounter',
          isMut: true,
          isSigner: false
        },
        {
          name: 'payable',
          isMut: true,
          isSigner: false
        },
        {
          name: 'host',
          isMut: true,
          isSigner: false
        },
        {
          name: 'chainStats',
          isMut: true,
          isSigner: false
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false
        },
        {
          name: 'maxWithdrawalFeeDetails',
          isMut: false,
          isSigner: false
        },
        {
          name: 'hostTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'chainTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'feesTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'feeCollector',
          isMut: false,
          isSigner: false
        },
        {
          name: 'signer',
          isMut: true,
          isSigner: true
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false
        }
      ],
      args: [
        {
          name: 'amount',
          type: 'u64'
        }
      ]
    },
    {
      name: 'withdrawNative',
      docs: [
        'Transfers the amount of native tokens (Solana) from a payable to a host',
        '',
        '### args',
        '* amount<u64>: The amount to be withdrawn'
      ],
      accounts: [
        {
          name: 'withdrawal',
          isMut: true,
          isSigner: false
        },
        {
          name: 'payableWithdrawalCounter',
          isMut: true,
          isSigner: false
        },
        {
          name: 'payable',
          isMut: true,
          isSigner: false
        },
        {
          name: 'host',
          isMut: true,
          isSigner: false
        },
        {
          name: 'chainStats',
          isMut: true,
          isSigner: false
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false
        },
        {
          name: 'feeCollector',
          isMut: false,
          isSigner: false
        },
        {
          name: 'maxWithdrawalFeeDetails',
          isMut: false,
          isSigner: false
        },
        {
          name: 'signer',
          isMut: true,
          isSigner: true
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false
        }
      ],
      args: [
        {
          name: 'amount',
          type: 'u64'
        }
      ]
    },
    {
      name: 'ownerWithdraw',
      docs: [
        'Withdraws fees from this program.',
        'Should be called only by upgrade authority holder of this program.',
        '',
        '### args',
        '* amount<u64>: The amount to be withdrawn'
      ],
      accounts: [
        {
          name: 'mint',
          isMut: false,
          isSigner: false
        },
        {
          name: 'chainStats',
          isMut: true,
          isSigner: false
        },
        {
          name: 'chainTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'ownerTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false
        },
        {
          name: 'owner',
          isMut: true,
          isSigner: true
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false
        }
      ],
      args: [
        {
          name: 'amount',
          type: 'u64'
        }
      ]
    }
  ],
  accounts: [
    {
      name: 'empty',
      type: {
        kind: 'struct',
        fields: []
      }
    },
    {
      name: 'chainStats',
      docs: ['Keeps track of all activities on this chain.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'chainId',
            docs: ['Wormhole-Chain ID for this chain.'],
            type: 'u16'
          },
          {
            name: 'usersCount',
            docs: [
              'Total number of users that have ever been initialized on this chain.'
            ],
            type: 'u64'
          },
          {
            name: 'payablesCount',
            docs: [
              'Total number of payables that have ever been created on this chain.'
            ],
            type: 'u64'
          },
          {
            name: 'paymentsCount',
            docs: [
              'Total number of payments that have ever been made on this chain.'
            ],
            type: 'u64'
          },
          {
            name: 'withdrawalsCount',
            docs: [
              'Total number of withdrawals that have ever been made on this chain.'
            ],
            type: 'u64'
          }
        ]
      }
    },
    {
      name: 'config',
      docs: [
        'Config account data. Mainly Wormhole-related addresses and infos.'
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'owner',
            docs: ['Deployer of this program.'],
            type: 'publicKey'
          },
          {
            name: 'chainbillsFeeCollector',
            docs: ["Chainbills' [FeeCollector](FeeCollector) address."],
            type: 'publicKey'
          },
          {
            name: 'wormholeBridge',
            docs: [
              "Wormhole's [BridgeData](wormhole_anchor_sdk::wormhole::BridgeData)",
              'address. Needed by the Wormhole program to post messages.'
            ],
            type: 'publicKey'
          },
          {
            name: 'wormholeEmitter',
            docs: ['Used by Wormhole to send messages'],
            type: 'publicKey'
          },
          {
            name: 'wormholeFeeCollector',
            docs: [
              "Wormhole's [FeeCollector](wormhole_anchor_sdk::wormhole::FeeCollector)",
              'address.'
            ],
            type: 'publicKey'
          },
          {
            name: 'wormholeSequence',
            docs: [
              'The [SequenceTracker](wormhole_anchor_sdk::wormhole::SequenceTracker)',
              'address for Wormhole messages. It tracks the number of messages posted',
              'by this program.'
            ],
            type: 'publicKey'
          }
        ]
      }
    },
    {
      name: 'foreignContract',
      docs: ['Foreign Contract Account Data.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'chain',
            docs: ["Contract's chain. Cannot equal `1` (Solana's Chain ID)."],
            type: 'u16'
          },
          {
            name: 'address',
            docs: ["Contract's address. Cannot be zero address."],
            type: {
              array: ['u8', 32]
            }
          }
        ]
      }
    },
    {
      name: 'maxFeeDetails',
      docs: ['Keeps track of how much of a token is its max fee.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'token',
            docs: ['The address of the token mint.'],
            type: 'publicKey'
          },
          {
            name: 'amount',
            docs: ['The amount of the token (with its decimals).'],
            type: 'u64'
          }
        ]
      }
    },
    {
      name: 'payableChainCounter',
      docs: ['A counter for the PayablePayments per chain.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'payableId',
            docs: ['The ID of the Payable to which this Payment was made.'],
            type: 'publicKey'
          },
          {
            name: 'chainId',
            docs: [
              'The Wormhole Chain ID of the chain from which the payment was made.'
            ],
            type: 'u16'
          },
          {
            name: 'paymentsCount',
            docs: [
              'The nth count of payments to this payable from the payment source',
              'chain at the point this payment was recorded.'
            ],
            type: 'u64'
          }
        ]
      }
    },
    {
      name: 'payablePayment',
      docs: [
        'Receipt of a payment from any blockchain network (this-chain inclusive)',
        'made to a Payable in this chain.'
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'payableId',
            docs: ['The ID of the Payable to which this Payment was made.'],
            type: 'publicKey'
          },
          {
            name: 'payer',
            docs: [
              'The Wormhole-normalized wallet address that made this Payment.',
              'If the payer is on Solana, then will be the bytes of their wallet address.'
            ],
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'payerChainId',
            docs: [
              'The Wormhole Chain ID of the chain from which the payment was made.'
            ],
            type: 'u16'
          },
          {
            name: 'localChainCount',
            docs: [
              'The nth count of payments to this payable from the payment source',
              'chain at the point this payment was recorded.'
            ],
            type: 'u64'
          },
          {
            name: 'payableCount',
            docs: [
              'The nth count of payments that the payable has received',
              'at the point when this payment was made.'
            ],
            type: 'u64'
          },
          {
            name: 'payerCount',
            docs: [
              'The nth count of payments that the payer has made',
              'at the point of making this payment.'
            ],
            type: 'u64'
          },
          {
            name: 'timestamp',
            docs: ['When this payment was made.'],
            type: 'u64'
          },
          {
            name: 'details',
            docs: ['The amount and token that the payer paid'],
            type: {
              defined: 'TokenAndAmount'
            }
          }
        ]
      }
    },
    {
      name: 'payableWithdrawalCounter',
      docs: [
        'A counter for the Withdrawals per Payable. This is used to track',
        "the nth withdrawal made from a payable. It contains the host's",
        'count of withdrawals and the time the withdrawal was made',
        'on the involved payable. The caller should then use the retrieved',
        'host count to get the main Withdrawal account.'
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'hostCount',
            docs: [
              'The host count of withdrawals at the point when the withdrawal was made.'
            ],
            type: 'u64'
          }
        ]
      }
    },
    {
      name: 'payable',
      docs: [
        'A payable is like a public invoice through which anybody can pay to.'
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'chainCount',
            docs: [
              'The nth count of payables on this chain at the point this payable',
              'was created.'
            ],
            type: 'u64'
          },
          {
            name: 'host',
            docs: ['The wallet address of that created this Payable.'],
            type: 'publicKey'
          },
          {
            name: 'hostCount',
            docs: [
              'The nth count of payables that the host has created at the point of',
              "this payable's creation."
            ],
            type: 'u64'
          },
          {
            name: 'allowedTokensAndAmounts',
            docs: ['The allowed tokens (and their amounts) on this payable.'],
            type: {
              vec: {
                defined: 'TokenAndAmount'
              }
            }
          },
          {
            name: 'balances',
            docs: ['Records of how much is in this payable.'],
            type: {
              vec: {
                defined: 'TokenAndAmount'
              }
            }
          },
          {
            name: 'createdAt',
            docs: ['The timestamp of when this payable was created.'],
            type: 'u64'
          },
          {
            name: 'paymentsCount',
            docs: ['The total number of payments made to this payable.'],
            type: 'u64'
          },
          {
            name: 'withdrawalsCount',
            docs: ['The total number of withdrawals made from this payable.'],
            type: 'u64'
          },
          {
            name: 'isClosed',
            docs: ['Whether this payable is currently accepting payments.'],
            type: 'bool'
          }
        ]
      }
    },
    {
      name: 'userPayment',
      docs: [
        "A user's receipt of a payment made in this chain to a Payable on any",
        'blockchain network (this-chain inclusive).'
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'payableId',
            docs: [
              'The ID of the Payable to which this Payment was made.',
              'If the payable was created in Solana, then this will be the bytes that',
              "payable's Pubkey. Otherwise, it will be a valid 32-byte hash ID",
              'from another chain.'
            ],
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'payer',
            docs: ['The wallet address that made this Payment.'],
            type: 'publicKey'
          },
          {
            name: 'payableChainId',
            docs: [
              'The Wormhole Chain ID of the chain into which the payment was made.'
            ],
            type: 'u16'
          },
          {
            name: 'chainCount',
            docs: [
              'The nth count of payments on this chain at the point this payment',
              'was made.'
            ],
            type: 'u64'
          },
          {
            name: 'payerCount',
            docs: [
              'The nth count of payments that the payer has made',
              'at the point of making this payment.'
            ],
            type: 'u64'
          },
          {
            name: 'payableCount',
            docs: [
              'The nth count of payments that the payable has received',
              'at the point when this payment was made.'
            ],
            type: 'u64'
          },
          {
            name: 'timestamp',
            docs: ['When this payment was made.'],
            type: 'u64'
          },
          {
            name: 'details',
            docs: ['The amount and token that the payer paid'],
            type: {
              defined: 'TokenAndAmount'
            }
          }
        ]
      }
    },
    {
      name: 'user',
      docs: ['A user is an entity that can create payables and make payments.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'walletAddress',
            docs: ['The address of the wallet that owns this User account.'],
            type: 'publicKey'
          },
          {
            name: 'chainCount',
            docs: [
              'The nth count of users on this chain at the point this user was',
              'initialized.'
            ],
            type: 'u64'
          },
          {
            name: 'payablesCount',
            docs: ['Total number of payables that this user has ever created.'],
            type: 'u64'
          },
          {
            name: 'paymentsCount',
            docs: ['Total number of payments that this user has ever made.'],
            type: 'u64'
          },
          {
            name: 'withdrawalsCount',
            docs: ['Total number of withdrawals that this user has ever made.'],
            type: 'u64'
          }
        ]
      }
    },
    {
      name: 'withdrawal',
      docs: ['A receipt of a withdrawal made by a Host from a Payable.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'payableId',
            docs: [
              'The address of the Payable from which this Withdrawal was made.'
            ],
            type: 'publicKey'
          },
          {
            name: 'host',
            docs: [
              "The wallet address (payable's owner) that made this Withdrawal."
            ],
            type: 'publicKey'
          },
          {
            name: 'chainCount',
            docs: [
              'The nth count of withdrawals on this chain at the point',
              'this withdrawal was made.'
            ],
            type: 'u64'
          },
          {
            name: 'hostCount',
            docs: [
              'The nth count of withdrawals that the host has made',
              'at the point of making this withdrawal.'
            ],
            type: 'u64'
          },
          {
            name: 'payableCount',
            docs: [
              'The nth count of withdrawals that has been made from',
              'this payable at the point when this withdrawal was made.'
            ],
            type: 'u64'
          },
          {
            name: 'timestamp',
            docs: ['When this withdrawal was made.'],
            type: 'u64'
          },
          {
            name: 'details',
            docs: ['The amount and token that the host withdrew'],
            type: {
              defined: 'TokenAndAmount'
            }
          }
        ]
      }
    },
    {
      name: 'wormholeReceived',
      docs: ['Holds data for every received message. Prevents replay attacks.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'batchId',
            docs: ['AKA nonce. Should always be zero.'],
            type: 'u32'
          },
          {
            name: 'vaaHash',
            docs: ['Keccak256 hash of verified Wormhole message.'],
            type: {
              array: ['u8', 32]
            }
          }
        ]
      }
    }
  ],
  types: [
    {
      name: 'TokenAndAmount',
      docs: [
        'A combination of a token address and its associated amount.',
        '',
        'This combination is used to constrain how much of a token',
        'a payable can accept. It is also used to record the details',
        'of a payment or a withdrawal.'
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'token',
            docs: ['The associated token mint.'],
            type: 'publicKey'
          },
          {
            name: 'amount',
            docs: ['The amount of the token with its decimals.'],
            type: 'u64'
          }
        ]
      }
    }
  ],
  events: [
    {
      name: 'InitializedEvent',
      fields: []
    },
    {
      name: 'RegisteredForeignContractEvent',
      fields: [
        {
          name: 'chainId',
          type: 'u16',
          index: false
        },
        {
          name: 'emitter',
          type: {
            array: ['u8', 32]
          },
          index: false
        }
      ]
    },
    {
      name: 'UpdatedMaxWithdrawalFeeEvent',
      fields: [
        {
          name: 'token',
          type: 'publicKey',
          index: false
        },
        {
          name: 'maxFee',
          type: 'u64',
          index: false
        }
      ]
    },
    {
      name: 'InitializedUserEvent',
      fields: [
        {
          name: 'wallet',
          type: 'publicKey',
          index: false
        },
        {
          name: 'chainCount',
          type: 'u64',
          index: false
        }
      ]
    },
    {
      name: 'CreatedPayableEvent',
      fields: [
        {
          name: 'payableId',
          type: 'publicKey',
          index: false
        },
        {
          name: 'hostWallet',
          type: 'publicKey',
          index: false
        },
        {
          name: 'chainCount',
          type: 'u64',
          index: false
        },
        {
          name: 'hostCount',
          type: 'u64',
          index: false
        }
      ]
    },
    {
      name: 'ClosePayableEvent',
      fields: [
        {
          name: 'payableId',
          type: 'publicKey',
          index: false
        },
        {
          name: 'hostWallet',
          type: 'publicKey',
          index: false
        }
      ]
    },
    {
      name: 'ReopenPayableEvent',
      fields: [
        {
          name: 'payableId',
          type: 'publicKey',
          index: false
        },
        {
          name: 'hostWallet',
          type: 'publicKey',
          index: false
        }
      ]
    },
    {
      name: 'UpdatedPayableAllowedTokensAndAmountsEvent',
      fields: [
        {
          name: 'payableId',
          type: 'publicKey',
          index: false
        },
        {
          name: 'hostWallet',
          type: 'publicKey',
          index: false
        }
      ]
    },
    {
      name: 'PayablePayEvent',
      fields: [
        {
          name: 'payableId',
          type: 'publicKey',
          index: false
        },
        {
          name: 'payerWallet',
          type: {
            array: ['u8', 32]
          },
          index: false
        },
        {
          name: 'paymentId',
          type: 'publicKey',
          index: false
        },
        {
          name: 'payerChainId',
          type: 'u16',
          index: false
        },
        {
          name: 'chainCount',
          type: 'u64',
          index: false
        },
        {
          name: 'payableCount',
          type: 'u64',
          index: false
        }
      ]
    },
    {
      name: 'UserPayEvent',
      fields: [
        {
          name: 'payableId',
          type: {
            array: ['u8', 32]
          },
          index: false
        },
        {
          name: 'payerWallet',
          type: 'publicKey',
          index: false
        },
        {
          name: 'paymentId',
          type: 'publicKey',
          index: false
        },
        {
          name: 'payableChainId',
          type: 'u16',
          index: false
        },
        {
          name: 'chainCount',
          type: 'u64',
          index: false
        },
        {
          name: 'payerCount',
          type: 'u64',
          index: false
        }
      ]
    },
    {
      name: 'WithdrawalEvent',
      fields: [
        {
          name: 'payableId',
          type: 'publicKey',
          index: false
        },
        {
          name: 'hostWallet',
          type: 'publicKey',
          index: false
        },
        {
          name: 'withdrawalId',
          type: 'publicKey',
          index: false
        },
        {
          name: 'chainCount',
          type: 'u64',
          index: false
        },
        {
          name: 'payableCount',
          type: 'u64',
          index: false
        },
        {
          name: 'hostCount',
          type: 'u64',
          index: false
        }
      ]
    },
    {
      name: 'OwnerWithdrawalEvent',
      fields: [
        {
          name: 'token',
          type: 'publicKey',
          index: false
        },
        {
          name: 'amount',
          type: 'u64',
          index: false
        }
      ]
    }
  ],
  errors: [
    {
      code: 6000,
      name: 'MaxPayableTokensCapacityReached',
      msg: 'MaxPayableTokensCapacityReached'
    },
    {
      code: 6001,
      name: 'ZeroAmountSpecified',
      msg: 'ZeroAmountSpecified'
    },
    {
      code: 6002,
      name: 'PayableIsClosed',
      msg: 'PayableIsClosed'
    },
    {
      code: 6003,
      name: 'PayableIsAlreadyClosed',
      msg: 'PayableIsAlreadyClosed'
    },
    {
      code: 6004,
      name: 'PayableIsNotClosed',
      msg: 'PayableIsNotClosed'
    },
    {
      code: 6005,
      name: 'MatchingTokenAndAmountNotFound',
      msg: 'MatchingTokenAndAmountNotFound'
    },
    {
      code: 6006,
      name: 'InsufficientWithdrawAmount',
      msg: 'InsufficientWithdrawAmount'
    },
    {
      code: 6007,
      name: 'NoBalanceForWithdrawalToken',
      msg: 'NoBalanceForWithdrawalToken'
    },
    {
      code: 6008,
      name: 'OwnerUnauthorized',
      msg: 'OwnerUnauthorized'
    },
    {
      code: 6009,
      name: 'InvalidWormholeBridge',
      msg: 'InvalidWormholeBridge'
    },
    {
      code: 6010,
      name: 'InvalidForeignContract',
      msg: 'InvalidForeignContract'
    },
    {
      code: 6011,
      name: 'WrongFeeCollectorAddress',
      msg: 'WrongFeeCollectorAddress'
    }
  ]
};
