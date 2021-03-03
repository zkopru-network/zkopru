import BN from 'bn.js'
import { Field, F } from '@zkopru/babyjubjub'
import { hexify } from '@zkopru/utils'
import { TreeNode } from './schema.types'
import { DB } from './types'

export async function getCachedSiblings (
  db: DB,
  depth: number,
  treeId: string,
  leafIndex: F,
): Promise<TreeNode[]> {
  const siblingIndexes = Array(depth).fill('')
  const leafPath = new BN(1).shln(depth).or(Field.toBN(leafIndex))
  if (leafPath.lte(Field.toBN(leafIndex)))
    throw Error('Leaf index is out of range')

  for (let level = 0; level < depth; level += 1) {
    const pathIndex = leafPath.shrn(level)
    const siblingIndex = new BN(1).xor(pathIndex)
    siblingIndexes[level] = hexify(siblingIndex)
  }
  const cachedSiblings = await db.findMany('TreeNode', {
    where: {
      treeId,
      nodeIndex: [...siblingIndexes],
    },
  })
  return cachedSiblings
}
