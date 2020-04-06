import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'

export interface TreeSqlObj {
  id: string
  type: number
  index: number
  zkopru: string
  start: string
  end: string
  data: {
    root: string
    index: string
    siblings: string[]
  }
}

export const tree: InanoSQLTableConfig = {
  name: 'tree',
  model: {
    'id:uuid': { pk: true },
    'type:int': { min: 1, max: 3, immutable: true }, // 1: utxo 2: withdrawal 3: nullifier
    'index:int': { immutable: true },
    'zkopru:uuid': { foreignKey: 'zkopru:id', immutable: true },
    'start:string': {},
    'end:string': {},
    'data:obj': {
      model: {
        'root:string': {},
        'index:string': { notNull: false }, // nullifier tree will not have the index
        'siblings:string[]': { notNull: false }, // nullifier tree will not store the latest siblings
      },
    },
  },
  indexes: {
    'type:int': {},
    'index:int': {},
    'zkopru:uuid': {},
  },
  queries: [
    {
      name: 'bootstrapTree',
      args: {
        'id:uuid': {},
        'index:int': {},
        'type:int': {},
        'zkopru:uuid': {},
        'data:obj': {},
      },
      call: (db, args) => {
        if (!(args.type in [1, 2, 3]))
          throw Error(`Invalid type of tree ${args.type}`)
        return db
          .query('upsert', [
            { start: args.data.index, end: args.data.index, ...args },
          ])
          .emit()
      },
    },
    {
      name: 'getTree',
      args: {
        'type:int': {},
        'index:int': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .where([['type', '=', args.type], 'AND', ['index', '=', args.index]])
          .emit()
      },
    },
    {
      name: 'getLatestUtxoTree',
      args: {
        'zkopru:uuid': {},
      },
      call: (db, args) => {
        return db
          .query('select', ['tree', 'data', 'MAX(index)'])
          .where([['type', '=', '1'], 'AND', ['zkopru', '=', args.zkopru]])
          .emit()
      },
    },
    {
      name: 'getLatestWithdrawalTree',
      args: {
        'zkopru:uuid': {},
      },
      call: (db, args) => {
        return db
          .query('select', ['tree', 'data', 'MAX(index)'])
          .where([['type', '=', '2'], 'AND', ['zkopru', '=', args.zkopru]])
          .emit()
      },
    },
    {
      name: 'getNullifierTree',
      args: {
        'zkopru:uuid': {},
      },
      call: (db, args) => {
        return db
          .query('select', ['tree', 'data', 'MAX(index)'])
          .where([['type', '=', '3'], 'AND', ['zkopru', '=', args.zkopru]])
          .emit()
      },
    },
    {
      name: 'updateTree',
      args: {
        'id:uuid': {},
        'data:obj': {},
      },
      call: (db, args) => {
        return db
          .query('upsert', [
            {
              id: args.id,
              end: args.data.index,
              data: args.data,
            },
          ])
          .emit()
      },
    },
    {
      name: 'getUtxoTree',
      args: {
        'index:int': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .where([['type', '=', 1], 'AND', ['index', '=', args.index]])
          .emit()
      },
    },
    {
      name: 'getWithdrawalTree',
      args: {
        'index:int': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .where([['type', '=', 2], 'AND', ['index', '=', args.index]])
          .emit()
      },
    },
    {
      name: 'getNullifierTree',
      args: {},
      call: (db, _) => {
        return db
          .query('select')
          .where(['type', '=', 3])
          .emit()
      },
    },
    {
      name: 'getUtxoTrees',
      args: {
        'grove:string': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .where([['grove', '=', args.grove], 'AND', ['type', '=', 1]])
          .orderBy(['index ASC'])
          .emit()
      },
    },
    {
      name: 'getWithdrawalTrees',
      args: {
        'grove:string': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .where([['grove', '=', args.grove], 'AND', ['type', '=', 2]])
          .orderBy(['index ASC'])
          .emit()
      },
    },
    {
      name: 'getNullifierTrees',
      args: {
        'grove:string': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .where([['grove', '=', args.grove], 'AND', ['type', '=', 3]])
          .orderBy(['index ASC'])
          .emit()
      },
    },
  ],
}
