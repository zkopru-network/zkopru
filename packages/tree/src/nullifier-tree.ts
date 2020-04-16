import { InanoSQLInstance } from '@nano-sql/core'
import { Field } from '@zkopru/babyjubjub'
import bigInt, { BigInteger } from 'big-integer'
import { schema, TreeNodeSql } from '@zkopru/database'
import AsyncLock from 'async-lock'
import { Hasher } from './hasher'
import { verifyProof, MerkleProof } from './merkle-proof'

export interface SMT {
  depth: number
  hasher: Hasher
  root: Field
  getInclusionProof(leaf: Field): Promise<MerkleProof>
  getNonInclusionProof(leaf: Field): Promise<MerkleProof>
  // exist(leaf: Hex): Promise<boolean>;
}

export enum SMTLeaf {
  EMPTY = 0,
  FILLED = 1,
}

export class NullifierTree implements SMT {
  readonly db: InanoSQLInstance

  readonly zkopruId: string

  readonly depth: number

  readonly hasher: Hasher

  lock: AsyncLock

  root!: Field

  constructor({
    db,
    hasher,
    zkopruId,
    depth,
  }: {
    db: InanoSQLInstance
    hasher: Hasher
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

  async getInclusionProof(index: Field): Promise<MerkleProof> {
    let siblings!: Field[]
    await this.lock.acquire('root', async () => {
      siblings = await this.getSiblings(index)
    })
    const merkleProof: MerkleProof = {
      root: this.root,
      index,
      leaf: Field.from(SMTLeaf.FILLED),
      siblings,
    }
    if (!verifyProof(this.hasher, merkleProof)) {
      throw Error('Generated invalid proof')
    }
    return merkleProof
  }

  async getNonInclusionProof(index: Field): Promise<MerkleProof> {
    let siblings!: Field[]
    await this.lock.acquire('root', async () => {
      siblings = await this.getSiblings(index)
    })
    const merkleProof: MerkleProof = {
      root: this.root,
      index,
      leaf: Field.from(SMTLeaf.EMPTY),
      siblings,
    }
    if (!verifyProof(this.hasher, merkleProof)) {
      throw Error('Generated invalid proof')
    }
    return merkleProof
  }

  async nullify(leaves: Field[], blockHash: string) {
    this.lock.acquire('root', async () => {
      for (const leaf of leaves) {
        await this.updateLeaf(leaf, SMTLeaf.FILLED, blockHash)
      }
    })
  }

  async recover(leaves: Field[], blockHash: string) {
    this.lock.acquire('root', async () => {
      for (const leaf of leaves) {
        await this.updateLeaf(leaf, SMTLeaf.EMPTY, blockHash)
      }
    })
  }

  private async getSiblings(index: Field): Promise<Field[]> {
    const { depth } = this
    const cachedSiblings = await this.db
      .selectTable(schema.nullifiers.name)
      .presetQuery('getSiblings', {
        depth,
        index,
      })
      .exec()

    const siblingCache = {}
    for (const sibling of cachedSiblings) {
      siblingCache[sibling.nodeIndex] = Field.from(sibling.value)
    }

    const siblings = Array(this.depth).fill(undefined)
    const leafNodeIndex = Field.from(index).val.or(bigInt.one.shiftRight(depth))
    let pathNodeIndex!: BigInteger
    let siblingNodeIndex!: BigInteger
    for (let level = 0; level < depth; level += 1) {
      pathNodeIndex = leafNodeIndex.shiftRight(level)
      siblingNodeIndex = pathNodeIndex.xor(1)
      const cached = siblingCache[Field.from(siblingNodeIndex).toHex()]
      siblings[level] = cached || this.hasher.preHash[level]
    }
    return siblings
  }

  private async updateLeaf(
    index: Field,
    val: SMTLeaf,
    blockHash: string,
  ): Promise<Field> {
    const nodesToUpdate: TreeNodeSql[] = []
    const leafIndex = index.val.or(bigInt.one.shiftRight(this.depth))
    const siblings = await this.getSiblings(index)
    let node = Field.from(val)
    let pathIndex: BigInteger
    let hasRightSibling: boolean
    for (let level = 0; level < this.depth; level += 1) {
      pathIndex = leafIndex.shiftRight(level)
      nodesToUpdate.push({
        nodeIndex: Field.from(pathIndex).toHex(),
        value: node.toHex(),
      })
      hasRightSibling = pathIndex.and(1).isZero()
      if (hasRightSibling) {
        node = this.hasher.parentOf(siblings[level], node)
      } else {
        node = this.hasher.parentOf(node, siblings[level])
      }
    }
    nodesToUpdate.push({
      nodeIndex: Field.from(1).toHex(),
      value: node.toHex(),
    })
    await this.db
      .selectTable(schema.nullifierTreeNode.name)
      .query('upsert', nodesToUpdate)
      .exec()

    if (val === SMTLeaf.FILLED) {
      await this.db
        .selectTable(schema.nullifiers.name)
        .presetQuery('nullify', {
          index: index.toHex(),
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
    this.root = node
    return this.root
  }

  async dryRunNullify(...leaves: Field[]): Promise<Field> {
    let result!: Field
    const prevRoot = Field.from(this.root)
    this.lock.acquire('root', async () => {
      for (const leaf of leaves) {
        await this.updateLeaf(leaf, SMTLeaf.FILLED, 'TEMP')
      }
      result = this.root
      for (const leaf of leaves) {
        await this.updateLeaf(leaf, SMTLeaf.EMPTY, 'TEMP')
      }
    })
    if (!this.root.equal(prevRoot))
      throw Error('Dry run should not make any change')
    return result
  }
}
