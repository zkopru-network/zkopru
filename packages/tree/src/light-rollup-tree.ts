import { InanoSQLInstance } from '@nano-sql/core'
import { Field } from '@zkopru/babyjubjub'
import { TreeNodeSql, NoteSql } from '@zkopru/database'
import bigInt, { BigInteger } from 'big-integer'
import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'
import { Note } from '@zkopru/transaction'
import { Hasher } from './hasher'
import { MerkleProof, startingLeafProof } from './merkle-proof'

export interface Item {
  leafHash: Field
  note?: Note
}

export interface TreeMetadata {
  id: string
  index: number
  zkopruId: string
  start: Field
  end: Field
}

export interface TreeData {
  root: Field
  index: Field
  siblings: Field[]
}

export interface TreeConfig {
  hasher: Hasher
  forceUpdate?: boolean
  fullSync?: boolean
}

export abstract class LightRollUpTree {
  db: InanoSQLInstance

  itemSchema: InanoSQLTableConfig

  treeSchema: InanoSQLTableConfig

  treeNodeSchema: InanoSQLTableConfig // merkle-proof-cache-schema

  config: TreeConfig

  metadata: TreeMetadata

  data: TreeData

  constructor({
    db,
    metadata,
    itemSchema,
    treeSchema,
    treeNodeSchema,
    data,
    config,
  }: {
    db: InanoSQLInstance
    metadata: TreeMetadata
    itemSchema: InanoSQLTableConfig
    treeSchema: InanoSQLTableConfig
    treeNodeSchema: InanoSQLTableConfig
    data: TreeData
    config: TreeConfig
  }) {
    this.db = db
    this.metadata = metadata
    this.data = data
    this.config = config
    this.itemSchema = itemSchema
    this.treeNodeSchema = treeNodeSchema
    this.treeSchema = treeSchema
    if (!metadata.id) throw Error('UUID is not defined')
  }

  root(): Field {
    return Field.from(this.data.root)
  }

  depth(): number {
    return this.data.siblings.length
  }

  maxSize(): Field {
    return Field.from(bigInt.one.shiftLeft(this.depth()))
  }

  latestLeafIndex(): Field {
    return this.data.index
  }

  siblings(): Field[] {
    return [...this.data.siblings]
  }

  async merkleProof({
    hash,
    index,
  }: {
    hash: string
    index: string
  }): Promise<MerkleProof> {
    const depth = this.depth()
    const cachedSiblings = await this.db
      .selectTable(this.treeNodeSchema.name)
      .presetQuery('getSiblings', {
        depth,
        index,
      })
      .exec()

    const siblingCache = {}
    for (const sibling of cachedSiblings) {
      siblingCache[sibling.nodeIndex] = Field.from(sibling.value)
    }

    if (this.metadata.start?.gt(index) || this.metadata.end?.lte(index)) {
      throw Error('not in range')
    }

    const siblings = Array(depth).fill(undefined)
    const leafNodeIndex = Field.from(index).val.or(bigInt.one.shiftRight(depth))
    let pathNodeIndex!: BigInteger
    let siblingNodeIndex!: BigInteger
    for (let level = 0; level < depth; level += 1) {
      pathNodeIndex = leafNodeIndex.shiftRight(level)
      siblingNodeIndex = pathNodeIndex.xor(1)

      if (siblingNodeIndex.gt(this.metadata.end.val.shiftRight(level))) {
        // should return pre hashed zero
        siblings[level] = this.config.hasher.preHash[level]
      } else {
        // should find the node value
        siblings[level] = siblingCache[Field.from(siblingNodeIndex).toHex()]
        if (siblings[level] === undefined)
          throw Error(
            'Sibling was not cached. Make sure you added your public key before scanning',
          )
      }
    }
    const root = this.root()
    return { root, index: Field.from(index), leaf: Field.from(hash), siblings }
  }

  async append(...items: Item[]) {
    const start = this.latestLeafIndex()
    const depth = this.depth()
    const latestSiblings = this.siblings()
    const cachedNodes: TreeNodeSql[] = []
    const itemAppendingQuery: NoteSql[] = []
    let root!: Field

    const trackingLeaves: Field[] = await this.indexesOfTrackingLeaves()

    let index = start
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      index = start.add(i)
      // if note exists, save the data and mark as an item to keep tracking
      if (this.config.fullSync || items[i].note) {
        itemAppendingQuery.push({
          hash: item.leafHash.toHex(),
          tree: this.metadata.id,
          index: index.toHex(),
          eth: item.note?.eth.toHex(),
          pubKey: item.note?.pubKey.toHex(),
          salt: item.note?.salt.toHex(),
          tokenAddr: item.note?.tokenAddr.toHex(),
          erc20Amount: item.note?.erc20Amount.toHex(),
          nft: item.note?.nft.toHex(),
        })
      }

      if (items[i].note) {
        trackingLeaves.push(index)
      }

      // udpate the latest siblings and save the intermediate value if it needs to be tracked
      const leafIndex = index.val.or(bigInt.one.shiftRight(depth))
      let node = item.leafHash
      let hasRightSibling!: boolean
      for (let level = 0; level < depth; level += 1) {
        const pathIndex = leafIndex.shiftRight(level)
        hasRightSibling = pathIndex.and(1).isZero()
        if (
          this.config.fullSync ||
          this.shouldTrack(trackingLeaves, pathIndex)
        ) {
          cachedNodes.push({
            nodeIndex: Field.from(pathIndex).toHex(),
            value: node.toHex(),
          })
        }
        if (
          this.config.fullSync ||
          (this.shouldTrack(trackingLeaves, pathIndex.xor(1)) &&
            !hasRightSibling)
        ) {
          // if this should track the sibling node which is not a pre-hashed zero
          cachedNodes.push({
            nodeIndex: Field.from(pathIndex.xor(1)).toHex(),
            value: latestSiblings[level].toHex(),
          })
        }
        if (hasRightSibling) {
          // right empty sibling
          latestSiblings[level] = node // current node will be the next merkle proof's left sibling
          node = this.config.hasher.parentOf(
            node,
            this.config.hasher.preHash[level],
          )
        } else {
          // left sibling
          // keep current sibling
          node = this.config.hasher.parentOf(latestSiblings[level], node)
        }
      }
      // update root
      root = node
    }
    // update the latest siblings
    this.data = {
      root,
      index,
      siblings: latestSiblings,
    }
    // Update database
    await this.db
      .selectTable(this.treeSchema.name)
      .presetQuery('updateTree', {
        id: this.metadata.id,
        data: {
          root: root.toHex(),
          index: index.toHex(),
          siblings: latestSiblings.map(sib => sib.toHex()),
        },
      })
      .exec()

