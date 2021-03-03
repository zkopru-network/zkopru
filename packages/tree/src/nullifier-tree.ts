/* eslint-disable @typescript-eslint/camelcase */
import { Fp } from '@zkopru/babyjubjub'
import AsyncLock from 'async-lock'
import BN from 'bn.js'
import { toBN } from 'web3-utils'
import { hexify, logger } from '@zkopru/utils'
import {
  DB,
  TreeNode,
  NULLIFIER_TREE_ID,
  getCachedSiblings,
} from '@zkopru/database'
import { Hasher, genesisRoot } from './hasher'
import { verifyProof, MerkleProof } from './merkle-proof'

export interface SMT<T extends Fp | BN> {
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
  index: BN
  val: SMTLeaf
}

type NodeMap = {
  [key: string]: BN
}

export class NullifierTree implements SMT<BN> {
  readonly db: DB

  readonly depth: number

  readonly hasher: Hasher<BN>

  lock: AsyncLock

  private rootNode!: BN

  constructor({
    db,
    hasher,
    depth,
  }: {
    db: DB
    hasher: Hasher<BN>
    depth: number
  }) {
    this.lock = new AsyncLock()
    this.db = db
    this.hasher = hasher
    this.depth = depth
    if (hasher.preHash.length <= depth)
      throw Error('Hasher should have enough prehased values')
  }

  async root(): Promise<BN> {
    let root: BN | undefined
    await this.lock.acquire('root', async () => {
      root = await this.getRootNode()
    })
    if (!root) throw Error('Failed to get root node')
    return root
  }

  async findUsedNullifier(...nullifiers: BN[]): Promise<BN[]> {
    const usedNullifierNodeIndices = await this.db.findMany('TreeNode', {
      // select: { nodeIndex: true },
      where: {
        nodeIndex: nullifiers
          .map(index => new BN(1).shln(this.depth).or(index))
          .map(nullifier => hexify(nullifier)),
        value: hexify(SMTLeaf.FILLED),
      },
    })
    // const usedNullifierNodeIndices = await this.db.read(prisma =>
    //   prisma.treeNode.findMany({
    //     select: { nodeIndex: true },
    //     where: {
    //       nodeIndex: {
    //         in: nullifiers
    //           .map(index => new BN(1).shln(this.depth).or(index))
    //           .map(nullifier => hexify(nullifier)),
    //       },
    //       value: hexify(SMTLeaf.FILLED),
    //     },
    //   }),
    // )
    const usedNullifiers = usedNullifierNodeIndices.map(nullifier =>
      toBN(nullifier.nodeIndex).sub(new BN(1).shln(this.depth)),
    )
    return usedNullifiers
  }

  private async getRootNode(): Promise<BN> {
    if (this.rootNode) return new BN(this.rootNode)
    logger.trace('try to get root node from database')
    const rootNode = await this.db.findOne('TreeNode', {
      // select: { value: true },
      where: {
        treeId: NULLIFIER_TREE_ID,
        nodeIndex: hexify(new BN(1)),
      },
    })
    if (rootNode) {
      this.rootNode = toBN(rootNode.value)
    } else {
      this.rootNode = genesisRoot(this.hasher)
    }
    return new BN(this.rootNode)
  }

  async getInclusionProof(index: BN): Promise<MerkleProof<BN>> {
    let siblings!: BN[]
    let merkleProof!: MerkleProof<BN>
    await this.lock.acquire('root', async () => {
      siblings = await this.getSiblings(index)
      merkleProof = {
        root: await this.getRootNode(),
        index,
        leaf: toBN(SMTLeaf.FILLED),
        siblings,
      }
    })
    if (!verifyProof(this.hasher, merkleProof)) {
      throw Error('Generated invalid inclusion proof')
    }
    return merkleProof
  }

  async getNonInclusionProof(index: BN): Promise<MerkleProof<BN>> {
    let siblings!: BN[]
    let merkleProof!: MerkleProof<BN>
    await this.lock.acquire('root', async () => {
      siblings = await this.getSiblings(index)
      merkleProof = {
        root: await this.getRootNode(),
        index,
        leaf: toBN(SMTLeaf.EMPTY),
        siblings,
      }
    })

    if (!verifyProof(this.hasher, merkleProof)) {
      throw Error('Generated invalid non inclusion proof')
    }
    return merkleProof
  }

  async nullify(...leaves: BN[]): Promise<BN> {
    let root: BN = this.rootNode
    await this.lock.acquire('root', async () => {
      root = await this.update(
        leaves.map(leaf => ({
          index: leaf,
          val: SMTLeaf.FILLED,
        })),
        { strictUpdate: true },
      )
    })
    return root
  }

  async recover(...leaves: BN[]) {
    await this.lock.acquire('root', async () => {
      await this.update(
        leaves.map(leaf => ({
          index: leaf,
          val: SMTLeaf.EMPTY,
        })),
        { strictUpdate: true },
      )
    })
  }

