import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'

export interface MassDepositCommitSql {
  index: string
  merged: string
  fee: string
  zkopru: string
  blockNumber: number
  includedIn?: string
}

export const massDeposit: InanoSQLTableConfig = {
  name: 'massDeposit',
  model: {
    'id:uuid': { pk: true },
    'index:string': {},
    'merged:string': {},
    'fee:string': {},
    'zkopru:uuid': { foreignKey: 'zkopru:id', immutable: true },
    'blockNumber:int': {},
    'includedIn:string': { default: 'NOT_INCLUDED' },
  },
  indexes: {
    'includedIn:string': {},
    'index:string': {},
    'merged:string': {},
    'fee:string': {},
  },
  queries: [
    {
      name: 'getSyncStart',
      args: {},
      call: (db, args) => {
        return db
          .query('select', ['MAX(blockNumber)'])
          .where(['zkopru', '=', args.zkopru])
          .emit()
      },
    },
    {
      name: 'writeMassDepositCommit',
      args: {},
      call: (db, args) => {
        return db.query('upsert', [args as MassDepositCommitSql]).emit()
      },
    },
    {
      name: 'markAsIncludedIn',
      args: {
        'zkopru:uuid': {},
        'block:string': {},
        'indexes:string[]': {},
      },
      call: (db, args) => {
        return db
          .query('upsert', [
            {
              includedIn: args.block,
            },
          ])
          .where([
            ['zkopru', '=', args.zkopru],
            'AND',
            ['index', 'IN', args.indexes],
          ])
          .emit()
      },
    },
    {
      name: 'getCommitIndex',
      args: {
        'merged:string': {},
        'fee:string': {},
        'zkopru:uuid': {},
      },
      call: (db, args) => {
        return db
          .query('select', ['index', 'MIN(blockNumber)'])
          .where([
            [
              ['includedIn', '=', 'NOT_INCLUDED'],
              'AND',
              ['zkopru', '=', args.zkopru],
            ],
            'AND',
            [['merged', '=', args.merged], 'AND', ['fee', '=', args.fee]],
          ])
          .emit()
      },
    },
  ],
}
