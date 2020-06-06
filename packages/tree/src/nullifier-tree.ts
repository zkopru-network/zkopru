/* eslint-disable @typescript-eslint/camelcase */
import { Field } from '@zkopru/babyjubjub'
import AsyncLock from 'async-lock'
import BN from 'bn.js'
import { toBN } from 'web3-utils'
import { hexify } from '@zkopru/utils'
import { DB, TreeNode, Nullifier, NULLIFIER_TREE_ID } from '@zkopru/prisma'
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

  rootNode!: BN

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
    if (this.rootNode) return this.rootNode
    const rootNode = await this.db.prisma.treeNode.findOne({
      select: { value: true },
      where: {
        treeId_nodeIndex: {
          treeId: NULLIFIER_TREE_ID,
          nodeIndex: Field.one.toHex(),
        },
      },
    })
    if (rootNode) return toBN(rootNode.value)
    return genesisRoot(this.hasher)
  }

  async getInclusionProof(index: BN): Promise<MerkleProof<BN>> {
    let siblings!: BN[]
    let merkleProof!: MerkleProof<BN>
    await this.lock.acquire('root', async () => {
      siblings = await this.getSiblings(index)
      merkleProof = {
        root: await this.root(),
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
        root: await this.root(),
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
    let result: BN = this.rootNode
    await this.lock.acquire('root', async () => {
      for (const leaf of leaves) {
        result = await this.updateLeaf(leaf, SMTLeaf.FILLED)
      }
    })
    return result
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
    const siblingCache = {}
    for (const sibling of cachedSiblings) {
      siblingCache[sibling.nodeIndex] = hexify(toBN(sibling.value))
    }
    const siblings = Array(this.depth).fill(undefined)
    const leafNodeIndex = new BN(1).shln(depth).or(index)
    let pathNodeIndex!: BN
    let siblingNodeIndex!: BN
    for (let level = 0; level < depth; level += 1) {
      pathNodeIndex = leafNodeIndex.shrn(level)
      siblingNodeIndex = new BN(1).xor(pathNodeIndex)
      const cached = siblingCache[hexify(siblingNodeIndex)]
      siblings[level] = cached || this.hasher.preHash[level]
    }
    return siblings
  }

  private async updateLeaf(index: BN, val: SMTLeaf): Promise<BN> {
    const nodesToUpdate: TreeNode[] = []
    const leafNodeIndex = new BN(1).shln(this.depth).or(index)
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
    nodesToUpdate.push({
      treeId: NULLIFIER_TREE_ID,
      nodeIndex: hexify(new BN(1)),
      value: hexify(node),
    })

    // need batch query here..
    for (const node of nodesToUpdate) {
      await this.db.prisma.treeNode.upsert({
        where: {
          treeId_nodeIndex: {
            treeId: node.treeId,
            nodeIndex: node.nodeIndex,
          },
        },
        update: node,
        create: node,
      })
    }

    if (val === SMTLeaf.FILLED) {
      const nullifier: Nullifier = {
        index: hexify(index),
        nullified: true,
      }
      await this.db.prisma.nullifier.upsert({
        where: {
          index: nullifier.index,
        },
        create: nullifier,
        update: nullifier,
      })
    } else {
      await this.db.prisma.nullifier.deleteMany({
        where: { index: hexify(index) },
      })
    }
    this.rootNode = node
    return this.rootNode
  }

  async dryRunNullify(...leaves: BN[]): Promise<BN> {
    let result!: BN
    await this.lock.acquire('root', async () => {
      const prevRoot = await this.root()
      for (const leaf of leaves) {
        await this.updateLeaf(leaf, SMTLeaf.FILLED)
      }
      result = await this.root()
      for (const leaf of leaves) {
        await this.updateLeaf(leaf, SMTLeaf.EMPTY)
      }
      if (!(await this.root()).eq(prevRoot))
        throw Error('Dry run should not make any change')
    })
    return result
  }
}
