import { DB, TreeNode } from '@zkopru/database'
import { BigNumber, BigNumberish } from 'ethers'

// An in memory cache for loading tree indexes in a database transaction
//
// This is used during block synchronization to allow updated data to be used
// before a database transaction is finished (see block-processor.ts)

export class TreeCache {
  enabled = false

  cachedTreeNodes = {} as { [key: string]: any }

  cacheNode(treeId: string, nodeIndex: string, node: any) {
    if (!this.enabled) return
    this.cachedTreeNodes[`${treeId}-${nodeIndex}`] = node
  }

  enable() {
    this.enabled = true
  }

  disable() {
    this.enabled = false
  }

  clear() {
    for (const key of Object.keys(this.cachedTreeNodes)) {
      delete this.cachedTreeNodes[key]
    }
  }

  async getCachedSiblings(
    db: DB,
    depth: number,
    treeId: string,
    leafIndex: BigNumberish,
  ): Promise<TreeNode[]> {
    const siblingIndexes = Array(depth).fill(null)
    const leafPath = BigNumber.from(1)
      .shl(depth)
      .or(leafIndex)
    if (leafPath.lte(leafIndex)) throw Error('Leaf index is out of range')

    for (let level = 0; level < depth; level += 1) {
      const pathIndex = leafPath.shr(level)
      const siblingIndex = BigNumber.from(1).xor(pathIndex)
      siblingIndexes[level] = siblingIndex.toHexString()
    }
    const inMemoryNodes = this.enabled
      ? siblingIndexes
          .map(index => this.cachedTreeNodes[`${treeId}-${index}`])
          .filter(node => !!node)
      : []
    const uncachedSiblingIndexes = siblingIndexes.filter(index => {
      if (!this.enabled) return true
      return !this.cachedTreeNodes[`${treeId}-${index}`]
    })
    const cachedSiblings = await db.findMany('TreeNode', {
      where: {
        treeId,
        nodeIndex: uncachedSiblingIndexes,
      },
    })
    return [...inMemoryNodes, ...cachedSiblings]
  }
}
