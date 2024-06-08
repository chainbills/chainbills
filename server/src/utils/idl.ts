export type Chainbills = {
  version: '0.1.0';
  name: 'chainbills';
  constants: [
    {
      name: 'ACTION_ID_INITIALIZE_PAYABLE';
      type: 'u8';
      value: '1';
    },
    {
      name: 'ACTION_ID_CLOSE_PAYABLE';
      type: 'u8';
      value: '2';
    },
    {
      name: 'ACTION_ID_REOPEN_PAYABLE';
      type: 'u8';
      value: '3';
    },
    {
      name: 'ACTION_ID_UPDATE_PAYABLE_DESCRIPTION';
      type: 'u8';
      value: '4';
    },
    {
      name: 'ACTION_ID_PAY';
      type: 'u8';
      value: '5';
    },
    {
      name: 'ACTION_ID_WITHDRAW';
      type: 'u8';
      value: '6';
    },
    {
      name: 'MAX_PAYABLES_DESCRIPTION_LENGTH';
      type: {
        defined: 'usize';
      };
      value: '3000';
    },
    {
      name: 'MAX_PAYABLES_TOKENS';
      type: {
        defined: 'usize';
      };
      value: '20';
    },
    {
      name: 'SEED_PREFIX_SENDING';
      type: 'bytes';
      value: '[115, 101, 110, 100, 105, 110, 103]';
    }
  ];
  instructions: [
    {
      name: 'initialize';
      docs: [
        "Initialize the program. Specifically initialize the program's",
        "Config, GlobalStats, and Solana's ChainStats.",
        '',
        'Config holds addresses and infos that this program will use to interact',
        'with Wormhole. Other method handlers would reference properties of',
        'Config to execute Wormhole-related CPI calls.',
        '',
        'GlobalStats keeps track of the count of all entities in this program.',
        'Entities include Users, Payables, Payments, and Withdrawals.',
        'Initializing any other entity must increment the appropriate count in',
        'GlobalStats.',
        '',
        'ChainStats is like GlobalStats but just for each BlockChain Network',
        "involved in Chainbills. Solana's ChainStats also gets initialized here."
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
          name: 'thisProgram';
          isMut: false;
          isSigner: false;
          docs: [
            'Helps in ensuring that the provided `this_program_data` is the',
            'correct one.'
          ];
        },
        {
          name: 'thisProgramData';
          isMut: false;
          isSigner: false;
          docs: [
            'Helps in ensuring that the provided `owner` is a correct owner.'
          ];
        },
        {
          name: 'globalStats';
          isMut: true;
          isSigner: false;
          docs: [
            'Keeps track of the counts of all entities (Users, Payables, Payments,',
            'and Withdrawals) in Chainbills. It is also the signer PDA for the holding',
            'balances in this program.'
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
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
          docs: ['Wormhole program.'];
        },
        {
          name: 'tokenBridgeProgram';
          isMut: false;
          isSigner: false;
          docs: ['Token Bridge program.'];
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
          name: 'tokenBridgeConfig';
          isMut: false;
          isSigner: false;
          docs: [
            'Token Bridge config. Token Bridge program needs this account to',
            'invoke the Wormhole program to post messages. Even though it is a',
            'required account for redeeming token transfers, it is not actually',
            'used for completing these transfers.'
          ];
        },
        {
          name: 'emitter';
          isMut: false;
          isSigner: false;
          docs: [
            "Token Bridge. This isn't an account that holds data; it is purely",
            'just a signer for posting Wormhole messages directly or on behalf of',
            'the Token Bridge program.'
          ];
        },
        {
          name: 'feeCollector';
          isMut: true;
          isSigner: false;
          docs: [
            'Wormhole fee collector account, which requires lamports before the',
            'program can post a message (if there is a fee).',
            '[`wormhole::post_message`] requires this account be mutable.'
          ];
        },
        {
          name: 'sequence';
          isMut: true;
          isSigner: false;
          docs: [
            'message is posted, so it needs to be an [UncheckedAccount] for the',
            '[`initialize`](crate::initialize) instruction.',
            '[`wormhole::post_message`] requires this account be mutable.'
          ];
        },
        {
          name: 'mintAuthority';
          isMut: false;
          isSigner: false;
          docs: [
            'data; it is purely just a signer (SPL mint authority) for Token Bridge',
            'wrapped assets.'
          ];
        },
        {
          name: 'custodySigner';
          isMut: false;
          isSigner: false;
          docs: [
            'data; it is purely just a signer for Token Bridge SPL tranfers.'
          ];
        },
        {
          name: 'authoritySigner';
          isMut: false;
          isSigner: false;
          docs: [
            'data; it is purely just a signer for SPL tranfers when it is delegated',
            'spending approval for the SPL token.'
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
          name: 'owner';
          isMut: true;
          isSigner: true;
          docs: [
            'Owner of the program set in the [`Config`] account. Signer for creating',
            'the [`ForeignContract`] account.'
          ];
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
          docs: [
            'Config account. This program requires that the `owner` specified in the',
            'context equals the pubkey specified in this account. Read-only.'
          ];
        },
        {
          name: 'chainStats';
          isMut: true;
          isSigner: false;
          docs: [
            'Keeps track of the counts of all entities (Users, Payables, Payments,',
            'and Withdrawals) initialized on this new Chain in Chainbills.'
          ];
        },
        {
          name: 'foreignContract';
          isMut: true;
          isSigner: false;
          docs: [
            'Foreign Contract account. Create this account if a contract has not been',
            'registered yet for this Wormhole chain ID. If there already is a contract',
            'address saved in this account, overwrite it.'
          ];
        },
        {
          name: 'tokenBridgeForeignEndpoint';
          isMut: false;
          isSigner: false;
          docs: [
            'Token Bridge foreign endpoint. This account should really be one',
            "endpoint per chain, but Token Bridge's PDA allows for multiple",
            'endpoints for each chain. We store the proper endpoint for the',
            'emitter chain.'
          ];
        },
        {
          name: 'tokenBridgeProgram';
          isMut: false;
          isSigner: false;
          docs: ['Token Bridge program.'];
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
      name: 'updateMaximumWithdrawalFee';
      docs: [
        'Updates the maximum withdrawal fees of the given token.',
        '',
        '### Args',
        '* token<[u8; 32]>: The Wormhole-normalized address of the token for which',
        'its maximum withdrawal fees is been set.',
        '* fee<u64>: The max fee to set.'
      ];
      accounts: [
        {
          name: 'owner';
          isMut: true;
          isSigner: true;
          docs: ['Owner of the program set in the [`Config`] account.'];
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
          docs: ['Config account to confirm owner status.'];
        },
        {
          name: 'maxWithdrawalFeeDetails';
          isMut: true;
          isSigner: false;
          docs: ['Account that stores the max withdrawal fee details.'];
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: 'token';
          type: {
            array: ['u8', 32];
          };
        },
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
        },
        {
          name: 'globalStats';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'chainStats';
          isMut: true;
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
      args: [];
    },
    {
      name: 'initializePayable';
      docs: [
        'Initialize a Payable',
        '',
        '### args',
        '* description<String>: what users see when they want to make payment.',
        '* tokens_and_amounts<Vec<TokenAndAmount>>: The allowed tokens',
        '(and their amounts) on this payable.',
        '* allows_free_payments<bool>: Whether this payable should allow payments',
        'of any amounts of any token.'
      ];
      accounts: [
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
          name: 'globalStats';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'chainStats';
          isMut: true;
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
          name: 'description';
          type: 'string';
        },
        {
          name: 'tokensAndAmounts';
          type: {
            vec: {
              defined: 'TokenAndAmount';
            };
          };
        },
        {
          name: 'allowsFreePayments';
          type: 'bool';
        }
      ];
    },
    {
      name: 'initializePayableReceived';
      docs: [
        'Initialize a Payable from another chain network',
        '',
        '### args',
        '* vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the',
        'source chain.',
        '* caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the',
        'creator of the payable on the source chain.',
        '* host_count<u64>: The nth count of the new payable from the host.'
      ];
      accounts: [
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
          name: 'globalStats';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'chainStats';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'signer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'vaa';
          isMut: false;
          isSigner: false;
          docs: [
            'Verified Wormhole message account. The Wormhole program verified',
            'signatures and posted the account data here. Read-only.'
          ];
        },
        {
          name: 'foreignContract';
          isMut: false;
          isSigner: false;
          docs: [
            "Foreign contract account. The vaa's `emitter_address` must",
            "agree with the one we have registered for this message's `emitter_chain`",
            '(chain ID). Read-only.'
          ];
        },
        {
          name: 'wormholeReceived';
          isMut: true;
          isSigner: false;
          docs: [
            'Received account. [`receive_message`](crate::receive_message) will',
            "deserialize the Wormhole message's payload and save it to this account.",
            'This account cannot be overwritten, and will prevent Wormhole message',
            'replay with the same sequence.'
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
          name: 'vaaHash';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'caller';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'hostCount';
          type: 'u64';
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
      name: 'closePayableReceived';
      docs: [
        'Stop a payable from accepting payments from contract call on',
        'another chain. Should be called only by the host (user) that created',
        'the payable.',
        '',
        '### args',
        '* vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the',
        'source chain.',
        '* caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the',
        'creator of the payable on the source chain.'
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
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'vaa';
          isMut: false;
          isSigner: false;
          docs: [
            'Verified Wormhole message account. The Wormhole program verified',
            'signatures and posted the account data here. Read-only.'
          ];
        },
        {
          name: 'foreignContract';
          isMut: false;
          isSigner: false;
          docs: [
            "Foreign contract account. The vaa's `emitter_address` must",
            "agree with the one we have registered for this message's `emitter_chain`",
            '(chain ID). Read-only.'
          ];
        },
        {
          name: 'wormholeReceived';
          isMut: true;
          isSigner: false;
          docs: [
            'Received account. [`wormhole_received`](crate::wormhole_received) will',
            "deserialize the Wormhole message's payload and save it to this account.",
            'This account cannot be overwritten, and will prevent Wormhole message',
            'replay with the same sequence.'
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
          name: 'vaaHash';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'caller';
          type: {
            array: ['u8', 32];
          };
        }
      ];
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
      name: 'reopenPayableReceived';
      docs: [
        'Allow a closed payable to continue accepting payments from contract',
        'call on another chain. Should be called only by the host (user)',
        'that owns the payable.',
        '',
        '### args',
        '* vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the',
        'source chain.',
        '* caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the',
        'creator of the payable on the source chain.'
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
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'vaa';
          isMut: false;
          isSigner: false;
          docs: [
            'Verified Wormhole message account. The Wormhole program verified',
            'signatures and posted the account data here. Read-only.'
          ];
        },
        {
          name: 'foreignContract';
          isMut: false;
          isSigner: false;
          docs: [
            "Foreign contract account. The vaa's `emitter_address` must",
            "agree with the one we have registered for this message's `emitter_chain`",
            '(chain ID). Read-only.'
          ];
        },
        {
          name: 'wormholeReceived';
          isMut: true;
          isSigner: false;
          docs: [
            'Received account. [`wormhole_received`](crate::wormhole_received) will',
            "deserialize the Wormhole message's payload and save it to this account.",
            'This account cannot be overwritten, and will prevent Wormhole message',
            'replay with the same sequence.'
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
          name: 'vaaHash';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'caller';
          type: {
            array: ['u8', 32];
          };
        }
      ];
    },
    {
      name: 'updatePayableDescription';
      docs: [
        "Allows a payable's host to update the payable's description.",
        '',
        '### args',
        '* description: the new description of the payable.'
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
          name: 'description';
          type: 'string';
        }
      ];
    },
    {
      name: 'updatePayableDescriptionReceived';
      docs: [
        "Allows a payable's host to update the payable's description from a",
        'contract call on another chain.',
        '',
        '### args',
        '* vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the',
        'source chain.',
        '* caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the',
        'creator of the payable on the source chain.'
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
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'vaa';
          isMut: false;
          isSigner: false;
          docs: [
            'Verified Wormhole message account. The Wormhole program verified',
            'signatures and posted the account data here. Read-only.'
          ];
        },
        {
          name: 'foreignContract';
          isMut: false;
          isSigner: false;
          docs: [
            "Foreign contract account. The vaa's `emitter_address` must",
            "agree with the one we have registered for this message's `emitter_chain`",
            '(chain ID). Read-only.'
          ];
        },
        {
          name: 'wormholeReceived';
          isMut: true;
          isSigner: false;
          docs: [
            'Received account. [`wormhole_received`](crate::wormhole_received) will',
            "deserialize the Wormhole message's payload and save it to this account.",
            'This account cannot be overwritten, and will prevent Wormhole message',
            'replay with the same sequence.'
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
          name: 'vaaHash';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'caller';
          type: {
            array: ['u8', 32];
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
          name: 'payment';
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
          name: 'globalStats';
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
          name: 'payerTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'globalTokenAccount';
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
      name: 'payReceived';
      docs: [
        'Transfers the amount of tokens from another chain network to a payable',
        '',
        '### args',
        '* vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the',
        'source chain.',
        '* caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the',
        'creator of the payable on the source chain.',
        '* payer_count<u64>: The nth count of the new payment from the payer.'
      ];
      accounts: [
        {
          name: 'payment';
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
          name: 'globalStats';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'globalTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'chainStats';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'foreignContract';
          isMut: false;
          isSigner: false;
          docs: [
            'Foreign Contract account. The registered contract specified in this',
            "account must agree with the target address for the Token Bridge's token",
            'transfer. Read-only.'
          ];
        },
        {
          name: 'tokenBridgeWrappedMint';
          isMut: true;
          isSigner: false;
          docs: [
            'Token Bridge wrapped mint info. This is the SPL token that will be',
            'bridged from the foreign contract. The wrapped mint PDA must agree',
            "with the native token's metadata in the wormhole message. Mutable."
          ];
        },
        {
          name: 'tokenBridgeWrappedMeta';
          isMut: false;
          isSigner: false;
          docs: [
            "Token Bridge program's wrapped metadata, which stores info",
            'about the token from its native chain:',
            '* Wormhole Chain ID',
            "* Token's native contract address",
            "* Token's native decimals"
          ];
        },
        {
          name: 'tokenBridgeClaim';
          isMut: true;
          isSigner: false;
          docs: [
            'is true if the bridged assets have been claimed. If the transfer has',
            'not been redeemed, this account will not exist yet.'
          ];
        },
        {
          name: 'tokenBridgeForeignEndpoint';
          isMut: false;
          isSigner: false;
          docs: [
            'Token Bridge foreign endpoint. This account should really be one',
            'endpoint per chain, but the PDA allows for multiple endpoints for each',
            'chain! We store the proper endpoint for the emitter chain.'
          ];
        },
        {
          name: 'tokenBridgeMintAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeConfig';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeBridge';
          isMut: true;
          isSigner: false;
          docs: ['Wormhole bridge data. Mutable.'];
        },
        {
          name: 'vaa';
          isMut: false;
          isSigner: false;
          docs: [
            'Verified Wormhole message account. The Wormhole program verified',
            'signatures and posted the account data here. Read-only.'
          ];
        },
        {
          name: 'wormholeReceived';
          isMut: true;
          isSigner: false;
          docs: [
            'Received account. [`receive_message`](crate::receive_message) will',
            "deserialize the Wormhole message's payload and save it to this account.",
            'This account cannot be overwritten, and will prevent Wormhole message',
            'replay with the same sequence.'
          ];
        },
        {
          name: 'signer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
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
          name: 'vaaHash';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'caller';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'payerCount';
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
          name: 'globalStats';
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
          name: 'globalTokenAccount';
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
      name: 'withdrawReceivedHandler';
      docs: [
        'Transfers the amount of tokens from a payable to its host on another',
        'chain network',
        '',
        '### args',
        '* vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the',
        'source chain.',
        '* caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the',
        'creator of the payable on the source chain.',
        '* host_count<u64>: The nth count of the new withdrawal from the host.'
      ];
      accounts: [
        {
          name: 'withdrawal';
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
          name: 'globalStats';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'globalTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'chainStats';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'foreignContract';
          isMut: false;
          isSigner: false;
          docs: [
            "Foreign contract account. The vaa's `emitter_address` must",
            "agree with the one we have registered for this message's `emitter_chain`",
            '(chain ID). Read-only.'
          ];
        },
        {
          name: 'vaa';
          isMut: false;
          isSigner: false;
          docs: [
            'Verified Wormhole message account. The Wormhole program verified',
            'signatures and posted the account data here. Read-only.'
          ];
        },
        {
          name: 'wormholeReceived';
          isMut: true;
          isSigner: false;
          docs: [
            'Received account. [`receive_message`](crate::receive_message) will',
            "deserialize the Wormhole message's payload and save it to this account.",
            'This account cannot be overwritten, and will prevent Wormhole message',
            'replay with the same sequence.'
          ];
        },
        {
          name: 'tokenBridgeWrappedMint';
          isMut: true;
          isSigner: false;
          docs: [
            'Token Bridge wrapped mint info. This is the SPL token that will be',
            'bridged to the foreign contract. The wrapped mint PDA must agree',
            "with the native token's metadata. Mutable."
          ];
        },
        {
          name: 'maxWithdrawalFeeDetails';
          isMut: false;
          isSigner: false;
          docs: ['Account that stores the max withdrawal fee details.'];
        },
        {
          name: 'tokenBridgeWrappedMeta';
          isMut: false;
          isSigner: false;
          docs: [
            "Token Bridge program's wrapped metadata, which stores info",
            'about the token from its native chain:',
            '* Wormhole Chain ID',
            "* Token's native contract address",
            "* Token's native decimals"
          ];
        },
        {
          name: 'tokenBridgeAuthoritySigner';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeConfig';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeBridge';
          isMut: true;
          isSigner: false;
          docs: ['Wormhole bridge data. Mutable.'];
        },
        {
          name: 'wormholeMessage';
          isMut: true;
          isSigner: false;
          docs: ['tokens transferred in this account.'];
        },
        {
          name: 'emitter';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'sequence';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'feeCollector';
          isMut: true;
          isSigner: false;
          docs: ['Wormhole fee collector. Mutable.'];
        },
        {
          name: 'signer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
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
        },
        {
          name: 'clock';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: 'vaaHash';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'caller';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'hostCount';
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
          name: 'globalStats';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'thisProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'thisProgramData';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'globalTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'adminTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'admin';
          isMut: false;
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
      name: 'chainStats';
      docs: ['Keeps track of all activities on each chain.'];
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
            docs: ["Program's owner."];
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
            name: 'tokenBridgeConfig';
            docs: [
              "[TokenBridge's Config](wormhole_anchor_sdk::token_bridge::Config)",
              'address. Needed by the TokenBridge to post messages to Wormhole.'
            ];
            type: 'publicKey';
          },
          {
            name: 'emitter';
            docs: ['Used by Wormhole and TokenBridge to send messages'];
            type: 'publicKey';
          },
          {
            name: 'feeCollector';
            docs: [
              "Wormhole's [FeeCollector](wormhole_anchor_sdk::wormhole::FeeCollector)",
              'address.'
            ];
            type: 'publicKey';
          },
          {
            name: 'sequence';
            docs: [
              'The [SequenceTracker](wormhole_anchor_sdk::wormhole::SequenceTracker)',
              'address for Wormhole messages. It tracks the number of messages posted',
              'by this program.'
            ];
            type: 'publicKey';
          },
          {
            name: 'mintAuthority';
            docs: [
              "Doesn't hold data. Is SPL mint authority (signer) for Token Bridge",
              'wrapped assets.'
            ];
            type: 'publicKey';
          },
          {
            name: 'custodySigner';
            docs: [
              "Doesn't hold data. Signs custody (holding-balances) Token Bridge",
              'SPL transfers.'
            ];
            type: 'publicKey';
          },
          {
            name: 'authoritySigner';
            docs: [
              "Doesn't hold data. Signs outbound TokenBridge SPL transfers."
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
          },
          {
            name: 'tokenBridgeForeignEndpoint';
            docs: ["Token Bridge program's foreign endpoint account key."];
            type: 'publicKey';
          }
        ];
      };
    },
    {
      name: 'globalStats';
      docs: ['Keeps track of all activity accounts across Chainbills.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'usersCount';
            docs: ['Total number of users that have ever been initialized.'];
            type: 'u64';
          },
          {
            name: 'payablesCount';
            docs: ['Total number of payables that have ever been created.'];
            type: 'u64';
          },
          {
            name: 'paymentsCount';
            docs: ['Total number of payments that have ever been made.'];
            type: 'u64';
          },
          {
            name: 'withdrawalsCount';
            docs: ['Total number of withdrawals that have ever been made.'];
            type: 'u64';
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
            docs: [
              'The Wormhole-normalized address of the token mint.',
              'This should be the bridged address on Solana.'
            ];
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'amount';
            docs: [
              'The Wormhole-normalized (with 8 decimals) amount of the token.'
            ];
            type: 'u64';
          }
        ];
      };
    },
    {
      name: 'payable';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'globalCount';
            docs: [
              'The nth count of global payables at the point this payable was created.'
            ];
            type: 'u64';
          },
          {
            name: 'chainCount';
            docs: [
              'The nth count of payables on the calling chain at the point this payable',
              'was created.'
            ];
            type: 'u64';
          },
          {
            name: 'host';
            docs: ['The address of the User account that owns this Payable.'];
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
            name: 'description';
            docs: [
              'Displayed to payers when the make payments to this payable.',
              'Set by the host.'
            ];
            type: 'string';
          },
          {
            name: 'tokensAndAmounts';
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
            name: 'allowsFreePayments';
            docs: [
              'Whether this payable allows payments any amount in any token.'
            ];
            type: 'bool';
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
      name: 'payment';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'globalCount';
            docs: [
              'The nth count of global payments at the point this payment was made.'
            ];
            type: 'u64';
          },
          {
            name: 'chainCount';
            docs: [
              'The nth count of payments on the calling chain at the point this payment',
              'was made.'
            ];
            type: 'u64';
          },
          {
            name: 'payable';
            docs: [
              'The address of the Payable to which this Payment was made.'
            ];
            type: 'publicKey';
          },
          {
            name: 'payer';
            docs: ['The address of the User account that made this Payment.'];
            type: 'publicKey';
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
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'ownerWallet';
            docs: [
              'The Wormhole-normalized address of the person who owns this User account.'
            ];
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'chainId';
            docs: ['The Wormhole Chain Id of the owner_wallet'];
            type: 'u16';
          },
          {
            name: 'globalCount';
            docs: [
              'The nth count of global users at the point this user was initialized.'
            ];
            type: 'u64';
          },
          {
            name: 'chainCount';
            docs: [
              'The nth count of users on the calling chain at the point this user was',
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
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'globalCount';
            docs: [
              'The nth count of global withdrawals at the point this',
              'withdrawal was made.'
            ];
            type: 'u64';
          },
          {
            name: 'chainCount';
            docs: [
              'The nth count of withdrawals on the calling chain at the point',
              'this withdrawal was made.'
            ];
            type: 'u64';
          },
          {
            name: 'payable';
            docs: [
              'The address of the Payable from which this Withdrawal was made.'
            ];
            type: 'publicKey';
          },
          {
            name: 'host';
            docs: [
              "The address of the User account (payable's owner)",
              'that made this Withdrawal.'
            ];
            type: 'publicKey';
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
        'A combination of a Wormhole-normalized token address and its',
        'Wormhole-normalized associated amount.',
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
            docs: [
              'The Wormhole-normalized address of the associated token mint.',
              'This should be the bridged address on Solana.'
            ];
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'amount';
            docs: [
              'The Wormhole-normalized (with 8 decimals) amount of the token.'
            ];
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
      fields: [];
    },
    {
      name: 'UpdatedMaxWithdrawalFeeEvent';
      fields: [];
    },
    {
      name: 'InitializedUserEvent';
      fields: [
        {
          name: 'globalCount';
          type: 'u64';
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
      name: 'InitializedPayableEvent';
      fields: [
        {
          name: 'globalCount';
          type: 'u64';
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
      fields: [];
    },
    {
      name: 'ReopenPayableEvent';
      fields: [];
    },
    {
      name: 'UpdatePayableDescriptionEvent';
      fields: [];
    },
    {
      name: 'PayEvent';
      fields: [
        {
          name: 'globalCount';
          type: 'u64';
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
          name: 'globalCount';
          type: 'u64';
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
      fields: [];
    }
  ];
  errors: [
    {
      code: 6000;
      name: 'MaxPayableTokensCapacityReached';
      msg: 'payable tokens capacity has exceeded';
    },
    {
      code: 6001;
      name: 'MaxPayableDescriptionReached';
      msg: 'payable description maximum characters has exceeded';
    },
    {
      code: 6002;
      name: 'ImproperPayablesConfiguration';
      msg: 'either allows_free_payments or specify tokens_and_amounts';
    },
    {
      code: 6003;
      name: 'ZeroAmountSpecified';
      msg: 'payable amount must be greater than zero';
    },
    {
      code: 6004;
      name: 'PayableIsClosed';
      msg: 'payable is currently not accepting payments';
    },
    {
      code: 6005;
      name: 'MatchingTokenAndAccountNotFound';
      msg: 'specified payment token and amount is not allowed on this payable';
    },
    {
      code: 6006;
      name: 'InsufficientWithdrawAmount';
      msg: 'withdraw amount should be less than or equal to balance';
    },
    {
      code: 6007;
      name: 'NoBalanceForWithdrawalToken';
      msg: 'no balance found for withdrawal token';
    },
    {
      code: 6008;
      name: 'ProgramDataUnauthorized';
      msg: 'wrong program data account provided';
    },
    {
      code: 6009;
      name: 'AdminUnauthorized';
      msg: 'you are not an admin';
    },
    {
      code: 6010;
      name: 'EmptyDescriptionProvided';
      msg: 'please provide a valid description';
    },
    {
      code: 6011;
      name: 'InvalidWormholeBridge';
      msg: 'InvalidWormholeBridge';
    },
    {
      code: 6012;
      name: 'InvalidWormholeFeeCollector';
      msg: 'InvalidWormholeFeeCollector';
    },
    {
      code: 6013;
      name: 'InvalidWormholeEmitter';
      msg: 'InvalidWormholeEmitter';
    },
    {
      code: 6014;
      name: 'InvalidWormholeSequence';
      msg: 'InvalidWormholeSequence';
    },
    {
      code: 6015;
      name: 'OwnerOnly';
      msg: 'OwnerOnly';
    },
    {
      code: 6016;
      name: 'InvalidForeignContract';
      msg: 'InvalidForeignContract';
    },
    {
      code: 6017;
      name: 'InvalidPayloadMessage';
      msg: 'InvalidPayloadMessage';
    },
    {
      code: 6018;
      name: 'InvalidActionId';
      msg: 'InvalidActionId';
    },
    {
      code: 6019;
      name: 'InvalidCallerAddress';
      msg: 'InvalidCallerAddress';
    },
    {
      code: 6020;
      name: 'UnauthorizedCallerAddress';
      msg: 'UnauthorizedCallerAddress';
    },
    {
      code: 6021;
      name: 'WrongPayablesHostCountProvided';
      msg: 'WrongPayablesHostCountProvided';
    },
    {
      code: 6022;
      name: 'WrongPaymentPayerCountProvided';
      msg: 'WrongPaymentPayerCountProvided';
    },
    {
      code: 6023;
      name: 'WrongWithdrawalsHostCountProvided';
      msg: 'WrongWithdrawalsHostCountProvided';
    },
    {
      code: 6024;
      name: 'ZeroBridgeAmount';
      msg: 'ZeroBridgeAmount';
    },
    {
      code: 6025;
      name: 'InvalidTokenBridgeConfig';
      msg: 'InvalidTokenBridgeConfig';
    },
    {
      code: 6026;
      name: 'InvalidTokenBridgeAuthoritySigner';
      msg: 'InvalidTokenBridgeAuthoritySigner';
    },
    {
      code: 6027;
      name: 'InvalidTokenBridgeCustodySigner';
      msg: 'InvalidTokenBridgeCustodySigner';
    },
    {
      code: 6028;
      name: 'InvalidTokenBridgeSender';
      msg: 'InvalidTokenBridgeSender';
    },
    {
      code: 6029;
      name: 'InvalidRecipient';
      msg: 'InvalidRecipient';
    },
    {
      code: 6030;
      name: 'InvalidTransferTokenAccount';
      msg: 'InvalidTransferTokenAccount';
    },
    {
      code: 6031;
      name: 'InvalidTransferToChain';
      msg: 'InvalidTransferTokenChain';
    },
    {
      code: 6032;
      name: 'InvalidTransferTokenChain';
      msg: 'InvalidTransferTokenChain';
    },
    {
      code: 6033;
      name: 'InvalidTransferToAddress';
      msg: 'InvalidTransferToAddress';
    },
    {
      code: 6034;
      name: 'AlreadyRedeemed';
      msg: 'AlreadyRedeemed';
    },
    {
      code: 6035;
      name: 'InvalidTokenBridgeForeignEndpoint';
      msg: 'InvalidTokenBridgeForeignEndpoint';
    },
    {
      code: 6036;
      name: 'InvalidTokenBridgeMintAuthority';
      msg: 'InvalidTokenBridgeMintAuthority';
    },
    {
      code: 6037;
      name: 'NotMatchingPayableId';
      msg: 'NotMatchingPayableId';
    },
    {
      code: 6038;
      name: 'NotMatchingTransactionAmount';
      msg: 'NotMatchingTransactionAmount';
    },
    {
      code: 6039;
      name: 'NotMatchingTransactionToken';
      msg: 'NotMatchingTransactionToken';
    },
    {
      code: 6040;
      name: 'WrongChainStatsProvided';
      msg: 'WrongChainStatsProvided';
    }
  ];
};

export const IDL: Chainbills = {
  version: '0.1.0',
  name: 'chainbills',
  constants: [
    {
      name: 'ACTION_ID_INITIALIZE_PAYABLE',
      type: 'u8',
      value: '1'
    },
    {
      name: 'ACTION_ID_CLOSE_PAYABLE',
      type: 'u8',
      value: '2'
    },
    {
      name: 'ACTION_ID_REOPEN_PAYABLE',
      type: 'u8',
      value: '3'
    },
    {
      name: 'ACTION_ID_UPDATE_PAYABLE_DESCRIPTION',
      type: 'u8',
      value: '4'
    },
    {
      name: 'ACTION_ID_PAY',
      type: 'u8',
      value: '5'
    },
    {
      name: 'ACTION_ID_WITHDRAW',
      type: 'u8',
      value: '6'
    },
    {
      name: 'MAX_PAYABLES_DESCRIPTION_LENGTH',
      type: {
        defined: 'usize'
      },
      value: '3000'
    },
    {
      name: 'MAX_PAYABLES_TOKENS',
      type: {
        defined: 'usize'
      },
      value: '20'
    },
    {
      name: 'SEED_PREFIX_SENDING',
      type: 'bytes',
      value: '[115, 101, 110, 100, 105, 110, 103]'
    }
  ],
  instructions: [
    {
      name: 'initialize',
      docs: [
        "Initialize the program. Specifically initialize the program's",
        "Config, GlobalStats, and Solana's ChainStats.",
        '',
        'Config holds addresses and infos that this program will use to interact',
        'with Wormhole. Other method handlers would reference properties of',
        'Config to execute Wormhole-related CPI calls.',
        '',
        'GlobalStats keeps track of the count of all entities in this program.',
        'Entities include Users, Payables, Payments, and Withdrawals.',
        'Initializing any other entity must increment the appropriate count in',
        'GlobalStats.',
        '',
        'ChainStats is like GlobalStats but just for each BlockChain Network',
        "involved in Chainbills. Solana's ChainStats also gets initialized here."
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
          name: 'thisProgram',
          isMut: false,
          isSigner: false,
          docs: [
            'Helps in ensuring that the provided `this_program_data` is the',
            'correct one.'
          ]
        },
        {
          name: 'thisProgramData',
          isMut: false,
          isSigner: false,
          docs: [
            'Helps in ensuring that the provided `owner` is a correct owner.'
          ]
        },
        {
          name: 'globalStats',
          isMut: true,
          isSigner: false,
          docs: [
            'Keeps track of the counts of all entities (Users, Payables, Payments,',
            'and Withdrawals) in Chainbills. It is also the signer PDA for the holding',
            'balances in this program.'
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
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false,
          docs: ['Wormhole program.']
        },
        {
          name: 'tokenBridgeProgram',
          isMut: false,
          isSigner: false,
          docs: ['Token Bridge program.']
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
          name: 'tokenBridgeConfig',
          isMut: false,
          isSigner: false,
          docs: [
            'Token Bridge config. Token Bridge program needs this account to',
            'invoke the Wormhole program to post messages. Even though it is a',
            'required account for redeeming token transfers, it is not actually',
            'used for completing these transfers.'
          ]
        },
        {
          name: 'emitter',
          isMut: false,
          isSigner: false,
          docs: [
            "Token Bridge. This isn't an account that holds data; it is purely",
            'just a signer for posting Wormhole messages directly or on behalf of',
            'the Token Bridge program.'
          ]
        },
        {
          name: 'feeCollector',
          isMut: true,
          isSigner: false,
          docs: [
            'Wormhole fee collector account, which requires lamports before the',
            'program can post a message (if there is a fee).',
            '[`wormhole::post_message`] requires this account be mutable.'
          ]
        },
        {
          name: 'sequence',
          isMut: true,
          isSigner: false,
          docs: [
            'message is posted, so it needs to be an [UncheckedAccount] for the',
            '[`initialize`](crate::initialize) instruction.',
            '[`wormhole::post_message`] requires this account be mutable.'
          ]
        },
        {
          name: 'mintAuthority',
          isMut: false,
          isSigner: false,
          docs: [
            'data; it is purely just a signer (SPL mint authority) for Token Bridge',
            'wrapped assets.'
          ]
        },
        {
          name: 'custodySigner',
          isMut: false,
          isSigner: false,
          docs: [
            'data; it is purely just a signer for Token Bridge SPL tranfers.'
          ]
        },
        {
          name: 'authoritySigner',
          isMut: false,
          isSigner: false,
          docs: [
            'data; it is purely just a signer for SPL tranfers when it is delegated',
            'spending approval for the SPL token.'
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
          name: 'owner',
          isMut: true,
          isSigner: true,
          docs: [
            'Owner of the program set in the [`Config`] account. Signer for creating',
            'the [`ForeignContract`] account.'
          ]
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false,
          docs: [
            'Config account. This program requires that the `owner` specified in the',
            'context equals the pubkey specified in this account. Read-only.'
          ]
        },
        {
          name: 'chainStats',
          isMut: true,
          isSigner: false,
          docs: [
            'Keeps track of the counts of all entities (Users, Payables, Payments,',
            'and Withdrawals) initialized on this new Chain in Chainbills.'
          ]
        },
        {
          name: 'foreignContract',
          isMut: true,
          isSigner: false,
          docs: [
            'Foreign Contract account. Create this account if a contract has not been',
            'registered yet for this Wormhole chain ID. If there already is a contract',
            'address saved in this account, overwrite it.'
          ]
        },
        {
          name: 'tokenBridgeForeignEndpoint',
          isMut: false,
          isSigner: false,
          docs: [
            'Token Bridge foreign endpoint. This account should really be one',
            "endpoint per chain, but Token Bridge's PDA allows for multiple",
            'endpoints for each chain. We store the proper endpoint for the',
            'emitter chain.'
          ]
        },
        {
          name: 'tokenBridgeProgram',
          isMut: false,
          isSigner: false,
          docs: ['Token Bridge program.']
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
      name: 'updateMaximumWithdrawalFee',
      docs: [
        'Updates the maximum withdrawal fees of the given token.',
        '',
        '### Args',
        '* token<[u8; 32]>: The Wormhole-normalized address of the token for which',
        'its maximum withdrawal fees is been set.',
        '* fee<u64>: The max fee to set.'
      ],
      accounts: [
        {
          name: 'owner',
          isMut: true,
          isSigner: true,
          docs: ['Owner of the program set in the [`Config`] account.']
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false,
          docs: ['Config account to confirm owner status.']
        },
        {
          name: 'maxWithdrawalFeeDetails',
          isMut: true,
          isSigner: false,
          docs: ['Account that stores the max withdrawal fee details.']
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false
        }
      ],
      args: [
        {
          name: 'token',
          type: {
            array: ['u8', 32]
          }
        },
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
          isSigner: false
        },
        {
          name: 'globalStats',
          isMut: true,
          isSigner: false
        },
        {
          name: 'chainStats',
          isMut: true,
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
      args: []
    },
    {
      name: 'initializePayable',
      docs: [
        'Initialize a Payable',
        '',
        '### args',
        '* description<String>: what users see when they want to make payment.',
        '* tokens_and_amounts<Vec<TokenAndAmount>>: The allowed tokens',
        '(and their amounts) on this payable.',
        '* allows_free_payments<bool>: Whether this payable should allow payments',
        'of any amounts of any token.'
      ],
      accounts: [
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
          name: 'globalStats',
          isMut: true,
          isSigner: false
        },
        {
          name: 'chainStats',
          isMut: true,
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
          name: 'description',
          type: 'string'
        },
        {
          name: 'tokensAndAmounts',
          type: {
            vec: {
              defined: 'TokenAndAmount'
            }
          }
        },
        {
          name: 'allowsFreePayments',
          type: 'bool'
        }
      ]
    },
    {
      name: 'initializePayableReceived',
      docs: [
        'Initialize a Payable from another chain network',
        '',
        '### args',
        '* vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the',
        'source chain.',
        '* caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the',
        'creator of the payable on the source chain.',
        '* host_count<u64>: The nth count of the new payable from the host.'
      ],
      accounts: [
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
          name: 'globalStats',
          isMut: true,
          isSigner: false
        },
        {
          name: 'chainStats',
          isMut: true,
          isSigner: false
        },
        {
          name: 'signer',
          isMut: true,
          isSigner: true
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false
        },
        {
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false
        },
        {
          name: 'vaa',
          isMut: false,
          isSigner: false,
          docs: [
            'Verified Wormhole message account. The Wormhole program verified',
            'signatures and posted the account data here. Read-only.'
          ]
        },
        {
          name: 'foreignContract',
          isMut: false,
          isSigner: false,
          docs: [
            "Foreign contract account. The vaa's `emitter_address` must",
            "agree with the one we have registered for this message's `emitter_chain`",
            '(chain ID). Read-only.'
          ]
        },
        {
          name: 'wormholeReceived',
          isMut: true,
          isSigner: false,
          docs: [
            'Received account. [`receive_message`](crate::receive_message) will',
            "deserialize the Wormhole message's payload and save it to this account.",
            'This account cannot be overwritten, and will prevent Wormhole message',
            'replay with the same sequence.'
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
          name: 'vaaHash',
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'caller',
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'hostCount',
          type: 'u64'
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
      name: 'closePayableReceived',
      docs: [
        'Stop a payable from accepting payments from contract call on',
        'another chain. Should be called only by the host (user) that created',
        'the payable.',
        '',
        '### args',
        '* vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the',
        'source chain.',
        '* caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the',
        'creator of the payable on the source chain.'
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
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false
        },
        {
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false
        },
        {
          name: 'vaa',
          isMut: false,
          isSigner: false,
          docs: [
            'Verified Wormhole message account. The Wormhole program verified',
            'signatures and posted the account data here. Read-only.'
          ]
        },
        {
          name: 'foreignContract',
          isMut: false,
          isSigner: false,
          docs: [
            "Foreign contract account. The vaa's `emitter_address` must",
            "agree with the one we have registered for this message's `emitter_chain`",
            '(chain ID). Read-only.'
          ]
        },
        {
          name: 'wormholeReceived',
          isMut: true,
          isSigner: false,
          docs: [
            'Received account. [`wormhole_received`](crate::wormhole_received) will',
            "deserialize the Wormhole message's payload and save it to this account.",
            'This account cannot be overwritten, and will prevent Wormhole message',
            'replay with the same sequence.'
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
          name: 'vaaHash',
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'caller',
          type: {
            array: ['u8', 32]
          }
        }
      ]
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
      name: 'reopenPayableReceived',
      docs: [
        'Allow a closed payable to continue accepting payments from contract',
        'call on another chain. Should be called only by the host (user)',
        'that owns the payable.',
        '',
        '### args',
        '* vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the',
        'source chain.',
        '* caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the',
        'creator of the payable on the source chain.'
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
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false
        },
        {
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false
        },
        {
          name: 'vaa',
          isMut: false,
          isSigner: false,
          docs: [
            'Verified Wormhole message account. The Wormhole program verified',
            'signatures and posted the account data here. Read-only.'
          ]
        },
        {
          name: 'foreignContract',
          isMut: false,
          isSigner: false,
          docs: [
            "Foreign contract account. The vaa's `emitter_address` must",
            "agree with the one we have registered for this message's `emitter_chain`",
            '(chain ID). Read-only.'
          ]
        },
        {
          name: 'wormholeReceived',
          isMut: true,
          isSigner: false,
          docs: [
            'Received account. [`wormhole_received`](crate::wormhole_received) will',
            "deserialize the Wormhole message's payload and save it to this account.",
            'This account cannot be overwritten, and will prevent Wormhole message',
            'replay with the same sequence.'
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
          name: 'vaaHash',
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'caller',
          type: {
            array: ['u8', 32]
          }
        }
      ]
    },
    {
      name: 'updatePayableDescription',
      docs: [
        "Allows a payable's host to update the payable's description.",
        '',
        '### args',
        '* description: the new description of the payable.'
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
          name: 'description',
          type: 'string'
        }
      ]
    },
    {
      name: 'updatePayableDescriptionReceived',
      docs: [
        "Allows a payable's host to update the payable's description from a",
        'contract call on another chain.',
        '',
        '### args',
        '* vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the',
        'source chain.',
        '* caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the',
        'creator of the payable on the source chain.'
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
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false
        },
        {
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false
        },
        {
          name: 'vaa',
          isMut: false,
          isSigner: false,
          docs: [
            'Verified Wormhole message account. The Wormhole program verified',
            'signatures and posted the account data here. Read-only.'
          ]
        },
        {
          name: 'foreignContract',
          isMut: false,
          isSigner: false,
          docs: [
            "Foreign contract account. The vaa's `emitter_address` must",
            "agree with the one we have registered for this message's `emitter_chain`",
            '(chain ID). Read-only.'
          ]
        },
        {
          name: 'wormholeReceived',
          isMut: true,
          isSigner: false,
          docs: [
            'Received account. [`wormhole_received`](crate::wormhole_received) will',
            "deserialize the Wormhole message's payload and save it to this account.",
            'This account cannot be overwritten, and will prevent Wormhole message',
            'replay with the same sequence.'
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
          name: 'vaaHash',
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'caller',
          type: {
            array: ['u8', 32]
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
          name: 'payment',
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
          name: 'globalStats',
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
          name: 'payerTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'globalTokenAccount',
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
      name: 'payReceived',
      docs: [
        'Transfers the amount of tokens from another chain network to a payable',
        '',
        '### args',
        '* vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the',
        'source chain.',
        '* caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the',
        'creator of the payable on the source chain.',
        '* payer_count<u64>: The nth count of the new payment from the payer.'
      ],
      accounts: [
        {
          name: 'payment',
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
          name: 'globalStats',
          isMut: true,
          isSigner: false
        },
        {
          name: 'globalTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false
        },
        {
          name: 'chainStats',
          isMut: true,
          isSigner: false
        },
        {
          name: 'foreignContract',
          isMut: false,
          isSigner: false,
          docs: [
            'Foreign Contract account. The registered contract specified in this',
            "account must agree with the target address for the Token Bridge's token",
            'transfer. Read-only.'
          ]
        },
        {
          name: 'tokenBridgeWrappedMint',
          isMut: true,
          isSigner: false,
          docs: [
            'Token Bridge wrapped mint info. This is the SPL token that will be',
            'bridged from the foreign contract. The wrapped mint PDA must agree',
            "with the native token's metadata in the wormhole message. Mutable."
          ]
        },
        {
          name: 'tokenBridgeWrappedMeta',
          isMut: false,
          isSigner: false,
          docs: [
            "Token Bridge program's wrapped metadata, which stores info",
            'about the token from its native chain:',
            '* Wormhole Chain ID',
            "* Token's native contract address",
            "* Token's native decimals"
          ]
        },
        {
          name: 'tokenBridgeClaim',
          isMut: true,
          isSigner: false,
          docs: [
            'is true if the bridged assets have been claimed. If the transfer has',
            'not been redeemed, this account will not exist yet.'
          ]
        },
        {
          name: 'tokenBridgeForeignEndpoint',
          isMut: false,
          isSigner: false,
          docs: [
            'Token Bridge foreign endpoint. This account should really be one',
            'endpoint per chain, but the PDA allows for multiple endpoints for each',
            'chain! We store the proper endpoint for the emitter chain.'
          ]
        },
        {
          name: 'tokenBridgeMintAuthority',
          isMut: false,
          isSigner: false
        },
        {
          name: 'tokenBridgeConfig',
          isMut: false,
          isSigner: false
        },
        {
          name: 'wormholeBridge',
          isMut: true,
          isSigner: false,
          docs: ['Wormhole bridge data. Mutable.']
        },
        {
          name: 'vaa',
          isMut: false,
          isSigner: false,
          docs: [
            'Verified Wormhole message account. The Wormhole program verified',
            'signatures and posted the account data here. Read-only.'
          ]
        },
        {
          name: 'wormholeReceived',
          isMut: true,
          isSigner: false,
          docs: [
            'Received account. [`receive_message`](crate::receive_message) will',
            "deserialize the Wormhole message's payload and save it to this account.",
            'This account cannot be overwritten, and will prevent Wormhole message',
            'replay with the same sequence.'
          ]
        },
        {
          name: 'signer',
          isMut: true,
          isSigner: true
        },
        {
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false
        },
        {
          name: 'tokenBridgeProgram',
          isMut: false,
          isSigner: false
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false
        },
        {
          name: 'rent',
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
          name: 'vaaHash',
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'caller',
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'payerCount',
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
          name: 'globalStats',
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
          name: 'globalTokenAccount',
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
      name: 'withdrawReceivedHandler',
      docs: [
        'Transfers the amount of tokens from a payable to its host on another',
        'chain network',
        '',
        '### args',
        '* vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the',
        'source chain.',
        '* caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the',
        'creator of the payable on the source chain.',
        '* host_count<u64>: The nth count of the new withdrawal from the host.'
      ],
      accounts: [
        {
          name: 'withdrawal',
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
          name: 'globalStats',
          isMut: true,
          isSigner: false
        },
        {
          name: 'globalTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false
        },
        {
          name: 'chainStats',
          isMut: true,
          isSigner: false
        },
        {
          name: 'foreignContract',
          isMut: false,
          isSigner: false,
          docs: [
            "Foreign contract account. The vaa's `emitter_address` must",
            "agree with the one we have registered for this message's `emitter_chain`",
            '(chain ID). Read-only.'
          ]
        },
        {
          name: 'vaa',
          isMut: false,
          isSigner: false,
          docs: [
            'Verified Wormhole message account. The Wormhole program verified',
            'signatures and posted the account data here. Read-only.'
          ]
        },
        {
          name: 'wormholeReceived',
          isMut: true,
          isSigner: false,
          docs: [
            'Received account. [`receive_message`](crate::receive_message) will',
            "deserialize the Wormhole message's payload and save it to this account.",
            'This account cannot be overwritten, and will prevent Wormhole message',
            'replay with the same sequence.'
          ]
        },
        {
          name: 'tokenBridgeWrappedMint',
          isMut: true,
          isSigner: false,
          docs: [
            'Token Bridge wrapped mint info. This is the SPL token that will be',
            'bridged to the foreign contract. The wrapped mint PDA must agree',
            "with the native token's metadata. Mutable."
          ]
        },
        {
          name: 'maxWithdrawalFeeDetails',
          isMut: false,
          isSigner: false,
          docs: ['Account that stores the max withdrawal fee details.']
        },
        {
          name: 'tokenBridgeWrappedMeta',
          isMut: false,
          isSigner: false,
          docs: [
            "Token Bridge program's wrapped metadata, which stores info",
            'about the token from its native chain:',
            '* Wormhole Chain ID',
            "* Token's native contract address",
            "* Token's native decimals"
          ]
        },
        {
          name: 'tokenBridgeAuthoritySigner',
          isMut: false,
          isSigner: false
        },
        {
          name: 'tokenBridgeConfig',
          isMut: false,
          isSigner: false
        },
        {
          name: 'wormholeBridge',
          isMut: true,
          isSigner: false,
          docs: ['Wormhole bridge data. Mutable.']
        },
        {
          name: 'wormholeMessage',
          isMut: true,
          isSigner: false,
          docs: ['tokens transferred in this account.']
        },
        {
          name: 'emitter',
          isMut: true,
          isSigner: false
        },
        {
          name: 'sequence',
          isMut: true,
          isSigner: false
        },
        {
          name: 'feeCollector',
          isMut: true,
          isSigner: false,
          docs: ['Wormhole fee collector. Mutable.']
        },
        {
          name: 'signer',
          isMut: true,
          isSigner: true
        },
        {
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false
        },
        {
          name: 'tokenBridgeProgram',
          isMut: false,
          isSigner: false
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false
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
        },
        {
          name: 'clock',
          isMut: false,
          isSigner: false
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false
        }
      ],
      args: [
        {
          name: 'vaaHash',
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'caller',
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'hostCount',
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
          name: 'globalStats',
          isMut: false,
          isSigner: false
        },
        {
          name: 'thisProgram',
          isMut: false,
          isSigner: false
        },
        {
          name: 'thisProgramData',
          isMut: false,
          isSigner: false
        },
        {
          name: 'globalTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'adminTokenAccount',
          isMut: true,
          isSigner: false
        },
        {
          name: 'admin',
          isMut: false,
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
      name: 'chainStats',
      docs: ['Keeps track of all activities on each chain.'],
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
            docs: ["Program's owner."],
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
            name: 'tokenBridgeConfig',
            docs: [
              "[TokenBridge's Config](wormhole_anchor_sdk::token_bridge::Config)",
              'address. Needed by the TokenBridge to post messages to Wormhole.'
            ],
            type: 'publicKey'
          },
          {
            name: 'emitter',
            docs: ['Used by Wormhole and TokenBridge to send messages'],
            type: 'publicKey'
          },
          {
            name: 'feeCollector',
            docs: [
              "Wormhole's [FeeCollector](wormhole_anchor_sdk::wormhole::FeeCollector)",
              'address.'
            ],
            type: 'publicKey'
          },
          {
            name: 'sequence',
            docs: [
              'The [SequenceTracker](wormhole_anchor_sdk::wormhole::SequenceTracker)',
              'address for Wormhole messages. It tracks the number of messages posted',
              'by this program.'
            ],
            type: 'publicKey'
          },
          {
            name: 'mintAuthority',
            docs: [
              "Doesn't hold data. Is SPL mint authority (signer) for Token Bridge",
              'wrapped assets.'
            ],
            type: 'publicKey'
          },
          {
            name: 'custodySigner',
            docs: [
              "Doesn't hold data. Signs custody (holding-balances) Token Bridge",
              'SPL transfers.'
            ],
            type: 'publicKey'
          },
          {
            name: 'authoritySigner',
            docs: [
              "Doesn't hold data. Signs outbound TokenBridge SPL transfers."
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
          },
          {
            name: 'tokenBridgeForeignEndpoint',
            docs: ["Token Bridge program's foreign endpoint account key."],
            type: 'publicKey'
          }
        ]
      }
    },
    {
      name: 'globalStats',
      docs: ['Keeps track of all activity accounts across Chainbills.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'usersCount',
            docs: ['Total number of users that have ever been initialized.'],
            type: 'u64'
          },
          {
            name: 'payablesCount',
            docs: ['Total number of payables that have ever been created.'],
            type: 'u64'
          },
          {
            name: 'paymentsCount',
            docs: ['Total number of payments that have ever been made.'],
            type: 'u64'
          },
          {
            name: 'withdrawalsCount',
            docs: ['Total number of withdrawals that have ever been made.'],
            type: 'u64'
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
            docs: [
              'The Wormhole-normalized address of the token mint.',
              'This should be the bridged address on Solana.'
            ],
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'amount',
            docs: [
              'The Wormhole-normalized (with 8 decimals) amount of the token.'
            ],
            type: 'u64'
          }
        ]
      }
    },
    {
      name: 'payable',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'globalCount',
            docs: [
              'The nth count of global payables at the point this payable was created.'
            ],
            type: 'u64'
          },
          {
            name: 'chainCount',
            docs: [
              'The nth count of payables on the calling chain at the point this payable',
              'was created.'
            ],
            type: 'u64'
          },
          {
            name: 'host',
            docs: ['The address of the User account that owns this Payable.'],
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
            name: 'description',
            docs: [
              'Displayed to payers when the make payments to this payable.',
              'Set by the host.'
            ],
            type: 'string'
          },
          {
            name: 'tokensAndAmounts',
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
            name: 'allowsFreePayments',
            docs: [
              'Whether this payable allows payments any amount in any token.'
            ],
            type: 'bool'
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
      name: 'payment',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'globalCount',
            docs: [
              'The nth count of global payments at the point this payment was made.'
            ],
            type: 'u64'
          },
          {
            name: 'chainCount',
            docs: [
              'The nth count of payments on the calling chain at the point this payment',
              'was made.'
            ],
            type: 'u64'
          },
          {
            name: 'payable',
            docs: [
              'The address of the Payable to which this Payment was made.'
            ],
            type: 'publicKey'
          },
          {
            name: 'payer',
            docs: ['The address of the User account that made this Payment.'],
            type: 'publicKey'
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
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'ownerWallet',
            docs: [
              'The Wormhole-normalized address of the person who owns this User account.'
            ],
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'chainId',
            docs: ['The Wormhole Chain Id of the owner_wallet'],
            type: 'u16'
          },
          {
            name: 'globalCount',
            docs: [
              'The nth count of global users at the point this user was initialized.'
            ],
            type: 'u64'
          },
          {
            name: 'chainCount',
            docs: [
              'The nth count of users on the calling chain at the point this user was',
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
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'globalCount',
            docs: [
              'The nth count of global withdrawals at the point this',
              'withdrawal was made.'
            ],
            type: 'u64'
          },
          {
            name: 'chainCount',
            docs: [
              'The nth count of withdrawals on the calling chain at the point',
              'this withdrawal was made.'
            ],
            type: 'u64'
          },
          {
            name: 'payable',
            docs: [
              'The address of the Payable from which this Withdrawal was made.'
            ],
            type: 'publicKey'
          },
          {
            name: 'host',
            docs: [
              "The address of the User account (payable's owner)",
              'that made this Withdrawal.'
            ],
            type: 'publicKey'
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
        'A combination of a Wormhole-normalized token address and its',
        'Wormhole-normalized associated amount.',
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
            docs: [
              'The Wormhole-normalized address of the associated token mint.',
              'This should be the bridged address on Solana.'
            ],
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'amount',
            docs: [
              'The Wormhole-normalized (with 8 decimals) amount of the token.'
            ],
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
      fields: []
    },
    {
      name: 'UpdatedMaxWithdrawalFeeEvent',
      fields: []
    },
    {
      name: 'InitializedUserEvent',
      fields: [
        {
          name: 'globalCount',
          type: 'u64',
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
      name: 'InitializedPayableEvent',
      fields: [
        {
          name: 'globalCount',
          type: 'u64',
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
      fields: []
    },
    {
      name: 'ReopenPayableEvent',
      fields: []
    },
    {
      name: 'UpdatePayableDescriptionEvent',
      fields: []
    },
    {
      name: 'PayEvent',
      fields: [
        {
          name: 'globalCount',
          type: 'u64',
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
          name: 'globalCount',
          type: 'u64',
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
      fields: []
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
    },
    {
      code: 6008,
      name: 'ProgramDataUnauthorized',
      msg: 'wrong program data account provided'
    },
    {
      code: 6009,
      name: 'AdminUnauthorized',
      msg: 'you are not an admin'
    },
    {
      code: 6010,
      name: 'EmptyDescriptionProvided',
      msg: 'please provide a valid description'
    },
    {
      code: 6011,
      name: 'InvalidWormholeBridge',
      msg: 'InvalidWormholeBridge'
    },
    {
      code: 6012,
      name: 'InvalidWormholeFeeCollector',
      msg: 'InvalidWormholeFeeCollector'
    },
    {
      code: 6013,
      name: 'InvalidWormholeEmitter',
      msg: 'InvalidWormholeEmitter'
    },
    {
      code: 6014,
      name: 'InvalidWormholeSequence',
      msg: 'InvalidWormholeSequence'
    },
    {
      code: 6015,
      name: 'OwnerOnly',
      msg: 'OwnerOnly'
    },
    {
      code: 6016,
      name: 'InvalidForeignContract',
      msg: 'InvalidForeignContract'
    },
    {
      code: 6017,
      name: 'InvalidPayloadMessage',
      msg: 'InvalidPayloadMessage'
    },
    {
      code: 6018,
      name: 'InvalidActionId',
      msg: 'InvalidActionId'
    },
    {
      code: 6019,
      name: 'InvalidCallerAddress',
      msg: 'InvalidCallerAddress'
    },
    {
      code: 6020,
      name: 'UnauthorizedCallerAddress',
      msg: 'UnauthorizedCallerAddress'
    },
    {
      code: 6021,
      name: 'WrongPayablesHostCountProvided',
      msg: 'WrongPayablesHostCountProvided'
    },
    {
      code: 6022,
      name: 'WrongPaymentPayerCountProvided',
      msg: 'WrongPaymentPayerCountProvided'
    },
    {
      code: 6023,
      name: 'WrongWithdrawalsHostCountProvided',
      msg: 'WrongWithdrawalsHostCountProvided'
    },
    {
      code: 6024,
      name: 'ZeroBridgeAmount',
      msg: 'ZeroBridgeAmount'
    },
    {
      code: 6025,
      name: 'InvalidTokenBridgeConfig',
      msg: 'InvalidTokenBridgeConfig'
    },
    {
      code: 6026,
      name: 'InvalidTokenBridgeAuthoritySigner',
      msg: 'InvalidTokenBridgeAuthoritySigner'
    },
    {
      code: 6027,
      name: 'InvalidTokenBridgeCustodySigner',
      msg: 'InvalidTokenBridgeCustodySigner'
    },
    {
      code: 6028,
      name: 'InvalidTokenBridgeSender',
      msg: 'InvalidTokenBridgeSender'
    },
    {
      code: 6029,
      name: 'InvalidRecipient',
      msg: 'InvalidRecipient'
    },
    {
      code: 6030,
      name: 'InvalidTransferTokenAccount',
      msg: 'InvalidTransferTokenAccount'
    },
    {
      code: 6031,
      name: 'InvalidTransferToChain',
      msg: 'InvalidTransferTokenChain'
    },
    {
      code: 6032,
      name: 'InvalidTransferTokenChain',
      msg: 'InvalidTransferTokenChain'
    },
    {
      code: 6033,
      name: 'InvalidTransferToAddress',
      msg: 'InvalidTransferToAddress'
    },
    {
      code: 6034,
      name: 'AlreadyRedeemed',
      msg: 'AlreadyRedeemed'
    },
    {
      code: 6035,
      name: 'InvalidTokenBridgeForeignEndpoint',
      msg: 'InvalidTokenBridgeForeignEndpoint'
    },
    {
      code: 6036,
      name: 'InvalidTokenBridgeMintAuthority',
      msg: 'InvalidTokenBridgeMintAuthority'
    },
    {
      code: 6037,
      name: 'NotMatchingPayableId',
      msg: 'NotMatchingPayableId'
    },
    {
      code: 6038,
      name: 'NotMatchingTransactionAmount',
      msg: 'NotMatchingTransactionAmount'
    },
    {
      code: 6039,
      name: 'NotMatchingTransactionToken',
      msg: 'NotMatchingTransactionToken'
    },
    {
      code: 6040,
      name: 'WrongChainStatsProvided',
      msg: 'WrongChainStatsProvided'
    }
  ]
};