    await this.db
      .selectTable(this.itemSchema.name)
      .query('upsert', itemAppendingQuery)
      .exec()
    await this.db
      .selectTable(this.treeNodeSchema.name)
      .query('upsert', cachedNodes)
      .exec()
  }

  async dryAppend(
    ...items: Item[]
  ): Promise<{
    root: Field
    index: Field
    siblings: Field[]
  }> {
    const start = this.latestLeafIndex()
    const depth = this.depth()
    const latestSiblings = this.siblings()
    let root!: Field

    let index = start
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      index = start.add(i)
      // if note exists, save the data and mark as an item to keep tracking
      // udpate the latest siblings and save the intermediate value if it needs to be tracked
      const leafIndex = index.val.or(bigInt.one.shiftRight(depth))
      let node = item.leafHash
      let hasRightSibling!: boolean
      for (let level = 0; level < depth; level += 1) {
        const pathIndex = leafIndex.shiftRight(level)
        hasRightSibling = pathIndex.and(1).isZero()
        if (hasRightSibling) {
          // right empty sibling
          latestSiblings[level] = node // current node will be the next merkle proof's left sibling
          node = this.config.hasher.parentOf(
            node,
            this.config.hasher.preHash[level],
          )
        } else {
          // left sibling
          // keep current sibling
          node = this.config.hasher.parentOf(latestSiblings[level], node)
        }
      }
      // update root
      root = node
    }
    // update the latest siblings
    return {
      root,
      index,
      siblings: latestSiblings,
    }
  }

  static async initTreeFromDatabase({
    db,
    treeSchema,
    metadata,
    data,
    config,
  }: {
    db: InanoSQLInstance
    treeSchema: InanoSQLTableConfig
    metadata: TreeMetadata
    data: TreeData
    config: TreeConfig
  }): Promise<{
    db: InanoSQLInstance
    metadata: TreeMetadata
    data: TreeData
    config: TreeConfig
  }> {
    // Check the data has a valid merkle proof
    if (
      !startingLeafProof(config.hasher, data.root, data.index, data.siblings)
    ) {
      throw Error('bootstrapped with invalid merkle proof')
    }
    // If it does not have force update config, check existing merkle tree
    const existingTreeQuery = await db
      .selectTable(treeSchema.name)
      .presetQuery('getTree', { index: metadata.index })
      .exec()
    if (!config.forceUpdate) {
      if (
        existingTreeQuery.length > 0 &&
        data.index.lte(existingTreeQuery[0].data.index)
      ) {
        throw Error('Bootstrap is behind the database. Use forceUpdate config')
      }
    }

    // Create or update the merkle tree using the "bootstrapTree" preset query
    const queryResult = await db
      .selectTable(treeSchema.name)
      .presetQuery('bootstrapTree', {
        id: existingTreeQuery.length > 0 ? existingTreeQuery[0].id : undefined,
        index: metadata.index,
        zkopru: metadata.zkopruId,
        data: {
          root: data.root.toHex(),
          index: data.index.toHex(),
          siblings: data.siblings.map(f => f.toHex()),
        },
      })
      .exec()
    const { id, start, end } = queryResult[0]
    // Return tree object
    return {
      db,
      metadata: {
        ...metadata,
        id,
        start: Field.from(start),
        end: Field.from(end),
      },
      data,
      config,
    }
  }

  /**
   * It returns true when the given node is a sibling of any leaf to keep tracking
   * @param nodeIndex Tree node's index
   */
  private shouldTrack(trackingLeaves: Field[], nodeIndex: BigInteger): boolean {
    const depth = this.depth()
    let leafIndex: bigInt.BigInteger
    let pathIndex: bigInt.BigInteger
    for (const leaf of trackingLeaves) {
      leafIndex = leaf.val.or(bigInt.one.shiftLeft(depth))
      pathIndex = leafIndex.shiftRight(
        leafIndex.bitLength().subtract(nodeIndex.bitLength()),
      )
      // if the node is one of the sibling for the leaf proof return true
      if (pathIndex.xor(nodeIndex).eq(1)) return true
    }
    return false
  }

  abstract async indexesOfTrackingLeaves(): Promise<Field[]>
}
