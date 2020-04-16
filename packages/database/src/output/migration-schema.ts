import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'

export interface MigrationSql {
  hash: string
  tree: string
  index: string
  eth?: string
  pubKey?: string
  salt?: string
  tokenAddr?: string
  erc20Amount?: string
  nft?: string
}

export const migration: InanoSQLTableConfig = {
  name: 'migration',
  model: {
    'hash:string': { pk: true },
    'tree:uuid': { foreignKey: 'utxoTree:id', notNull: false }, // deposit will not have the tree uuid at first
    'index:string': { notNull: false },
    'eth:string': {},
    'pubKey:string': { notNull: false },
    'salt:string': { notNull: false },
    'tokenAddr:string': { notNull: false },
    'erc20Amount:string': { notNull: false },
    'nft:string': { notNull: false },
    'status:int': { default: 0, min: 0, max: 3 }, // 0: nonIncluded 1: unspent 2: spending 3: spent
  },
  indexes: {
    'pubKey:string': {},
    'status:int': {},
  },
  queries: [
    {
      name: 'markAsIncluded',
      args: {
        'utxos:obj[]': {
          'hash:string': {},
          'tree:uuid': {},
          'index:string': {},
        },
      },
      call: (db, args) => {
        return db
          .query(
            'upsert',
            args.utxos.map(utxo => {
              return {
                status: 1,
                ...utxo,
              }
            }),
          )
          .emit()
      },
    },
    {
      name: 'utxosToTrack',
      args: {
        'tree:uuid': {},
        'keys:string[]': {},
      },
      call: (db, args) => {
        return db
          .query('select', ['hash', 'index'])
          .where([
            ['tree', '=', args.tree],
            'AND',
            [['pubKey', 'IN', args.keys], 'AND', ['status', '<', 3]],
          ])
          .emit()
      },
    },
    {
      name: 'getSpendables',
      args: {
        'zkopru:uuid': {},
        'pubKeys:string[]': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .join({
            type: 'left',
            with: { table: 'tree' },
            on: ['utxo.tree', '=', 'tree.id'],
          })
          .where([
            ['tree.zkopru', '=', args.zkopru],
            'AND',
            [
              ['utxo.pubKey', 'IN', args.pubKeys],
              'AND',
              ['utxo.status', '=', 1],
            ],
          ])
          .emit()
      },
    },
    {
      name: 'markAsSpending',
      args: {
        'utxos:string[]': {},
      },
      call: (db, args) => {
        return db
          .query(
            'upsert',
            args.utxos.map((hash: string) => {
              return { hash, status: 2 }
            }),
          )
          .emit()
      },
    },
    {
      name: 'markAsSpent',
      args: {
        'utxos:string[]': {},
      },
      call: (db, args) => {
        return db
          .query(
            'upsert',
            args.utxos.map((hash: string) => {
              return { hash, status: 3 }
            }),
          )
          .emit()
      },
    },
    {
      name: 'clearSpentUTXOs',
      args: {},
      call: (db, _) => {
        return db
          .query('delete')
          .where(['status', '=', 3])
          .emit()
      },
    },
  ],
}
