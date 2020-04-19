import { Field } from '@zkopru/babyjubjub'
import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'
import BN from 'bn.js'

export interface TreeNodeSql {
  nodeIndex: string
  value: string
}

export function treeNode(treeId: string): InanoSQLTableConfig {
  return {
    name: `treeNode-${treeId}`,
    model: {
      'nodeIndex:string': { pk: true },
      'value:string': {},
    },
    indexes: {
      'value:string': {},
    },
    queries: [
      {
        name: 'getSiblings',
        args: {
          'depth:int': {},
          'index:string': {},
        },
        call: (db, args) => {
          const { depth } = args
          const siblingIndexes = Array(depth).fill('')
          const leafIndex = Field.toBN(args.index).or(new BN(1).shln(depth))
          for (let level = 0; level < depth; level += 1) {
            const pathIndex = leafIndex.shrn(level)
            const siblingIndex = pathIndex.xor(new BN(1))
            siblingIndexes[level] = `0x${siblingIndex.toString('hex')}`
          }
          return db
            .query('select')
            .where(['nodeIndex', 'IN', siblingIndexes])
            .emit()
        },
      },
      {
        name: 'getRoot',
        args: {},
        call: (db, _) => {
          return db
            .query('select')
            .where([['nodeIndex', '=', Field.one.toHex()]])
            .emit()
        },
      },
    ],
  }
}
