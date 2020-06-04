import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'

export interface DepositSql {
  note: string
  fee: string
  queuedAt: string
  zkopru: string
  transactionIndex: number
  logIndex: number
  blockNumber: number
  l2Block?: string
}

export const deposit: InanoSQLTableConfig = {
  name: 'deposit',
  model: {
    'note:string': { pk: true },
    'fee:string': {},
    'queuedAt:string': {},
    'logIndex:int': {},
    'transactionIndex:int': {},
    'zkopru:uuid': {},
    'blockNumber:int': {},
    'l2Block:string': {},
  },
  indexes: {
    'queuedAt:string': {},
    'zkopru:uuid': {},
  },
  queries: [
    {
      name: 'getSyncStart',
      args: { 'zkopru:uuid': {} },
      call: (db, args) => {
        return db
          .query('select', ['MAX(blockNumber)'])
          .where(['zkopru', '=', args.zkopru])
          .emit()
      },
    },
    {
      name: 'writeNewDeposit',
      args: { 'deposit:object': {} },
      call: (db, args) => {
        return db.query('upsert', [args.deposit as DepositSql]).emit()
      },
    },
    {
      name: 'getDeposits',
      args: {
        'commitIndexes:string[]': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .where(['queuedAt', 'IN', [...args.commitIndexes]])
          .emit()
      },
    },
  ],
}