  async dryRunNullify(...leaves: BN[]): Promise<BN> {
    let result!: BN
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

  private async getSiblings(index: BN): Promise<BN[]> {
    const { depth } = this
    const cachedSiblings = await getCachedSiblings(
      this.db,
      depth,
      NULLIFIER_TREE_ID,
      index,
    )
    const siblingCache: { [nodeIndex: string]: BN } = {}
    for (const sibling of cachedSiblings) {
      siblingCache[toBN(sibling.nodeIndex).toString(10)] = toBN(sibling.value)
    }
    const siblings = Array(this.depth).fill(undefined)
    const leafNodeIndex = new BN(1).shln(depth).or(index)
    let pathNodeIndex!: BN
    let siblingNodeIndex!: BN
    for (let level = 0; level < depth; level += 1) {
      pathNodeIndex = leafNodeIndex.shrn(level)
      siblingNodeIndex = new BN(1).xor(pathNodeIndex)
      const cached = siblingCache[siblingNodeIndex.toString(10)]
      siblings[level] = cached || this.hasher.preHash[level]
    }
    return siblings
  }

  private async getSiblingNodes(...leafIndices: BN[]): Promise<NodeMap> {
    // get indexes to retrieve
    const nodeIndices: string[] = []
    for (const leafIndex of leafIndices) {
      const leafPath = new BN(1).shln(this.depth).or(Fp.toBN(leafIndex))
      for (let level = 0; level < this.depth; level += 1) {
        const pathIndex = leafPath.shrn(level)
        const siblingIndex = new BN(1).xor(pathIndex)
        nodeIndices.push(hexify(siblingIndex))
      }
    }
    // const mutatedNodes: { [nodeIndex: string]: BN } = {}
    const mutatedNodes: TreeNode[] = await this.db.findMany('TreeNode', {
      where: {
        treeId: NULLIFIER_TREE_ID,
        nodeIndex: [...nodeIndices],
      },
    })
    // const mutatedNodes: TreeNode[] = await this.db.read(prisma =>
    //   prisma.treeNode.findMany({
    //     where: {
    //       AND: [
    //         { treeId: NULLIFIER_TREE_ID },
    //         { nodeIndex: { in: [...nodeIndices] } },
    //       ],
    //     },
    //   }),
    // )
    const siblingNodes: NodeMap = {}
    for (const node of mutatedNodes) {
      // key is a hexified node index
      siblingNodes[node.nodeIndex] = toBN(node.value)
    }
    return siblingNodes
  }

  /**
   * @param option if strictUpdate is true, every leaf should update the root
   */
  private async update(
    leaves: Leaf[],
    option?: { strictUpdate?: boolean },
  ): Promise<BN> {
    const { updatedNodes } = await this.dryRun(leaves, option)
    // need batch query here..
    for (const nodeIndex of Object.keys(updatedNodes)) {
      await this.db.upsert('TreeNode', {
        where: {
          treeId: NULLIFIER_TREE_ID,
          nodeIndex,
        },
        update: { value: hexify(updatedNodes[nodeIndex]) },
        create: {
          treeId: NULLIFIER_TREE_ID,
          nodeIndex,
          value: hexify(updatedNodes[nodeIndex]),
        },
      })
    }
    const newRoot = updatedNodes[hexify(new BN(1))]
    logger.trace(`setting new root - ${newRoot}`)
    this.rootNode = newRoot
    return this.rootNode
  }

  private async dryRun(
    leaves: Leaf[],
    option?: { strictUpdate?: boolean },
  ): Promise<{ updatedNodes: NodeMap; newRoot: BN }> {
    // get all sibling nodes
    const siblingNodes: NodeMap = await this.getSiblingNodes(
      ...leaves.map(leaf => leaf.index),
    )
    const updatedNodes: NodeMap = {}
    // cache node update
    const getSibling = (path: BN): BN => {
      const sibIndex = hexify(new BN(1).xor(path))
      return (
        updatedNodes[sibIndex] ||
        siblingNodes[sibIndex] ||
        this.hasher.preHash[this.depth - (path.bitLength() - 1)]
      )
    }

    let newRoot = await this.getRootNode()
    // write on the database
    for (const leaf of leaves) {
      const { index, val } = leaf
      const leafNodeIndex = new BN(1).shln(this.depth).or(index)
      if (leafNodeIndex.lte(index)) throw Error('Leaf index is out of range')
      let node = toBN(val)
      let pathIndex: BN
      let hasRightSibling: boolean
      for (let level = 0; level < this.depth; level += 1) {
        pathIndex = leafNodeIndex.shrn(level)
        updatedNodes[hexify(pathIndex)] = new BN(node)
        hasRightSibling = pathIndex.isEven()
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
    updatedNodes[hexify(new BN(1))] = newRoot
    return { updatedNodes, newRoot }
  }
}
