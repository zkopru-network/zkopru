import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'
import { OutputStatus } from '@zkopru/transaction'

export interface OutputSqlObject {
  hash: string
  tree: string
  index: string
  eth?: string
  pubKey?: string
  salt?: string
  tokenAddr?: string
  erc20Amount?: string
  nft?: string
  status?: OutputStatus
  type?: number
  to?: string
  fee?: string
}

export const output: InanoSQLTableConfig = {
  name: 'output',
  model: {
    'hash:string': { pk: true },
    'tree:uuid': { foreignKey: 'tree:id', notNull: false },
    'index:string': { notNull: false },
    'eth:string': {},
    'pubKey:string': { notNull: false },
    'salt:string': { notNull: false },
    'tokenAddr:string': { notNull: false },
    'erc20Amount:string': { notNull: false },
    'nft:string': { notNull: false },
    'status:int': { default: 0, min: 0, max: 3 }, // 0: nonIncluded 1: unspent 2: spending 3: spent
    'type:int': { default: 0, min: 0, max: 2 }, // 0: utxo 1: withdrawal 2: migration
    'to:string': { notNull: false },
    'fee:string': { notNull: false },
  },
  indexes: {
    'pubKey:string': {},
    'status:int': {},
  },
  queries: [
    {
      name: 'markAsIncluded',
      args: {
        'outputs:obj[]': {
          'hash:string': {},
          'tree:uuid': {},
          'index:string': {},
        },
      },
      call: (db, args) => {
        return db
          .query(
            'upsert',
            args.outputs.map(output => {
              return {
                status: 1,
                ...output,
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
            [['tree', '=', args.tree], 'AND', ['type', '=', 0]],
            'AND',
            [['pubKey', 'IN', args.keys], 'AND', ['status', '<', 3]],
          ])
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
            [['tree', '=', args.tree], 'AND', ['type', '=', 1]],
            'AND',
            [['to', 'IN', args.keys], 'AND', ['status', '<', 3]],
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
            on: ['output.tree', '=', 'tree.id'],
          })
          .where([
            [['tree.zkopru', '=', args.zkopru], 'AND', ['output.type', '=', 0]],
            'AND',
            [
              ['output.pubKey', 'IN', args.pubKeys],
              'AND',
              ['output.status', '=', 1],
            ],
          ])
          .emit()
      },
    },
    {
      name: 'getWithdrawables',
      args: {
        'zkopru:uuid': {},
        'addresses:string[]': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .join({
            type: 'left',
            with: { table: 'tree' },
            on: ['output.tree', '=', 'tree.id'],
          })
          .where([
            [['tree.zkopru', '=', args.zkopru], 'AND', ['output.type', '=', 1]],
            'AND',
            [['output.to', 'IN', args.addresses], 'AND', ['output.status', '=', 1]],
          ])
          .emit()
      },
    },
    {
      name: 'getMigratables',
      args: {
        'zkopru:uuid': {},
        'addresses:string[]': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .join({
            type: 'left',
            with: { table: 'tree' },
            on: ['output.tree', '=', 'tree.id'],
          })
          .where([
            [['tree.zkopru', '=', args.zkopru], 'AND', ['output.type', '=', 2]],
            'AND',
            [['output.to', 'IN', args.addresses], 'AND', ['output.status', '=', 1]],
          ])
          .emit()
      },
    },
    {
      name: 'markAsSpending',
      args: {
        'outputs:string[]': {},
      },
      call: (db, args) => {
        return db
          .query(
            'upsert',
            args.outputs.map((hash: string) => {
              return { hash, status: 2 }
            }),
          )
          .emit()
      },
    },
    {
      name: 'markAsSpent',
      args: {
        'outputs:string[]': {},
      },
      call: (db, args) => {
        return db
          .query(
            'upsert',
            args.outputs.map((hash: string) => {
              return { hash, status: 3 }
            }),
          )
          .emit()
      },
    },
    {
      name: 'clearSpentOutputs',
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
