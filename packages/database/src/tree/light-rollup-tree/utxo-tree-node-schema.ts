import { treeNode } from '../tree-node-schema'

export function utxoTreeNode(treeId: string) {
  return treeNode(`utxo-${treeId}`)
}
