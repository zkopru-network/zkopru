import BN from 'bn.js'
import { Fp, F } from '@zkopru/babyjubjub'
import { hexify } from '@zkopru/utils'
import { TreeNode } from './schema.types'
import { DB } from './types'

// An in memory cache for loading tree indexes in a database transaction
//
// This is used during block synchronization to allow updated data to be used
// before a database transaction is finished (see block-processor.ts)
const cachedTreeNodes = {} as { [key: string]: any }

let cacheEnabled = false

export function cacheTreeNode(treeId: string, nodeIndex: string, node: any) {
  if (!cacheEnabled) return
  cachedTreeNodes[`${treeId}-${nodeIndex}`] = node
}

export function enableTreeCache() {
  cacheEnabled = true
}

export function disableTreeCache() {
  cacheEnabled = true
}

export function clearTreeCache() {
  for (const key of Object.keys(cachedTreeNodes)) {
    delete cachedTreeNodes[key]
  }
}

export async function getCachedSiblings(
  db: DB,
  depth: number,
  treeId: string,
  leafIndex: F,
): Promise<TreeNode[]> {
  const siblingIndexes = Array(depth).fill(null)
  const leafPath = new BN(1).shln(depth).or(Fp.toBN(leafIndex))
  if (leafPath.lte(Fp.toBN(leafIndex)))
    throw Error('Leaf index is out of range')

  for (let level = 0; level < depth; level += 1) {
    const pathIndex = leafPath.shrn(level)
    const siblingIndex = new BN(1).xor(pathIndex)
    siblingIndexes[level] = hexify(siblingIndex)
  }
  const inMemoryNodes = cacheEnabled
    ? siblingIndexes
        .map(index => cachedTreeNodes[`${treeId}-${index}`])
        .filter(node => !!node)
    : []
  const uncachedSiblingIndexes = siblingIndexes.filter(index => {
    if (!cacheEnabled) return true
    return !cachedTreeNodes[`${treeId}-${index}`]
  })
  const cachedSiblings = await db.findMany('TreeNode', {
    where: {
      treeId,
      nodeIndex: uncachedSiblingIndexes,
    },
  })
  return [...inMemoryNodes, ...cachedSiblings]
}
