import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'

export const nullifiers: InanoSQLTableConfig = {
  name: 'nullifiers',
  model: {
    'index:string': { pk: true },
    'nullified:boolean': {},
    'blockHash:string': {},
  },
  indexes: {
    'nullified:boolean': {},
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
              nullified: true,
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
              nullified: false,
              blockHash: null,
            },
          ])
          .where(['blockHash', '=', blockHash])
          .emit()
      },
    },
  ],
}
