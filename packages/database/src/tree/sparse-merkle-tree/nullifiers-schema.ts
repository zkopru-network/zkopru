import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'

export const nullifiers: InanoSQLTableConfig = {
  name: 'nullifiers',
  model: {
    'index:string': { pk: true },
    'nullified:int': {},
    'blockHash:string': {},
  },
  indexes: {
    'nullified:int': {},
    'blockHash:string': {},
  },
  queries: [
    {
      name: 'nullify',
      args: {
        'index:string': {},
        'blockHash:string': {},
      },
      call: (db, args) => {
        const { index, blockHash } = args
        return db
          .query('upsert', [
            {
              index,
              nullified: 1,
              blockHash,
            },
          ])
          .emit()
      },
    },
    {
      name: 'recover',
      args: {
        'blockHash:string': {},
      },
      call: (db, args) => {
        const { blockHash } = args
        return db
          .query('upsert', [
            {
              nullified: 0,
              blockHash: null,
            },
          ])
          .where(['blockHash', '=', blockHash])
          .emit()
      },
    },
  ],
}
