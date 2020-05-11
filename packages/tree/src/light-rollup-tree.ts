/* eslint-disable no-underscore-dangle */
import { InanoSQLInstance } from '@nano-sql/core'
import { Field } from '@zkopru/babyjubjub'
import { TreeNodeSql, NoteSql } from '@zkopru/database'
import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'
import AsyncLock from 'async-lock'
import { Note } from '@zkopru/transaction'
import BN from 'bn.js'
import { toBN } from 'web3-utils'
import { hexify } from '@zkopru/utils'
import { Hasher } from './hasher'
import { MerkleProof, startingLeafProof } from './merkle-proof'

export interface Item<T extends Field | BN> {
  leafHash: T
  note?: Note
}

export interface TreeMetadata<T extends Field | BN> {
  id: string
  index: number
  zkopruId: string
  start: T
  end: T
}

export interface TreeData<T extends Field | BN> {
  root: T
  index: T
  siblings: T[]
}

export interface TreeConfig<T extends Field | BN> {
  hasher: Hasher<T>
  forceUpdate?: boolean
  fullSync?: boolean
}

export abstract class LightRollUpTree<T extends Field | BN> {
  zero?: T

  db: InanoSQLInstance

  itemSchema: InanoSQLTableConfig

  treeSchema: InanoSQLTableConfig

  treeNodeSchema: InanoSQLTableConfig // merkle-proof-cache-schema

  config: TreeConfig<T>

  metadata: TreeMetadata<T>

  data: TreeData<T>

  depth: number

