import { InanoSQLInstance } from '@nano-sql/core'
import { Field } from '@zkopru/babyjubjub'
import { schema, TreeNodeSql } from '@zkopru/database'
import AsyncLock from 'async-lock'
import BN from 'bn.js'
import { toBN } from 'web3-utils'
import { hexify } from '@zkopru/utils'
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
  readonly db: InanoSQLInstance

  readonly zkopruId: string

  readonly depth: number

  readonly hasher: Hasher<BN>

  lock: AsyncLock

  rootNode!: BN

  constructor({
    db,
    hasher,
    zkopruId,
    depth,
  }: {
    db: InanoSQLInstance
    hasher: Hasher<BN>
    zkopruId: string
    depth: number
  }) {
    this.lock = new AsyncLock()
    this.db = db
    this.hasher = hasher
    this.zkopruId = zkopruId
    this.depth = depth
    if (hasher.preHash.length < depth)
      throw Error('Hasher should have enough prehased values')
  }

  async root(): Promise<BN> {
    if (this.rootNode) return this.rootNode
    const stored = (
      await this.db
        .selectTable(schema.nullifierTreeNode.name)
        .presetQuery('getRoot')
        .exec()
    )[0] as TreeNodeSql
    if (stored) return toBN(stored.value)
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

  async nullify(blockHash: string, ...leaves: BN[]): Promise<BN> {
    let result: BN = this.rootNode
    await this.lock.acquire('root', async () => {
      for (const leaf of leaves) {
        result = await this.updateLeaf(leaf, SMTLeaf.FILLED, blockHash)
      }
    })
    return result
  }

  async recover(blockHash: string, ...leaves: BN[]) {
    await this.lock.acquire('root', async () => {
      for (const leaf of leaves) {
        await this.updateLeaf(leaf, SMTLeaf.EMPTY, blockHash)
      }
    })
  }

  private async getSiblings(index: BN): Promise<BN[]> {
    const { depth } = this
    const cachedSiblings = await this.db
      .selectTable(schema.nullifierTreeNode.name)
      .presetQuery('getSiblings', {
        depth,
        index,
      })
      .exec()

    const siblingCache = {}
    for (const sibling of cachedSiblings) {
      siblingCache[sibling.nodeIndex] = toBN(sibling.value)
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

  private async updateLeaf(
    index: BN,
    val: SMTLeaf,
    blockHash: string,
  ): Promise<BN> {
    const nodesToUpdate: TreeNodeSql[] = []
    const leafNodeIndex = new BN(1).shln(this.depth).or(index)
    const siblings = await this.getSiblings(index)
    let node = new BN(val)
    let pathIndex: BN
    let hasRightSibling: boolean
    for (let level = 0; level < this.depth; level += 1) {
      pathIndex = leafNodeIndex.shrn(level)
      nodesToUpdate.push({
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
      nodeIndex: hexify(new BN(1)),
      value: hexify(node),
    })
    await this.db
      .selectTable(schema.nullifierTreeNode.name)
      .query('upsert', nodesToUpdate)
      .exec()

    if (val === SMTLeaf.FILLED) {
      await this.db
        .selectTable(schema.nullifiers.name)
        .presetQuery('nullify', {
          index: hexify(index),
          blockHash,
        })
        .exec()
    } else {
      await this.db
        .selectTable(schema.nullifiers.name)
        .presetQuery('recover', {
          blockHash,
        })
        .exec()
    }
    this.rootNode = node
    return this.rootNode
  }

  async dryRunNullify(...leaves: BN[]): Promise<BN> {
    let result!: BN
    await this.lock.acquire('root', async () => {
      const prevRoot = await this.root()
      for (const leaf of leaves) {
        await this.updateLeaf(leaf, SMTLeaf.FILLED, 'TEMP')
      }
      result = await this.root()
      for (const leaf of leaves) {
        await this.updateLeaf(leaf, SMTLeaf.EMPTY, 'TEMP')
      }
      if (!(await this.root()).eq(prevRoot))
        throw Error('Dry run should not make any change')
    })
    return result
  }
}
