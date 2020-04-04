import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'
import * as utils from '@nano-sql/core/lib/utilities'

export const tree: InanoSQLTableConfig = {
  name: 'tree',
  model: {
    'id:uuid': { pk: true },
    'type:int': { min: 1, max: 3, immutable: true }, // 1: utxo 2: withdrawal 3: nullifier
    'index:int': { immutable: true },
    'zkopru:uuid': { foreignKey: 'zkopru:id', immutable: true },
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
      name: 'createUtxoTree',
      args: {
        'index:int': {},
        'zkopru:uuid': {},
        'data:obj': {},
      },
      call: (db, args) => {
        const id = utils.uuid()
        const type = 1
        return db.query('upsert', [{ id, type, ...args }]).emit()
      },
    },
    {
      name: 'createWithdrawalTree',
      args: {
        'index:int': {},
        'zkopru:uuid': {},
        'data:obj': {},
      },
      call: (db, args) => {
        const id = utils.uuid()
        const type = 2
        return db.query('upsert', [{ id, type, ...args }]).emit()
      },
    },
    {
      name: 'createNullifierTree',
      args: {
        'index:int': {},
        'zkopru:uuid': {},
        'data:obj': {},
      },
      call: (db, args) => {
        const id = utils.uuid()
        const type = 3
        return db.query('upsert', [{ id, type, ...args }]).emit()
      },
    },
    {
      name: 'getTree',
      args: {
        'tree:uuid': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .where(['tree', '=', args.tree])
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
        'tree:uuid': {},
        'data:obj': {},
      },
      call: (db, args) => {
        return db
          .query('upsert', [
            {
              tree: args.tree,
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
