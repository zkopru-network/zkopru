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
    rows: [
      ['hash', 'String'],
      ['proposalNum', 'Int', { index: true, optional: true }],
      ['canonicalNum', 'Int', { optional: true }],
      ['proposedAt', 'Int', { index: true, optional: true }],
      ['proposalTx', 'String', { optional: true }],
      ['proposalData', 'String', { optional: true }],
      ['fetched', 'String', { optional: true }],
      ['finalized', 'Bool', { optional: true }],
      ['verified', 'Bool', { optional: true }],
      ['isUncle', 'Bool', { optional: true }],
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
    ],
  },
  {
    name: 'MassDeposit',
    primaryKey: 'index',
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
    name: 'Deposit',
    primaryKey: 'note',
    rows: [
      ['note', 'String'],
      ['fee', 'String'],
      ['transactionIndex', 'Int'],
      ['logIndex', 'Int'],
      ['blockNumber', 'Int', { index: true }],
      ['queuedAt', 'String'],
    ],
  },
  {
    name: 'Utxo',
    primaryKey: 'hash',
    rows: [
      ['hash', 'String'],
      {
        name: 'eth',
        type: 'String',
        optional: true,
      },
      {
        name: 'owner',
        type: 'String',
        optional: true,
      },
      {
        name: 'salt',
        type: 'String',
        optional: true,
      },
      {
        name: 'tokenAddr',
        type: 'String',
        optional: true,
      },
      {
        name: 'erc20Amount',
        type: 'String',
        optional: true,
      },
      {
        name: 'nft',
        type: 'String',
        optional: true,
      },
      {
        name: 'status',
        type: 'Int',
        optional: true,
      },
      {
        name: 'treeId',
        type: 'String',
        optional: true,
      },
      {
        name: 'index',
        type: 'String',
        optional: true,
      },
      {
        name: 'nullifier',
        type: 'String',
        optional: true,
      },
      {
        name: 'usedAt',
        type: 'String',
        optional: true,
      },
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
      ['siblings', 'String', { optional: true }],
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
    rows: [
      ['treeId', 'String'],
      ['nodeIndex', 'String'],
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
] as TableData[]
