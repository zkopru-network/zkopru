import * as uuid from 'uuid'
import { TableData } from './types'

export default [
  {
    name: 'EncryptedWallet',
    primaryKey: 'id',
    rows: [
      {
        name: 'id',
        unique: true,
        type: 'String',
        default: () => uuid.v4(),
      },
      ['ciphertext', 'String'],
      ['iv', 'String'],
      ['algorithm', 'String'],
      ['keylen', 'Int'],
      ['kdf', 'String'],
      ['N', 'Int'],
      ['r', 'Int'],
      ['p', 'Int'],
      ['salt', 'String'],
    ],
  },
  {
    name: 'Keystore',
    primaryKey: 'address',
    rows: [
      ['address', 'String'],
      ['zkAddress', 'String'],
      ['encrypted', 'String'],
    ],
  },
  {
    name: 'Config',
    primaryKey: ['networkId', 'chainId', 'address'],
    rows: [
      ['id', 'String', { unique: true }],
      ['networkId', 'Int'],
      ['chainId', 'Int'],
      ['address', 'String'],
      ['utxoTreeDepth', 'Int'],
      ['withdrawalTreeDepth', 'Int'],
      ['nullifierTreeDepth', 'Int'],
      ['challengePeriod', 'Int'],
      ['minimumStake', 'String'],
      ['referenceDepth', 'Int'],
      ['maxUtxo', 'String'],
      ['maxWithdrawal', 'String'],
      ['utxoSubTreeDepth', 'Int'],
      ['utxoSubTreeSize', 'Int'],
      ['withdrawalSubTreeDepth', 'Int'],
      ['withdrawalSubTreeSize', 'Int'],
    ],
  },
  {
    name: 'Tracker',
    primaryKey: 'id',
    rows: [
      {
        name: 'id',
        type: 'Int',
        default: () => Math.floor(Math.random() * 100000000),
      },
      {
        name: 'viewer',
        type: 'String',
        unique: true,
        optional: true,
      },
      {
        name: 'address',
        type: 'String',
        unique: true,
        optional: true,
      },
    ],
  },
  {
    name: 'Header',
    primaryKey: 'hash',
    indexes: [{ keys: ['utxoRoot'] }, { keys: ['parentBlock'] }],
    rows: [
      ['hash', 'String'],
      ['proposer', 'String'],
      ['parentBlock', 'String'],
      ['fee', 'String'],
      ['utxoRoot', 'String'],
      ['utxoIndex', 'String'],
      ['nullifierRoot', 'String'],
      ['withdrawalRoot', 'String'],
      ['withdrawalIndex', 'String'],
      ['txRoot', 'String'],
      ['depositRoot', 'String'],
      ['migrationRoot', 'String'],
    ],
  },
  {
    name: 'Block',
    primaryKey: 'hash',
    rows: [
      ['hash', 'String'],
      {
        name: 'header',
        type: 'Object',
        relation: {
          localField: 'hash',
          foreignField: 'hash',
          foreignTable: 'Header',
        },
      },
      {
        name: 'proposal',
        type: 'Object',
        relation: {
          localField: 'hash',
          foreignField: 'hash',
          foreignTable: 'Proposal',
        },
      },
      ['bootstrap', 'Object', { optional: true }],
      {
        name: 'slash',
        type: 'Object',
        optional: true,
        relation: {
          localField: 'hash',
          foreignField: 'hash',
          foreignTable: 'Slash',
        },
      },
    ],
  },
  {
    name: 'Proposal',
    primaryKey: 'hash',
    indexes: [{ keys: ['hash'] }],
    rows: [
      ['hash', 'String'],
      ['proposalNum', 'Int', { index: true, optional: true }],
      ['canonicalNum', 'Int', { optional: true }],
      ['proposedAt', 'Int', { index: true, optional: true }],
      ['proposalTx', 'String', { optional: true }],
      ['proposalData', 'String', { optional: true }],
      ['timestamp', 'Int', { optional: true }],
      ['fetched', 'String', { optional: true }],
      ['finalized', 'Bool', { optional: true }],
      ['verified', 'Bool', { optional: true }],
      ['isUncle', 'Bool', { optional: true }],
      {
        name: 'header',
        type: 'Object',
        relation: {
          localField: 'hash',
          foreignField: 'hash',
          foreignTable: 'Header',
        },
      },
      {
        name: 'block',
        type: 'Object',
        optional: true,
        relation: {
          localField: 'hash',
          foreignField: 'hash',
          foreignTable: 'Block',
        },
      },
    ],
  },
  {
    name: 'Slash',
    primaryKey: 'hash',
    rows: [
      ['hash', 'String'],
      ['proposer', 'String'],
      ['reason', 'String'],
      ['executionTx', 'String'],
      ['slashedAt', 'Int', { index: true }],
      {
        name: 'block',
        relation: {
          localField: 'hash',
          foreignField: 'hash',
          foreignTable: 'Block',
        },
      },
    ],
  },
  {
    name: 'Bootstrap',
    primaryKey: 'id',
    rows: [
      {
        name: 'id',
        type: 'String',
        default: () => uuid.v4(),
      },
      {
        name: 'blockHash',
        type: 'String',
        optional: true,
        unique: true,
      },
      ['utxoBootstrap', 'String'],
      ['withdrawalBootstrap', 'String'],
      {
        name: 'block',
        type: 'Object',
        relation: {
          localField: 'blockHash',
          foreignField: 'hash',
          foreignTable: 'Block',
        },
      },
    ],
  },
  {
    name: 'Tx',
    primaryKey: 'hash',
    rows: [
      ['hash', 'String'],
      ['blockHash', 'String'],
      ['inflowCount', 'Int'],
      ['outflowCount', 'Int'],
      ['fee', 'String'],
      ['challenged', 'Bool'],
      ['slashed', 'Bool'],
      /**
       * The fields below are problematic. If the memo is decryptable by our
       * address we know that we received at least one of the UTXOs.
       * However, there are possibly up to 3 other recipients. senderAddress
       * should be an array, but for simplicity we are storing a string.
       * This should only become a problem if an advanced type of
       * transaction is used e.g. me sending 4 outflows from 4 different
       * accounts I control to a single note owned by one account.
       * */
      ['senderAddress', 'String', { optional: true }],
      ['receiverAddress', 'String', { optional: true }],
      ['tokenAddr', 'String', { optional: true }],
      ['erc20Amount', 'String', { optional: true }],
      ['eth', 'String', { optional: true }],
      {
        name: 'proposal',
        relation: {
          localField: 'blockHash',
          foreignField: 'hash',
          foreignTable: 'Proposal',
        },
      },
    ],
  },
  {
    name: 'PendingTx',
    primaryKey: 'hash',
    rows: [
      ['hash', 'String'],
      ['fee', 'String'],
      ['proof', 'Object'],
      ['memoVersion', 'Int', { optional: true }],
      ['memoData', 'String', { optional: true }],
      ['swap', 'String', { optional: true }],
      ['inflow', 'Object'],
      ['outflow', 'Object'],
      ['senderAddress', 'String', { optional: true }],
      ['receiverAddress', 'String', { optional: true }],
      ['tokenAddr', 'String', { optional: true }],
      ['erc20Amount', 'String', { optional: true }],
      ['eth', 'String', { optional: true }],
    ],
  },
  {
    name: 'MassDeposit',
    primaryKey: 'index',
    indexes: [
      {
        keys: ['merged'],
      },
    ],
    rows: [
      ['index', 'String'],
      ['merged', 'String'],
      ['fee', 'String'],
      ['blockNumber', 'Int', { index: true }],
      {
        name: 'includedIn',
        type: 'String',
        optional: true,
      },
    ],
  },
  {
    name: 'PendingDeposit',
    primaryKey: 'note',
    rows: [
      ['note', 'String'],
      ['fee', 'String'],
      {
        name: 'utxo',
        relation: {
          localField: 'note',
          foreignField: 'hash',
          foreignTable: 'Utxo',
        },
      },
    ],
  },
  {
    name: 'Deposit',
    primaryKey: 'id',
    rows: [
      ['id', 'String'],
      ['note', 'String', { index: true }],
      ['fee', 'String'],
      ['transactionIndex', 'Int'],
      ['logIndex', 'Int'],
      ['blockNumber', 'Int', { index: true }],
      ['queuedAt', 'String', { index: true }],
      ['ownerAddress', 'String', { optional: true }],
      ['includedIn', 'String', { optional: true }],
      ['from', 'String', { optional: true }],
      {
        name: 'utxo',
        relation: {
          localField: 'note',
          foreignField: 'hash',
          foreignTable: 'Utxo',
        },
      },
      {
        name: 'proposal',
        relation: {
          localField: 'includedIn',
          foreignField: 'hash',
          foreignTable: 'Proposal',
        },
      },
    ],
  },
  {
    name: 'Utxo',
    primaryKey: 'hash',
    rows: [
      ['hash', 'String'],
      ['eth', 'String', { optional: true }],
      ['owner', 'String', { optional: true }],
      ['salt', 'String', { optional: true }],
      ['tokenAddr', 'String', { optional: true }],
      ['erc20Amount', 'String', { optional: true }],
      ['nft', 'String', { optional: true }],
      ['status', 'Int', { optional: true }],
      ['treeId', 'String', { optional: true }],
      ['index', 'String', { optional: true }],
      ['nullifier', 'String', { optional: true }],
      ['usedAt', 'String', { optional: true }],
      [
        'depositedAt',
        'Int',
        {
          optional: true,
          index: true,
        },
      ],
    ],
  },
  {
    name: 'Withdrawal',
    primaryKey: 'hash',
    rows: [
      ['hash', 'String'],
      ['withdrawalHash', 'String'],
      ['eth', 'String'],
      ['owner', 'String', { optional: true }],
      ['salt', 'String', { optional: true }],
      ['tokenAddr', 'String'],
      ['erc20Amount', 'String'],
      ['nft', 'String'],
      ['to', 'String'],
      ['fee', 'String'],
      ['status', 'Int', { optional: true }],
      ['treeId', 'String', { optional: true }],
      ['index', 'String', { optional: true }],
      ['includedIn', 'String', { optional: true }],
      ['prepayer', 'String', { optional: true }],
      ['expiration', 'Int', { optional: true }],
      ['siblings', 'String', { optional: true }],
      {
        name: 'proposal',
        relation: {
          localField: 'includedIn',
          foreignField: 'hash',
          foreignTable: 'Proposal',
        },
      },
    ],
  },
  {
    name: 'InstantWithdrawal',
    primaryKey: 'signature',
    rows: [
      ['signature', 'String'],
      ['withdrawalHash', 'String'],
      ['prepayFeeInEth', 'String'],
      ['prepayFeeInToken', 'String'],
      ['expiration', 'Int'],
      ['prepayer', 'String'],
      {
        name: 'withdrawal',
        relation: {
          localField: 'withdrawalHash',
          foreignField: 'withdrawalHash',
          foreignTable: 'Withdrawal',
        },
      },
    ],
  },
  {
    name: 'Migration',
    primaryKey: 'hash',
    rows: [
      ['hash', 'String'],
      ['eth', 'String', { optional: true }],
      ['owner', 'String', { optional: true }],
      ['salt', 'String', { optional: true }],
      ['tokenAddr', 'String', { optional: true }],
      ['erc20Amount', 'String', { optional: true }],
      ['nft', 'String', { optional: true }],
      ['to', 'String', { optional: true }],
      ['fee', 'String', { optional: true }],
      ['status', 'Int', { optional: true }],
      ['treeId', 'String', { optional: true }],
      ['index', 'String', { optional: true }],
      ['usedFor', 'String', { optional: true }],
    ],
  },
  {
    name: 'TreeNode',
    primaryKey: ['treeId', 'nodeIndex'],
    indexes: [
      {
        keys: ['nodeIndex', 'treeId'],
      },
      {
        keys: ['nodeIndex', 'value'],
      },
    ],
    rows: [
      ['treeId', 'String'],
      ['nodeIndex', 'String', { index: true }],
      ['value', 'String'],
    ],
  },
  {
    name: 'LightTree',
    primaryKey: 'id',
    rows: [
      {
        name: 'id',
        type: 'String',
        default: () => uuid.v4(),
        // unique: true,
      },
      ['species', 'Int', { unique: true }],
      ['start', 'String'],
      ['end', 'String'],
      ['root', 'String'],
      ['index', 'String'],
      ['siblings', 'String'],
    ],
  },
  {
    name: 'TokenRegistry',
    primaryKey: 'address',
    rows: [
      ['address', 'String'],
      ['isERC20', 'Bool'],
      ['isERC721', 'Bool'],
      ['identifier', 'Int'],
      ['blockNumber', 'Int', { index: true }],
    ],
  },
  {
    name: 'ERC20Info',
    primaryKey: 'address',
    rows: [
      ['address', 'String'],
      ['symbol', 'String'],
      ['decimals', 'Int'],
    ],
  },
] as TableData[]
