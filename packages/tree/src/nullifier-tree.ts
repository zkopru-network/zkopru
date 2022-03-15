/* eslint-disable @typescript-eslint/camelcase */
import { Fp } from '@zkopru/babyjubjub'
import AsyncLock from 'async-lock'
import { hexify, logger } from '@zkopru/utils'
import {
  DB,
  TreeNode,
  NULLIFIER_TREE_ID,
  TransactionDB,
} from '@zkopru/database'
import { Hasher, genesisRoot } from './hasher'
import { verifyProof, MerkleProof } from './merkle-proof'
import { TreeCache } from './utils'
import { BigNumber } from 'ethers'

export interface SMT<T extends Fp | BigNumber> {
  depth: number
  hasher: Hasher<T>
  root(): Promise<T>
  getInclusionProof(leaf: T): Promise<MerkleProof<T>>
  getNonInclusionProof(leaf: T): Promise<MerkleProof<T>>
  // exist(leaf: Hex): Promise<boolean>;
}

export enum SMTLeaf {
  EMPTY = 0,
  FILLED = 1,
}

type Leaf = {
  index: BigNumber
  val: SMTLeaf
}

type NodeMap = {
  [key: string]: BigNumber
}

export class NullifierTree implements SMT<BigNumber> {
  readonly db: DB

  readonly depth: number

  readonly hasher: Hasher<BigNumber>

  lock: AsyncLock

  private rootNode!: BigNumber

  treeCache: TreeCache

  constructor({
    db,
    hasher,
    depth,
    treeCache,
  }: {
    db: DB
    hasher: Hasher<BigNumber>
    depth: number
    treeCache: TreeCache
  }) {
    this.lock = new AsyncLock()
    this.db = db
    this.hasher = hasher
    this.depth = depth
    this.treeCache = treeCache
    if (hasher.preHash.length <= depth)
      throw Error('Hasher should have enough prehashed values')
  }

  async root(): Promise<BigNumber> {
    let root: BigNumber | undefined
    await this.lock.acquire('root', async () => {
      root = await this.getRootNode()
    })
    if (!root) throw Error('Failed to get root node')
    return root
  }

  async findUsedNullifier(...nullifiers: BigNumber[]): Promise<BigNumber[]> {
    const usedNullifierNodeIndices = await this.db.findMany('TreeNode', {
      // select: { nodeIndex: true },
      where: {
        nodeIndex: nullifiers
          .map(index =>
            BigNumber.from(1)
              .shl(this.depth)
              .or(index),
          )
          .map(nullifier => nullifier.toHexString()),
        value: hexify(SMTLeaf.FILLED),
      },
    })
    const usedNullifiers = usedNullifierNodeIndices.map(nullifier =>
      BigNumber.from(nullifier.nodeIndex).sub(
        BigNumber.from(1).shl(this.depth),
      ),
    )
    return usedNullifiers
  }

  private async getRootNode(): Promise<BigNumber> {
    if (this.rootNode) return BigNumber.from(this.rootNode)
    logger.trace('tree/nullifier-tree.ts - try to get root node from database')
    const rootNode = await this.db.findOne('TreeNode', {
      // select: { value: true },
      where: {
        treeId: NULLIFIER_TREE_ID,
        nodeIndex: BigNumber.from(1).toHexString(),
      },
    })
    if (rootNode) {
      this.rootNode = BigNumber.from(rootNode.value)
    } else {
      this.rootNode = genesisRoot(this.hasher)
    }
    return BigNumber.from(this.rootNode)
  }

  async getInclusionProof(index: BigNumber): Promise<MerkleProof<BigNumber>> {
    let siblings!: BigNumber[]
    let merkleProof!: MerkleProof<BigNumber>
    await this.lock.acquire('root', async () => {
      siblings = await this.getSiblings(index)
      merkleProof = {
        root: await this.getRootNode(),
        index,
        leaf: BigNumber.from(SMTLeaf.FILLED),
        siblings,
      }
    })
    if (!verifyProof(this.hasher, merkleProof)) {
      throw Error('Generated invalid inclusion proof')
    }
    return merkleProof
  }

  async getNonInclusionProof(
    index: BigNumber,
  ): Promise<MerkleProof<BigNumber>> {
    let siblings!: BigNumber[]
    let merkleProof!: MerkleProof<BigNumber>
    await this.lock.acquire('root', async () => {
      siblings = await this.getSiblings(index)
      merkleProof = {
        root: await this.getRootNode(),
        index,
        leaf: BigNumber.from(SMTLeaf.EMPTY),
        siblings,
      }
    })

    if (!verifyProof(this.hasher, merkleProof)) {
      throw Error('Generated invalid non inclusion proof')
    }
    return merkleProof
  }

  async nullify(leaves: BigNumber[], db: TransactionDB): Promise<BigNumber> {
    let root: BigNumber = this.rootNode
    await this.lock.acquire('root', async () => {
      root = await this.update(
        leaves.map(leaf => ({
          index: leaf,
          val: SMTLeaf.FILLED,
        })),
        db,
        { strictUpdate: true },
      )
    })
    return root
  }

  async recover(leaves: BigNumber[], db: TransactionDB) {
    await this.lock.acquire('root', async () => {
      await this.update(
        leaves.map(leaf => ({
          index: leaf,
          val: SMTLeaf.EMPTY,
        })),
        db,
        { strictUpdate: true },
      )
    })
  }

  async dryRunNullify(...leaves: BigNumber[]): Promise<BigNumber> {
    let result!: BigNumber
    await this.lock.acquire('root', async () => {
      const { newRoot } = await this.dryRun(
        leaves.map(leaf => ({
          index: leaf,
          val: SMTLeaf.FILLED,
        })),
        { strictUpdate: true },
      )
      result = newRoot
    })
    return result
  }