  lock: AsyncLock

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
    metadata: TreeMetadata<T>
    itemSchema: InanoSQLTableConfig
    treeSchema: InanoSQLTableConfig
    treeNodeSchema: InanoSQLTableConfig
    data: TreeData<T>
    config: TreeConfig<T>
  }) {
    this.lock = new AsyncLock()
    this.db = db
    this.metadata = metadata
    this.data = data
    this.config = config
    this.itemSchema = itemSchema
    this.treeNodeSchema = treeNodeSchema
    this.treeSchema = treeSchema
    this.depth = data.siblings.length
  }

  root(): T {
    return this.data.root
  }

  maxSize(): BN {
    return new BN(1).shln(this.depth)
  }

  latestLeafIndex(): T {
    return this.data.index
  }

  siblings(): T[] {
    return [...this.data.siblings]
  }

  async merkleProof({
    hash,
    index,
  }: {
    hash: T
    index?: T
  }): Promise<MerkleProof<T>> {
    let proof!: MerkleProof<T>
    await this.lock.acquire('root', async () => {
      proof = await this._merkleProof({ hash, index })
    })
    return proof
  }

  async append(
    ...items: Item<T>[]
  ): Promise<{
    root: T
    index: T
    siblings: T[]
  }> {
    let result!: {
      root: T
      index: T
      siblings: T[]
    }
    await this.lock.acquire('root', async () => {
      result = await this._append(...items)
    })
    return result
  }

  async dryAppend(
    ...items: Item<T>[]
  ): Promise<{
    root: T
    index: T
    siblings: T[]
  }> {
    let start!: T
    let latestSiblings!: T[]
    await this.lock.acquire('root', async () => {
      start = this.latestLeafIndex()
      latestSiblings = this.siblings()
    })
    let root!: T

    let index = start
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      // if note exists, save the data and mark as an item to keep tracking
      // udpate the latest siblings and save the intermediate value if it needs to be tracked
      const leafIndex = new BN(1).shln(this.depth).or(index)
      let node = item.leafHash
      let hasRightSibling!: boolean
      for (let level = 0; level < this.depth; level += 1) {
        const pathIndex = leafIndex.shrn(level)
        hasRightSibling = pathIndex.and(new BN(1)).isZero()
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
      // update index
      if (this.zero instanceof Field) {
        index = Field.from(index.addn(1)) as T
      } else {
        index = index.addn(1) as T
      }
    }
    // update the latest siblings
    return {
      root,
      index,
      siblings: latestSiblings,
    }
  }

  getStartingLeafProof(): {
    root: T
    index: T
    siblings: T[]
  } {
    const index = this.latestLeafIndex()
    const siblings: T[] = [...this.data.siblings]
    let path: BN = index
    for (let i = 0; i < this.depth; i += 1) {
      if (path.isEven()) {
        siblings[i] = this.config.hasher.preHash[i]
      }
      path = path.shrn(1)
    }
    return {
      root: this.root(),
      index,
      siblings,
    }
  }

  private async _merkleProof({
    hash,
    index,
  }: {
    hash: T
    index?: T
  }): Promise<MerkleProof<T>> {
    let leafIndex: T
    if (index) {
      leafIndex = index
    } else {
      const indexes = await this.db
        .selectTable(this.treeNodeSchema.name)
        .query('select')
        .where(['value', '=', hexify(hash)])
        .exec()
      if (indexes.length === 0) throw Error('Leaf does not exist.')
      else if (indexes.length > 1)
        throw Error('Multiple leaves exist for same hash.')
      else {
        const leafNodeIndex: BN = toBN(indexes[0].nodeIndex)
        const prefix = new BN(1).shln(this.depth)
        if (this.zero instanceof Field) {
          leafIndex = Field.from(leafNodeIndex.xor(prefix)) as T
        } else {
          leafIndex = leafNodeIndex.xor(prefix) as T
        }
      }
    }
    const cachedSiblings = await this.db
      .selectTable(this.treeNodeSchema.name)
      .presetQuery('getSiblings', {
        depth: this.depth,
        index: leafIndex,
      })
      .exec()

    const siblingCache = {}
    for (const sibling of cachedSiblings) {
      siblingCache[sibling.nodeIndex] = hexify(toBN(sibling.value))
    }

    if (
      this.metadata.start?.gt(leafIndex) ||
      this.metadata.end?.lte(leafIndex)
    ) {
      throw Error('not in range')
    }

    const siblings = Array(this.depth).fill(undefined)
    const leafNodeIndex = new BN(1).shln(this.depth).or(leafIndex)
    let pathNodeIndex!: BN
    let siblingNodeIndex!: BN
    for (let level = 0; level < this.depth; level += 1) {
      pathNodeIndex = leafNodeIndex.shrn(level)
      siblingNodeIndex = new BN(1).xor(pathNodeIndex)
      const usePreHashed: boolean = siblingNodeIndex.gt(
        new BN(1)
          .shln(this.depth)
          .or(this.metadata.end)
          .shrn(level),
      )
      if (usePreHashed) {
        // should return pre hashed zero
        siblings[level] = this.config.hasher.preHash[level]
      } else {
        // should find the node value
        const cached = siblingCache[hexify(siblingNodeIndex)]
        if (this.zero instanceof Field) {
          siblings[level] = Field.from(cached)
        } else {
          siblings[level] = toBN(cached)
        }
        if (siblings[level] === undefined)
          throw Error(
            'Sibling was not cached. Make sure you added your public key before scanning',
          )
      }
    }
    const root = this.root()
    return {
      root,
      index: leafIndex,
      leaf: hash,
      siblings,
    }
  }

  private async _append(
    ...items: Item<T>[]
  ): Promise<{
    root: T
    index: T
    siblings: T[]
  }> {
    const start = this.latestLeafIndex()
    const latestSiblings = this.siblings()
    const cached: {
      [nodeIndex: string]: string
    } = {}
    const itemAppendingQuery: NoteSql[] = []
    let root: T = this.root()

    const trackingLeaves: T[] = await this.indexesOfTrackingLeaves()

    let index = start
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      // if note exists, save the data and mark as an item to keep tracking
      if (this.config.fullSync || items[i].note) {
        itemAppendingQuery.push({
          hash: hexify(item.leafHash),
          tree: this.metadata.id,
          index: hexify(index),
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
      const leafNodeIndex = new BN(1).shln(this.depth).or(index)
      let node = item.leafHash
      let hasRightSibling!: boolean
      for (let level = 0; level < this.depth; level += 1) {
        const pathIndex = leafNodeIndex.shrn(level)
        hasRightSibling = pathIndex.isEven()
        if (
          this.config.fullSync ||
          this.shouldTrack(trackingLeaves, pathIndex)
        ) {
          cached[`0x${pathIndex.toString('hex')}`] = hexify(node)
        }

        if (index.gtn(0)) {
          // store nodes when if the previous sibling set has a node on the tracking path,
          // because the latest siblings are going to be updated.
          const prevIndexPath = new BN(1).shln(this.depth).or(index.subn(1))
          const prevPathIndex = prevIndexPath.shrn(level)
          const prevSibIndex = new BN(1).xor(prevPathIndex)
          if (
            prevSibIndex.isEven() &&
            (this.config.fullSync ||
              this.shouldTrack(trackingLeaves, prevSibIndex))
          ) {
            // if this should track the sibling node which is not a pre-hashed zero
            cached[`0x${prevSibIndex.toString('hex')}`] = `0x${latestSiblings[
              level
            ].toString('hex')}`
          }
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
      // increment index
      if (this.zero instanceof Field) {
        index = Field.from(index.addn(1)) as T
      } else {
        index = index.addn(1) as T
      }
    }
    // update the latest siblings
    this.data = {
      root,
      index,
      siblings: latestSiblings,
    }
    this.metadata.end = index
    // Update database
    await this.db
      .selectTable(this.treeSchema.name)
      .presetQuery('updateTree', {
        id: this.metadata.id,
        data: {
          root: hexify(root),
          index: hexify(index),
          siblings: latestSiblings.map(hexify),
        },
      })
      .exec()
    await this.db
      .selectTable(this.itemSchema.name)
      .query('upsert', itemAppendingQuery)
      .exec()
    const cachedNodes: TreeNodeSql[] = Object.keys(cached).map(nodeIndex => ({
      nodeIndex,
      value: cached[nodeIndex],
    }))
    await this.db
      .selectTable(this.treeNodeSchema.name)
      .query('delete')
      .where(['nodeIndex', 'IN', Object.keys(cached)])
      .exec()
    await this.db
      .selectTable(this.treeNodeSchema.name)
      .query('upsert', cachedNodes)
      .exec()
    return {
      root,
      index,
      siblings: latestSiblings,
    }
  }

  static async initTreeFromDatabase<T extends Field | BN>({
    db,
    treeSchema,
    metadata,
    data,
    config,
  }: {
    db: InanoSQLInstance
    treeSchema: InanoSQLTableConfig
    metadata: TreeMetadata<T>
    data: TreeData<T>
    config: TreeConfig<T>
  }): Promise<{
    db: InanoSQLInstance
    metadata: TreeMetadata<T>
    data: TreeData<T>
    config: TreeConfig<T>
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
          root: hexify(data.root),
          index: hexify(data.index),
          siblings: data.siblings.map(hexify),
        },
      })
      .exec()
    const { id, start, end } = queryResult[0]
    // Return tree object
    let _start: T
    let _end: T
    if (metadata.start instanceof Field) {
      _start = Field.from(start) as T
      _end = Field.from(end) as T
    } else {
      _start = toBN(start) as T
      _end = toBN(end) as T
    }
    return {
      db,
      metadata: {
        ...metadata,
        id,
        start: _start,
        end: _end,
      },
      data,
      config,
    }
  }

  /**
   * It returns true when the given node is a sibling of any leaf to keep tracking
   * @param nodeIndex Tree node's index
   */
  private shouldTrack(trackingLeaves: T[], nodeIndex: BN): boolean {
    let leafIndex: BN
    let pathIndex: BN
    for (const leaf of trackingLeaves) {
      leafIndex = new BN(1).shln(this.depth).or(leaf)
      pathIndex = leafIndex.shrn(leafIndex.bitLength() - nodeIndex.bitLength())
      // if the node is one of the sibling for the leaf proof return true
      if (pathIndex.xor(nodeIndex).eqn(1)) return true
    }
    return false
  }

  abstract async indexesOfTrackingLeaves(): Promise<T[]>
}
