/* eslint-disable @typescript-eslint/no-unused-vars */
import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'

export enum BlockStatus {
  NOT_FETCHED = 0,
  FETCHED = 1,
  PARTIALLY_VERIFIED = 2,
  FULLY_VERIFIED = 3,
  FINALIZED = 4,
  INVALIDATED = 5,
  REVERTED = 6,
}

export interface HeaderSql {
  proposer: string
  parentBlock: string
  metadata: string
  fee: string
  utxoRoot: string
  utxoIndex: string
  nullifierRoot: string
  withdrawalRoot: string
  withdrawalIndex: string
  txRoot: string
  depositRoot: string
  migrationRoot: string
}

export interface BootstrapSql {
  utxoTreeIndex: number
  utxoBootstrap: string[]
  withdrawalTreeIndex: number
  withdrawalBootstrap: string[]
}

export interface BlockSql {
  hash: string
  status?: number
  proposalNum?: number
  proposedAt: number
  proposalTx: string
  header: HeaderSql
  proposalData?: object
  bootstrap?: BootstrapSql
}

export const block: InanoSQLTableConfig = {
  name: `zkopru-block`,
  model: {
    'hash:string': { pk: true },
    'status:int': { default: 0 },
    'proposalNum:int': {},
    'proposedAt:int': {},
    'proposalTx:string': {},
    'header:obj': {
      model: {
        'proposer:string': {},
        'parentBlock:string': {},
        'metadata:string': {},
        'fee:string': {},
        /** UTXO roll up  */
        'utxoRoot:string': {},
        'utxoIndex:string': {},

        /** Nullifier roll up  */
        'nullifierRoot:string': {},

        /** Withdrawal roll up  */
        'withdrawalRoot:string': {},
        'withdrawalIndex:string': {},

        /** Transactions */
        'txRoot:string': {},
        'depositRoot:string': {},
        'migrationRoot:string': {},
      },
    },
    'proposalData:obj': {},
    'bootstrap:obj': {
      model: {
        'utxoTreeIndex:int': {},
        'utxoBootstrap:string[]': {},
        'withdrawalTreeIndex:int': {},
        'withdrawalBootstrap:string[]': {},
      },
    },
    'reverted:boolean': { default: false },
  },
  indexes: {
    'proposedAt:int': {},
    'proposalNum:int': {},
    'status:int': {},
    'header.parentBlock:string': {},
  },
  queries: [
    {
      name: 'addGenesisBlock',
      args: {
        'hash:string': {},
        'header:object': {},
        'proposedAt:int': {},
        'proposalTx:string': {},
      },
      call: (db, args) => {
        const { hash, header, proposedAt, proposalTx } = args
        console.log('adding genesis block', hash, header)
        return db
          .query('upsert', [
            {
              hash,
              header,
              proposalNum: 0,
              proposedAt,
              proposalTx,
              status: BlockStatus.FINALIZED,
            },
          ])
          .emit()
      },
    },
    {
      name: 'recordBootstrap',
      args: {
        'hash:string': {},
        'bootstrap:obj': {},
      },
      call: (db, args) => {
        return db
          .query('upsert', [
            {
              hash: args.hash,
              bootstrap: args.bootstrap,
            },
          ])
          .emit()
      },
    },
    {
      name: 'bootstrapBlock',
      args: {
        'block:obj': {},
      },
      call: (db, args) => {
        const { block } = args
        return db
          .query('upsert', [
            {
              ...block,
              status: BlockStatus.FINALIZED,
            },
          ])
          .emit()
      },
    },
    {
      name: 'getProposalSyncStart',
      args: {},
      call: (db, _) => {
        return db
          .query('select', ['MAX(proposedAt)'])
          .where(['status', '<=', BlockStatus.NOT_FETCHED])
          .emit()
      },
    },
    {
      name: 'getFinalizationSyncStart',
      args: {},
      call: (db, _) => {
        return db
          .query('select', ['MAX(proposedAt)'])
          .where(['status', '=', BlockStatus.FINALIZED])
          .emit()
      },
    },
    {
      name: 'writeNewProposal',
      args: {
        'blockHash:string': {},
        'proposalNum:int': {},
        'proposedAt:int': {},
        'proposalTx:string': {},
      },
      call: (db, args) => {
        console.log('DB write args', args)
        return db
          .query('upsert', [
            {
              hash: args.blockHash,
              proposalNum: args.proposalNum,
              proposedAt: args.proposedAt,
              proposalTx: args.proposalTx,
              status: BlockStatus.NOT_FETCHED,
            },
          ])
          .emit()
      },
    },
    {
      name: 'saveFetchedBlock',
      args: {
        'hash:string': { pk: true },
        'header:obj': {},
        'proposalData:obj': {},
      },
      call: (db, args) => {
        return db
          .query('upsert', [
            {
              hash: args.hash,
              header: args.header,
              proposalData: args.proposalData,
              status: BlockStatus.FETCHED,
            },
          ])
          .emit()
      },
    },
    {
      name: 'markAsPartiallyVerified',
      args: {
        'hash:string': { pk: true },
      },
      call: (db, args) => {
        return db
          .query('upsert', [
            {
              hash: args.hash,
              status: BlockStatus.PARTIALLY_VERIFIED,
            },
          ])
          .emit()
      },
    },
    {
      name: 'markAsFullyVerified',
      args: {
        'hash:string': { pk: true },
      },
      call: (db, args) => {
        return db
          .query('upsert', [
            {
              hash: args.hash,
              status: BlockStatus.FULLY_VERIFIED,
            },
          ])
          .where(['status', '<', BlockStatus.FINALIZED])
          .emit()
      },
    },
    {
      name: 'markAsFinalized',
      args: {
        'hash:string': { pk: true },
      },
      call: (db, args) => {
        return db
          .query('upsert', [{ hash: args.hash, status: BlockStatus.FINALIZED }])
          .where(['status', '<', BlockStatus.FINALIZED])
          .emit()
      },
    },
    {
      name: 'markAsInvalidated',
      args: {
        'hash:string': { pk: true },
      },
      call: (db, args) => {
        return db
          .query('upsert', [
            { hash: args.hash, status: BlockStatus.INVALIDATED },
          ])
          .emit()
      },
    },
    {
      name: 'markAsReverted',
      args: {
        'hash:string': { pk: true },
      },
      call: (db, args) => {
        return db
          .query('upsert', [
            { hash: args.hash, status: BlockStatus.REVERTED, reverted: true },
          ])
          .emit()
      },
    },
    {
      name: 'getBlockNumForLatestProposal',
      args: {},
      call: (db, _) => {
        return db.query('select', ['MAX(proposalNum)']).emit()
      },
    },
    {
      name: 'getBlockWithHash',
      args: {
        'hash:string': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .where(['hash', '=', args.hash])
          .emit()
      },
    },
    {
      name: 'getLastVerifiedBlock',
      args: {},
      call: (db, _) => {
        return db
          .query('select', [
            'hash',
            'proposalNum',
            'header',
            'MAX(proposalNum)',
          ])
          .where([
            'status',
            'IN',
            [
              BlockStatus.PARTIALLY_VERIFIED,
              BlockStatus.FULLY_VERIFIED,
              BlockStatus.FINALIZED,
            ],
          ])
          .emit()
      },
    },
    {
      name: 'getLastProcessedBlock',
      args: {},
      call: (db, _) => {
        return db
          .query('select', [
            'hash',
            'header',
            'MAX(proposalNum) AS proposalNum',
          ])
          .where(['status', '>', BlockStatus.FETCHED])
          .emit()
      },
    },
    {
      name: 'getLatestBlock',
      args: {},
      call: (db, _) => {
        return db
          .query('select', [
            'hash',
            'proposalNum',
            'proposalTx',
            'header',
            'MAX(proposalNum)',
          ])
          .emit()
      },
    },
  ],
}
