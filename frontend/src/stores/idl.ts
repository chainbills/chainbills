/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/chainbills.json`.
 */
export type Chainbills = {
  "address": "DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk",
  "metadata": {
    "name": "chainbills",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Cross-chain Crypto Payment Gateway powered by Wormhole + Circle CCTP"
  },
  "instructions": [
    {
      "name": "adminSyncForeignPayable",
      "docs": [
        "Admin escape hatch: apply a PayablePayload without a VAA.",
        "Used when no common protocol exists between two chains."
      ],
      "discriminator": [
        95,
        147,
        85,
        212,
        11,
        181,
        173,
        46
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "The program owner. Must sign."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config — validates owner."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — incremented when a new ForeignPayable is created."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "foreignPayable",
          "docs": [
            "ForeignPayable PDA for the given payable_id. Created if it doesn't exist."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  111,
                  114,
                  101,
                  105,
                  103,
                  110,
                  95,
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "payableId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "payableId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "srcCbChainId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "nonce",
          "type": "u64"
        },
        {
          "name": "actionType",
          "type": "u8"
        },
        {
          "name": "ataaData",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "allowToken",
      "docs": [
        "Create or update a TokenConfig PDA marking a mint as allowed."
      ],
      "discriminator": [
        127,
        147,
        164,
        111,
        0,
        161,
        111,
        84
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "The program owner. Must sign."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config — validates owner."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tokenMint",
          "docs": [
            "The token mint to allow. Must be owned by a recognized token program."
          ]
        },
        {
          "name": "tokenConfig",
          "docs": [
            "TokenConfig PDA for this mint. Created if it doesn't exist yet."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "maxWithdrawalFee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "broadcastPayableUpdate",
      "docs": [
        "Broadcast this payable's current state to all registered foreign chains."
      ],
      "discriminator": [
        244,
        117,
        4,
        65,
        250,
        250,
        151,
        79
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "The host or program owner calling the broadcast."
          ],
          "signer": true
        },
        {
          "name": "payable",
          "docs": [
            "The payable to broadcast. Authority must be host or owner."
          ]
        },
        {
          "name": "config",
          "docs": [
            "Config — provides has_wormhole/has_cctp flags and nonce counter."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — incremented on successful broadcasts."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "actionType",
          "type": "u8"
        }
      ]
    },
    {
      "name": "closePayable",
      "docs": [
        "Close a payable. Broadcasts close to all foreign chains."
      ],
      "discriminator": [
        155,
        244,
        163,
        34,
        116,
        115,
        203,
        109
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "userRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "payable.host_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "stats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "activityRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "stats"
              }
            ]
          }
        },
        {
          "name": "userActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "userRecord"
              }
            ]
          }
        },
        {
          "name": "payableActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createPayable",
      "docs": [
        "Create a new payable (public invoice). Records PayableCreated activity.",
        "Broadcasts PayablePayload to all registered foreign chains."
      ],
      "discriminator": [
        192,
        171,
        199,
        248,
        232,
        4,
        38,
        46
      ],
      "accounts": [
        {
          "name": "host",
          "docs": [
            "The host creating the payable. Must sign. Pays for account rent."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "userRecord",
          "docs": [
            "UserRecord for the host. Created if this is their first action."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              }
            ]
          }
        },
        {
          "name": "payable",
          "docs": [
            "The new Payable PDA. Seeded with host + host's current payables_count."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.payables_count",
                "account": "userRecord"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "docs": [
            "Vault authority PDA. No data — pure PDA that owns vault ATAs for this",
            "payable. CHECK: PDA with no data, used as ATA authority. Seeds",
            "validated by constraint."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              }
            ]
          }
        },
        {
          "name": "config",
          "docs": [
            "Program config — owner not needed here, but stats are split."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "activityRecord",
          "docs": [
            "Global activity record for this event."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "stats"
              }
            ]
          }
        },
        {
          "name": "userActivityPointer",
          "docs": [
            "User-scoped activity pointer."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "userRecord"
              }
            ]
          }
        },
        {
          "name": "payableActivityPointer",
          "docs": [
            "Payable-scoped activity pointer."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "const",
                "value": [
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "allowedTokensAndAmounts",
          "type": {
            "vec": {
              "defined": {
                "name": "tokenAndAmount"
              }
            }
          }
        },
        {
          "name": "isAutoWithdraw",
          "type": "bool"
        }
      ]
    },
    {
      "name": "disallowToken",
      "docs": [
        "Mark a previously allowed token as disallowed."
      ],
      "discriminator": [
        128,
        24,
        199,
        234,
        114,
        157,
        151,
        177
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "The program owner. Must sign."
          ],
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config — validates owner."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tokenConfig",
          "docs": [
            "The TokenConfig to update. Must already exist."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "token_config.mint",
                "account": "tokenConfig"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "docs": [
        "One-time initialization. Creates GlobalConfig. Only the program's",
        "upgrade authority may call this."
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "The upgrade authority of the program. Must sign. Becomes the program",
            "owner."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "program",
          "docs": [
            "The program account itself — used to look up its programdata address."
          ],
          "address": "DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk"
        },
        {
          "name": "programData",
          "docs": [
            "The program's upgrade data account. Validates that `authority` is the",
            "upgrade authority — the only entity that should be able to initialize."
          ]
        },
        {
          "name": "config",
          "docs": [
            "Admin config PDA. Seeds: [b\"config\"]."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Chain statistics PDA. Seeds: [b\"stats\"]."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "senderAuthority",
          "docs": [
            "Sender authority PDA — keyless signer for CCTP deposit_for_burn CPIs.",
            "Seeds: [b\"sender_authority\"]."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  110,
                  100,
                  101,
                  114,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "pay",
      "docs": [
        "Pay a local payable with an SPL Token or Token-2022 token.",
        "If is_auto_withdraw is set, triggers immediate withdrawal."
      ],
      "discriminator": [
        119,
        18,
        216,
        65,
        192,
        117,
        122,
        220
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "userRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true
        },
        {
          "name": "payerTokenAccount",
          "writable": true
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vaultAuthority"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "config",
          "docs": [
            "Config — provides cb_chain_id for payment records."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "tokenConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "userPayment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "user_record.payments_count",
                "account": "userRecord"
              }
            ]
          }
        },
        {
          "name": "payablePayment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.payments_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "activityRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "stats"
              }
            ]
          }
        },
        {
          "name": "userActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "userRecord"
              }
            ]
          }
        },
        {
          "name": "payableActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "payForeignViaCctp",
      "docs": [
        "Cross-chain outbound payment (Solana → EVM). Burns USDC via CCTP,",
        "publishes PaymentPayload via Wormhole shim."
      ],
      "discriminator": [
        158,
        45,
        169,
        136,
        9,
        104,
        126,
        205
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "userRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "foreignPayable",
          "docs": [
            "The foreign payable to pay into. Must exist and not be closed."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  111,
                  114,
                  101,
                  105,
                  103,
                  110,
                  95,
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "foreignPayableId"
              }
            ]
          }
        },
        {
          "name": "config",
          "docs": [
            "Config — provides cb_chain_id (payer chain) and has_wormhole/has_cctp",
            "flags."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "chainRegistry",
          "docs": [
            "Destination chain registry — validates has_cctp and provides",
            "circle_domain."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  97,
                  105,
                  110,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "destCbChainId"
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "docs": [
            "USDC mint — the only token supported for cross-chain payments via CCTP."
          ]
        },
        {
          "name": "payerUsdcAta",
          "docs": [
            "Payer's USDC ATA."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "senderAuthority",
          "docs": [
            "SenderAuthority PDA — keyless signer that owns program_usdc_ata.",
            "Authorizes the CCTP deposit_for_burn CPI."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  110,
                  100,
                  101,
                  114,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "programUsdcAta",
          "docs": [
            "Intermediate program ATA — holds USDC transiently before CCTP burn.",
            "Authority: sender_authority PDA (signs the burn CPI)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "senderAuthority"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userPayment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "user_record.payments_count",
                "account": "userRecord"
              }
            ]
          }
        },
        {
          "name": "activityRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "stats"
              }
            ]
          }
        },
        {
          "name": "userActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "userRecord"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "foreignPayableId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "destCbChainId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "maxFee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "payNative",
      "docs": [
        "Pay a local payable with native SOL."
      ],
      "discriminator": [
        116,
        31,
        164,
        230,
        244,
        244,
        218,
        204
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "userRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true
        },
        {
          "name": "vaultAuthority",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              }
            ]
          }
        },
        {
          "name": "config",
          "docs": [
            "Config — provides cb_chain_id."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "tokenConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "const",
                "value": [
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          "name": "userPayment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "user_record.payments_count",
                "account": "userRecord"
              }
            ]
          }
        },
        {
          "name": "payablePayment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.payments_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "activityRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "stats"
              }
            ]
          }
        },
        {
          "name": "userActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "userRecord"
              }
            ]
          }
        },
        {
          "name": "payableActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "recvPayableUpdateViaCctp",
      "docs": [
        "EVM → Solana payable state sync via CCTP data message (no Wormhole)."
      ],
      "discriminator": [
        49,
        20,
        232,
        86,
        243,
        165,
        16,
        23
      ],
      "accounts": [
        {
          "name": "relayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "cctpProgram"
        },
        {
          "name": "chainRegistry"
        },
        {
          "name": "foreignPayable",
          "writable": true
        },
        {
          "name": "cctpDataNonce",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  99,
                  116,
                  112,
                  95,
                  100,
                  97,
                  116,
                  97,
                  95,
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "srcDomain"
              },
              {
                "kind": "arg",
                "path": "cctpNonce"
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — incremented for received_cctp_update_messages and optionally",
            "total_foreign_payables."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "srcDomain",
          "type": "u32"
        },
        {
          "name": "cctpNonce",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "message",
          "type": "bytes"
        },
        {
          "name": "attestation",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "recvPayableUpdateViaWormhole",
      "docs": [
        "EVM → Solana payable state sync via Wormhole VAA."
      ],
      "discriminator": [
        180,
        87,
        164,
        204,
        97,
        163,
        238,
        35
      ],
      "accounts": [
        {
          "name": "relayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "wormholeProgram"
        },
        {
          "name": "postedVaa",
          "docs": [
            "handler."
          ]
        },
        {
          "name": "chainRegistry"
        },
        {
          "name": "foreignPayable",
          "writable": true
        },
        {
          "name": "consumedVaa",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  115,
                  117,
                  109,
                  101,
                  100,
                  95,
                  118,
                  97,
                  97
                ]
              },
              {
                "kind": "arg",
                "path": "vaaHash"
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — incremented for consumed_wormhole_messages and optionally",
            "total_foreign_payables."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "vaaHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "recvPaymentViaCctpOnly",
      "docs": [
        "EVM → Solana payment receipt via CCTP only (no Wormhole)."
      ],
      "discriminator": [
        4,
        252,
        138,
        199,
        133,
        117,
        79,
        142
      ],
      "accounts": [
        {
          "name": "relayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "cctpProgram"
        },
        {
          "name": "chainRegistry"
        },
        {
          "name": "foreignPayable",
          "writable": true
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "foreignPayable"
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "vaultUsdcAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vaultAuthority"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "payablePayment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "foreignPayable"
              },
              {
                "kind": "account",
                "path": "foreign_payable.payments_count",
                "account": "foreignPayable"
              }
            ]
          }
        },
        {
          "name": "cctpDataNoncePda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  99,
                  116,
                  112,
                  95,
                  100,
                  97,
                  116,
                  97,
                  95,
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "srcDomain"
              },
              {
                "kind": "arg",
                "path": "dataNonce"
              }
            ]
          }
        },
        {
          "name": "cctpBurnNoncePda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  99,
                  116,
                  112,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  98,
                  117,
                  114,
                  110,
                  95,
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "srcDomain"
              },
              {
                "kind": "arg",
                "path": "burnNonce"
              }
            ]
          }
        },
        {
          "name": "paymentNoncePda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116,
                  95,
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "payerChainId"
              },
              {
                "kind": "arg",
                "path": "payer"
              },
              {
                "kind": "arg",
                "path": "paymentNonce"
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "activityRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "stats"
              }
            ]
          }
        },
        {
          "name": "payableActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "foreignPayable"
              },
              {
                "kind": "account",
                "path": "foreign_payable.payments_count",
                "account": "foreignPayable"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "srcDomain",
          "type": "u32"
        },
        {
          "name": "dataNonce",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "burnNonce",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "payerChainId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "payer",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "paymentNonce",
          "type": "u64"
        },
        {
          "name": "dataMessage",
          "type": "bytes"
        },
        {
          "name": "dataAttestation",
          "type": "bytes"
        },
        {
          "name": "burnMessage",
          "type": "bytes"
        },
        {
          "name": "burnAttestation",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "recvPaymentViaCctpWormhole",
      "docs": [
        "EVM → Solana payment receipt via Wormhole VAA + Circle CCTP."
      ],
      "discriminator": [
        187,
        101,
        215,
        40,
        251,
        24,
        185,
        120
      ],
      "accounts": [
        {
          "name": "relayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "wormholeProgram"
        },
        {
          "name": "postedVaa"
        },
        {
          "name": "chainRegistry"
        },
        {
          "name": "foreignPayable",
          "writable": true
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "foreignPayable"
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "vaultUsdcAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vaultAuthority"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "payablePayment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "foreignPayable"
              },
              {
                "kind": "account",
                "path": "foreign_payable.payments_count",
                "account": "foreignPayable"
              }
            ]
          }
        },
        {
          "name": "consumedVaa",
          "docs": [
            "ConsumedVaa PDA — init fails on replay."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  115,
                  117,
                  109,
                  101,
                  100,
                  95,
                  118,
                  97,
                  97
                ]
              },
              {
                "kind": "arg",
                "path": "vaaHash"
              }
            ]
          }
        },
        {
          "name": "paymentNoncePda",
          "docs": [
            "PaymentNonce PDA — init fails on replay."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116,
                  95,
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "payerChainId"
              },
              {
                "kind": "arg",
                "path": "payer"
              },
              {
                "kind": "arg",
                "path": "paymentNonce"
              }
            ]
          }
        },
        {
          "name": "cctpBurnNoncePda",
          "docs": [
            "CctpTokenBurnNonce PDA — init fails on replay."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  99,
                  116,
                  112,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  98,
                  117,
                  114,
                  110,
                  95,
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "srcDomain"
              },
              {
                "kind": "arg",
                "path": "cctpBurnNonce"
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "activityRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "stats"
              }
            ]
          }
        },
        {
          "name": "payableActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "foreignPayable"
              },
              {
                "kind": "account",
                "path": "foreign_payable.payments_count",
                "account": "foreignPayable"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "vaaHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "payerChainId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "payer",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "paymentNonce",
          "type": "u64"
        },
        {
          "name": "cctpBurnNonce",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "srcDomain",
          "type": "u32"
        },
        {
          "name": "burnMessage",
          "type": "bytes"
        },
        {
          "name": "circleAttestation",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "registerChain",
      "docs": [
        "Register a foreign chain with its Wormhole and/or CCTP identifiers."
      ],
      "discriminator": [
        230,
        181,
        152,
        173,
        20,
        163,
        157,
        243
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "The program owner. Must sign and pays for the new ChainRegistry account."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config — validates owner."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "chainRegistry",
          "docs": [
            "ChainRegistry PDA for this foreign chain. Created here (init)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  97,
                  105,
                  110,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "cbChainId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "cbChainId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "hasWormhole",
          "type": "bool"
        },
        {
          "name": "wormholeChainId",
          "type": "u16"
        },
        {
          "name": "hasCctp",
          "type": "bool"
        },
        {
          "name": "circleDomain",
          "type": "u32"
        },
        {
          "name": "registeredContract",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "reopenPayable",
      "docs": [
        "Reopen a previously closed payable. Broadcasts reopen to all foreign",
        "chains."
      ],
      "discriminator": [
        86,
        195,
        169,
        72,
        96,
        182,
        2,
        89
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "userRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "payable.host_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "stats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "activityRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "stats"
              }
            ]
          }
        },
        {
          "name": "userActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "userRecord"
              }
            ]
          }
        },
        {
          "name": "payableActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "updateChain",
      "docs": [
        "Update an existing ChainRegistry (add/change Wormhole or CCTP params)."
      ],
      "discriminator": [
        29,
        50,
        131,
        193,
        37,
        245,
        12,
        171
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "The program owner. Must sign."
          ],
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config — validates owner."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "chainRegistry",
          "docs": [
            "The ChainRegistry to update. Must already exist."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  97,
                  105,
                  110,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "chain_registry.cb_chain_id",
                "account": "chainRegistry"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "hasWormhole",
          "type": "bool"
        },
        {
          "name": "wormholeChainId",
          "type": "u16"
        },
        {
          "name": "hasCctp",
          "type": "bool"
        },
        {
          "name": "circleDomain",
          "type": "u32"
        },
        {
          "name": "registeredContract",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "updateFeeSettings",
      "docs": [
        "Update global fee settings (fee_bps and fee_collector)."
      ],
      "discriminator": [
        155,
        121,
        178,
        253,
        181,
        139,
        103,
        177
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "The program owner. Must sign."
          ],
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config — validated and mutated."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "feeCollector",
          "docs": [
            "The new fee collector wallet. Receives the fee portion on withdrawals."
          ]
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "updatePayableAtaa",
      "docs": [
        "Replace the payable's allowed tokens and amounts list. Reallocates",
        "the Payable account if the new list is larger. Broadcasts update."
      ],
      "discriminator": [
        249,
        76,
        203,
        157,
        81,
        146,
        155,
        197
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "userRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "payable.host_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "stats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "activityRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "stats"
              }
            ]
          }
        },
        {
          "name": "userActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "userRecord"
              }
            ]
          }
        },
        {
          "name": "payableActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "allowedTokensAndAmounts",
          "type": {
            "vec": {
              "defined": {
                "name": "tokenAndAmount"
              }
            }
          }
        }
      ]
    },
    {
      "name": "updatePayableAutoWithdraw",
      "docs": [
        "Flip the auto-withdraw flag. No cross-chain broadcast (local flag only)."
      ],
      "discriminator": [
        58,
        202,
        231,
        196,
        46,
        112,
        250,
        215
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "userRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "payable.host_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "stats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "activityRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "stats"
              }
            ]
          }
        },
        {
          "name": "userActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "userRecord"
              }
            ]
          }
        },
        {
          "name": "payableActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "isAutoWithdraw",
          "type": "bool"
        }
      ]
    },
    {
      "name": "withdraw",
      "docs": [
        "Withdraw SPL Token or Token-2022 from a payable. 2% fee (capped per",
        "token)."
      ],
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "userRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vaultAuthority"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "hostTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "feeCollectorTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "feeCollector"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "feeCollector"
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "config",
          "docs": [
            "Config — provides fee_bps and fee_collector."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "tokenConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "withdrawal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  116,
                  104,
                  100,
                  114,
                  97,
                  119,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.withdrawals_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "activityRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "stats"
              }
            ]
          }
        },
        {
          "name": "userActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "userRecord"
              }
            ]
          }
        },
        {
          "name": "payableActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawNative",
      "docs": [
        "Withdraw native SOL from a payable."
      ],
      "discriminator": [
        113,
        227,
        26,
        32,
        53,
        66,
        90,
        250
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "userRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true
        },
        {
          "name": "vaultAuthority",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              }
            ]
          }
        },
        {
          "name": "feeCollector",
          "writable": true
        },
        {
          "name": "config",
          "docs": [
            "Config — provides fee_bps and fee_collector."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "tokenConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "const",
                "value": [
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          "name": "withdrawal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  116,
                  104,
                  100,
                  114,
                  97,
                  119,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.withdrawals_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "activityRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "stats"
              }
            ]
          }
        },
        {
          "name": "userActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "userRecord"
              }
            ]
          }
        },
        {
          "name": "payableActivityPointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "payable"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "activityRecord",
      "discriminator": [
        239,
        117,
        49,
        169,
        154,
        126,
        114,
        206
      ]
    },
    {
      "name": "cctpDataNonce",
      "discriminator": [
        139,
        86,
        247,
        217,
        98,
        13,
        30,
        211
      ]
    },
    {
      "name": "cctpTokenBurnNonce",
      "discriminator": [
        68,
        102,
        238,
        63,
        198,
        246,
        24,
        188
      ]
    },
    {
      "name": "chainRegistry",
      "discriminator": [
        119,
        7,
        172,
        219,
        63,
        243,
        194,
        231
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "consumedVaa",
      "discriminator": [
        191,
        28,
        148,
        127,
        15,
        13,
        25,
        110
      ]
    },
    {
      "name": "foreignPayable",
      "discriminator": [
        161,
        149,
        110,
        231,
        250,
        181,
        187,
        191
      ]
    },
    {
      "name": "payable",
      "discriminator": [
        216,
        171,
        158,
        251,
        109,
        214,
        139,
        147
      ]
    },
    {
      "name": "payableActivityPointer",
      "discriminator": [
        98,
        176,
        122,
        35,
        26,
        252,
        16,
        3
      ]
    },
    {
      "name": "payablePayment",
      "discriminator": [
        149,
        222,
        228,
        249,
        244,
        91,
        194,
        232
      ]
    },
    {
      "name": "paymentNonce",
      "discriminator": [
        233,
        204,
        107,
        236,
        138,
        172,
        52,
        155
      ]
    },
    {
      "name": "senderAuthority",
      "discriminator": [
        223,
        57,
        178,
        90,
        196,
        17,
        186,
        67
      ]
    },
    {
      "name": "stats",
      "discriminator": [
        190,
        125,
        51,
        63,
        169,
        197,
        36,
        238
      ]
    },
    {
      "name": "tokenConfig",
      "discriminator": [
        92,
        73,
        255,
        43,
        107,
        51,
        117,
        101
      ]
    },
    {
      "name": "userActivityPointer",
      "discriminator": [
        34,
        60,
        199,
        118,
        199,
        52,
        2,
        196
      ]
    },
    {
      "name": "userPayment",
      "discriminator": [
        115,
        161,
        14,
        69,
        223,
        123,
        210,
        9
      ]
    },
    {
      "name": "userRecord",
      "discriminator": [
        210,
        252,
        132,
        218,
        191,
        85,
        173,
        167
      ]
    },
    {
      "name": "withdrawal",
      "discriminator": [
        10,
        45,
        211,
        182,
        129,
        235,
        90,
        82
      ]
    }
  ],
  "events": [
    {
      "name": "chainRegistered",
      "discriminator": [
        249,
        198,
        244,
        115,
        251,
        62,
        51,
        97
      ]
    },
    {
      "name": "chainUpdated",
      "discriminator": [
        7,
        190,
        233,
        250,
        34,
        253,
        48,
        233
      ]
    },
    {
      "name": "closedPayable",
      "discriminator": [
        19,
        150,
        138,
        48,
        224,
        53,
        48,
        107
      ]
    },
    {
      "name": "createdPayable",
      "discriminator": [
        116,
        213,
        179,
        18,
        209,
        33,
        209,
        63
      ]
    },
    {
      "name": "feeSettingsUpdated",
      "discriminator": [
        132,
        70,
        159,
        144,
        246,
        39,
        114,
        101
      ]
    },
    {
      "name": "foreignPaymentReceived",
      "discriminator": [
        215,
        205,
        12,
        245,
        12,
        61,
        79,
        62
      ]
    },
    {
      "name": "payableReceived",
      "discriminator": [
        220,
        233,
        68,
        8,
        169,
        252,
        227,
        57
      ]
    },
    {
      "name": "payableUpdateBroadcasted",
      "discriminator": [
        16,
        191,
        245,
        37,
        198,
        134,
        223,
        132
      ]
    },
    {
      "name": "programInitialized",
      "discriminator": [
        43,
        70,
        110,
        241,
        199,
        218,
        221,
        245
      ]
    },
    {
      "name": "receivedPayableUpdate",
      "discriminator": [
        103,
        87,
        91,
        246,
        171,
        52,
        222,
        182
      ]
    },
    {
      "name": "reopenedPayable",
      "discriminator": [
        183,
        9,
        202,
        149,
        185,
        125,
        91,
        31
      ]
    },
    {
      "name": "tokenAllowed",
      "discriminator": [
        143,
        122,
        92,
        195,
        119,
        118,
        88,
        122
      ]
    },
    {
      "name": "tokenDisallowed",
      "discriminator": [
        171,
        2,
        63,
        82,
        189,
        80,
        133,
        85
      ]
    },
    {
      "name": "updatedPayableAtaa",
      "discriminator": [
        40,
        193,
        196,
        71,
        250,
        11,
        166,
        46
      ]
    },
    {
      "name": "updatedPayableAutoWithdraw",
      "discriminator": [
        85,
        144,
        229,
        26,
        111,
        178,
        105,
        154
      ]
    },
    {
      "name": "userInitialized",
      "discriminator": [
        66,
        195,
        5,
        223,
        42,
        84,
        135,
        60
      ]
    },
    {
      "name": "userPaid",
      "discriminator": [
        97,
        212,
        121,
        73,
        172,
        12,
        183,
        203
      ]
    },
    {
      "name": "withdrew",
      "discriminator": [
        15,
        125,
        249,
        65,
        130,
        86,
        20,
        166
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "payableClosed",
      "msg": "Payable is closed"
    },
    {
      "code": 6001,
      "name": "payableNotClosed",
      "msg": "Payable is not closed"
    },
    {
      "code": 6002,
      "name": "payableNotFound",
      "msg": "Payable not found"
    },
    {
      "code": 6003,
      "name": "tokenNotAllowed",
      "msg": "Token is not allowed"
    },
    {
      "code": 6004,
      "name": "tokenAlreadyAllowed",
      "msg": "Token is already allowed"
    },
    {
      "code": 6005,
      "name": "tokenAmountMismatch",
      "msg": "Token or amount does not match payable's allowed list"
    },
    {
      "code": 6006,
      "name": "duplicateTokenAndAmount",
      "msg": "Duplicate token in allowed tokens and amounts"
    },
    {
      "code": 6007,
      "name": "insufficientBalance",
      "msg": "Insufficient balance for withdrawal"
    },
    {
      "code": 6008,
      "name": "insufficientPaymentAmount",
      "msg": "Payment amount is below the required minimum"
    },
    {
      "code": 6009,
      "name": "unauthorizedHost",
      "msg": "Unauthorized: signer is not the payable host"
    },
    {
      "code": 6010,
      "name": "unauthorizedOwner",
      "msg": "Unauthorized: signer is not the program owner"
    },
    {
      "code": 6011,
      "name": "foreignPayableNotFound",
      "msg": "Foreign payable not found"
    },
    {
      "code": 6012,
      "name": "foreignPayableClosed",
      "msg": "Foreign payable is closed"
    },
    {
      "code": 6013,
      "name": "stalePayableUpdateNonce",
      "msg": "Stale payable update nonce — update already applied or out of order"
    },
    {
      "code": 6014,
      "name": "invalidPayloadType",
      "msg": "Invalid payload type byte"
    },
    {
      "code": 6015,
      "name": "invalidPayloadVersion",
      "msg": "Invalid payload version byte"
    },
    {
      "code": 6016,
      "name": "invalidPayloadLength",
      "msg": "Invalid payload length"
    },
    {
      "code": 6017,
      "name": "invalidEmitter",
      "msg": "Invalid VAA emitter address"
    },
    {
      "code": 6018,
      "name": "invalidVaaEmitterChain",
      "msg": "Invalid VAA emitter chain ID"
    },
    {
      "code": 6019,
      "name": "vaaAlreadyConsumed",
      "msg": "VAA already consumed — replay protection triggered"
    },
    {
      "code": 6020,
      "name": "paymentNonceAlreadyConsumed",
      "msg": "Payment nonce already consumed — replay protection triggered"
    },
    {
      "code": 6021,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6022,
      "name": "mathUnderflow",
      "msg": "Math underflow"
    },
    {
      "code": 6023,
      "name": "invalidProgramData",
      "msg": "Invalid program data account"
    },
    {
      "code": 6024,
      "name": "unauthorizedUpgradeAuthority",
      "msg": "Unauthorized: signer is not the program upgrade authority"
    },
    {
      "code": 6025,
      "name": "missingRemainingAccounts",
      "msg": "Missing required remaining accounts"
    },
    {
      "code": 6026,
      "name": "invalidRemainingAccount",
      "msg": "Invalid remaining account — key mismatch"
    },
    {
      "code": 6027,
      "name": "maxAtaaExceeded",
      "msg": "Allowed tokens and amounts list exceeds maximum of 255 entries"
    },
    {
      "code": 6028,
      "name": "ataaAmountZero",
      "msg": "ATAA entry amount cannot be zero — use an empty ATAA list to accept any \\\n     amount"
    },
    {
      "code": 6029,
      "name": "invalidFeeSettings",
      "msg": "Invalid fee settings: fee_bps must be <= 10000"
    },
    {
      "code": 6030,
      "name": "zeroAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6031,
      "name": "autoWithdrawFailed",
      "msg": "Auto-withdraw failed"
    },
    {
      "code": 6032,
      "name": "chainHasNoProtocol",
      "msg": "Chain must support at least one of Wormhole or CCTP"
    }
  ],
  "types": [
    {
      "name": "activityRecord",
      "docs": [
        "A single activity event in the global audit trail.",
        "Globally indexed; pointer accounts provide per-entity access.",
        "",
        "Seeds: `[ActivityRecord::SEED_PREFIX, ActivityRecord::GLOBAL_PREFIX,",
        "global_index.to_le_bytes()]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "globalIndex",
            "docs": [
              "The global sequence index of this event (0-based, monotonically",
              "increasing)."
            ],
            "type": "u64"
          },
          {
            "name": "activityType",
            "docs": [
              "The type of activity that occurred."
            ],
            "type": {
              "defined": {
                "name": "activityType"
              }
            }
          },
          {
            "name": "entity",
            "docs": [
              "The primary entity involved (payable PDA, user_payment PDA, etc.)."
            ],
            "type": "pubkey"
          },
          {
            "name": "actor",
            "docs": [
              "The actor who triggered this activity (payer, host, relayer, etc.)."
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp when this activity occurred."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "activityType",
      "docs": [
        "All possible activity types. Mirrors EVM's `ActivityType` enum."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "userInitialized"
          },
          {
            "name": "payableCreated"
          },
          {
            "name": "payableClosed"
          },
          {
            "name": "payableReopened"
          },
          {
            "name": "payableAtaaUpdated"
          },
          {
            "name": "payableAutoWithdrawUpdated"
          },
          {
            "name": "userPaid"
          },
          {
            "name": "payableReceived"
          },
          {
            "name": "withdrew"
          },
          {
            "name": "foreignPayableCreated"
          },
          {
            "name": "foreignPayableUpdated"
          }
        ]
      }
    },
    {
      "name": "cctpDataNonce",
      "docs": [
        "Marks a Circle CCTP data-message nonce as consumed.",
        "",
        "Created atomically with the state changes triggered by the data message.",
        "A duplicate `init` fails → replay rejected.",
        "",
        "Seeds: `[CctpDataNonce::SEED_PREFIX, circle_domain.to_le_bytes(), &nonce]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circleDomain",
            "docs": [
              "Circle's uint32 domain ID of the source chain."
            ],
            "type": "u32"
          },
          {
            "name": "nonce",
            "docs": [
              "The 32-byte CCTP V2 nonce from the data message header (bytes 12-44)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "processedAt",
            "docs": [
              "Unix timestamp when this data nonce was consumed."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "cctpTokenBurnNonce",
      "docs": [
        "Marks a Circle CCTP burn nonce as consumed on CCTP-only payment receive",
        "paths.",
        "",
        "CCTP V2 uses a 32-byte nonce (bytes [12..44] of the message header).",
        "The nonce is unique per source domain, preventing replay of the same burn",
        "message.",
        "",
        "Seeds: `[CctpTokenBurnNonce::SEED_PREFIX, circle_domain.to_le_bytes(),",
        "&nonce]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circleDomain",
            "docs": [
              "Circle's uint32 domain ID of the source chain."
            ],
            "type": "u32"
          },
          {
            "name": "nonce",
            "docs": [
              "The 32-byte CCTP V2 nonce from the source chain's burn message header",
              "(bytes 12-44)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "processedAt",
            "docs": [
              "Unix timestamp when this burn nonce was consumed."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "chainRegistered",
      "docs": [
        "Emitted when a foreign chain is registered. Mirrors EVM",
        "`RegisteredForeignContract` + `RegisteredChainWormholeId` +",
        "`RegisteredChainCircleDomain`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "cbChainId",
            "docs": [
              "Universal cross-chain key for the registered chain (CAIP-2 keccak256)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "hasWormhole",
            "docs": [
              "Whether this chain uses Wormhole for data messaging."
            ],
            "type": "bool"
          },
          {
            "name": "wormholeChainId",
            "docs": [
              "Wormhole's uint16 chain ID for this chain (0 if not applicable)."
            ],
            "type": "u16"
          },
          {
            "name": "hasCctp",
            "docs": [
              "Whether this chain uses Circle CCTP."
            ],
            "type": "bool"
          },
          {
            "name": "circleDomain",
            "docs": [
              "Circle's uint32 domain for this chain (0 if not applicable)."
            ],
            "type": "u32"
          },
          {
            "name": "registeredContract",
            "docs": [
              "32-byte normalized address of Chainbills contract on this chain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "chainRegistry",
      "docs": [
        "Describes a foreign chain that Chainbills is deployed on.",
        "Created by the owner via `register_chain`. Used for:",
        "- Routing payable sync broadcasts (Wormhole vs CCTP path)",
        "- Validating inbound VAA emitter addresses and CCTP source domains",
        "- Cross-chain payment routing in `pay_foreign_via_cctp`",
        "",
        "Seeds: `[ChainRegistry::SEED_PREFIX, cb_chain_id]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "cbChainId",
            "docs": [
              "The universal chain key: keccak256(\"namespace:reference\") (CAIP-2).",
              "e.g., keccak256(\"eip155:11155111\") for Ethereum Sepolia."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "hasWormhole",
            "docs": [
              "Whether this chain uses Wormhole for cross-chain messaging."
            ],
            "type": "bool"
          },
          {
            "name": "wormholeChainId",
            "docs": [
              "Wormhole's uint16 chain ID for this chain. Only valid if `has_wormhole =",
              "true`. Used for VAA emitter_chain validation."
            ],
            "type": "u16"
          },
          {
            "name": "hasCctp",
            "docs": [
              "Whether this chain uses Circle CCTP for token bridging."
            ],
            "type": "bool"
          },
          {
            "name": "circleDomain",
            "docs": [
              "Circle's uint32 domain for this chain. Only valid if `has_cctp = true`.",
              "Used in CCTP burn/receive message routing."
            ],
            "type": "u32"
          },
          {
            "name": "registeredContract",
            "docs": [
              "The 32-byte normalized address of the Chainbills contract on this chain.",
              "For EVM: left-padded 20-byte address. For Solana: program PDA bytes.",
              "Validated against VAA emitter_address and CCTP message sender fields."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "chainUpdated",
      "docs": [
        "Emitted when an existing foreign chain's parameters are updated. Mirrors EVM",
        "`RegisteredForeignContract` update path."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "cbChainId",
            "docs": [
              "Universal cross-chain key for the updated chain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "hasWormhole",
            "docs": [
              "New Wormhole flag."
            ],
            "type": "bool"
          },
          {
            "name": "wormholeChainId",
            "docs": [
              "New Wormhole chain ID."
            ],
            "type": "u16"
          },
          {
            "name": "hasCctp",
            "docs": [
              "New CCTP flag."
            ],
            "type": "bool"
          },
          {
            "name": "circleDomain",
            "docs": [
              "New Circle domain."
            ],
            "type": "u32"
          },
          {
            "name": "registeredContract",
            "docs": [
              "New registered contract address (32 bytes normalized)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "closedPayable",
      "docs": [
        "Emitted when a payable is closed by its host."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The PDA address of the closed payable."
            ],
            "type": "pubkey"
          },
          {
            "name": "host",
            "docs": [
              "The host that closed it."
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "config",
      "docs": [
        "Program-wide admin configuration. Created once by `initialize`. Never",
        "closed.",
        "",
        "Mirrors the admin/config portion of EVM storage (owner, feeBps,",
        "feeCollector, etc.). Counters live in `Stats` (`[b\"stats\"]`) to keep this",
        "account small and fast.",
        "",
        "Seeds: `[Config::SEED_PREFIX]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "The program owner. Can call admin instructions (allow_token,",
              "register_chain, etc.)."
            ],
            "type": "pubkey"
          },
          {
            "name": "feeCollector",
            "docs": [
              "The fee collector wallet. Receives the fee portion on every withdrawal."
            ],
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "docs": [
              "Withdrawal fee in basis points (200 = 2%). Max 10_000 (100%)."
            ],
            "type": "u16"
          },
          {
            "name": "cbChainId",
            "docs": [
              "The cbChainId of this Solana deployment (mainnet or devnet).",
              "Set at initialization. Used in cross-chain payload construction."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "payableUpdateNonceCounter",
            "docs": [
              "Monotonically increasing counter for payable update broadcast nonces.",
              "Each broadcast increments this. Ordering cross-chain payable sync",
              "messages."
            ],
            "type": "u64"
          },
          {
            "name": "hasWormhole",
            "docs": [
              "Whether this Solana deployment supports Wormhole for outbound messages.",
              "Mirrors EVM `hasWormhole()`. Gates Wormhole shim CPI in broadcast +",
              "outbound payment."
            ],
            "type": "bool"
          },
          {
            "name": "hasCctp",
            "docs": [
              "Whether this Solana deployment supports CCTP for outbound messages.",
              "Mirrors EVM `hasCctp()`. Gates CCTP `send_message` / `deposit_for_burn`",
              "CPIs."
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "consumedVaa",
      "docs": [
        "Marks a Wormhole VAA as consumed. Created atomically with the state changes",
        "it triggers. If the account already exists, `init` fails → replay rejected.",
        "",
        "This is the primary replay protection layer for all inbound Wormhole",
        "messages. A secondary layer is the Core Bridge's own PostedVAA account, but",
        "we create this PDA to store our own metadata and to survive Core Bridge",
        "account closure.",
        "",
        "Seeds: `[ConsumedVaa::SEED_PREFIX, vaa_hash]`",
        "where `vaa_hash` = the keccak256 hash of the VAA body (matches Core Bridge",
        "convention)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vaaHash",
            "docs": [
              "The 32-byte keccak256 hash of the VAA body. Used as PDA seed."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "emitterChain",
            "docs": [
              "The Wormhole chain ID of the VAA's emitter."
            ],
            "type": "u16"
          },
          {
            "name": "sequence",
            "docs": [
              "The VAA's sequence number (from the emitter's emitter_sequence)."
            ],
            "type": "u64"
          },
          {
            "name": "payloadType",
            "docs": [
              "The payload type byte (0x01 = PayablePayload, 0x02 = PaymentPayload)."
            ],
            "type": "u8"
          },
          {
            "name": "processedAt",
            "docs": [
              "Unix timestamp when this VAA was processed by Chainbills."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "createdPayable",
      "docs": [
        "Emitted when a new payable is created."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The PDA address of the newly created payable."
            ],
            "type": "pubkey"
          },
          {
            "name": "host",
            "docs": [
              "The host wallet that created the payable."
            ],
            "type": "pubkey"
          },
          {
            "name": "hostCount",
            "docs": [
              "The host's payable creation index (host_count at time of creation)."
            ],
            "type": "u64"
          },
          {
            "name": "chainCount",
            "docs": [
              "Global payable count at time of creation (snapshot)."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "feeSettingsUpdated",
      "docs": [
        "Emitted when global fee settings are updated. Mirrors EVM",
        "`SetWithdrawalFeePercentage` + `SetFeeCollectorAddress`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feeBps",
            "docs": [
              "New fee in basis points."
            ],
            "type": "u16"
          },
          {
            "name": "feeCollector",
            "docs": [
              "New fee collector wallet that receives the fee portion on withdrawals."
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "foreignPayable",
      "docs": [
        "Represents the last-known state of a payable that lives on a foreign EVM",
        "chain. Created and updated by `recv_payable_update_via_wormhole` and",
        "`recv_payable_update_via_cctp`.",
        "",
        "The `payable_id` is the foreign chain's identifier for the payable",
        "(on EVM this is a `bytes32` derived from `keccak256(...)` or the contract",
        "address).",
        "",
        "Seeds: `[ForeignPayable::SEED_PREFIX, payable_id]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payableId",
            "docs": [
              "The foreign chain's identifier for this payable (32 bytes).",
              "EVM: result of `keccak256(abi.encodePacked(...))` or similar."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "cbChainId",
            "docs": [
              "cbChainId of the chain where this payable lives."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "isClosed",
            "docs": [
              "Whether this payable is currently closed on its home chain."
            ],
            "type": "bool"
          },
          {
            "name": "isAutoWithdraw",
            "docs": [
              "Whether auto-withdraw is enabled on the foreign payable."
            ],
            "type": "bool"
          },
          {
            "name": "payableUpdateNonce",
            "docs": [
              "The payable_update_nonce of the last applied PayablePayload.",
              "New updates must have nonce > this value to prevent state regression."
            ],
            "type": "u64"
          },
          {
            "name": "paymentsCount",
            "docs": [
              "Total number of payments received by this foreign payable on Solana."
            ],
            "type": "u64"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp when this ForeignPayable record was first created on",
              "Solana."
            ],
            "type": "i64"
          },
          {
            "name": "allowedTokensAndAmounts",
            "docs": [
              "Allowed tokens and amounts from the foreign chain (Wormhole-normalized)."
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "tokenAndAmountForeign"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "foreignPaymentReceived",
      "docs": [
        "Emitted when a cross-chain payment (EVM → Solana) is received and processed."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payablePayment",
            "docs": [
              "The PayablePayment PDA created for this inbound payment."
            ],
            "type": "pubkey"
          },
          {
            "name": "payable",
            "docs": [
              "The ForeignPayable that received the payment."
            ],
            "type": "pubkey"
          },
          {
            "name": "payer",
            "docs": [
              "Wormhole-normalized payer address on the source chain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "payerChainId",
            "docs": [
              "The cbChainId of the payer's chain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "amount",
            "docs": [
              "USDC amount credited (after CCTP fee deduction)."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "payable",
      "docs": [
        "A public invoice that anyone can pay into. Created by a host.",
        "",
        "Size is dynamic: the account is reallocated when",
        "`allowed_tokens_and_amounts` or `balances` vecs change size. Max 255 ATAA",
        "entries (wire format limit).",
        "",
        "Seeds: `[Payable::SEED_PREFIX, host.key(), host_count.to_le_bytes()]`",
        "where `host_count` is `user_record.payables_count` BEFORE incrementing",
        "(this is the creation index, 0-based)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "host",
            "docs": [
              "The wallet of the payable's creator and owner."
            ],
            "type": "pubkey"
          },
          {
            "name": "hostCount",
            "docs": [
              "The value of `user_record.payables_count` at creation time.",
              "Used as part of the PDA seed to give each host a unique per-index",
              "payable."
            ],
            "type": "u64"
          },
          {
            "name": "chainCount",
            "docs": [
              "Snapshot of `global_config.total_payables` at creation time.",
              "Used by the relayer to order payables globally."
            ],
            "type": "u64"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp when this payable was created."
            ],
            "type": "i64"
          },
          {
            "name": "isClosed",
            "docs": [
              "Whether new payments are rejected. Set by `close_payable`."
            ],
            "type": "bool"
          },
          {
            "name": "isAutoWithdraw",
            "docs": [
              "Whether each incoming payment should trigger an immediate withdrawal."
            ],
            "type": "bool"
          },
          {
            "name": "paymentsCount",
            "docs": [
              "Total number of payments ever received by this payable."
            ],
            "type": "u64"
          },
          {
            "name": "withdrawalsCount",
            "docs": [
              "Total number of withdrawals ever performed from this payable."
            ],
            "type": "u64"
          },
          {
            "name": "activitiesCount",
            "docs": [
              "Total number of activity records linked to this payable."
            ],
            "type": "u64"
          },
          {
            "name": "allowedTokensAndAmounts",
            "docs": [
              "List of (token, amount) pairs that this payable accepts.",
              "Empty = accepts any token in any amount.",
              "Max 255 entries (wire format uses 1-byte length field)."
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "tokenAndAmount"
                }
              }
            }
          },
          {
            "name": "balances",
            "docs": [
              "Running balances per token in this payable's vault.",
              "Each entry represents the total accumulated but not yet withdrawn for a",
              "token."
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "tokenAndAmount"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "payableActivityPointer",
      "docs": [
        "Pointer linking a payable's nth activity to the global ActivityRecord.",
        "",
        "Seeds: `[PayableActivityPointer::SEED_PREFIX,",
        "PayableActivityPointer::PAYABLE_PREFIX, payable.key(),",
        "payable_index.to_le_bytes()]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "globalIndex",
            "docs": [
              "Index into the global ActivityRecord sequence."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "payablePayment",
      "docs": [
        "Immutable record of a payment from the payable's perspective.",
        "Created in both same-chain and cross-chain inbound payment flows.",
        "",
        "`payer` is stored as `[u8; 32]` (Wormhole-normalized) to support cross-chain",
        "payers:",
        "- Solana payer: `pubkey.to_bytes()`",
        "- EVM payer: `address.to_wormhole_format()` (left-padded 32 bytes)",
        "",
        "Seeds: `[PayablePayment::SEED_PREFIX, payable.key(),",
        "payable.payments_count.to_le_bytes()]` where `payments_count` is the value",
        "BEFORE incrementing (0-based index)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The payable that received this payment."
            ],
            "type": "pubkey"
          },
          {
            "name": "payer",
            "docs": [
              "Wormhole-normalized payer address (32 bytes).",
              "Solana: `pubkey.to_bytes()`. EVM: left-padded 20-byte address."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "payableCount",
            "docs": [
              "This payment's index within the payable's payment history (0-based)."
            ],
            "type": "u64"
          },
          {
            "name": "chainCount",
            "docs": [
              "Snapshot of `global_config.total_payable_payments` at time of payment."
            ],
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "docs": [
              "The token mint credited. `system_program::ID` for native SOL."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount received in token base units."
            ],
            "type": "u64"
          },
          {
            "name": "payerChainId",
            "docs": [
              "cbChainId of the payer's chain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "payerPaymentId",
            "docs": [
              "The UserPayment PDA address on the payer's chain (or cross-chain payment",
              "ID). Stored as bytes for cross-chain compatibility."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp of the payment."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "payableReceived",
      "docs": [
        "Emitted when a local payable receives a payment.",
        "For cross-chain inbound, `payer` is Wormhole-normalized (32 bytes) from the",
        "source chain."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payment",
            "docs": [
              "The PayablePayment PDA address."
            ],
            "type": "pubkey"
          },
          {
            "name": "payable",
            "docs": [
              "The payable that received the payment."
            ],
            "type": "pubkey"
          },
          {
            "name": "payer",
            "docs": [
              "Wormhole-normalized payer address (32 bytes — Pubkey on Solana, padded",
              "address on EVM)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "token",
            "docs": [
              "The token mint credited to the payable vault."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "The payment amount in token base units."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "payableUpdateBroadcasted",
      "docs": [
        "Emitted when a payable's state is broadcast to foreign chains."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The payable whose state was broadcast."
            ],
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "docs": [
              "The nonce assigned to this broadcast (monotonically increasing)."
            ],
            "type": "u64"
          },
          {
            "name": "actionType",
            "docs": [
              "The action type: 1=Create, 2=Close, 3=Reopen, 4=UpdateATAA."
            ],
            "type": "u8"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "paymentNonce",
      "docs": [
        "Marks a cross-chain payment nonce as consumed.",
        "",
        "Each EVM→Solana payment carries a payer-specific nonce in the",
        "PaymentPayload. `init`-ing this PDA is the second layer of replay protection",
        "(first is ConsumedVaa).",
        "",
        "Seeds: `[PaymentNonce::SEED_PREFIX, payer_chain_id, payer,",
        "nonce.to_le_bytes()]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payerChainId",
            "docs": [
              "cbChainId of the payer's chain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "payer",
            "docs": [
              "Wormhole-normalized payer address (32 bytes)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "nonce",
            "docs": [
              "The nonce value from the PaymentPayload."
            ],
            "type": "u64"
          },
          {
            "name": "processedAt",
            "docs": [
              "Unix timestamp when this nonce was consumed."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "programInitialized",
      "docs": [
        "Emitted when the program is initialized for the first time.",
        "Captures the full initial configuration."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "The program owner (upgrade authority at init time)."
            ],
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "docs": [
              "Default withdrawal fee in basis points (200 = 2%)."
            ],
            "type": "u16"
          },
          {
            "name": "cbChainId",
            "docs": [
              "cbChainId of this Solana deployment (mainnet or devnet)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "hasWormhole",
            "docs": [
              "Whether this deployment supports Wormhole outbound messages."
            ],
            "type": "bool"
          },
          {
            "name": "hasCctp",
            "docs": [
              "Whether this deployment supports CCTP outbound messages."
            ],
            "type": "bool"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp of initialization."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "receivedPayableUpdate",
      "docs": [
        "Emitted when a PayablePayload is received from a foreign chain and applied",
        "to a ForeignPayable PDA."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "foreignPayableId",
            "docs": [
              "The payable_id from the payload (foreign chain's payable address as",
              "bytes32)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "srcCbChainId",
            "docs": [
              "The cbChainId of the chain that sent this update."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "nonce",
            "docs": [
              "The nonce of the update (used for ordering / replay protection)."
            ],
            "type": "u64"
          },
          {
            "name": "actionType",
            "docs": [
              "The action type applied: 1=Create, 2=Close, 3=Reopen, 4=UpdateATAA."
            ],
            "type": "u8"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "reopenedPayable",
      "docs": [
        "Emitted when a previously closed payable is reopened."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The PDA address of the reopened payable."
            ],
            "type": "pubkey"
          },
          {
            "name": "host",
            "docs": [
              "The host that reopened it."
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "senderAuthority",
      "docs": [
        "Keyless PDA that the program uses to sign CCTP `deposit_for_burn` calls.",
        "",
        "Owns the intermediate `program_usdc_ata` token account. The PDA itself holds",
        "no user funds — USDC passes through transiently and is burned atomically.",
        "",
        "Seeds: `[SenderAuthority::SEED_PREFIX]`"
      ],
      "type": {
        "kind": "struct",
        "fields": []
      }
    },
    {
      "name": "stats",
      "docs": [
        "Chain-wide activity counters. Created once by `initialize`. Never closed.",
        "",
        "Mirrors EVM's combined `ChainStats`, `WormholeStats`, and `CctpStats`",
        "storage variables. Solana has no slot-layout upgrade concern (we use",
        "`realloc`), so all stats fit one PDA.",
        "",
        "Seeds: `[Stats::SEED_PREFIX]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "totalUsers",
            "docs": [
              "Cumulative count of unique users ever initialized on this chain."
            ],
            "type": "u64"
          },
          {
            "name": "totalPayables",
            "docs": [
              "Cumulative count of payables ever created on this chain."
            ],
            "type": "u64"
          },
          {
            "name": "totalForeignPayables",
            "docs": [
              "Cumulative count of foreign payable records ever created on this chain."
            ],
            "type": "u64"
          },
          {
            "name": "totalUserPayments",
            "docs": [
              "Cumulative count of user-side payment records ever created on this chain."
            ],
            "type": "u64"
          },
          {
            "name": "totalPayablePayments",
            "docs": [
              "Cumulative count of payable-side payment records ever created on this",
              "chain."
            ],
            "type": "u64"
          },
          {
            "name": "totalWithdrawals",
            "docs": [
              "Cumulative count of withdrawals ever performed on this chain."
            ],
            "type": "u64"
          },
          {
            "name": "totalActivities",
            "docs": [
              "Cumulative count of activity records ever created on this chain."
            ],
            "type": "u64"
          },
          {
            "name": "publishedWormholeMessages",
            "docs": [
              "Total Wormhole messages published (payable updates + outbound payments)."
            ],
            "type": "u64"
          },
          {
            "name": "consumedWormholeMessages",
            "docs": [
              "Total Wormhole VAAs consumed (payable updates + inbound payments)."
            ],
            "type": "u64"
          },
          {
            "name": "emittedCctpPaymentMessages",
            "docs": [
              "Total CCTP payment messages emitted via `pay_foreign_via_cctp`."
            ],
            "type": "u64"
          },
          {
            "name": "emittedCctpUpdateMessages",
            "docs": [
              "Total CCTP payable-update `sendMessage` calls emitted via",
              "`broadcast_payable_update`."
            ],
            "type": "u64"
          },
          {
            "name": "receivedCctpPaymentMessages",
            "docs": [
              "Total CCTP payment messages received (burn + data message pairs)."
            ],
            "type": "u64"
          },
          {
            "name": "receivedCctpUpdateMessages",
            "docs": [
              "Total CCTP payable-update data messages received."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenAllowed",
      "docs": [
        "Emitted when a token mint is allowed for payments. Mirrors EVM",
        "`AllowedPaymentsForToken`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "The mint address of the newly allowed token."
            ],
            "type": "pubkey"
          },
          {
            "name": "maxWithdrawalFee",
            "docs": [
              "The maximum withdrawal fee cap for this token (in base units)."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "tokenAndAmount",
      "docs": [
        "A (token_mint, amount) pair used in payable ATAA lists and balance tracking.",
        "",
        "In ATAA lists: if amount > 0, payer must pay exactly this amount.",
        "If the entire ATAA list is empty, the payable accepts any token in any",
        "amount.",
        "",
        "In balance tracking: represents the total accumulated balance for a token."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "token",
            "docs": [
              "The token mint pubkey. Use `system_program::ID` for native SOL."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount in token base units. Must be > 0 in ATAA entries."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenAndAmountForeign",
      "docs": [
        "A (Wormhole-normalized token, amount) pair for foreign chain tokens.",
        "Token is stored as 32-byte Wormhole format (left-padded for EVM addresses)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "token",
            "docs": [
              "32-byte Wormhole-normalized token address on the foreign chain.",
              "EVM: left-padded 20-byte address. Solana: pubkey bytes."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "amount",
            "docs": [
              "Required payment amount in token base units."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenConfig",
      "docs": [
        "Configuration and cumulative stats for a token mint.",
        "Created by `allow_token`, updated by payments and withdrawals.",
        "",
        "Seeds: `[TokenConfig::SEED_PREFIX, mint.key()]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "The token mint this config applies to. `system_program::ID` for native",
              "SOL."
            ],
            "type": "pubkey"
          },
          {
            "name": "isAllowed",
            "docs": [
              "Whether this token is currently accepted for payments.",
              "Set to true by `allow_token`, false by `disallow_token`."
            ],
            "type": "bool"
          },
          {
            "name": "maxWithdrawalFee",
            "docs": [
              "Maximum fee cap in token base units.",
              "Fee = min(amount * fee_bps / 10_000, max_withdrawal_fee).",
              "Set by `allow_token`. Prevents runaway fees on high-value tokens."
            ],
            "type": "u64"
          },
          {
            "name": "totalPaid",
            "docs": [
              "Cumulative amount of this token paid into all payables on this chain."
            ],
            "type": "u64"
          },
          {
            "name": "totalReceived",
            "docs": [
              "Cumulative amount of this token received (inbound cross-chain)."
            ],
            "type": "u64"
          },
          {
            "name": "totalWithdrawn",
            "docs": [
              "Cumulative amount of this token withdrawn by hosts."
            ],
            "type": "u64"
          },
          {
            "name": "totalFeesCollected",
            "docs": [
              "Cumulative fees collected in this token."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenDisallowed",
      "docs": [
        "Emitted when a token mint is disallowed (payments blocked). Mirrors EVM",
        "`StoppedPaymentsForToken`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "The mint address of the disallowed token."
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "updatedPayableAtaa",
      "docs": [
        "Emitted when a payable's allowed tokens and amounts list is updated."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The PDA address of the updated payable."
            ],
            "type": "pubkey"
          },
          {
            "name": "host",
            "docs": [
              "The host that performed the update."
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "updatedPayableAutoWithdraw",
      "docs": [
        "Emitted when a payable's auto-withdraw flag is toggled."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The PDA address of the updated payable."
            ],
            "type": "pubkey"
          },
          {
            "name": "host",
            "docs": [
              "The host that performed the update."
            ],
            "type": "pubkey"
          },
          {
            "name": "isAutoWithdraw",
            "docs": [
              "The new value of the auto-withdraw flag."
            ],
            "type": "bool"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "userActivityPointer",
      "docs": [
        "Pointer linking a user's nth activity to the global ActivityRecord.",
        "",
        "Seeds: `[UserActivityPointer::SEED_PREFIX, UserActivityPointer::USER_PREFIX,",
        "user.key(), user_index.to_le_bytes()]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "globalIndex",
            "docs": [
              "Index into the global ActivityRecord sequence."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "userInitialized",
      "docs": [
        "Emitted when a new UserRecord PDA is created for a wallet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "docs": [
              "The wallet that was initialized."
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp of initialization."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "userPaid",
      "docs": [
        "Emitted when a same-chain payment is made to a payable.",
        "Also emitted for cross-chain outbound (Solana → EVM) payments."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payment",
            "docs": [
              "The UserPayment PDA address."
            ],
            "type": "pubkey"
          },
          {
            "name": "payer",
            "docs": [
              "The payer's wallet address."
            ],
            "type": "pubkey"
          },
          {
            "name": "payable",
            "docs": [
              "The payable that was paid into."
            ],
            "type": "pubkey"
          },
          {
            "name": "token",
            "docs": [
              "The token mint used for payment (system_program::ID for native SOL)."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "The payment amount in token base units."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "userPayment",
      "docs": [
        "Immutable record of a payment from the payer's perspective.",
        "Created in both same-chain and cross-chain outbound payment flows.",
        "",
        "Seeds: `[UserPayment::SEED_PREFIX, payer.key(),",
        "user_record.payments_count.to_le_bytes()]` where `payments_count` is the",
        "value BEFORE incrementing (0-based index)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payer",
            "docs": [
              "The payer's wallet."
            ],
            "type": "pubkey"
          },
          {
            "name": "payable",
            "docs": [
              "The target payable. For same-chain: local Payable PDA.",
              "For cross-chain outbound: the foreign payable_id as a Pubkey (bytes)."
            ],
            "type": "pubkey"
          },
          {
            "name": "payerCount",
            "docs": [
              "This payment's index within the payer's payment history (0-based)."
            ],
            "type": "u64"
          },
          {
            "name": "chainCount",
            "docs": [
              "Snapshot of `global_config.total_user_payments` at time of payment."
            ],
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "docs": [
              "The token mint used. `system_program::ID` for native SOL."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount paid in token base units."
            ],
            "type": "u64"
          },
          {
            "name": "payableChainId",
            "docs": [
              "cbChainId of the chain where the payable lives."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "payerChainId",
            "docs": [
              "cbChainId of the chain where the payer lives (this chain = Solana)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp of the payment."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "userRecord",
      "docs": [
        "Tracks a user's activity counts and creation timestamp.",
        "Created with `init_if_needed` on first action by a wallet.",
        "",
        "Seeds: `[UserRecord::SEED_PREFIX, wallet.key()]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "docs": [
              "The wallet this record belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "payablesCount",
            "docs": [
              "Number of payables this user has created. Used as the index seed",
              "for new Payable PDAs: seeds = [b\"payable\", wallet,",
              "payables_count.to_le_bytes()]."
            ],
            "type": "u64"
          },
          {
            "name": "paymentsCount",
            "docs": [
              "Number of payments this user has made. Used as the index seed",
              "for new UserPayment PDAs."
            ],
            "type": "u64"
          },
          {
            "name": "withdrawalsCount",
            "docs": [
              "Number of withdrawals this user has performed."
            ],
            "type": "u64"
          },
          {
            "name": "activitiesCount",
            "docs": [
              "Number of activity records linked to this user."
            ],
            "type": "u64"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp when this UserRecord was first created."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "withdrawal",
      "docs": [
        "Immutable record of a withdrawal by a payable host.",
        "",
        "Seeds: `[Withdrawal::SEED_PREFIX, payable.key(),",
        "payable.withdrawals_count.to_le_bytes()]` where `withdrawals_count` is the",
        "value BEFORE incrementing (0-based index)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The payable that was withdrawn from."
            ],
            "type": "pubkey"
          },
          {
            "name": "host",
            "docs": [
              "The host wallet that performed the withdrawal."
            ],
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "docs": [
              "The token mint withdrawn. `system_program::ID` for native SOL."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Gross withdrawal amount (before fee deduction)."
            ],
            "type": "u64"
          },
          {
            "name": "fees",
            "docs": [
              "Fee deducted (min of percentage-based and max_fee cap)."
            ],
            "type": "u64"
          },
          {
            "name": "netAmount",
            "docs": [
              "Net amount actually received by the host (amount - fees)."
            ],
            "type": "u64"
          },
          {
            "name": "withdrawalCount",
            "docs": [
              "This withdrawal's index within the payable's withdrawal history",
              "(0-based)."
            ],
            "type": "u64"
          },
          {
            "name": "chainCount",
            "docs": [
              "Snapshot of `global_config.total_withdrawals` at time of withdrawal."
            ],
            "type": "u64"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp of the withdrawal."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "withdrew",
      "docs": [
        "Emitted when a host withdraws funds from a payable."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "withdrawal",
            "docs": [
              "The Withdrawal PDA address."
            ],
            "type": "pubkey"
          },
          {
            "name": "payable",
            "docs": [
              "The payable that was withdrawn from."
            ],
            "type": "pubkey"
          },
          {
            "name": "host",
            "docs": [
              "The host that performed the withdrawal."
            ],
            "type": "pubkey"
          },
          {
            "name": "token",
            "docs": [
              "The token mint withdrawn."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Gross withdrawal amount (before fees)."
            ],
            "type": "u64"
          },
          {
            "name": "fees",
            "docs": [
              "Fee amount deducted."
            ],
            "type": "u64"
          },
          {
            "name": "netAmount",
            "docs": [
              "Net amount received by host (amount - fees)."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    }
  ]
};


export const IDL: Chainbills = 
{
  "address": "DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk",
  "metadata": {
    "name": "chainbills",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Cross-chain Crypto Payment Gateway powered by Wormhole + Circle CCTP"
  },
  "instructions": [
    {
      "name": "admin_sync_foreign_payable",
      "docs": [
        "Admin escape hatch: apply a PayablePayload without a VAA.",
        "Used when no common protocol exists between two chains."
      ],
      "discriminator": [
        95,
        147,
        85,
        212,
        11,
        181,
        173,
        46
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "The program owner. Must sign."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config — validates owner."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — incremented when a new ForeignPayable is created."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "foreign_payable",
          "docs": [
            "ForeignPayable PDA for the given payable_id. Created if it doesn't exist."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  111,
                  114,
                  101,
                  105,
                  103,
                  110,
                  95,
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "payable_id"
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "payable_id",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "src_cb_chain_id",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "nonce",
          "type": "u64"
        },
        {
          "name": "action_type",
          "type": "u8"
        },
        {
          "name": "ataa_data",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "allow_token",
      "docs": [
        "Create or update a TokenConfig PDA marking a mint as allowed."
      ],
      "discriminator": [
        127,
        147,
        164,
        111,
        0,
        161,
        111,
        84
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "The program owner. Must sign."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config — validates owner."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "token_mint",
          "docs": [
            "The token mint to allow. Must be owned by a recognized token program."
          ]
        },
        {
          "name": "token_config",
          "docs": [
            "TokenConfig PDA for this mint. Created if it doesn't exist yet."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "token_mint"
              }
            ]
          }
        },
        {
          "name": "token_program"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "max_withdrawal_fee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "broadcast_payable_update",
      "docs": [
        "Broadcast this payable's current state to all registered foreign chains."
      ],
      "discriminator": [
        244,
        117,
        4,
        65,
        250,
        250,
        151,
        79
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "The host or program owner calling the broadcast."
          ],
          "signer": true
        },
        {
          "name": "payable",
          "docs": [
            "The payable to broadcast. Authority must be host or owner."
          ]
        },
        {
          "name": "config",
          "docs": [
            "Config — provides has_wormhole/has_cctp flags and nonce counter."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — incremented on successful broadcasts."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "action_type",
          "type": "u8"
        }
      ]
    },
    {
      "name": "close_payable",
      "docs": [
        "Close a payable. Broadcasts close to all foreign chains."
      ],
      "discriminator": [
        155,
        244,
        163,
        34,
        116,
        115,
        203,
        109
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "user_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "payable.host_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "stats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "activity_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "Stats"
              }
            ]
          }
        },
        {
          "name": "user_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "UserRecord"
              }
            ]
          }
        },
        {
          "name": "payable_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "create_payable",
      "docs": [
        "Create a new payable (public invoice). Records PayableCreated activity.",
        "Broadcasts PayablePayload to all registered foreign chains."
      ],
      "discriminator": [
        192,
        171,
        199,
        248,
        232,
        4,
        38,
        46
      ],
      "accounts": [
        {
          "name": "host",
          "docs": [
            "The host creating the payable. Must sign. Pays for account rent."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "user_record",
          "docs": [
            "UserRecord for the host. Created if this is their first action."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              }
            ]
          }
        },
        {
          "name": "payable",
          "docs": [
            "The new Payable PDA. Seeded with host + host's current payables_count."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.payables_count",
                "account": "UserRecord"
              }
            ]
          }
        },
        {
          "name": "vault_authority",
          "docs": [
            "Vault authority PDA. No data — pure PDA that owns vault ATAs for this",
            "payable. CHECK: PDA with no data, used as ATA authority. Seeds",
            "validated by constraint."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              }
            ]
          }
        },
        {
          "name": "config",
          "docs": [
            "Program config — owner not needed here, but stats are split."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "activity_record",
          "docs": [
            "Global activity record for this event."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "Stats"
              }
            ]
          }
        },
        {
          "name": "user_activity_pointer",
          "docs": [
            "User-scoped activity pointer."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "UserRecord"
              }
            ]
          }
        },
        {
          "name": "payable_activity_pointer",
          "docs": [
            "Payable-scoped activity pointer."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "const",
                "value": [
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "allowed_tokens_and_amounts",
          "type": {
            "vec": {
              "defined": {
                "name": "TokenAndAmount"
              }
            }
          }
        },
        {
          "name": "is_auto_withdraw",
          "type": "bool"
        }
      ]
    },
    {
      "name": "disallow_token",
      "docs": [
        "Mark a previously allowed token as disallowed."
      ],
      "discriminator": [
        128,
        24,
        199,
        234,
        114,
        157,
        151,
        177
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "The program owner. Must sign."
          ],
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config — validates owner."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "token_config",
          "docs": [
            "The TokenConfig to update. Must already exist."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "token_config.mint",
                "account": "TokenConfig"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "docs": [
        "One-time initialization. Creates GlobalConfig. Only the program's",
        "upgrade authority may call this."
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "The upgrade authority of the program. Must sign. Becomes the program",
            "owner."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "program",
          "docs": [
            "The program account itself — used to look up its programdata address."
          ],
          "address": "DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk"
        },
        {
          "name": "program_data",
          "docs": [
            "The program's upgrade data account. Validates that `authority` is the",
            "upgrade authority — the only entity that should be able to initialize."
          ]
        },
        {
          "name": "config",
          "docs": [
            "Admin config PDA. Seeds: [b\"config\"]."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Chain statistics PDA. Seeds: [b\"stats\"]."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "sender_authority",
          "docs": [
            "Sender authority PDA — keyless signer for CCTP deposit_for_burn CPIs.",
            "Seeds: [b\"sender_authority\"]."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  110,
                  100,
                  101,
                  114,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "pay",
      "docs": [
        "Pay a local payable with an SPL Token or Token-2022 token.",
        "If is_auto_withdraw is set, triggers immediate withdrawal."
      ],
      "discriminator": [
        119,
        18,
        216,
        65,
        192,
        117,
        122,
        220
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "user_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true
        },
        {
          "name": "payer_token_account",
          "writable": true
        },
        {
          "name": "vault_authority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              }
            ]
          }
        },
        {
          "name": "vault_token_account",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault_authority"
              },
              {
                "kind": "account",
                "path": "token_program"
              },
              {
                "kind": "account",
                "path": "token_mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "token_mint"
        },
        {
          "name": "config",
          "docs": [
            "Config — provides cb_chain_id for payment records."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "token_config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "token_mint"
              }
            ]
          }
        },
        {
          "name": "user_payment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "user_record.payments_count",
                "account": "UserRecord"
              }
            ]
          }
        },
        {
          "name": "payable_payment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.payments_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "activity_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "Stats"
              }
            ]
          }
        },
        {
          "name": "user_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "UserRecord"
              }
            ]
          }
        },
        {
          "name": "payable_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "token_program"
        },
        {
          "name": "associated_token_program",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "pay_foreign_via_cctp",
      "docs": [
        "Cross-chain outbound payment (Solana → EVM). Burns USDC via CCTP,",
        "publishes PaymentPayload via Wormhole shim."
      ],
      "discriminator": [
        158,
        45,
        169,
        136,
        9,
        104,
        126,
        205
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "user_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "foreign_payable",
          "docs": [
            "The foreign payable to pay into. Must exist and not be closed."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  111,
                  114,
                  101,
                  105,
                  103,
                  110,
                  95,
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "foreign_payable_id"
              }
            ]
          }
        },
        {
          "name": "config",
          "docs": [
            "Config — provides cb_chain_id (payer chain) and has_wormhole/has_cctp",
            "flags."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "chain_registry",
          "docs": [
            "Destination chain registry — validates has_cctp and provides",
            "circle_domain."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  97,
                  105,
                  110,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "dest_cb_chain_id"
              }
            ]
          }
        },
        {
          "name": "usdc_mint",
          "docs": [
            "USDC mint — the only token supported for cross-chain payments via CCTP."
          ]
        },
        {
          "name": "payer_usdc_ata",
          "docs": [
            "Payer's USDC ATA."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "token_program"
              },
              {
                "kind": "account",
                "path": "usdc_mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "sender_authority",
          "docs": [
            "SenderAuthority PDA — keyless signer that owns program_usdc_ata.",
            "Authorizes the CCTP deposit_for_burn CPI."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  110,
                  100,
                  101,
                  114,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program_usdc_ata",
          "docs": [
            "Intermediate program ATA — holds USDC transiently before CCTP burn.",
            "Authority: sender_authority PDA (signs the burn CPI)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "sender_authority"
              },
              {
                "kind": "account",
                "path": "token_program"
              },
              {
                "kind": "account",
                "path": "usdc_mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "user_payment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "user_record.payments_count",
                "account": "UserRecord"
              }
            ]
          }
        },
        {
          "name": "activity_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "Stats"
              }
            ]
          }
        },
        {
          "name": "user_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "UserRecord"
              }
            ]
          }
        },
        {
          "name": "token_program"
        },
        {
          "name": "associated_token_program",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "foreign_payable_id",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "dest_cb_chain_id",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "max_fee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "pay_native",
      "docs": [
        "Pay a local payable with native SOL."
      ],
      "discriminator": [
        116,
        31,
        164,
        230,
        244,
        244,
        218,
        204
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "user_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true
        },
        {
          "name": "vault_authority",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              }
            ]
          }
        },
        {
          "name": "config",
          "docs": [
            "Config — provides cb_chain_id."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "token_config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "const",
                "value": [
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          "name": "user_payment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "user_record.payments_count",
                "account": "UserRecord"
              }
            ]
          }
        },
        {
          "name": "payable_payment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.payments_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "activity_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "Stats"
              }
            ]
          }
        },
        {
          "name": "user_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "UserRecord"
              }
            ]
          }
        },
        {
          "name": "payable_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "recv_payable_update_via_cctp",
      "docs": [
        "EVM → Solana payable state sync via CCTP data message (no Wormhole)."
      ],
      "discriminator": [
        49,
        20,
        232,
        86,
        243,
        165,
        16,
        23
      ],
      "accounts": [
        {
          "name": "relayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "cctp_program"
        },
        {
          "name": "chain_registry"
        },
        {
          "name": "foreign_payable",
          "writable": true
        },
        {
          "name": "cctp_data_nonce",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  99,
                  116,
                  112,
                  95,
                  100,
                  97,
                  116,
                  97,
                  95,
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "src_domain"
              },
              {
                "kind": "arg",
                "path": "cctp_nonce"
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — incremented for received_cctp_update_messages and optionally",
            "total_foreign_payables."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "src_domain",
          "type": "u32"
        },
        {
          "name": "cctp_nonce",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "message",
          "type": "bytes"
        },
        {
          "name": "attestation",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "recv_payable_update_via_wormhole",
      "docs": [
        "EVM → Solana payable state sync via Wormhole VAA."
      ],
      "discriminator": [
        180,
        87,
        164,
        204,
        97,
        163,
        238,
        35
      ],
      "accounts": [
        {
          "name": "relayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "wormhole_program"
        },
        {
          "name": "posted_vaa",
          "docs": [
            "handler."
          ]
        },
        {
          "name": "chain_registry"
        },
        {
          "name": "foreign_payable",
          "writable": true
        },
        {
          "name": "consumed_vaa",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  115,
                  117,
                  109,
                  101,
                  100,
                  95,
                  118,
                  97,
                  97
                ]
              },
              {
                "kind": "arg",
                "path": "vaa_hash"
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — incremented for consumed_wormhole_messages and optionally",
            "total_foreign_payables."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "vaa_hash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "recv_payment_via_cctp_only",
      "docs": [
        "EVM → Solana payment receipt via CCTP only (no Wormhole)."
      ],
      "discriminator": [
        4,
        252,
        138,
        199,
        133,
        117,
        79,
        142
      ],
      "accounts": [
        {
          "name": "relayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "cctp_program"
        },
        {
          "name": "chain_registry"
        },
        {
          "name": "foreign_payable",
          "writable": true
        },
        {
          "name": "vault_authority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "foreign_payable"
              }
            ]
          }
        },
        {
          "name": "usdc_mint"
        },
        {
          "name": "vault_usdc_ata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault_authority"
              },
              {
                "kind": "account",
                "path": "token_program"
              },
              {
                "kind": "account",
                "path": "usdc_mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "payable_payment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "foreign_payable"
              },
              {
                "kind": "account",
                "path": "foreign_payable.payments_count",
                "account": "ForeignPayable"
              }
            ]
          }
        },
        {
          "name": "cctp_data_nonce_pda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  99,
                  116,
                  112,
                  95,
                  100,
                  97,
                  116,
                  97,
                  95,
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "src_domain"
              },
              {
                "kind": "arg",
                "path": "data_nonce"
              }
            ]
          }
        },
        {
          "name": "cctp_burn_nonce_pda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  99,
                  116,
                  112,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  98,
                  117,
                  114,
                  110,
                  95,
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "src_domain"
              },
              {
                "kind": "arg",
                "path": "burn_nonce"
              }
            ]
          }
        },
        {
          "name": "payment_nonce_pda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116,
                  95,
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "payer_chain_id"
              },
              {
                "kind": "arg",
                "path": "payer"
              },
              {
                "kind": "arg",
                "path": "payment_nonce"
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "activity_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "Stats"
              }
            ]
          }
        },
        {
          "name": "payable_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "foreign_payable"
              },
              {
                "kind": "account",
                "path": "foreign_payable.payments_count",
                "account": "ForeignPayable"
              }
            ]
          }
        },
        {
          "name": "token_program"
        },
        {
          "name": "associated_token_program",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "src_domain",
          "type": "u32"
        },
        {
          "name": "data_nonce",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "burn_nonce",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "payer_chain_id",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "payer",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "payment_nonce",
          "type": "u64"
        },
        {
          "name": "data_message",
          "type": "bytes"
        },
        {
          "name": "data_attestation",
          "type": "bytes"
        },
        {
          "name": "burn_message",
          "type": "bytes"
        },
        {
          "name": "burn_attestation",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "recv_payment_via_cctp_wormhole",
      "docs": [
        "EVM → Solana payment receipt via Wormhole VAA + Circle CCTP."
      ],
      "discriminator": [
        187,
        101,
        215,
        40,
        251,
        24,
        185,
        120
      ],
      "accounts": [
        {
          "name": "relayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "wormhole_program"
        },
        {
          "name": "posted_vaa"
        },
        {
          "name": "chain_registry"
        },
        {
          "name": "foreign_payable",
          "writable": true
        },
        {
          "name": "vault_authority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "foreign_payable"
              }
            ]
          }
        },
        {
          "name": "usdc_mint"
        },
        {
          "name": "vault_usdc_ata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault_authority"
              },
              {
                "kind": "account",
                "path": "token_program"
              },
              {
                "kind": "account",
                "path": "usdc_mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "payable_payment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "foreign_payable"
              },
              {
                "kind": "account",
                "path": "foreign_payable.payments_count",
                "account": "ForeignPayable"
              }
            ]
          }
        },
        {
          "name": "consumed_vaa",
          "docs": [
            "ConsumedVaa PDA — init fails on replay."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  115,
                  117,
                  109,
                  101,
                  100,
                  95,
                  118,
                  97,
                  97
                ]
              },
              {
                "kind": "arg",
                "path": "vaa_hash"
              }
            ]
          }
        },
        {
          "name": "payment_nonce_pda",
          "docs": [
            "PaymentNonce PDA — init fails on replay."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116,
                  95,
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "payer_chain_id"
              },
              {
                "kind": "arg",
                "path": "payer"
              },
              {
                "kind": "arg",
                "path": "payment_nonce"
              }
            ]
          }
        },
        {
          "name": "cctp_burn_nonce_pda",
          "docs": [
            "CctpTokenBurnNonce PDA — init fails on replay."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  99,
                  116,
                  112,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  98,
                  117,
                  114,
                  110,
                  95,
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "src_domain"
              },
              {
                "kind": "arg",
                "path": "cctp_burn_nonce"
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "activity_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "Stats"
              }
            ]
          }
        },
        {
          "name": "payable_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "foreign_payable"
              },
              {
                "kind": "account",
                "path": "foreign_payable.payments_count",
                "account": "ForeignPayable"
              }
            ]
          }
        },
        {
          "name": "token_program"
        },
        {
          "name": "associated_token_program",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "vaa_hash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "payer_chain_id",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "payer",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "payment_nonce",
          "type": "u64"
        },
        {
          "name": "cctp_burn_nonce",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "src_domain",
          "type": "u32"
        },
        {
          "name": "burn_message",
          "type": "bytes"
        },
        {
          "name": "circle_attestation",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "register_chain",
      "docs": [
        "Register a foreign chain with its Wormhole and/or CCTP identifiers."
      ],
      "discriminator": [
        230,
        181,
        152,
        173,
        20,
        163,
        157,
        243
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "The program owner. Must sign and pays for the new ChainRegistry account."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config — validates owner."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "chain_registry",
          "docs": [
            "ChainRegistry PDA for this foreign chain. Created here (init)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  97,
                  105,
                  110,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "cb_chain_id"
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "cb_chain_id",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "has_wormhole",
          "type": "bool"
        },
        {
          "name": "wormhole_chain_id",
          "type": "u16"
        },
        {
          "name": "has_cctp",
          "type": "bool"
        },
        {
          "name": "circle_domain",
          "type": "u32"
        },
        {
          "name": "registered_contract",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "reopen_payable",
      "docs": [
        "Reopen a previously closed payable. Broadcasts reopen to all foreign",
        "chains."
      ],
      "discriminator": [
        86,
        195,
        169,
        72,
        96,
        182,
        2,
        89
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "user_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "payable.host_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "stats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "activity_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "Stats"
              }
            ]
          }
        },
        {
          "name": "user_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "UserRecord"
              }
            ]
          }
        },
        {
          "name": "payable_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "update_chain",
      "docs": [
        "Update an existing ChainRegistry (add/change Wormhole or CCTP params)."
      ],
      "discriminator": [
        29,
        50,
        131,
        193,
        37,
        245,
        12,
        171
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "The program owner. Must sign."
          ],
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config — validates owner."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "chain_registry",
          "docs": [
            "The ChainRegistry to update. Must already exist."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  97,
                  105,
                  110,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "chain_registry.cb_chain_id",
                "account": "ChainRegistry"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "has_wormhole",
          "type": "bool"
        },
        {
          "name": "wormhole_chain_id",
          "type": "u16"
        },
        {
          "name": "has_cctp",
          "type": "bool"
        },
        {
          "name": "circle_domain",
          "type": "u32"
        },
        {
          "name": "registered_contract",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "update_fee_settings",
      "docs": [
        "Update global fee settings (fee_bps and fee_collector)."
      ],
      "discriminator": [
        155,
        121,
        178,
        253,
        181,
        139,
        103,
        177
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "The program owner. Must sign."
          ],
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Config — validated and mutated."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "fee_collector",
          "docs": [
            "The new fee collector wallet. Receives the fee portion on withdrawals."
          ]
        }
      ],
      "args": [
        {
          "name": "fee_bps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "update_payable_ataa",
      "docs": [
        "Replace the payable's allowed tokens and amounts list. Reallocates",
        "the Payable account if the new list is larger. Broadcasts update."
      ],
      "discriminator": [
        249,
        76,
        203,
        157,
        81,
        146,
        155,
        197
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "user_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "payable.host_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "stats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "activity_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "Stats"
              }
            ]
          }
        },
        {
          "name": "user_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "UserRecord"
              }
            ]
          }
        },
        {
          "name": "payable_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "allowed_tokens_and_amounts",
          "type": {
            "vec": {
              "defined": {
                "name": "TokenAndAmount"
              }
            }
          }
        }
      ]
    },
    {
      "name": "update_payable_auto_withdraw",
      "docs": [
        "Flip the auto-withdraw flag. No cross-chain broadcast (local flag only)."
      ],
      "discriminator": [
        58,
        202,
        231,
        196,
        46,
        112,
        250,
        215
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "user_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "payable.host_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "stats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "activity_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "Stats"
              }
            ]
          }
        },
        {
          "name": "user_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "UserRecord"
              }
            ]
          }
        },
        {
          "name": "payable_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "is_auto_withdraw",
          "type": "bool"
        }
      ]
    },
    {
      "name": "withdraw",
      "docs": [
        "Withdraw SPL Token or Token-2022 from a payable. 2% fee (capped per",
        "token)."
      ],
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "user_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true
        },
        {
          "name": "vault_authority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              }
            ]
          }
        },
        {
          "name": "vault_token_account",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault_authority"
              },
              {
                "kind": "account",
                "path": "token_program"
              },
              {
                "kind": "account",
                "path": "token_mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "host_token_account",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "token_program"
              },
              {
                "kind": "account",
                "path": "token_mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "fee_collector_token_account",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "fee_collector"
              },
              {
                "kind": "account",
                "path": "token_program"
              },
              {
                "kind": "account",
                "path": "token_mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "fee_collector"
        },
        {
          "name": "token_mint"
        },
        {
          "name": "config",
          "docs": [
            "Config — provides fee_bps and fee_collector."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "token_config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "token_mint"
              }
            ]
          }
        },
        {
          "name": "withdrawal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  116,
                  104,
                  100,
                  114,
                  97,
                  119,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.withdrawals_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "activity_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "Stats"
              }
            ]
          }
        },
        {
          "name": "user_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "UserRecord"
              }
            ]
          }
        },
        {
          "name": "payable_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "token_program"
        },
        {
          "name": "associated_token_program",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw_native",
      "docs": [
        "Withdraw native SOL from a payable."
      ],
      "discriminator": [
        113,
        227,
        26,
        32,
        53,
        66,
        90,
        250
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "user_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              }
            ]
          }
        },
        {
          "name": "payable",
          "writable": true
        },
        {
          "name": "vault_authority",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              }
            ]
          }
        },
        {
          "name": "fee_collector",
          "writable": true
        },
        {
          "name": "config",
          "docs": [
            "Config — provides fee_bps and fee_collector."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stats",
          "docs": [
            "Stats — counters incremented here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "token_config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "const",
                "value": [
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          "name": "withdrawal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  116,
                  104,
                  100,
                  114,
                  97,
                  119,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.withdrawals_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "activity_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "stats.total_activities",
                "account": "Stats"
              }
            ]
          }
        },
        {
          "name": "user_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "account",
                "path": "user_record.activities_count",
                "account": "UserRecord"
              }
            ]
          }
        },
        {
          "name": "payable_activity_pointer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payable"
              },
              {
                "kind": "account",
                "path": "payable.activities_count",
                "account": "Payable"
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "ActivityRecord",
      "discriminator": [
        239,
        117,
        49,
        169,
        154,
        126,
        114,
        206
      ]
    },
    {
      "name": "CctpDataNonce",
      "discriminator": [
        139,
        86,
        247,
        217,
        98,
        13,
        30,
        211
      ]
    },
    {
      "name": "CctpTokenBurnNonce",
      "discriminator": [
        68,
        102,
        238,
        63,
        198,
        246,
        24,
        188
      ]
    },
    {
      "name": "ChainRegistry",
      "discriminator": [
        119,
        7,
        172,
        219,
        63,
        243,
        194,
        231
      ]
    },
    {
      "name": "Config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "ConsumedVaa",
      "discriminator": [
        191,
        28,
        148,
        127,
        15,
        13,
        25,
        110
      ]
    },
    {
      "name": "ForeignPayable",
      "discriminator": [
        161,
        149,
        110,
        231,
        250,
        181,
        187,
        191
      ]
    },
    {
      "name": "Payable",
      "discriminator": [
        216,
        171,
        158,
        251,
        109,
        214,
        139,
        147
      ]
    },
    {
      "name": "PayableActivityPointer",
      "discriminator": [
        98,
        176,
        122,
        35,
        26,
        252,
        16,
        3
      ]
    },
    {
      "name": "PayablePayment",
      "discriminator": [
        149,
        222,
        228,
        249,
        244,
        91,
        194,
        232
      ]
    },
    {
      "name": "PaymentNonce",
      "discriminator": [
        233,
        204,
        107,
        236,
        138,
        172,
        52,
        155
      ]
    },
    {
      "name": "SenderAuthority",
      "discriminator": [
        223,
        57,
        178,
        90,
        196,
        17,
        186,
        67
      ]
    },
    {
      "name": "Stats",
      "discriminator": [
        190,
        125,
        51,
        63,
        169,
        197,
        36,
        238
      ]
    },
    {
      "name": "TokenConfig",
      "discriminator": [
        92,
        73,
        255,
        43,
        107,
        51,
        117,
        101
      ]
    },
    {
      "name": "UserActivityPointer",
      "discriminator": [
        34,
        60,
        199,
        118,
        199,
        52,
        2,
        196
      ]
    },
    {
      "name": "UserPayment",
      "discriminator": [
        115,
        161,
        14,
        69,
        223,
        123,
        210,
        9
      ]
    },
    {
      "name": "UserRecord",
      "discriminator": [
        210,
        252,
        132,
        218,
        191,
        85,
        173,
        167
      ]
    },
    {
      "name": "Withdrawal",
      "discriminator": [
        10,
        45,
        211,
        182,
        129,
        235,
        90,
        82
      ]
    }
  ],
  "events": [
    {
      "name": "ChainRegistered",
      "discriminator": [
        249,
        198,
        244,
        115,
        251,
        62,
        51,
        97
      ]
    },
    {
      "name": "ChainUpdated",
      "discriminator": [
        7,
        190,
        233,
        250,
        34,
        253,
        48,
        233
      ]
    },
    {
      "name": "ClosedPayable",
      "discriminator": [
        19,
        150,
        138,
        48,
        224,
        53,
        48,
        107
      ]
    },
    {
      "name": "CreatedPayable",
      "discriminator": [
        116,
        213,
        179,
        18,
        209,
        33,
        209,
        63
      ]
    },
    {
      "name": "FeeSettingsUpdated",
      "discriminator": [
        132,
        70,
        159,
        144,
        246,
        39,
        114,
        101
      ]
    },
    {
      "name": "ForeignPaymentReceived",
      "discriminator": [
        215,
        205,
        12,
        245,
        12,
        61,
        79,
        62
      ]
    },
    {
      "name": "PayableReceived",
      "discriminator": [
        220,
        233,
        68,
        8,
        169,
        252,
        227,
        57
      ]
    },
    {
      "name": "PayableUpdateBroadcasted",
      "discriminator": [
        16,
        191,
        245,
        37,
        198,
        134,
        223,
        132
      ]
    },
    {
      "name": "ProgramInitialized",
      "discriminator": [
        43,
        70,
        110,
        241,
        199,
        218,
        221,
        245
      ]
    },
    {
      "name": "ReceivedPayableUpdate",
      "discriminator": [
        103,
        87,
        91,
        246,
        171,
        52,
        222,
        182
      ]
    },
    {
      "name": "ReopenedPayable",
      "discriminator": [
        183,
        9,
        202,
        149,
        185,
        125,
        91,
        31
      ]
    },
    {
      "name": "TokenAllowed",
      "discriminator": [
        143,
        122,
        92,
        195,
        119,
        118,
        88,
        122
      ]
    },
    {
      "name": "TokenDisallowed",
      "discriminator": [
        171,
        2,
        63,
        82,
        189,
        80,
        133,
        85
      ]
    },
    {
      "name": "UpdatedPayableAtaa",
      "discriminator": [
        40,
        193,
        196,
        71,
        250,
        11,
        166,
        46
      ]
    },
    {
      "name": "UpdatedPayableAutoWithdraw",
      "discriminator": [
        85,
        144,
        229,
        26,
        111,
        178,
        105,
        154
      ]
    },
    {
      "name": "UserInitialized",
      "discriminator": [
        66,
        195,
        5,
        223,
        42,
        84,
        135,
        60
      ]
    },
    {
      "name": "UserPaid",
      "discriminator": [
        97,
        212,
        121,
        73,
        172,
        12,
        183,
        203
      ]
    },
    {
      "name": "Withdrew",
      "discriminator": [
        15,
        125,
        249,
        65,
        130,
        86,
        20,
        166
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "PayableClosed",
      "msg": "Payable is closed"
    },
    {
      "code": 6001,
      "name": "PayableNotClosed",
      "msg": "Payable is not closed"
    },
    {
      "code": 6002,
      "name": "PayableNotFound",
      "msg": "Payable not found"
    },
    {
      "code": 6003,
      "name": "TokenNotAllowed",
      "msg": "Token is not allowed"
    },
    {
      "code": 6004,
      "name": "TokenAlreadyAllowed",
      "msg": "Token is already allowed"
    },
    {
      "code": 6005,
      "name": "TokenAmountMismatch",
      "msg": "Token or amount does not match payable's allowed list"
    },
    {
      "code": 6006,
      "name": "DuplicateTokenAndAmount",
      "msg": "Duplicate token in allowed tokens and amounts"
    },
    {
      "code": 6007,
      "name": "InsufficientBalance",
      "msg": "Insufficient balance for withdrawal"
    },
    {
      "code": 6008,
      "name": "InsufficientPaymentAmount",
      "msg": "Payment amount is below the required minimum"
    },
    {
      "code": 6009,
      "name": "UnauthorizedHost",
      "msg": "Unauthorized: signer is not the payable host"
    },
    {
      "code": 6010,
      "name": "UnauthorizedOwner",
      "msg": "Unauthorized: signer is not the program owner"
    },
    {
      "code": 6011,
      "name": "ForeignPayableNotFound",
      "msg": "Foreign payable not found"
    },
    {
      "code": 6012,
      "name": "ForeignPayableClosed",
      "msg": "Foreign payable is closed"
    },
    {
      "code": 6013,
      "name": "StalePayableUpdateNonce",
      "msg": "Stale payable update nonce — update already applied or out of order"
    },
    {
      "code": 6014,
      "name": "InvalidPayloadType",
      "msg": "Invalid payload type byte"
    },
    {
      "code": 6015,
      "name": "InvalidPayloadVersion",
      "msg": "Invalid payload version byte"
    },
    {
      "code": 6016,
      "name": "InvalidPayloadLength",
      "msg": "Invalid payload length"
    },
    {
      "code": 6017,
      "name": "InvalidEmitter",
      "msg": "Invalid VAA emitter address"
    },
    {
      "code": 6018,
      "name": "InvalidVaaEmitterChain",
      "msg": "Invalid VAA emitter chain ID"
    },
    {
      "code": 6019,
      "name": "VaaAlreadyConsumed",
      "msg": "VAA already consumed — replay protection triggered"
    },
    {
      "code": 6020,
      "name": "PaymentNonceAlreadyConsumed",
      "msg": "Payment nonce already consumed — replay protection triggered"
    },
    {
      "code": 6021,
      "name": "MathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6022,
      "name": "MathUnderflow",
      "msg": "Math underflow"
    },
    {
      "code": 6023,
      "name": "InvalidProgramData",
      "msg": "Invalid program data account"
    },
    {
      "code": 6024,
      "name": "UnauthorizedUpgradeAuthority",
      "msg": "Unauthorized: signer is not the program upgrade authority"
    },
    {
      "code": 6025,
      "name": "MissingRemainingAccounts",
      "msg": "Missing required remaining accounts"
    },
    {
      "code": 6026,
      "name": "InvalidRemainingAccount",
      "msg": "Invalid remaining account — key mismatch"
    },
    {
      "code": 6027,
      "name": "MaxAtaaExceeded",
      "msg": "Allowed tokens and amounts list exceeds maximum of 255 entries"
    },
    {
      "code": 6028,
      "name": "AtaaAmountZero",
      "msg": "ATAA entry amount cannot be zero — use an empty ATAA list to accept any \\\n     amount"
    },
    {
      "code": 6029,
      "name": "InvalidFeeSettings",
      "msg": "Invalid fee settings: fee_bps must be <= 10000"
    },
    {
      "code": 6030,
      "name": "ZeroAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6031,
      "name": "AutoWithdrawFailed",
      "msg": "Auto-withdraw failed"
    },
    {
      "code": 6032,
      "name": "ChainHasNoProtocol",
      "msg": "Chain must support at least one of Wormhole or CCTP"
    }
  ],
  "types": [
    {
      "name": "ActivityRecord",
      "docs": [
        "A single activity event in the global audit trail.",
        "Globally indexed; pointer accounts provide per-entity access.",
        "",
        "Seeds: `[ActivityRecord::SEED_PREFIX, ActivityRecord::GLOBAL_PREFIX,",
        "global_index.to_le_bytes()]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "global_index",
            "docs": [
              "The global sequence index of this event (0-based, monotonically",
              "increasing)."
            ],
            "type": "u64"
          },
          {
            "name": "activity_type",
            "docs": [
              "The type of activity that occurred."
            ],
            "type": {
              "defined": {
                "name": "ActivityType"
              }
            }
          },
          {
            "name": "entity",
            "docs": [
              "The primary entity involved (payable PDA, user_payment PDA, etc.)."
            ],
            "type": "pubkey"
          },
          {
            "name": "actor",
            "docs": [
              "The actor who triggered this activity (payer, host, relayer, etc.)."
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp when this activity occurred."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "ActivityType",
      "docs": [
        "All possible activity types. Mirrors EVM's `ActivityType` enum."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "UserInitialized"
          },
          {
            "name": "PayableCreated"
          },
          {
            "name": "PayableClosed"
          },
          {
            "name": "PayableReopened"
          },
          {
            "name": "PayableAtaaUpdated"
          },
          {
            "name": "PayableAutoWithdrawUpdated"
          },
          {
            "name": "UserPaid"
          },
          {
            "name": "PayableReceived"
          },
          {
            "name": "Withdrew"
          },
          {
            "name": "ForeignPayableCreated"
          },
          {
            "name": "ForeignPayableUpdated"
          }
        ]
      }
    },
    {
      "name": "CctpDataNonce",
      "docs": [
        "Marks a Circle CCTP data-message nonce as consumed.",
        "",
        "Created atomically with the state changes triggered by the data message.",
        "A duplicate `init` fails → replay rejected.",
        "",
        "Seeds: `[CctpDataNonce::SEED_PREFIX, circle_domain.to_le_bytes(), &nonce]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle_domain",
            "docs": [
              "Circle's uint32 domain ID of the source chain."
            ],
            "type": "u32"
          },
          {
            "name": "nonce",
            "docs": [
              "The 32-byte CCTP V2 nonce from the data message header (bytes 12-44)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "processed_at",
            "docs": [
              "Unix timestamp when this data nonce was consumed."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "CctpTokenBurnNonce",
      "docs": [
        "Marks a Circle CCTP burn nonce as consumed on CCTP-only payment receive",
        "paths.",
        "",
        "CCTP V2 uses a 32-byte nonce (bytes [12..44] of the message header).",
        "The nonce is unique per source domain, preventing replay of the same burn",
        "message.",
        "",
        "Seeds: `[CctpTokenBurnNonce::SEED_PREFIX, circle_domain.to_le_bytes(),",
        "&nonce]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle_domain",
            "docs": [
              "Circle's uint32 domain ID of the source chain."
            ],
            "type": "u32"
          },
          {
            "name": "nonce",
            "docs": [
              "The 32-byte CCTP V2 nonce from the source chain's burn message header",
              "(bytes 12-44)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "processed_at",
            "docs": [
              "Unix timestamp when this burn nonce was consumed."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "ChainRegistered",
      "docs": [
        "Emitted when a foreign chain is registered. Mirrors EVM",
        "`RegisteredForeignContract` + `RegisteredChainWormholeId` +",
        "`RegisteredChainCircleDomain`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "cb_chain_id",
            "docs": [
              "Universal cross-chain key for the registered chain (CAIP-2 keccak256)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "has_wormhole",
            "docs": [
              "Whether this chain uses Wormhole for data messaging."
            ],
            "type": "bool"
          },
          {
            "name": "wormhole_chain_id",
            "docs": [
              "Wormhole's uint16 chain ID for this chain (0 if not applicable)."
            ],
            "type": "u16"
          },
          {
            "name": "has_cctp",
            "docs": [
              "Whether this chain uses Circle CCTP."
            ],
            "type": "bool"
          },
          {
            "name": "circle_domain",
            "docs": [
              "Circle's uint32 domain for this chain (0 if not applicable)."
            ],
            "type": "u32"
          },
          {
            "name": "registered_contract",
            "docs": [
              "32-byte normalized address of Chainbills contract on this chain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "ChainRegistry",
      "docs": [
        "Describes a foreign chain that Chainbills is deployed on.",
        "Created by the owner via `register_chain`. Used for:",
        "- Routing payable sync broadcasts (Wormhole vs CCTP path)",
        "- Validating inbound VAA emitter addresses and CCTP source domains",
        "- Cross-chain payment routing in `pay_foreign_via_cctp`",
        "",
        "Seeds: `[ChainRegistry::SEED_PREFIX, cb_chain_id]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "cb_chain_id",
            "docs": [
              "The universal chain key: keccak256(\"namespace:reference\") (CAIP-2).",
              "e.g., keccak256(\"eip155:11155111\") for Ethereum Sepolia."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "has_wormhole",
            "docs": [
              "Whether this chain uses Wormhole for cross-chain messaging."
            ],
            "type": "bool"
          },
          {
            "name": "wormhole_chain_id",
            "docs": [
              "Wormhole's uint16 chain ID for this chain. Only valid if `has_wormhole =",
              "true`. Used for VAA emitter_chain validation."
            ],
            "type": "u16"
          },
          {
            "name": "has_cctp",
            "docs": [
              "Whether this chain uses Circle CCTP for token bridging."
            ],
            "type": "bool"
          },
          {
            "name": "circle_domain",
            "docs": [
              "Circle's uint32 domain for this chain. Only valid if `has_cctp = true`.",
              "Used in CCTP burn/receive message routing."
            ],
            "type": "u32"
          },
          {
            "name": "registered_contract",
            "docs": [
              "The 32-byte normalized address of the Chainbills contract on this chain.",
              "For EVM: left-padded 20-byte address. For Solana: program PDA bytes.",
              "Validated against VAA emitter_address and CCTP message sender fields."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "ChainUpdated",
      "docs": [
        "Emitted when an existing foreign chain's parameters are updated. Mirrors EVM",
        "`RegisteredForeignContract` update path."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "cb_chain_id",
            "docs": [
              "Universal cross-chain key for the updated chain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "has_wormhole",
            "docs": [
              "New Wormhole flag."
            ],
            "type": "bool"
          },
          {
            "name": "wormhole_chain_id",
            "docs": [
              "New Wormhole chain ID."
            ],
            "type": "u16"
          },
          {
            "name": "has_cctp",
            "docs": [
              "New CCTP flag."
            ],
            "type": "bool"
          },
          {
            "name": "circle_domain",
            "docs": [
              "New Circle domain."
            ],
            "type": "u32"
          },
          {
            "name": "registered_contract",
            "docs": [
              "New registered contract address (32 bytes normalized)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "ClosedPayable",
      "docs": [
        "Emitted when a payable is closed by its host."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The PDA address of the closed payable."
            ],
            "type": "pubkey"
          },
          {
            "name": "host",
            "docs": [
              "The host that closed it."
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "Config",
      "docs": [
        "Program-wide admin configuration. Created once by `initialize`. Never",
        "closed.",
        "",
        "Mirrors the admin/config portion of EVM storage (owner, feeBps,",
        "feeCollector, etc.). Counters live in `Stats` (`[b\"stats\"]`) to keep this",
        "account small and fast.",
        "",
        "Seeds: `[Config::SEED_PREFIX]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "The program owner. Can call admin instructions (allow_token,",
              "register_chain, etc.)."
            ],
            "type": "pubkey"
          },
          {
            "name": "fee_collector",
            "docs": [
              "The fee collector wallet. Receives the fee portion on every withdrawal."
            ],
            "type": "pubkey"
          },
          {
            "name": "fee_bps",
            "docs": [
              "Withdrawal fee in basis points (200 = 2%). Max 10_000 (100%)."
            ],
            "type": "u16"
          },
          {
            "name": "cb_chain_id",
            "docs": [
              "The cbChainId of this Solana deployment (mainnet or devnet).",
              "Set at initialization. Used in cross-chain payload construction."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "payable_update_nonce_counter",
            "docs": [
              "Monotonically increasing counter for payable update broadcast nonces.",
              "Each broadcast increments this. Ordering cross-chain payable sync",
              "messages."
            ],
            "type": "u64"
          },
          {
            "name": "has_wormhole",
            "docs": [
              "Whether this Solana deployment supports Wormhole for outbound messages.",
              "Mirrors EVM `hasWormhole()`. Gates Wormhole shim CPI in broadcast +",
              "outbound payment."
            ],
            "type": "bool"
          },
          {
            "name": "has_cctp",
            "docs": [
              "Whether this Solana deployment supports CCTP for outbound messages.",
              "Mirrors EVM `hasCctp()`. Gates CCTP `send_message` / `deposit_for_burn`",
              "CPIs."
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "ConsumedVaa",
      "docs": [
        "Marks a Wormhole VAA as consumed. Created atomically with the state changes",
        "it triggers. If the account already exists, `init` fails → replay rejected.",
        "",
        "This is the primary replay protection layer for all inbound Wormhole",
        "messages. A secondary layer is the Core Bridge's own PostedVAA account, but",
        "we create this PDA to store our own metadata and to survive Core Bridge",
        "account closure.",
        "",
        "Seeds: `[ConsumedVaa::SEED_PREFIX, vaa_hash]`",
        "where `vaa_hash` = the keccak256 hash of the VAA body (matches Core Bridge",
        "convention)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vaa_hash",
            "docs": [
              "The 32-byte keccak256 hash of the VAA body. Used as PDA seed."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "emitter_chain",
            "docs": [
              "The Wormhole chain ID of the VAA's emitter."
            ],
            "type": "u16"
          },
          {
            "name": "sequence",
            "docs": [
              "The VAA's sequence number (from the emitter's emitter_sequence)."
            ],
            "type": "u64"
          },
          {
            "name": "payload_type",
            "docs": [
              "The payload type byte (0x01 = PayablePayload, 0x02 = PaymentPayload)."
            ],
            "type": "u8"
          },
          {
            "name": "processed_at",
            "docs": [
              "Unix timestamp when this VAA was processed by Chainbills."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "CreatedPayable",
      "docs": [
        "Emitted when a new payable is created."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The PDA address of the newly created payable."
            ],
            "type": "pubkey"
          },
          {
            "name": "host",
            "docs": [
              "The host wallet that created the payable."
            ],
            "type": "pubkey"
          },
          {
            "name": "host_count",
            "docs": [
              "The host's payable creation index (host_count at time of creation)."
            ],
            "type": "u64"
          },
          {
            "name": "chain_count",
            "docs": [
              "Global payable count at time of creation (snapshot)."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "FeeSettingsUpdated",
      "docs": [
        "Emitted when global fee settings are updated. Mirrors EVM",
        "`SetWithdrawalFeePercentage` + `SetFeeCollectorAddress`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fee_bps",
            "docs": [
              "New fee in basis points."
            ],
            "type": "u16"
          },
          {
            "name": "fee_collector",
            "docs": [
              "New fee collector wallet that receives the fee portion on withdrawals."
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "ForeignPayable",
      "docs": [
        "Represents the last-known state of a payable that lives on a foreign EVM",
        "chain. Created and updated by `recv_payable_update_via_wormhole` and",
        "`recv_payable_update_via_cctp`.",
        "",
        "The `payable_id` is the foreign chain's identifier for the payable",
        "(on EVM this is a `bytes32` derived from `keccak256(...)` or the contract",
        "address).",
        "",
        "Seeds: `[ForeignPayable::SEED_PREFIX, payable_id]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable_id",
            "docs": [
              "The foreign chain's identifier for this payable (32 bytes).",
              "EVM: result of `keccak256(abi.encodePacked(...))` or similar."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "cb_chain_id",
            "docs": [
              "cbChainId of the chain where this payable lives."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "is_closed",
            "docs": [
              "Whether this payable is currently closed on its home chain."
            ],
            "type": "bool"
          },
          {
            "name": "is_auto_withdraw",
            "docs": [
              "Whether auto-withdraw is enabled on the foreign payable."
            ],
            "type": "bool"
          },
          {
            "name": "payable_update_nonce",
            "docs": [
              "The payable_update_nonce of the last applied PayablePayload.",
              "New updates must have nonce > this value to prevent state regression."
            ],
            "type": "u64"
          },
          {
            "name": "payments_count",
            "docs": [
              "Total number of payments received by this foreign payable on Solana."
            ],
            "type": "u64"
          },
          {
            "name": "created_at",
            "docs": [
              "Unix timestamp when this ForeignPayable record was first created on",
              "Solana."
            ],
            "type": "i64"
          },
          {
            "name": "allowed_tokens_and_amounts",
            "docs": [
              "Allowed tokens and amounts from the foreign chain (Wormhole-normalized)."
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "TokenAndAmountForeign"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "ForeignPaymentReceived",
      "docs": [
        "Emitted when a cross-chain payment (EVM → Solana) is received and processed."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable_payment",
            "docs": [
              "The PayablePayment PDA created for this inbound payment."
            ],
            "type": "pubkey"
          },
          {
            "name": "payable",
            "docs": [
              "The ForeignPayable that received the payment."
            ],
            "type": "pubkey"
          },
          {
            "name": "payer",
            "docs": [
              "Wormhole-normalized payer address on the source chain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "payer_chain_id",
            "docs": [
              "The cbChainId of the payer's chain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "amount",
            "docs": [
              "USDC amount credited (after CCTP fee deduction)."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "Payable",
      "docs": [
        "A public invoice that anyone can pay into. Created by a host.",
        "",
        "Size is dynamic: the account is reallocated when",
        "`allowed_tokens_and_amounts` or `balances` vecs change size. Max 255 ATAA",
        "entries (wire format limit).",
        "",
        "Seeds: `[Payable::SEED_PREFIX, host.key(), host_count.to_le_bytes()]`",
        "where `host_count` is `user_record.payables_count` BEFORE incrementing",
        "(this is the creation index, 0-based)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "host",
            "docs": [
              "The wallet of the payable's creator and owner."
            ],
            "type": "pubkey"
          },
          {
            "name": "host_count",
            "docs": [
              "The value of `user_record.payables_count` at creation time.",
              "Used as part of the PDA seed to give each host a unique per-index",
              "payable."
            ],
            "type": "u64"
          },
          {
            "name": "chain_count",
            "docs": [
              "Snapshot of `global_config.total_payables` at creation time.",
              "Used by the relayer to order payables globally."
            ],
            "type": "u64"
          },
          {
            "name": "created_at",
            "docs": [
              "Unix timestamp when this payable was created."
            ],
            "type": "i64"
          },
          {
            "name": "is_closed",
            "docs": [
              "Whether new payments are rejected. Set by `close_payable`."
            ],
            "type": "bool"
          },
          {
            "name": "is_auto_withdraw",
            "docs": [
              "Whether each incoming payment should trigger an immediate withdrawal."
            ],
            "type": "bool"
          },
          {
            "name": "payments_count",
            "docs": [
              "Total number of payments ever received by this payable."
            ],
            "type": "u64"
          },
          {
            "name": "withdrawals_count",
            "docs": [
              "Total number of withdrawals ever performed from this payable."
            ],
            "type": "u64"
          },
          {
            "name": "activities_count",
            "docs": [
              "Total number of activity records linked to this payable."
            ],
            "type": "u64"
          },
          {
            "name": "allowed_tokens_and_amounts",
            "docs": [
              "List of (token, amount) pairs that this payable accepts.",
              "Empty = accepts any token in any amount.",
              "Max 255 entries (wire format uses 1-byte length field)."
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "TokenAndAmount"
                }
              }
            }
          },
          {
            "name": "balances",
            "docs": [
              "Running balances per token in this payable's vault.",
              "Each entry represents the total accumulated but not yet withdrawn for a",
              "token."
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "TokenAndAmount"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "PayableActivityPointer",
      "docs": [
        "Pointer linking a payable's nth activity to the global ActivityRecord.",
        "",
        "Seeds: `[PayableActivityPointer::SEED_PREFIX,",
        "PayableActivityPointer::PAYABLE_PREFIX, payable.key(),",
        "payable_index.to_le_bytes()]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "global_index",
            "docs": [
              "Index into the global ActivityRecord sequence."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "PayablePayment",
      "docs": [
        "Immutable record of a payment from the payable's perspective.",
        "Created in both same-chain and cross-chain inbound payment flows.",
        "",
        "`payer` is stored as `[u8; 32]` (Wormhole-normalized) to support cross-chain",
        "payers:",
        "- Solana payer: `pubkey.to_bytes()`",
        "- EVM payer: `address.to_wormhole_format()` (left-padded 32 bytes)",
        "",
        "Seeds: `[PayablePayment::SEED_PREFIX, payable.key(),",
        "payable.payments_count.to_le_bytes()]` where `payments_count` is the value",
        "BEFORE incrementing (0-based index)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The payable that received this payment."
            ],
            "type": "pubkey"
          },
          {
            "name": "payer",
            "docs": [
              "Wormhole-normalized payer address (32 bytes).",
              "Solana: `pubkey.to_bytes()`. EVM: left-padded 20-byte address."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "payable_count",
            "docs": [
              "This payment's index within the payable's payment history (0-based)."
            ],
            "type": "u64"
          },
          {
            "name": "chain_count",
            "docs": [
              "Snapshot of `global_config.total_payable_payments` at time of payment."
            ],
            "type": "u64"
          },
          {
            "name": "token_mint",
            "docs": [
              "The token mint credited. `system_program::ID` for native SOL."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount received in token base units."
            ],
            "type": "u64"
          },
          {
            "name": "payer_chain_id",
            "docs": [
              "cbChainId of the payer's chain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "payer_payment_id",
            "docs": [
              "The UserPayment PDA address on the payer's chain (or cross-chain payment",
              "ID). Stored as bytes for cross-chain compatibility."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "created_at",
            "docs": [
              "Unix timestamp of the payment."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "PayableReceived",
      "docs": [
        "Emitted when a local payable receives a payment.",
        "For cross-chain inbound, `payer` is Wormhole-normalized (32 bytes) from the",
        "source chain."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payment",
            "docs": [
              "The PayablePayment PDA address."
            ],
            "type": "pubkey"
          },
          {
            "name": "payable",
            "docs": [
              "The payable that received the payment."
            ],
            "type": "pubkey"
          },
          {
            "name": "payer",
            "docs": [
              "Wormhole-normalized payer address (32 bytes — Pubkey on Solana, padded",
              "address on EVM)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "token",
            "docs": [
              "The token mint credited to the payable vault."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "The payment amount in token base units."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "PayableUpdateBroadcasted",
      "docs": [
        "Emitted when a payable's state is broadcast to foreign chains."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The payable whose state was broadcast."
            ],
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "docs": [
              "The nonce assigned to this broadcast (monotonically increasing)."
            ],
            "type": "u64"
          },
          {
            "name": "action_type",
            "docs": [
              "The action type: 1=Create, 2=Close, 3=Reopen, 4=UpdateATAA."
            ],
            "type": "u8"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "PaymentNonce",
      "docs": [
        "Marks a cross-chain payment nonce as consumed.",
        "",
        "Each EVM→Solana payment carries a payer-specific nonce in the",
        "PaymentPayload. `init`-ing this PDA is the second layer of replay protection",
        "(first is ConsumedVaa).",
        "",
        "Seeds: `[PaymentNonce::SEED_PREFIX, payer_chain_id, payer,",
        "nonce.to_le_bytes()]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payer_chain_id",
            "docs": [
              "cbChainId of the payer's chain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "payer",
            "docs": [
              "Wormhole-normalized payer address (32 bytes)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "nonce",
            "docs": [
              "The nonce value from the PaymentPayload."
            ],
            "type": "u64"
          },
          {
            "name": "processed_at",
            "docs": [
              "Unix timestamp when this nonce was consumed."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "ProgramInitialized",
      "docs": [
        "Emitted when the program is initialized for the first time.",
        "Captures the full initial configuration."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "The program owner (upgrade authority at init time)."
            ],
            "type": "pubkey"
          },
          {
            "name": "fee_bps",
            "docs": [
              "Default withdrawal fee in basis points (200 = 2%)."
            ],
            "type": "u16"
          },
          {
            "name": "cb_chain_id",
            "docs": [
              "cbChainId of this Solana deployment (mainnet or devnet)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "has_wormhole",
            "docs": [
              "Whether this deployment supports Wormhole outbound messages."
            ],
            "type": "bool"
          },
          {
            "name": "has_cctp",
            "docs": [
              "Whether this deployment supports CCTP outbound messages."
            ],
            "type": "bool"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp of initialization."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "ReceivedPayableUpdate",
      "docs": [
        "Emitted when a PayablePayload is received from a foreign chain and applied",
        "to a ForeignPayable PDA."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "foreign_payable_id",
            "docs": [
              "The payable_id from the payload (foreign chain's payable address as",
              "bytes32)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "src_cb_chain_id",
            "docs": [
              "The cbChainId of the chain that sent this update."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "nonce",
            "docs": [
              "The nonce of the update (used for ordering / replay protection)."
            ],
            "type": "u64"
          },
          {
            "name": "action_type",
            "docs": [
              "The action type applied: 1=Create, 2=Close, 3=Reopen, 4=UpdateATAA."
            ],
            "type": "u8"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "ReopenedPayable",
      "docs": [
        "Emitted when a previously closed payable is reopened."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The PDA address of the reopened payable."
            ],
            "type": "pubkey"
          },
          {
            "name": "host",
            "docs": [
              "The host that reopened it."
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "SenderAuthority",
      "docs": [
        "Keyless PDA that the program uses to sign CCTP `deposit_for_burn` calls.",
        "",
        "Owns the intermediate `program_usdc_ata` token account. The PDA itself holds",
        "no user funds — USDC passes through transiently and is burned atomically.",
        "",
        "Seeds: `[SenderAuthority::SEED_PREFIX]`"
      ],
      "type": {
        "kind": "struct",
        "fields": []
      }
    },
    {
      "name": "Stats",
      "docs": [
        "Chain-wide activity counters. Created once by `initialize`. Never closed.",
        "",
        "Mirrors EVM's combined `ChainStats`, `WormholeStats`, and `CctpStats`",
        "storage variables. Solana has no slot-layout upgrade concern (we use",
        "`realloc`), so all stats fit one PDA.",
        "",
        "Seeds: `[Stats::SEED_PREFIX]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "total_users",
            "docs": [
              "Cumulative count of unique users ever initialized on this chain."
            ],
            "type": "u64"
          },
          {
            "name": "total_payables",
            "docs": [
              "Cumulative count of payables ever created on this chain."
            ],
            "type": "u64"
          },
          {
            "name": "total_foreign_payables",
            "docs": [
              "Cumulative count of foreign payable records ever created on this chain."
            ],
            "type": "u64"
          },
          {
            "name": "total_user_payments",
            "docs": [
              "Cumulative count of user-side payment records ever created on this chain."
            ],
            "type": "u64"
          },
          {
            "name": "total_payable_payments",
            "docs": [
              "Cumulative count of payable-side payment records ever created on this",
              "chain."
            ],
            "type": "u64"
          },
          {
            "name": "total_withdrawals",
            "docs": [
              "Cumulative count of withdrawals ever performed on this chain."
            ],
            "type": "u64"
          },
          {
            "name": "total_activities",
            "docs": [
              "Cumulative count of activity records ever created on this chain."
            ],
            "type": "u64"
          },
          {
            "name": "published_wormhole_messages",
            "docs": [
              "Total Wormhole messages published (payable updates + outbound payments)."
            ],
            "type": "u64"
          },
          {
            "name": "consumed_wormhole_messages",
            "docs": [
              "Total Wormhole VAAs consumed (payable updates + inbound payments)."
            ],
            "type": "u64"
          },
          {
            "name": "emitted_cctp_payment_messages",
            "docs": [
              "Total CCTP payment messages emitted via `pay_foreign_via_cctp`."
            ],
            "type": "u64"
          },
          {
            "name": "emitted_cctp_update_messages",
            "docs": [
              "Total CCTP payable-update `sendMessage` calls emitted via",
              "`broadcast_payable_update`."
            ],
            "type": "u64"
          },
          {
            "name": "received_cctp_payment_messages",
            "docs": [
              "Total CCTP payment messages received (burn + data message pairs)."
            ],
            "type": "u64"
          },
          {
            "name": "received_cctp_update_messages",
            "docs": [
              "Total CCTP payable-update data messages received."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "TokenAllowed",
      "docs": [
        "Emitted when a token mint is allowed for payments. Mirrors EVM",
        "`AllowedPaymentsForToken`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "The mint address of the newly allowed token."
            ],
            "type": "pubkey"
          },
          {
            "name": "max_withdrawal_fee",
            "docs": [
              "The maximum withdrawal fee cap for this token (in base units)."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "TokenAndAmount",
      "docs": [
        "A (token_mint, amount) pair used in payable ATAA lists and balance tracking.",
        "",
        "In ATAA lists: if amount > 0, payer must pay exactly this amount.",
        "If the entire ATAA list is empty, the payable accepts any token in any",
        "amount.",
        "",
        "In balance tracking: represents the total accumulated balance for a token."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "token",
            "docs": [
              "The token mint pubkey. Use `system_program::ID` for native SOL."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount in token base units. Must be > 0 in ATAA entries."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "TokenAndAmountForeign",
      "docs": [
        "A (Wormhole-normalized token, amount) pair for foreign chain tokens.",
        "Token is stored as 32-byte Wormhole format (left-padded for EVM addresses)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "token",
            "docs": [
              "32-byte Wormhole-normalized token address on the foreign chain.",
              "EVM: left-padded 20-byte address. Solana: pubkey bytes."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "amount",
            "docs": [
              "Required payment amount in token base units."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "TokenConfig",
      "docs": [
        "Configuration and cumulative stats for a token mint.",
        "Created by `allow_token`, updated by payments and withdrawals.",
        "",
        "Seeds: `[TokenConfig::SEED_PREFIX, mint.key()]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "The token mint this config applies to. `system_program::ID` for native",
              "SOL."
            ],
            "type": "pubkey"
          },
          {
            "name": "is_allowed",
            "docs": [
              "Whether this token is currently accepted for payments.",
              "Set to true by `allow_token`, false by `disallow_token`."
            ],
            "type": "bool"
          },
          {
            "name": "max_withdrawal_fee",
            "docs": [
              "Maximum fee cap in token base units.",
              "Fee = min(amount * fee_bps / 10_000, max_withdrawal_fee).",
              "Set by `allow_token`. Prevents runaway fees on high-value tokens."
            ],
            "type": "u64"
          },
          {
            "name": "total_paid",
            "docs": [
              "Cumulative amount of this token paid into all payables on this chain."
            ],
            "type": "u64"
          },
          {
            "name": "total_received",
            "docs": [
              "Cumulative amount of this token received (inbound cross-chain)."
            ],
            "type": "u64"
          },
          {
            "name": "total_withdrawn",
            "docs": [
              "Cumulative amount of this token withdrawn by hosts."
            ],
            "type": "u64"
          },
          {
            "name": "total_fees_collected",
            "docs": [
              "Cumulative fees collected in this token."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "TokenDisallowed",
      "docs": [
        "Emitted when a token mint is disallowed (payments blocked). Mirrors EVM",
        "`StoppedPaymentsForToken`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "The mint address of the disallowed token."
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "UpdatedPayableAtaa",
      "docs": [
        "Emitted when a payable's allowed tokens and amounts list is updated."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The PDA address of the updated payable."
            ],
            "type": "pubkey"
          },
          {
            "name": "host",
            "docs": [
              "The host that performed the update."
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "UpdatedPayableAutoWithdraw",
      "docs": [
        "Emitted when a payable's auto-withdraw flag is toggled."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The PDA address of the updated payable."
            ],
            "type": "pubkey"
          },
          {
            "name": "host",
            "docs": [
              "The host that performed the update."
            ],
            "type": "pubkey"
          },
          {
            "name": "is_auto_withdraw",
            "docs": [
              "The new value of the auto-withdraw flag."
            ],
            "type": "bool"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "UserActivityPointer",
      "docs": [
        "Pointer linking a user's nth activity to the global ActivityRecord.",
        "",
        "Seeds: `[UserActivityPointer::SEED_PREFIX, UserActivityPointer::USER_PREFIX,",
        "user.key(), user_index.to_le_bytes()]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "global_index",
            "docs": [
              "Index into the global ActivityRecord sequence."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "UserInitialized",
      "docs": [
        "Emitted when a new UserRecord PDA is created for a wallet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "docs": [
              "The wallet that was initialized."
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp of initialization."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "UserPaid",
      "docs": [
        "Emitted when a same-chain payment is made to a payable.",
        "Also emitted for cross-chain outbound (Solana → EVM) payments."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payment",
            "docs": [
              "The UserPayment PDA address."
            ],
            "type": "pubkey"
          },
          {
            "name": "payer",
            "docs": [
              "The payer's wallet address."
            ],
            "type": "pubkey"
          },
          {
            "name": "payable",
            "docs": [
              "The payable that was paid into."
            ],
            "type": "pubkey"
          },
          {
            "name": "token",
            "docs": [
              "The token mint used for payment (system_program::ID for native SOL)."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "The payment amount in token base units."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "UserPayment",
      "docs": [
        "Immutable record of a payment from the payer's perspective.",
        "Created in both same-chain and cross-chain outbound payment flows.",
        "",
        "Seeds: `[UserPayment::SEED_PREFIX, payer.key(),",
        "user_record.payments_count.to_le_bytes()]` where `payments_count` is the",
        "value BEFORE incrementing (0-based index)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payer",
            "docs": [
              "The payer's wallet."
            ],
            "type": "pubkey"
          },
          {
            "name": "payable",
            "docs": [
              "The target payable. For same-chain: local Payable PDA.",
              "For cross-chain outbound: the foreign payable_id as a Pubkey (bytes)."
            ],
            "type": "pubkey"
          },
          {
            "name": "payer_count",
            "docs": [
              "This payment's index within the payer's payment history (0-based)."
            ],
            "type": "u64"
          },
          {
            "name": "chain_count",
            "docs": [
              "Snapshot of `global_config.total_user_payments` at time of payment."
            ],
            "type": "u64"
          },
          {
            "name": "token_mint",
            "docs": [
              "The token mint used. `system_program::ID` for native SOL."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount paid in token base units."
            ],
            "type": "u64"
          },
          {
            "name": "payable_chain_id",
            "docs": [
              "cbChainId of the chain where the payable lives."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "payer_chain_id",
            "docs": [
              "cbChainId of the chain where the payer lives (this chain = Solana)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "created_at",
            "docs": [
              "Unix timestamp of the payment."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "UserRecord",
      "docs": [
        "Tracks a user's activity counts and creation timestamp.",
        "Created with `init_if_needed` on first action by a wallet.",
        "",
        "Seeds: `[UserRecord::SEED_PREFIX, wallet.key()]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "docs": [
              "The wallet this record belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "payables_count",
            "docs": [
              "Number of payables this user has created. Used as the index seed",
              "for new Payable PDAs: seeds = [b\"payable\", wallet,",
              "payables_count.to_le_bytes()]."
            ],
            "type": "u64"
          },
          {
            "name": "payments_count",
            "docs": [
              "Number of payments this user has made. Used as the index seed",
              "for new UserPayment PDAs."
            ],
            "type": "u64"
          },
          {
            "name": "withdrawals_count",
            "docs": [
              "Number of withdrawals this user has performed."
            ],
            "type": "u64"
          },
          {
            "name": "activities_count",
            "docs": [
              "Number of activity records linked to this user."
            ],
            "type": "u64"
          },
          {
            "name": "created_at",
            "docs": [
              "Unix timestamp when this UserRecord was first created."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "Withdrawal",
      "docs": [
        "Immutable record of a withdrawal by a payable host.",
        "",
        "Seeds: `[Withdrawal::SEED_PREFIX, payable.key(),",
        "payable.withdrawals_count.to_le_bytes()]` where `withdrawals_count` is the",
        "value BEFORE incrementing (0-based index)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payable",
            "docs": [
              "The payable that was withdrawn from."
            ],
            "type": "pubkey"
          },
          {
            "name": "host",
            "docs": [
              "The host wallet that performed the withdrawal."
            ],
            "type": "pubkey"
          },
          {
            "name": "token_mint",
            "docs": [
              "The token mint withdrawn. `system_program::ID` for native SOL."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Gross withdrawal amount (before fee deduction)."
            ],
            "type": "u64"
          },
          {
            "name": "fees",
            "docs": [
              "Fee deducted (min of percentage-based and max_fee cap)."
            ],
            "type": "u64"
          },
          {
            "name": "net_amount",
            "docs": [
              "Net amount actually received by the host (amount - fees)."
            ],
            "type": "u64"
          },
          {
            "name": "withdrawal_count",
            "docs": [
              "This withdrawal's index within the payable's withdrawal history",
              "(0-based)."
            ],
            "type": "u64"
          },
          {
            "name": "chain_count",
            "docs": [
              "Snapshot of `global_config.total_withdrawals` at time of withdrawal."
            ],
            "type": "u64"
          },
          {
            "name": "created_at",
            "docs": [
              "Unix timestamp of the withdrawal."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "Withdrew",
      "docs": [
        "Emitted when a host withdraws funds from a payable."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "withdrawal",
            "docs": [
              "The Withdrawal PDA address."
            ],
            "type": "pubkey"
          },
          {
            "name": "payable",
            "docs": [
              "The payable that was withdrawn from."
            ],
            "type": "pubkey"
          },
          {
            "name": "host",
            "docs": [
              "The host that performed the withdrawal."
            ],
            "type": "pubkey"
          },
          {
            "name": "token",
            "docs": [
              "The token mint withdrawn."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Gross withdrawal amount (before fees)."
            ],
            "type": "u64"
          },
          {
            "name": "fees",
            "docs": [
              "Fee amount deducted."
            ],
            "type": "u64"
          },
          {
            "name": "net_amount",
            "docs": [
              "Net amount received by host (amount - fees)."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    }
  ]
}
 as Chainbills;
