import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'
import { lightRollUpTree } from './light-rollup-tree-schema'

export const utxoTree: InanoSQLTableConfig = {
  ...lightRollUpTree,
  name: 'utxoTree',
}
