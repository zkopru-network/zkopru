import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'

export interface LightRollUpTreeSql {
  id: string
  index: number
  zkopru: string
  block: string
  start: string
  end: string
  data: {
    root: string
    index: string
    siblings: string[]
  }
}

export const lightRollUpTree: InanoSQLTableConfig = {
  name: 'tree',
  model: {
    'id:uuid': { pk: true },
    'index:int': { immutable: true },
    'zkopru:uuid': { foreignKey: 'zkopru:id', immutable: true },
    'block:string': {},
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
    'index:int': {},
    'zkopru:uuid': {},
  },
  queries: [
    {
      name: 'bootstrapTree',
      args: {
        'id:uuid': {},
        'index:int': {},
        'zkopru:uuid': {},
        'data:obj': {},
      },
      call: (db, args) => {
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
        'index:int': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .where(['index', '=', args.index])
          .emit()
      },
    },
    {
      name: 'getLatestTree',
      args: {
        'zkopru:uuid': {},
      },
      call: (db, args) => {
        return db
          .query('select', ['tree', 'data', 'MAX(index)'])
          .where(['zkopru', '=', args.zkopru])
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
      name: 'getTrees',
      args: {
        'grove:string': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .where(['grove', '=', args.grove])
          .orderBy(['index ASC'])
          .emit()
      },
    },
  ],
}