  private async getSiblings(index: BigNumber): Promise<BigNumber[]> {
    const { depth } = this
    const cachedSiblings = await this.treeCache.getCachedSiblings(
      this.db,
      depth,
      NULLIFIER_TREE_ID,
      index,
    )
    const siblingCache: { [nodeIndex: string]: BigNumber } = {}
    for (const sibling of cachedSiblings) {
      siblingCache[
        BigNumber.from(sibling.nodeIndex).toString()
      ] = BigNumber.from(sibling.value)
    }
    const siblings = Array(this.depth).fill(undefined)
    const leafNodeIndex = BigNumber.from(1)
      .shl(depth)
      .or(index)
    let pathNodeIndex!: BigNumber
    let siblingNodeIndex!: BigNumber
    for (let level = 0; level < depth; level += 1) {
      pathNodeIndex = leafNodeIndex.shr(level)
      siblingNodeIndex = BigNumber.from(1).xor(pathNodeIndex)
      const cached = siblingCache[siblingNodeIndex.toString()]
      siblings[level] = cached || this.hasher.preHash[level]
    }
    return siblings
  }

  private async getSiblingNodes(...leafIndices: BigNumber[]): Promise<NodeMap> {
    // get indexes to retrieve
    const nodeIndices: string[] = []
    for (const leafIndex of leafIndices) {
      const leafPath = BigNumber.from(1)
        .shl(this.depth)
        .or(leafIndex)
      for (let level = 0; level < this.depth; level += 1) {
        const pathIndex = leafPath.shr(level)
        const siblingIndex = BigNumber.from(1).xor(pathIndex)
        nodeIndices.push(siblingIndex.toHexString())
      }
    }
    // const mutatedNodes: { [nodeIndex: string]: BigNumber } = {}
    const mutatedNodes: TreeNode[] = await this.db.findMany('TreeNode', {
      where: {
        treeId: NULLIFIER_TREE_ID,
        nodeIndex: [...nodeIndices],
      },
    })
    const siblingNodes: NodeMap = {}
    for (const node of mutatedNodes) {
      // key is a hexified node index
      siblingNodes[node.nodeIndex] = BigNumber.from(node.value)
    }
    return siblingNodes
  }

  /**
   * @param option if strictUpdate is true, every leaf should update the root
   */
  private async update(
    leaves: Leaf[],
    db: TransactionDB,
    option?: { strictUpdate?: boolean },
  ): Promise<BigNumber> {
    const { updatedNodes } = await this.dryRun(leaves, option)
    // need batch query here..
    for (const nodeIndex of Object.keys(updatedNodes)) {
      this.treeCache.cacheNode(NULLIFIER_TREE_ID, nodeIndex, {
        treeId: NULLIFIER_TREE_ID,
        nodeIndex,
        value: updatedNodes[nodeIndex].toHexString(),
      })
      db.upsert('TreeNode', {
        where: {
          treeId: NULLIFIER_TREE_ID,
          nodeIndex,
        },
        update: { value: updatedNodes[nodeIndex].toHexString() },
        create: {
          treeId: NULLIFIER_TREE_ID,
          nodeIndex,
          value: updatedNodes[nodeIndex].toHexString(),
        },
      })
    }
    const newRoot = updatedNodes[BigNumber.from(1).toHexString()]
    logger.trace(`tree/nullifier-tree.ts - setting new root - ${newRoot}`)
    const oldRoot = BigNumber.from(this.rootNode)
    db.onError(async () => {
      await this.lock.acquire('root', () => {
        this.rootNode = oldRoot
      })
    })
    this.rootNode = newRoot
    return this.rootNode
  }

  private async dryRun(
    leaves: Leaf[],
    option?: { strictUpdate?: boolean },
  ): Promise<{ updatedNodes: NodeMap; newRoot: BigNumber }> {
    // get all sibling nodes
    const siblingNodes: NodeMap = await this.getSiblingNodes(
      ...leaves.map(leaf => leaf.index),
    )
    const updatedNodes: NodeMap = {}
    // cache node update
    const getSibling = (path: BigNumber): BigNumber => {
      const sibIndex = BigNumber.from(1)
        .xor(path)
        .toHexString()
      return (
        updatedNodes[sibIndex] ||
        siblingNodes[sibIndex] ||
        this.hasher.preHash[
          this.depth - (path.toBigInt().toString(2).length - 1)
        ]
      )
    }

    let newRoot = await this.getRootNode()
    // write on the database
    for (const leaf of leaves) {
      const { index, val } = leaf
      const leafNodeIndex = BigNumber.from(1)
        .shl(this.depth)
        .or(index)
      if (leafNodeIndex.lte(index)) throw Error('Leaf index is out of range')
      let node = BigNumber.from(val)
      let pathIndex: BigNumber
      let hasRightSibling: boolean
      for (let level = 0; level < this.depth; level += 1) {
        pathIndex = leafNodeIndex.shr(level)
        updatedNodes[pathIndex.toHexString()] = BigNumber.from(node)
        hasRightSibling = pathIndex.and(1).isZero()
        if (hasRightSibling) {
          node = this.hasher.parentOf(node, getSibling(pathIndex))
        } else {
          node = this.hasher.parentOf(getSibling(pathIndex), node)
        }
      }
      // add root node to the list to record
      if (option?.strictUpdate && newRoot.eq(node)) {
        throw Error(`Leaf ${index} is not changing the root.`)
      }
      newRoot = node
    }
    updatedNodes[BigNumber.from(1).toHexString()] = newRoot
    return { updatedNodes, newRoot }
  }
}
