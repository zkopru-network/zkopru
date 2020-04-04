import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'

export function block(zkopruId: string): InanoSQLTableConfig {
  return {
    name: `zkopru-block-${zkopruId}`,
    model: {
      'hash:string': { pk: true },
      'blockNum:int': {},
      'parent:string': {},
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
      'blockNum:int': {},
    },
    queries: [
      {
        name: 'newBlock',
        args: {
          'hash:string': { pk: true },
          'blockNum:int': {},
          'parent:string': {},
          'submissionId:string': {},
          'header:obj': {},
        },
        call: (db, args) => {
          return db.query('upsert', [args]).emit()
        },
      },
      {
        name: 'getBlockNumber',
        args: {},
        call: (db, _) => {
          return db.query('select', ['MAX(blockNum)']).emit()
        },
      },
      {
        name: 'getBlockWithNumber',
        args: {
          'blockNum:int': {},
        },
        call: (db, args) => {
          return db
            .query('select')
            .where(['blockNum', '=', args.blockNum])
            .emit()
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
              'blockNum',
              'parent',
              'submissionId',
              'header',
              'MAX(blockNum)',
            ])
            .emit()
        },
      },
    ],
  }
}
