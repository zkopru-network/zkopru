import { treeNode } from '../tree-node-schema'

export function withdrawalTreeNode(treeId: string) {
  return treeNode(`withdrawal-${treeId}`)
}
