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

export interface BlockSql {
  hash: string
  status?: number
  proposedAt: number
  proposalHash: string
  header: {
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
  proposalData?: object
  bootstrap?: {
    utxoTreeIndex: number
    utxoBootstrap: string[]
    withdrawalTreeIndex: number
    withdrawalBootstrap: string[]
  }
}

export function block(zkopruId: string): InanoSQLTableConfig {
  return {
    name: `zkopru-block-${zkopruId}`,
    model: {
      'hash:string': { pk: true },
      'status:int': { default: 0 },
      'proposedAt:int': {},
      'proposalHash:string': {},
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
      'proposalData:any': {},
      'bootstrap:obj': {
        model: {
          'utxoTreeIndex:number': {},
          'utxoBootstrap:string[]': {},
          'withdrawalTreeIndex:number': {},
          'withdrawalBootstrap:string[]': {},
        },
      },
    },
    indexes: {
      'proposedAt:int': {},
      'status:int': {},
      'header.parentBlock:string': {},
    },
    queries: [
      {
        name: 'addGenesisBlock',
        args: {},
        call: (db, args) => {
          const { hash, header } = args
          return db
            .query('upsert', [
              {
                hash,
                header,
                status: BlockStatus.FINALIZED,
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
                proposalData: null,
              },
            ])
            .emit()
        },
      },
      {
        name: 'getProposalSyncIndex',
        args: {},
        call: (db, _) => {
          return db
            .query('select', ['MAX(proposedAt)'])
            .where(['status', '<=', BlockStatus.NOT_FETCHED])
            .emit()
        },
      },
      {
        name: 'getFinalizationSyncIndex',
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
          'hash:string': {},
          'proposedAt:int ': {},
          'proposalHash:string ': {},
        },
        call: (db, args) => {
          return db
            .query('upsert', [
              {
                hash: args.hash,
                proposedAt: args.proposedAt,
                proposalHash: args.proposalHash,
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
          'proposalData:string': {},
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
                proposalData: null,
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
                proposalData: null,
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
            .query('upsert', [
              { hash: args.hash, status: BlockStatus.FINALIZED },
            ])
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
              { hash: args.hash, status: BlockStatus.REVERTED },
            ])
            .emit()
        },
      },
      {
        name: 'getBlockNumForLatestProposal',
        args: {},
        call: (db, _) => {
          return db.query('select', ['MAX(proposedAt)']).emit()
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
              'proposedAt',
              'header',
              'MAX(proposedAt)',
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
        name: 'getLatestBlock',
        args: {},
        call: (db, _) => {
          return db
            .query('select', [
              'hash',
              'proposedAt',
              'proposalHash',
              'header',
              'MAX(proposedAt)',
            ])
            .emit()
        },
      },
    ],
  }
}
