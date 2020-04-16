import { treeNode } from '../tree-node-schema'

export const withdrawalTreeNode = (treeId: string) =>
  treeNode(`withdrawal-${treeId}`)
