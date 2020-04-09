import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'

export enum BlockStatus {
  NOT_FETCHED = 0,
  FETCHED = 1,
  VERIFIED = 2,
  FINALIZED = 3,
  INVALIDATED = 4,
  REVERTED = 5,
}

export interface BlockSql {
  hash: string
  status?: BlockStatus
  proposedAt: number
  submissionId: string
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
}

export function block(zkopruId: string): InanoSQLTableConfig {
  return {
    name: `zkopru-block-${zkopruId}`,
    model: {
      'hash:string': { pk: true },
      'status:int': { default: 0 },
      'proposedAt:int': {},
      'submissionId:string': {},
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
    },
    indexes: {
      'proposedAt:int': {},
    },
    queries: [
      {
        name: 'newBlock',
        args: {
          'hash:string': { pk: true },
          'proposedAt:int': {},
          'submissionId:string': {},
          'header:obj': {},
        },
        call: (db, args) => {
          return db.query('upsert', [args]).emit()
        },
      },
      {
        name: 'getLastUpstreamBlock',
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
        name: 'getLatestBlock',
        args: {},
        call: (db, _) => {
          return db
            .query('select', [
              'hash',
              'proposedAt',
              'submissionId',
              'header',
              'MAX(proposedAt)',
            ])
            .emit()
        },
      },
    ],
  }
}
