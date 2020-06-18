/* eslint-disable @typescript-eslint/camelcase */
import { Field } from '@zkopru/babyjubjub'
import AsyncLock from 'async-lock'
import BN from 'bn.js'
import { toBN } from 'web3-utils'
import { hexify, logger } from '@zkopru/utils'
import { DB, TreeNode, NULLIFIER_TREE_ID } from '@zkopru/prisma'
import { Hasher, genesisRoot } from './hasher'
import { verifyProof, MerkleProof } from './merkle-proof'

export interface SMT<T extends Field | BN> {
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
    if (hasher.preHash.length < depth)
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

  private async getRootNode(): Promise<BN> {
    if (this.rootNode) return new BN(this.rootNode)
    logger.trace('try to get root node from database')
    const rootNode = await this.db.read(prisma =>
      prisma.treeNode.findOne({
        select: { value: true },
        where: {
          treeId_nodeIndex: {
            treeId: NULLIFIER_TREE_ID,
            nodeIndex: hexify(new BN(1)),
          },
        },
      }),
    )
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
      throw Error('Generated invalid proof')
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
      throw Error('Generated invalid proof')
    }
    return merkleProof
  }

  async nullify(...leaves: BN[]): Promise<BN> {
    let root: BN = this.rootNode
    await this.lock.acquire('root', async () => {
      for (const leaf of leaves) {
        root = await this.updateLeaf(leaf, SMTLeaf.FILLED)
      }
    })
    return root
  }

  async recover(...leaves: BN[]) {
    await this.lock.acquire('root', async () => {
      for (const leaf of leaves) {
        await this.updateLeaf(leaf, SMTLeaf.EMPTY)
      }
    })
  }

  private async getSiblings(index: BN): Promise<BN[]> {
    const { depth } = this
    const cachedSiblings = await this.db.preset.getCachedSiblings(
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

  private async updateLeaf(index: BN, val: SMTLeaf): Promise<BN> {
    const nodesToUpdate: TreeNode[] = []
    const leafNodeIndex = new BN(1).shln(this.depth).or(index)
    if (leafNodeIndex.lte(index)) throw Error('Leaf index is out of range')
    const siblings = await this.getSiblings(index)
    let node = new BN(val)
    let pathIndex: BN
    let hasRightSibling: boolean
    for (let level = 0; level < this.depth; level += 1) {
      pathIndex = leafNodeIndex.shrn(level)
      nodesToUpdate.push({
        treeId: NULLIFIER_TREE_ID,
        nodeIndex: hexify(pathIndex),
        value: hexify(node),
      })
      hasRightSibling = pathIndex.isEven()
      if (hasRightSibling) {
        node = this.hasher.parentOf(node, siblings[level])
      } else {
        node = this.hasher.parentOf(siblings[level], node)
      }
    }
    // add root node to the list to record
    nodesToUpdate.push({
      treeId: NULLIFIER_TREE_ID,
      nodeIndex: hexify(new BN(1)),
      value: hexify(node),
    })

    // need batch query here..
    for (const node of nodesToUpdate) {
      await this.db.write(prisma =>
        prisma.treeNode.upsert({
          where: {
            treeId_nodeIndex: {
              treeId: NULLIFIER_TREE_ID,
              nodeIndex: node.nodeIndex,
            },
          },
          update: { value: node.value },
          create: node,
        }),
      )
    }
    logger.trace(`setting new root - ${node}`)
    this.rootNode = node
    return this.rootNode
  }

  async dryRunNullify(...leaves: BN[]): Promise<BN> {
    let result!: BN
    await this.lock.acquire('root', async () => {
      const originalRoot = await this.getRootNode()
      let prevRoot: BN = originalRoot
      const nullified: BN[] = []
      let duplicated: BN | undefined
      // nullify items
      for (const leaf of leaves) {
        const newRoot = await this.updateLeaf(leaf, SMTLeaf.FILLED)
        nullified.push(leaf)
        if (newRoot.eq(prevRoot)) {
          duplicated = leaf
          break
        }
        prevRoot = newRoot
      }
      result = await this.getRootNode()
      // recover nullified items
      for (const leaf of nullified) {
        await this.updateLeaf(leaf, SMTLeaf.EMPTY)
      }
      // emit errors if there were some problems
      if (duplicated)
        throw Error(`Already used nullifier: ${duplicated.toString()}`)
      if (!(await this.getRootNode()).eq(originalRoot)) {
        throw Error('Dry run should not make any change')
      }
    })
    return result
  }
}
