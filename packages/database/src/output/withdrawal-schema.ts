import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'

export interface WithdrawalSql {
  hash: string
  tree: string
  index: string
  to?: string
  fee?: string
  eth?: string
  pubKey?: string
  salt?: string
  tokenAddr?: string
  erc20Amount?: string
  nft?: string
}

export const withdrawal: InanoSQLTableConfig = {
  name: 'withdrawal',
  model: {
    'hash:string': { pk: true },
    'tree:uuid': { foreignKey: 'utxoTree:id', notNull: false }, // deposit will not have the tree uuid at first
    'index:string': { notNull: false },
    'to:string': {},
    'fee:string': {},
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
    'to:string': {},
  },
  queries: [
    {
      name: 'markAsIncluded',
      args: {
        'withdrawals:obj[]': {
          'hash:string': {},
          'tree:uuid': {},
          'index:string': {},
        },
      },
      call: (db, args) => {
        return db
          .query(
            'upsert',
            args.withdrawals.map(utxo => {
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
      name: 'withdrawalsToTrack',
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
