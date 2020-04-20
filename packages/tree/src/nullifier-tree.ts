import { InanoSQLInstance } from '@nano-sql/core'
import { Field } from '@zkopru/babyjubjub'
import { schema, TreeNodeSql } from '@zkopru/database'
import AsyncLock from 'async-lock'
import BN from 'bn.js'
import { Hasher, genesisRoot } from './hasher'
import { verifyProof, MerkleProof } from './merkle-proof'

export interface SMT {
  depth: number
  hasher: Hasher
  root(): Promise<Field>
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

  rootNode!: Field

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

  async root(): Promise<Field> {
    if (this.rootNode) return this.rootNode
    const stored = (
      await this.db
        .selectTable(schema.nullifierTreeNode.name)
        .presetQuery('getRoot')
        .exec()
    )[0] as TreeNodeSql
    if (stored) return Field.from(stored.value)
    return genesisRoot(this.hasher)
  }

  async getInclusionProof(index: Field): Promise<MerkleProof> {
    let siblings!: Field[]
    let merkleProof!: MerkleProof
    await this.lock.acquire('root', async () => {
      siblings = await this.getSiblings(index)
      merkleProof = {
        root: await this.root(),
        index,
        leaf: Field.from(SMTLeaf.FILLED),
        siblings,
      }
    })
    if (!verifyProof(this.hasher, merkleProof)) {
      throw Error('Generated invalid proof')
    }
    return merkleProof
  }

  async getNonInclusionProof(index: Field): Promise<MerkleProof> {
    let siblings!: Field[]
    let merkleProof!: MerkleProof
    await this.lock.acquire('root', async () => {
      siblings = await this.getSiblings(index)
      merkleProof = {
        root: await this.root(),
        index,
        leaf: Field.from(SMTLeaf.EMPTY),
        siblings,
      }
    })

    if (!verifyProof(this.hasher, merkleProof)) {
      throw Error('Generated invalid proof')
    }
    return merkleProof
  }

  async nullify(blockHash: string, ...leaves: Field[]): Promise<Field> {
    let result: Field = this.rootNode
    await this.lock.acquire('root', async () => {
      for (const leaf of leaves) {
        result = await this.updateLeaf(leaf, SMTLeaf.FILLED, blockHash)
      }
    })
    return result
  }

  async recover(blockHash: string, ...leaves: Field[]) {
    await this.lock.acquire('root', async () => {
      for (const leaf of leaves) {
        await this.updateLeaf(leaf, SMTLeaf.EMPTY, blockHash)
      }
    })
  }

  private async getSiblings(index: Field): Promise<Field[]> {
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
      siblingCache[sibling.nodeIndex] = Field.from(sibling.value)
    }

    const siblings = Array(this.depth).fill(undefined)
    const leafNodeIndex = index.addPrefixBit(depth)
    let pathNodeIndex!: BN
    let siblingNodeIndex!: BN
    for (let level = 0; level < depth; level += 1) {
      pathNodeIndex = leafNodeIndex.shrn(level)
      siblingNodeIndex = new BN(1).xor(pathNodeIndex)
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
    const leafNodeIndex = index.addPrefixBit(this.depth)
    const siblings = await this.getSiblings(index)
    let node = Field.from(val)
    let pathIndex: BN
    let hasRightSibling: boolean
    for (let level = 0; level < this.depth; level += 1) {
      pathIndex = leafNodeIndex.shrn(level)
      nodesToUpdate.push({
        nodeIndex: Field.from(pathIndex).toHex(),
        value: node.toHex(),
      })
      hasRightSibling = pathIndex.isEven()
      if (hasRightSibling) {
        node = this.hasher.parentOf(node, siblings[level])
      } else {
        node = this.hasher.parentOf(siblings[level], node)
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
    this.rootNode = node
    return this.rootNode
  }

  async dryRunNullify(...leaves: Field[]): Promise<Field> {
    let result!: Field
    await this.lock.acquire('root', async () => {
      const prevRoot = Field.from(await this.root())
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
